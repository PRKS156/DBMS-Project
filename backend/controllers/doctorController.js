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
            where: { userId: targetId }
        });

        if (!docProfile) {
            return res.status(404).json({ success: false, message: "Doctor profile not found." });
        }

        const computedAvailable = docProfile.isOnDuty && !docProfile.isBusy;

        const updated = await prisma.doctorProfile.update({
            where: { id: docProfile.id },
            data: {
                currentLat: lat,
                currentLng: lng,
                lastLocationAt: new Date(),
                isAvailable: computedAvailable,
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
            req.app.locals.io.to('staff').emit('doctorLocation', { doctorId: docProfile.userId, latitude: lat, longitude: lng });
        }

        return res.status(200).json({ success: true, message: "Location telemetry updated.", profile: updated });
    } catch (error) {
        console.error("❌ Location Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Location update failed.", debug: error.message });
    }
};

/**
 * Update doctor's shift duty status (isOnDuty: true / false).
 * Clinicians control isOnDuty. Dispatch transactions control isBusy.
 */
exports.setStatus = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);
    const { status, isActive, isOnDuty } = req.body;
    const resolvedStatus = (typeof status === 'boolean') ? status : ((typeof isActive === 'boolean') ? isActive : ((typeof isOnDuty === 'boolean') ? isOnDuty : null));

    if (resolvedStatus === null) {
        return res.status(400).json({ success: false, message: "Invalid status value. Expected boolean true or false." });
    }

    try {
        let docProfile = null;
        if (!isNaN(targetId)) {
            docProfile = await prisma.doctorProfile.findFirst({
                where: { userId: targetId }
            });
        }
        if (!docProfile && typeof id === 'string') {
            docProfile = await prisma.doctorProfile.findFirst({
                where: { user: { email: id.trim().toLowerCase() } }
            });
        }

        if (!docProfile) {
            return res.status(404).json({ success: false, message: "Doctor profile not found." });
        }

        const computedAvailable = resolvedStatus && !docProfile.isBusy;

        const updateData = {
            isOnDuty: resolvedStatus,
            isAvailable: computedAvailable
        };

        // When activating duty, refresh telemetry heartbeat and ensure coordinates exist
        if (resolvedStatus) {
            updateData.lastLocationAt = new Date();
            if (!docProfile.currentLat || !docProfile.currentLng) {
                updateData.currentLat = 12.9715;
                updateData.currentLng = 79.1585;
            }
        }

        const updated = await prisma.doctorProfile.update({
            where: { id: docProfile.id },
            data: updateData
        });


        if (req.app.locals.io) {
            req.app.locals.io.emit('doctorStatusUpdate', {
                doctorId: docProfile.userId,
                isOnDuty: updated.isOnDuty,
                isBusy: updated.isBusy,
                isAvailable: updated.isAvailable
            });
        }

        return res.status(200).json({
            success: true,
            message: `Duty status updated: ${status ? 'On Duty' : 'Off Duty'}.`,
            isOnDuty: updated.isOnDuty,
            isBusy: updated.isBusy,
            isAvailable: updated.isAvailable
        });
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
            where: { userId: targetId },
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
                isOnDuty: doc.isOnDuty,
                isBusy: doc.isBusy,
                isAvailable: doc.isAvailable,
                isActive: doc.isActive,
                lastLocationAt: doc.lastLocationAt,
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
                isOnDuty: d.isOnDuty,
                isBusy: d.isBusy,
                isAvailable: d.isAvailable,
                isActive: d.isActive,
                lastLocationAt: d.lastLocationAt,
                currentLat: d.currentLat,
                currentLng: d.currentLng
            }))
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch doctors list.", debug: error.message });
    }
};