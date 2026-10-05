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
    try {
        await prisma.user.delete({ where: { id: parseInt(id) } });
        return res.status(200).json({ success: true, message: "Doctor deleted." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Delete failed.", debug: error.message });
    }
};

exports.deletePatient = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id: parseInt(id) } });
        return res.status(200).json({ success: true, message: "Patient deleted." });
    } catch (error) {
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
                // description format: "Cardiology | Landmark: Central Park"
                const parts = d.alert.description.split(' | ');
                const type = parts[0]?.trim() || 'Unknown';
                const area = parts.length > 1 ? parts.slice(1).join(' ').trim() : 'Unknown Area';

                emergencyTypes[type] = (emergencyTypes[type] || 0) + 1;
                
                // Group by general area keywords if possible, else use raw
                let areaKey = area.includes('Landmark:') ? area.split('Landmark:')[1].trim() : 'Building/Hospital';
                areaCases[areaKey] = (areaCases[areaKey] || 0) + 1;
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