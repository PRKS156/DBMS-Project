const prisma = require('../config/db.js');
const { getDistance, formatDistance } = require('../utils/geoUtils');

// Maximum acceptable distance to prioritize a specialist over a closer general emergency doctor
const MAX_SPECIALIST_DISTANCE_METERS = 15000; // 15 km

// In-memory sliding window rate limiting for emergency alerts (prevents bot/spam denial-of-service)
const rateLimitMap = new Map();
function checkRateLimit(clientIp) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const maxRequests = 5;
    const timestamps = (rateLimitMap.get(clientIp) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
        return false;
    }
    timestamps.push(now);
    rateLimitMap.set(clientIp, timestamps);
    return true;
}

exports.getHospitals = async (req, res) => {
    try {
        const hospitals = await prisma.hospital.findMany({
            orderBy: { id: 'asc' }
        });
        return res.status(200).json({ success: true, hospitals });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch hospitals.", debug: error.message });
    }
};

exports.triggerAlert = async (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
            success: false,
            message: "Too many emergency requests from this network. Please call emergency services (112 / 108) directly."
        });
    }

    const {
        patientId,
        latitude,
        longitude,
        requiredSpecialization,
        floor,
        roomNumber,
        bedNumber,
        locationType,
        landmark,
        hospitalId,
        hospitalName
    } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: "Missing or invalid GPS coordinates." });
    }

    try {
        // Query active, available doctors who are not currently committed to an active emergency
        let availableDoctors = await prisma.doctorProfile.findMany({
            where: {
                isAvailable: true,
                currentLat: { not: null },
                currentLng: { not: null },
                dispatches: {
                    none: {
                        alert: {
                            status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] }
                        }
                    }
                }
            },
            include: { user: true }
        });

        // If no doctors are available, register escalated alert and advise immediate phone contact
        if (availableDoctors.length === 0) {
            return res.status(200).json({
                success: false,
                escalated: true,
                message: "⚠️ High Alert: All response units are currently committed to active emergencies. Your alert has been escalated to regional dispatch. Please call national emergency services (112 / 108) immediately."
            });
        }

        // Compute distances and verify GPS telemetry freshness (Item 9: GPS trust & stale location timeout)
        const STALE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
        const now = Date.now();
        let doctorsWithDistance = availableDoctors.map(doc => ({
            ...doc,
            distance_meters: getDistance(lat, lng, doc.currentLat, doc.currentLng),
            isFreshGPS: doc.user?.updatedAt ? (now - new Date(doc.user.updatedAt).getTime() < STALE_TIMEOUT_MS) : false
        }));

        // Prioritize fresh GPS beacons over stale positions, then sort by proximity
        doctorsWithDistance.sort((a, b) => {
            if (a.isFreshGPS !== b.isFreshGPS) return a.isFreshGPS ? -1 : 1;
            return a.distance_meters - b.distance_meters;
        });
        const closestGeneralDoctor = doctorsWithDistance[0];

        let closestDoctor = null;
        let isFallback = false;
        let fallbackReason = null;

        // Specialist matching with distance & ratio threshold (Item 1 & 5)
        if (requiredSpecialization && requiredSpecialization !== 'Unsure / General') {
            const specialists = doctorsWithDistance.filter(d => d.specialization === requiredSpecialization);
            if (specialists.length > 0) {
                const nearestSpecialist = specialists[0];
                // Check if specialist is within safe emergency transit distance and within reasonable ratio
                if (nearestSpecialist.distance_meters <= MAX_SPECIALIST_DISTANCE_METERS &&
                    nearestSpecialist.distance_meters <= closestGeneralDoctor.distance_meters * 3) {
                    closestDoctor = nearestSpecialist;
                } else {
                    isFallback = true;
                    fallbackReason = `Requested ${requiredSpecialization} specialist is ${formatDistance(nearestSpecialist.distance_meters)} away (exceeds immediate safe transit threshold). Dispatched closest emergency physician (${formatDistance(closestGeneralDoctor.distance_meters)}) for rapid on-site stabilization.`;
                    closestDoctor = closestGeneralDoctor;
                }
            } else {
                isFallback = true;
                fallbackReason = `No ${requiredSpecialization} specialist currently on duty in this sector. Dispatched nearest emergency physician (${formatDistance(closestGeneralDoctor.distance_meters)}) for immediate stabilization.`;
                closestDoctor = closestGeneralDoctor;
            }
        } else {
            closestDoctor = closestGeneralDoctor;
        }

        // Resolve or create patient profile
        let patientProfileId = null;
        if (patientId) {
            const profile = await prisma.patientProfile.findUnique({
                where: { userId: parseInt(patientId) }
            });
            if (profile) patientProfileId = profile.id;
        }

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
                            medicalHistory: 'Unknown (Guest SOS)'
                        }
                    }
                },
                include: { patientProfile: true }
            });
            patientProfileId = guestUser.patientProfile.id;
        }

        // Resolve target hospital
        let targetHospital = null;
        if (hospitalId) {
            targetHospital = await prisma.hospital.findUnique({ where: { id: parseInt(hospitalId) } });
        }
        if (!targetHospital && hospitalName) {
            targetHospital = await prisma.hospital.findFirst({
                where: { name: { contains: hospitalName, mode: 'insensitive' } }
            });
        }
        if (!targetHospital) {
            targetHospital = await prisma.hospital.findFirst();
        }

        const chosenHospitalName = targetHospital ? targetHospital.name : (hospitalName || landmark || 'City General Hospital');

        // Identify if inpatient hospital ward alert (Item 12: Inpatient ward alerts must NOT dispatch street ambulances)
        const isIndoorWard = locationType === 'Building' || Boolean(floor || roomNumber);

        let alertDescription = '';
        if (isIndoorWard) {
            alertDescription = `${requiredSpecialization || 'General'} | Hospital: ${chosenHospitalName}, Floor: ${floor || 'N/A'}, Room: ${roomNumber || 'N/A'}${bedNumber ? `, Bed: ${bedNumber}` : ''} [INPATIENT ON-FOOT]`;
        } else {
            alertDescription = `${requiredSpecialization || 'General'} | Outdoor SOS (Facility: ${chosenHospitalName}) - Landmark: ${landmark || 'N/A'}`;
        }

        if (isFallback) {
            alertDescription += ` | [FALLBACK MATCH]`;
        }

        // Execute atomic transaction: Create alert, allocate vehicle (if outdoor), mark doctor busy (Item 2 & 3)
        const result = await prisma.$transaction(async (tx) => {
            const newAlert = await tx.emergencyAlert.create({
                data: {
                    patientId: patientProfileId,
                    latitude: lat,
                    longitude: lng,
                    status: 'PENDING',
                    description: alertDescription
                }
            });

            // Atomically flip doctor status to busy
            await tx.doctorProfile.update({
                where: { id: closestDoctor.id },
                data: { isAvailable: false }
            });

            // Allocate an available emergency vehicle ONLY for outdoor field emergencies
            let vehicle = null;
            if (!isIndoorWard) {
                vehicle = await tx.vehicle.findFirst({
                    where: { isAvailable: true }
                });
                if (vehicle) {
                    await tx.vehicle.update({
                        where: { id: vehicle.id },
                        data: { isAvailable: false }
                    });
                }
            }

            const dispatch = await tx.dispatchRecord.create({
                data: {
                    alertId: newAlert.id,
                    doctorId: closestDoctor.id,
                    hospitalId: targetHospital ? targetHospital.id : null,
                    vehicleId: vehicle ? vehicle.id : null
                }
            });

            return { newAlert, vehicle, dispatch };
        });

        const distanceFormatted = formatDistance(closestDoctor.distance_meters, isIndoorWard);

        const dispatchMessage = isFallback
            ? (fallbackReason || `Nearest available physician has been dispatched for rapid on-site stabilization.`)
            : `A qualified ${closestDoctor.specialization} specialist has been dispatched to your location.`;

        return res.status(200).json({
            success: true,
            message: dispatchMessage,
            isFallback: isFallback,
            fallbackReason: fallbackReason,
            alertId: result.newAlert.id,
            dispatchedDoctor: {
                id: closestDoctor.id,
                name: closestDoctor.fullName,
                phone: closestDoctor.phoneNumber,
                specialization: closestDoctor.specialization,
                distance: distanceFormatted
            },
            allocatedVehicle: result.vehicle ? {
                id: result.vehicle.id,
                licensePlate: result.vehicle.licensePlate,
                type: result.vehicle.type
            } : null
        });

    } catch (error) {
        console.error("❌ Alert Trigger Failure:", error);
        return res.status(500).json({ success: false, message: "Database transaction failed.", debug: error.message });
    }
};

