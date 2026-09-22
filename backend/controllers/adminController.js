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