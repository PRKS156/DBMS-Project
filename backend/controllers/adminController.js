const prisma = require('../config/db.js');

exports.getAllData = async (req, res) => {
    try {
        const totalDoctors = await prisma.doctorProfile.count();
        const availableDoctors = await prisma.doctorProfile.count({ where: { isAvailable: true } });
        const totalPatients = await prisma.patientProfile.count();

        const doctors = await prisma.doctorProfile.findMany({
            include: { user: true },
            orderBy: { id: 'asc' }
        });
        
        const patients = await prisma.patientProfile.findMany({
            include: { user: true },
            orderBy: { id: 'asc' }
        });

        return res.status(200).json({
            success: true,
            stats: {
                totalDoctors,
                availableDoctors,
                busyOrOffDuty: totalDoctors - availableDoctors,
                totalPatients
            },
            doctors: doctors.map(d => ({
                id: d.id,
                userId: d.userId,
                email: d.user.email,
                name: d.fullName,
                phone: d.phoneNumber,
                specialization: d.specialization,
                isAvailable: d.isAvailable
            })),
            patients: patients.map(p => ({
                id: p.id,
                userId: p.userId,
                email: p.user.email,
                name: p.fullName,
                age: p.age,
                gender: p.gender,
                bloodGroup: p.bloodGroup,
                phone: p.phoneNumber
            }))
        });
    } catch (error) {
        console.error("❌ Admin Data Fetch Failure:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch admin data." });
    }
};

exports.deleteDoctor = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);
    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid doctor ID." });
    }

    try {
        let docProfile = await prisma.doctorProfile.findFirst({
            where: { OR: [{ userId: targetId }, { id: targetId }] }
        });

        const userId = docProfile ? docProfile.userId : targetId;
        const docId = docProfile ? docProfile.id : null;

        if (docId) {
            // Nullify doctor reference in dispatch records so history remains consistent
            await prisma.dispatchRecord.updateMany({
                where: { doctorId: docId },
                data: { doctorId: null }
            });
        }

        // Remove any feedbacks submitted by this user
        await prisma.feedback.deleteMany({
            where: { userId }
        });

        // Delete doctor profile if exists
        if (docProfile) {
            await prisma.doctorProfile.deleteMany({
                where: { id: docProfile.id }
            });
        }

        // Delete user account
        await prisma.user.deleteMany({
            where: { id: userId }
        });

        return res.status(200).json({ success: true, message: "Doctor deleted successfully." });
    } catch (error) {
        console.error("❌ Delete doctor failed:", error);
        return res.status(500).json({ success: false, message: "Delete failed.", debug: error.message });
    }
};

exports.deletePatient = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);
    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid patient ID." });
    }

    try {
        let patProfile = await prisma.patientProfile.findFirst({
            where: { OR: [{ userId: targetId }, { id: targetId }] }
        });

        const userId = patProfile ? patProfile.userId : targetId;
        const patId = patProfile ? patProfile.id : null;

        if (patId) {
            // Find all emergency alerts for this patient
            const alerts = await prisma.emergencyAlert.findMany({
                where: { patientId: patId },
                select: { id: true }
            });
            const alertIds = alerts.map(a => a.id);

            if (alertIds.length > 0) {
                // Find associated dispatch records
                const dispatches = await prisma.dispatchRecord.findMany({
                    where: { alertId: { in: alertIds } },
                    select: { id: true }
                });
                const dispatchIds = dispatches.map(d => d.id);

                if (dispatchIds.length > 0) {
                    // Delete feedbacks associated with these dispatches
                    await prisma.feedback.deleteMany({
                        where: { dispatchRecordId: { in: dispatchIds } }
                    });
                    // Delete dispatch records
                    await prisma.dispatchRecord.deleteMany({
                        where: { id: { in: dispatchIds } }
                    });
                }

                // Delete the alerts
                await prisma.emergencyAlert.deleteMany({
                    where: { id: { in: alertIds } }
                });
            }
        }

        // Delete feedbacks submitted by this user
        await prisma.feedback.deleteMany({
            where: { userId }
        });

        // Delete patient profile
        if (patProfile) {
            await prisma.patientProfile.deleteMany({
                where: { id: patProfile.id }
            });
        }

        // Delete user account
        await prisma.user.deleteMany({
            where: { id: userId }
        });

        return res.status(200).json({ success: true, message: "Patient deleted successfully." });
    } catch (error) {
        console.error("❌ Delete patient failed:", error);
        return res.status(500).json({ success: false, message: "Delete failed.", debug: error.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const dispatches = await prisma.dispatchRecord.findMany({
            include: { alert: true }
        });

        let totalResponseTimeMs = 0;
        let respondedCount = 0;
        const emergencyTypes = {};
        const areaCases = {};

        dispatches.forEach(d => {
            if (d.dispatchedAt && d.alert && d.alert.createdAt) {
                const diff = new Date(d.dispatchedAt) - new Date(d.alert.createdAt);
                if (diff > 0) {
                    totalResponseTimeMs += diff;
                    respondedCount++;
                }
            }

            if (d.alert && d.alert.description) {
                let type, area;
                if (d.alert.description.includes(' | ')) {
                    const parts = d.alert.description.split(' | ');
                    type = parts[0]?.trim();
                    area = parts.slice(1).join(' ').trim();
                } else {
                    // Legacy data fallback
                    type = 'Legacy / Unspecified';
                    area = d.alert.description;
                }

                emergencyTypes[type] = (emergencyTypes[type] || 0) + 1;
                
                // User requested: "only the outdoor locations not indoor" for the area chart
                if (area.includes('Landmark:')) {
                    let areaKey = area.split('Landmark:')[1].trim();
                    areaCases[areaKey] = (areaCases[areaKey] || 0) + 1;
                }
            }
        });

        const avgResponseTimeSeconds = respondedCount > 0 ? Math.round(totalResponseTimeMs / respondedCount / 1000) : 0;
        
        // Format for Recharts
        const typeData = Object.keys(emergencyTypes).map(key => ({ name: key, value: emergencyTypes[key] }));
        const areaData = Object.keys(areaCases).map(key => ({ name: key, cases: areaCases[key] }));

        return res.status(200).json({
            success: true,
            avgResponseTimeSeconds,
            totalAlerts: dispatches.length,
            emergencyTypes: typeData,
            areaCases: areaData
        });
    } catch (error) {
        console.error("❌ Analytics Fetch Failure:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch analytics." });
    }
};