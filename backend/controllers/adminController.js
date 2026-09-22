const prisma = require('../config/db.js');

exports.getAllData = async (req, res) => {
    try {
        const totalDoctors = await prisma.doctorProfile.count();
        const availableDoctors = await prisma.doctorProfile.count({ where: { isAvailable: true } });
        const totalPatients = await prisma.patientProfile.count();

        return res.status(200).json({
            success: true,
            stats: {
                totalDoctors,
                availableDoctors,
                busyOrOffDuty: totalDoctors - availableDoctors,
                totalPatients
            }
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