const prisma = require('../config/db.js');

/**
 * Update doctor's live GPS coordinates and automatically mark them available.
 */
exports.updateLocation = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);
    const { latitude, longitude } = req.body;

    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid doctor ID." });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: "Valid numeric latitude and longitude coordinates are required." });
    }

    try {
        const docProfile = await prisma.doctorProfile.findFirst({
            where: { OR: [{ userId: targetId }, { id: targetId }] }
        });

        if (!docProfile) {
            return res.status(404).json({ success: false, message: "Doctor profile not found." });
        }

        const updated = await prisma.doctorProfile.update({
            where: { id: docProfile.id },
            data: {
                currentLat: lat,
                currentLng: lng,
                lastLocationAt: new Date(),
                isAvailable: true,
                user: { update: { updatedAt: new Date() } }
            }
        });

        // Query active dispatches for isolated room emission (Item 18: Privacy & Data Isolation)
        const activeDispatches = await prisma.dispatchRecord.findMany({
            where: {
                doctorId: docProfile.id,
                alert: { status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] } }
            },
            select: { alertId: true }
        });

        // Emit real-time location update to isolated alert rooms and doctor listener
        if (req.app.locals.io) {
            activeDispatches.forEach(d => {
                req.app.locals.io.to(`alert_${d.alertId}`).emit('doctorLocation', {
                    doctorId: docProfile.userId,
                    latitude: lat,
                    longitude: lng
                });
            });
            req.app.locals.io.emit(`doctorLocation_${docProfile.userId}`, { latitude: lat, longitude: lng });
            req.app.locals.io.emit('doctorLocation', { doctorId: docProfile.userId, latitude: lat, longitude: lng });
        }

        return res.status(200).json({ success: true, message: "Location and availability updated.", profile: updated });
    } catch (error) {
        console.error("❌ Location Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Location update failed.", debug: error.message });
    }
};

/**
 * Update doctor's availability status (on-duty / off-duty).
 */
exports.setStatus = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);
    const { status } = req.body; // Expecting boolean 'isAvailable'

    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid doctor ID." });
    }

    if (typeof status !== 'boolean') {
        return res.status(400).json({ success: false, message: "Invalid status value. Expected boolean true or false." });
    }

    try {
        const docProfile = await prisma.doctorProfile.findFirst({
            where: { OR: [{ userId: targetId }, { id: targetId }] }
        });

        if (!docProfile) {
            return res.status(404).json({ success: false, message: "Doctor profile not found." });
        }

        const updated = await prisma.doctorProfile.update({
            where: { id: docProfile.id },
            data: { isAvailable: status }
        });

        return res.status(200).json({ success: true, message: "Duty status updated.", isAvailable: updated.isAvailable });
    } catch (error) {
        console.error("❌ Status Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Status update failed.", debug: error.message });
    }
};

/**
 * Fetch individual doctor profile by userId or profile ID.
 */
exports.getDoctorProfile = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);

    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid doctor ID." });
    }

    try {
        const doc = await prisma.doctorProfile.findFirst({
            where: { OR: [{ userId: targetId }, { id: targetId }] },
            include: { user: { select: { id: true, email: true, createdAt: true } } }
        });

        if (!doc) {
            return res.status(404).json({ success: false, message: "Doctor profile not found." });
        }

        return res.status(200).json({
            success: true,
            doctor: {
                id: doc.id,
                userId: doc.userId,
                email: doc.user.email,
                name: doc.fullName,
                phone: doc.phoneNumber,
                specialization: doc.specialization,
                isAvailable: doc.isAvailable,
                currentLat: doc.currentLat,
                currentLng: doc.currentLng
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch doctor profile.", debug: error.message });
    }
};

/**
 * List all registered doctors with availability.
 */
exports.getAllDoctors = async (req, res) => {
    try {
        const doctors = await prisma.doctorProfile.findMany({
            include: { user: { select: { email: true } } },
            orderBy: { id: 'asc' }
        });

        return res.status(200).json({
            success: true,
            doctors: doctors.map(d => ({
                id: d.id,
                userId: d.userId,
                email: d.user.email,
                name: d.fullName,
                phone: d.phoneNumber,
                specialization: d.specialization,
                isAvailable: d.isAvailable,
                currentLat: d.currentLat,
                currentLng: d.currentLng
            }))
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch doctors list.", debug: error.message });
    }
};