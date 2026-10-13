const prisma = require('../config/db.js');

// Haversine distance formula in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

exports.triggerAlert = async (req, res) => {
    const { patientId, latitude, longitude, requiredSpecialization, floor, roomNumber, bedNumber, locationType, landmark } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: "Missing or invalid GPS coordinates." });
    }

    try {
        let isFallback = false;

        // Fetch all available doctors
        let availableDoctors = await prisma.doctorProfile.findMany({
            where: { isAvailable: true, currentLat: { not: null }, currentLng: { not: null } }
        });

        if (availableDoctors.length === 0) {
            return res.status(200).json({ success: false, message: "No physicians are currently available." });
        }

        // Compute distances
        let doctorsWithDistance = availableDoctors.map(doc => {
            return {
                ...doc,
                distance_meters: getDistance(lat, lng, doc.currentLat, doc.currentLng)
            };
        });

        // Try finding a specialist first
        let closestDoctor = null;
        if (requiredSpecialization && requiredSpecialization !== 'Unsure / General') {
            const specialists = doctorsWithDistance.filter(d => d.specialization === requiredSpecialization);
            if (specialists.length > 0) {
                specialists.sort((a, b) => a.distance_meters - b.distance_meters);
                closestDoctor = specialists[0];
            }
        }

        // Fallback to closest general available doctor
        if (!closestDoctor) {
            isFallback = true;
            doctorsWithDistance.sort((a, b) => a.distance_meters - b.distance_meters);
            closestDoctor = doctorsWithDistance[0];
        }

        if (!closestDoctor) {
            return res.status(200).json({ success: false, message: "No physicians are currently available in your area." });
        }

        // Get actual PatientProfile ID based on the userId passed in (if valid)
        let patientProfileId = null;
        if (patientId) {
            const profile = await prisma.patientProfile.findUnique({
                where: { userId: parseInt(patientId) }
            });
            if (profile) patientProfileId = profile.id;
        }

        // If no patient profile found (e.g., Guest / Bystander SOS)
        if (!patientProfileId) {
             const guestUser = await prisma.user.create({
                 data: {
                     email: `guest_${Date.now()}@medrelay.com`,
                     password: 'guestpassword',
                     role: 'PATIENT',
                     patientProfile: {
                         create: {
                             fullName: 'Anonymous Bystander',
                             phoneNumber: 'N/A',
                             medicalHistory: 'Unknown (Guest SOS)',
                         }
                     }
                 },
                 include: { patientProfile: true }
             });
             patientProfileId = guestUser.patientProfile.id;
        }

        const typePrefix = requiredSpecialization || 'Unknown';
        
        let alertDescription = '';
        if (locationType === 'Building') {
            alertDescription = `${typePrefix} | Building/Hospital: ${landmark || 'N/A'}, Floor: ${floor || 'N/A'}, Room: ${roomNumber || 'N/A'}`;
        } else if (locationType === 'Outside') {
            alertDescription = `${typePrefix} | Outside/Home - Landmark: ${landmark || 'N/A'}`;
        } else {
            alertDescription = `${typePrefix} | Floor ${floor || 'N/A'}, Room ${roomNumber || 'N/A'}`; // Fallback for old apps
        }

        // Create the EmergencyAlert and DispatchRecord
        const newAlert = await prisma.emergencyAlert.create({
            data: {
                patientId: patientProfileId,
                latitude: lat,
                longitude: lng,
                status: 'PENDING',
                description: alertDescription
            }
        });

        await prisma.dispatchRecord.create({
            data: {
                alertId: newAlert.id,
                doctorId: closestDoctor.id
            }
        });

        const distanceFormatted = closestDoctor.distance_meters > 1000 
            ? `${(closestDoctor.distance_meters / 1000).toFixed(2)} km`
            : `${Math.round(closestDoctor.distance_meters)} meters`;

        const dispatchMessage = isFallback && requiredSpecialization && requiredSpecialization !== 'Unsure / General'
            ? `No ${requiredSpecialization} specialist was available nearby. The nearest available physician has been dispatched instead.`
            : "A qualified physician has been dispatched to your location.";

        return res.status(200).json({
            success: true,
            message: dispatchMessage,
            isFallback: isFallback,
            alertId: newAlert.id,
            dispatchedDoctor: {
                id: closestDoctor.id,
                name: closestDoctor.fullName,
                phone: closestDoctor.phoneNumber,
                specialization: closestDoctor.specialization,
                distance: distanceFormatted
            }
        });

    } catch (error) {
        console.error("❌ Alert Trigger Failure:", error);
        return res.status(500).json({ success: false, message: "Database query failed.", debug: error.message });
    }
};