exports.getAlertStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const dispatch = await prisma.dispatchRecord.findUnique({
            where: { alertId: parseInt(id) },
            include: {
                alert: { include: { patient: true } },
                doctor: true,
                hospital: true,
                vehicle: true
            }
        });

        if (!dispatch) {
            return res.status(404).json({ success: false, message: "Alert not found." });
        }

        let distanceFormatted = "Unknown";
        if (dispatch.doctor && dispatch.doctor.currentLat && dispatch.alert.latitude) {
             const dist = getDistance(dispatch.alert.latitude, dispatch.alert.longitude, dispatch.doctor.currentLat, dispatch.doctor.currentLng);
             distanceFormatted = formatDistance(dist);
        }

        let fallbackReason = null;
        if (dispatch.alert.description && dispatch.alert.description.includes('[Fallback:')) {
            const match = dispatch.alert.description.match(/\[Fallback:\s*([^\]]+)\]/);
            if (match) fallbackReason = match[1];
        }

        return res.status(200).json({
            success: true,
            alert: {
                alertid: dispatch.alert.id,
                status: dispatch.alert.status,
                isFallback: Boolean(fallbackReason),
                fallbackReason,
                doctorname: dispatch.doctor ? dispatch.doctor.fullName : 'N/A',
                doctorphone: dispatch.doctor ? dispatch.doctor.phoneNumber : 'N/A',
                specialization: dispatch.doctor ? dispatch.doctor.specialization : 'N/A',
                hospitalName: dispatch.hospital ? dispatch.hospital.name : null,
                hospitalAddress: dispatch.hospital ? dispatch.hospital.address : null,
                hospitalContact: dispatch.hospital ? dispatch.hospital.contactNumber : null,
                vehiclePlate: dispatch.vehicle ? dispatch.vehicle.licensePlate : null,
                vehicleType: dispatch.vehicle ? dispatch.vehicle.type : null,
                distanceFormatted,
                description: dispatch.alert.description,
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
    const { doctorId } = req.params;
    try {
        const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: parseInt(doctorId) }});
        if (!docProfile) return res.status(404).json({ success: false, message: "Doctor profile not found." });

        const dispatches = await prisma.dispatchRecord.findMany({
            where: {
                doctorId: docProfile.id,
                alert: { status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] } }
            },
            include: { 
                alert: { include: { patient: true } },
                hospital: true,
                vehicle: true
            },
            orderBy: { dispatchedAt: 'desc' }
        });

        const mappedAlerts = dispatches.map(d => {
            let fallbackReason = null;
            if (d.alert.description && d.alert.description.includes('[Fallback:')) {
                const match = d.alert.description.match(/\[Fallback:\s*([^\]]+)\]/);
                if (match) fallbackReason = match[1];
            }
            return {
                alertid: d.alert.id,
                description: d.alert.description,
                isFallback: Boolean(fallbackReason),
                fallbackReason,
                hospitalName: d.hospital?.name || null,
                vehiclePlate: d.vehicle?.licensePlate || null,
                vehicleType: d.vehicle?.type || null,
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
            };
        });

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

        if (req.app.locals.io) {
            req.app.locals.io.to(`alert_${id}`).emit('alertUpdate', { status: 'DISPATCHED' });
        }

        return res.status(200).json({ success: true, message: "Alert acknowledged. Doctor en route." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to acknowledge alert.", debug: error.message });
    }
};

