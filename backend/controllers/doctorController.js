const prisma = require('../config/db.js');

exports.updateLocation = async (req, res) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Location coordinates are required." });
    }

    try {
        await prisma.doctorProfile.update({
            where: { userId: parseInt(id) },
            data: {
                currentLat: parseFloat(latitude),
                currentLng: parseFloat(longitude),
                isAvailable: true // Automatically set available when they update location
            }
        });
        return res.status(200).json({ success: true, message: "Location and availability updated." });
    } catch (error) {
        console.error("❌ Location Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Location update failed.", debug: error.message });
    }
};

exports.setStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Expecting boolean 'isAvailable'

    if (typeof status !== 'boolean') {
        return res.status(400).json({ success: false, message: "Invalid status value. Expected boolean." });
    }

    try {
        await prisma.doctorProfile.update({
            where: { userId: parseInt(id) },
            data: { isAvailable: status }
        });
        return res.status(200).json({ success: true, message: "Status updated." });
    } catch (error) {
        console.error("❌ Status Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Status update failed.", debug: error.message });
    }
};