exports.getAlertStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const dispatch = await prisma.dispatchRecord.findUnique({
            where: { alertId: parseInt(id) },
            include: {
                alert: { include: { patient: true } },
                doctor: true
            }
        });

        if (!dispatch) {
            return res.status(404).json({ success: false, message: "Alert not found." });
        }

        let distanceFormatted = "Unknown";
        if (dispatch.doctor && dispatch.doctor.currentLat && dispatch.alert.latitude) {
             const dist = getDistance(dispatch.alert.latitude, dispatch.alert.longitude, dispatch.doctor.currentLat, dispatch.doctor.currentLng);
             distanceFormatted = dist > 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} meters`;
        }

        return res.status(200).json({
            success: true,
            alert: {
                alertid: dispatch.alert.id,
                status: dispatch.alert.status,
                doctorname: dispatch.doctor ? dispatch.doctor.fullName : 'N/A',
                doctorphone: dispatch.doctor ? dispatch.doctor.phoneNumber : 'N/A',
                specialization: dispatch.doctor ? dispatch.doctor.specialization : 'N/A',
                distanceFormatted,
                latitude: dispatch.alert.latitude,
                longitude: dispatch.alert.longitude,
                doctorLat: dispatch.doctor ? dispatch.doctor.currentLat : null,
                doctorLng: dispatch.doctor ? dispatch.doctor.currentLng : null,
                doctorId: dispatch.doctor ? dispatch.doctor.userId : null
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch alert status.", debug: error.message });
    }
};

exports.getDoctorAlerts = async (req, res) => {
    const { doctorId } = req.params; // userId of doctor
    try {
        const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: parseInt(doctorId) }});
        if (!docProfile) return res.status(404).json({ success: false, message: "Doctor profile not found." });

        const dispatches = await prisma.dispatchRecord.findMany({
            where: {
                doctorId: docProfile.id,
                alert: { status: { in: ['PENDING', 'DISPATCHED'] } }
            },
            include: { alert: { include: { patient: true } } },
            orderBy: { dispatchedAt: 'desc' }
        });

        const mappedAlerts = dispatches.map(d => ({
            alertid: d.alert.id,
            description: d.alert.description,
            status: d.alert.status,
            latitude: d.alert.latitude,
            longitude: d.alert.longitude,
            doctorLat: docProfile.currentLat,
            doctorLng: docProfile.currentLng,
            createdat: d.alert.createdAt,
            patientname: d.alert.patient?.fullName || 'Anonymous Patient',
            age: d.alert.patient?.age || 'N/A',
            gender: d.alert.patient?.gender || 'N/A',
            bloodgroup: d.alert.patient?.bloodGroup || 'N/A',
            patientphone: d.alert.patient?.phoneNumber || 'N/A',
            medicalHistory: d.alert.patient?.medicalHistory || 'None recorded'
        }));

        return res.status(200).json({ success: true, alerts: mappedAlerts });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch alerts.", debug: error.message });
    }
};

exports.acknowledgeAlert = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.emergencyAlert.update({
            where: { id: parseInt(id) },
            data: { status: 'DISPATCHED' }
        });

        // Emit real-time update to the patient tracking this alert
        if (req.app.locals.io) {
            req.app.locals.io.to(`alert_${id}`).emit('alertUpdate', { status: 'DISPATCHED' });
        }

        return res.status(200).json({ success: true, message: "Alert acknowledged." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to acknowledge alert.", debug: error.message });
    }
};

exports.completeAlert = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.emergencyAlert.update({
            where: { id: parseInt(id) },
            data: { status: 'COMPLETED' }
        });

        await prisma.dispatchRecord.updateMany({
            where: { alertId: parseInt(id) },
            data: { completedAt: new Date() }
        });

        if (req.app.locals.io) {
            req.app.locals.io.to(`alert_${id}`).emit('alertUpdate', { status: 'COMPLETED' });
        }

        return res.status(200).json({ success: true, message: "Emergency marked as completed." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to complete alert.", debug: error.message });
    }
};

exports.getPatientActiveAlert = async (req, res) => {
    const { patientId } = req.params;
    try {
        const patProfile = await prisma.patientProfile.findUnique({ where: { userId: parseInt(patientId) } });
        if (!patProfile) return res.status(200).json({ success: true, alert: null });

        const activeAlert = await prisma.emergencyAlert.findFirst({
            where: {
                patientId: patProfile.id,
                status: { in: ['PENDING', 'DISPATCHED'] }
            },
            orderBy: { createdAt: 'desc' },
            include: { dispatchRecord: { include: { doctor: true } } }
        });

        if (!activeAlert) {
            return res.status(200).json({ success: true, alert: null });
        }

        const dispatch = activeAlert.dispatchRecord;
        return res.status(200).json({
            success: true,
            alert: {
                alertid: activeAlert.id,
                status: activeAlert.status,
                doctorname: dispatch?.doctor ? dispatch.doctor.fullName : 'N/A',
                doctorphone: dispatch?.doctor ? dispatch.doctor.phoneNumber : 'N/A',
                specialization: dispatch?.doctor ? dispatch.doctor.specialization : 'N/A',
                latitude: activeAlert.latitude,
                longitude: activeAlert.longitude,
                doctorLat: dispatch?.doctor ? dispatch.doctor.currentLat : null,
                doctorLng: dispatch?.doctor ? dispatch.doctor.currentLng : null,
                doctorId: dispatch?.doctor ? dispatch.doctor.userId : null
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch active alert.", debug: error.message });
    }
};