// Item 6: Hospital Transport Step (DISPATCHED -> TRANSPORTING)
exports.transportAlert = async (req, res) => {
    const { id } = req.params;
    const alertId = parseInt(id);
    const { hospitalId } = req.body;
    try {
        await prisma.emergencyAlert.update({
            where: { id: alertId },
            data: { status: 'TRANSPORTING' }
        });

        if (hospitalId) {
            await prisma.dispatchRecord.updateMany({
                where: { alertId: alertId },
                data: { hospitalId: parseInt(hospitalId) }
            });
        }

        if (req.app.locals.io) {
            req.app.locals.io.to(`alert_${id}`).emit('alertUpdate', { status: 'TRANSPORTING' });
        }

        return res.status(200).json({ success: true, message: "Patient secured; en route to hospital." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to update transport status.", debug: error.message });
    }
};

// Item 8: Cancel Alert (Emergency Cancellation & Resource Release)
exports.cancelAlert = async (req, res) => {
    const { id } = req.params;
    const alertId = parseInt(id);
    const { reason } = req.body;
    try {
        await prisma.emergencyAlert.update({
            where: { id: alertId },
            data: {
                status: 'CANCELLED',
                description: reason ? `[CANCELLED: ${reason}]` : undefined
            }
        });

        const dispatch = await prisma.dispatchRecord.findUnique({
            where: { alertId: alertId }
        });

        if (dispatch) {
            // Release doctor back to available
            if (dispatch.doctorId) {
                await prisma.doctorProfile.update({
                    where: { id: dispatch.doctorId },
                    data: { isAvailable: true }
                });
            }
            // Release vehicle back to available
            if (dispatch.vehicleId) {
                await prisma.vehicle.update({
                    where: { id: dispatch.vehicleId },
                    data: { isAvailable: true }
                });
            }
        }

        if (req.app.locals.io) {
            req.app.locals.io.to(`alert_${id}`).emit('alertUpdate', { status: 'CANCELLED', reason });
        }

        return res.status(200).json({ success: true, message: "Emergency alert cancelled. Resources released." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to cancel alert.", debug: error.message });
    }
};

exports.completeAlert = async (req, res) => {
    const { id } = req.params;
    const alertId = parseInt(id);
    try {
        await prisma.emergencyAlert.update({
            where: { id: alertId },
            data: { status: 'COMPLETED' }
        });

        await prisma.dispatchRecord.updateMany({
            where: { alertId: alertId },
            data: { completedAt: new Date() }
        });

        const dispatch = await prisma.dispatchRecord.findUnique({
            where: { alertId: alertId }
        });

        // Release doctor and vehicle back to available pool
        if (dispatch) {
            if (dispatch.doctorId) {
                await prisma.doctorProfile.update({
                    where: { id: dispatch.doctorId },
                    data: { isAvailable: true }
                });
            }
            if (dispatch.vehicleId) {
                await prisma.vehicle.update({
                    where: { id: dispatch.vehicleId },
                    data: { isAvailable: true }
                });
            }
        }

        if (req.app.locals.io) {
            req.app.locals.io.to(`alert_${id}`).emit('alertUpdate', { status: 'COMPLETED' });
        }

        return res.status(200).json({ success: true, message: "Emergency marked as completed. Clinician and ambulance released." });
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
                status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] }
            },
            orderBy: { createdAt: 'desc' },
            include: { dispatchRecord: { include: { doctor: true, hospital: true, vehicle: true } } }
        });

        if (!activeAlert) {
            return res.status(200).json({ success: true, alert: null });
        }

        const dispatch = activeAlert.dispatchRecord;
        let fallbackReason = null;
        if (activeAlert.description && activeAlert.description.includes('[Fallback:')) {
            const match = activeAlert.description.match(/\[Fallback:\s*([^\]]+)\]/);
            if (match) fallbackReason = match[1];
        }

        return res.status(200).json({
            success: true,
            alert: {
                alertid: activeAlert.id,
                status: activeAlert.status,
                isFallback: Boolean(fallbackReason),
                fallbackReason,
                doctorname: dispatch?.doctor ? dispatch.doctor.fullName : 'N/A',
                doctorphone: dispatch?.doctor ? dispatch.doctor.phoneNumber : 'N/A',
                specialization: dispatch?.doctor ? dispatch.doctor.specialization : 'N/A',
                hospitalName: dispatch?.hospital ? dispatch.hospital.name : null,
                hospitalAddress: dispatch?.hospital ? dispatch.hospital.address : null,
                vehiclePlate: dispatch?.vehicle ? dispatch.vehicle.licensePlate : null,
                vehicleType: dispatch?.vehicle ? dispatch.vehicle.type : null,
                description: activeAlert.description,
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

exports.submitFeedback = async (req, res) => {
    const { id } = req.params;
    const { rating, comments, userId } = req.body;
    try {
        const dispatch = await prisma.dispatchRecord.findUnique({
            where: { alertId: parseInt(id) }
        });
        if (!dispatch) return res.status(404).json({ success: false, message: "Dispatch record not found." });

        const feedback = await prisma.feedback.upsert({
            where: { dispatchRecordId: dispatch.id },
            update: {
                rating: parseInt(rating) || 5,
                comments: comments || ''
            },
            create: {
                dispatchRecordId: dispatch.id,
                userId: parseInt(userId) || 1,
                rating: parseInt(rating) || 5,
                comments: comments || ''
            }
        });

        return res.status(200).json({ success: true, message: "Feedback submitted successfully.", feedback });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to submit feedback.", debug: error.message });
    }
};