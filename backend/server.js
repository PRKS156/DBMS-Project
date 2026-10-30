const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const alertRoutes = require('./routes/alertRoutes');
const prisma = require('./config/db');
const { retryPendingAlerts } = require('./controllers/alertController');
require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
const app = express();

// Critique #8: Trust proxy when behind reverse proxies (Render, Cloudflare, load balancers)
app.set('trust proxy', 1);

// Open global CORS access parameters so your Vercel cloud frontend can send request vectors securely
app.use(cors());
app.use(express.json());

// Main logical endpoint routing switch rules
app.use('/api/alerts', alertRoutes);
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);

const aiRoutes = require('./routes/aiRoutes');
app.use('/api/ai', aiRoutes);


// Catch-all health check route pathway for the Render deployment environment verification
app.get('/', (req, res) => {
    res.status(200).json({ status: "healthy", message: "Emergency Core Server Engine is awake." });
});

// Dynamic port configuration rule allowing Render to pass down random cloud ports automatically
const PORT = process.env.PORT || 3000;

// Catch-all 404 handler
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("❌ Unhandled server error:", err);
    res.status(500).json({ success: false, message: "Internal server error.", error: err.message });
});

// Setup HTTP server and Socket.io for real-time updates
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins for the Vercel frontend
        methods: ['GET', 'POST', 'PATCH']
    }
});

// Critique #18: Socket handshake authentication middleware with JWT verification
io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const account = await prisma.user.findUnique({where:{id:decoded.userId}});
            socket.user = account?.isActive && account.role === decoded.role ? decoded : null;
        } catch (err) {
            socket.user = null;
        }
    } else {
        socket.user = null;
    }
    next();
});

// Map active doctor socket connections to their database IDs (Critique #9)
const activeDoctorSockets = new Map(); // socket.id -> doctorUserId

io.on('connection', (socket) => {
    if (['ADMIN', 'DISPATCHER'].includes(socket.user?.role)) socket.join('staff');
    console.log(`🔌 Client connected: ${socket.id} (Authenticated User: ${socket.user?.userId || 'Anonymous'})`);

    if (socket.user && socket.user.role === 'DOCTOR') {
        const doctorUserId = socket.user.userId;
        activeDoctorSockets.set(socket.id, doctorUserId);

        // Reconcile doctor availability and signal recovery on reconnect
        (async () => {
            try {
                const docProfile = await prisma.doctorProfile.findUnique({
                    where: { userId: doctorUserId },
                    include: {
                        dispatches: {
                            where: {
                                alert: { status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] } }
                            }
                        }
                    }
                });

                if (docProfile) {
                    const hasActiveMission = (docProfile.dispatches || []).length > 0;
                    const shouldBeBusy = hasActiveMission || docProfile.isBusy;
                    const computedAvailable = docProfile.isOnDuty && !shouldBeBusy;

                    await prisma.doctorProfile.update({
                        where: { id: docProfile.id },
                        data: {
                            isBusy: shouldBeBusy,
                            isAvailable: computedAvailable
                        }
                    });

                    if (hasActiveMission) {
                        docProfile.dispatches.forEach(d => {
                            io.to(`alert_${d.alertId}`).emit('doctorSignalRestored', {
                                alertId: d.alertId,
                                doctorId: doctorUserId,
                                doctorName: docProfile.fullName,
                                message: `Signal restored from responder Dr. ${docProfile.fullName}. Live telemetry resumed.`
                            });
                        });
                        io.to('staff').emit('dispatcherAlertUpdate', {
                            alertId: docProfile.dispatches[0].alertId,
                            doctorSignalRestored: true,
                            doctorId: doctorUserId,
                            doctorName: docProfile.fullName
                        });
                        console.log(`📶 Doctor #${doctorUserId} reconnected mid-mission: Retained busy & assigned.`);
                    }
                }
            } catch (err) {
                console.error("Error reconciling doctor reconnect state:", err.message);
            }
        })();
    }

    // Critique #18: Anti-spoofing socket handler for real-time location broadcast
    // Strictly verifies sender identity: Only the assigned doctor can broadcast coordinates into that alert's room
    socket.on('locationBroadcast', async (data) => {
        if (!socket.user || socket.user.role !== 'DOCTOR') {
            return socket.emit('spoofError', {
                success: false,
                message: 'Unauthorized: Only authenticated clinicians may broadcast location telemetry.'
            });
        }

        const doctorUserId = socket.user.userId;
        const { alertId, latitude, longitude } = data || {};
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return socket.emit('spoofError', {
                success: false,
                message: 'Invalid coordinates provided.'
            });
        }

        // If broadcasting for a specific alert, strictly verify that THIS doctor is assigned to it!
        if (alertId) {
            const targetAlertId = parseInt(alertId);
            try {
                const dispatch = await prisma.dispatchRecord.findUnique({
                    where: { alertId: targetAlertId },
                    include: { doctor: true }
                });

                if (!dispatch || !dispatch.doctor || dispatch.doctor.userId !== doctorUserId) {
                    console.warn(`🚨 Anti-Spoofing: Socket ${socket.id} (Doctor User #${doctorUserId}) attempted to push fake coords to alert #${targetAlertId}!`);
                    return socket.emit('spoofError', {
                        success: false,
                        message: `Access Denied: You are not the assigned doctor for emergency alert #${targetAlertId}. Spoofed location broadcast rejected.`
                    });
                }

                // Legitimate assigned doctor broadcasting to alert room
                io.to(`alert_${targetAlertId}`).emit('doctorLocation', {
                    doctorId: doctorUserId,
                    latitude: lat,
                    longitude: lng
                });
            } catch (err) {
                return socket.emit('spoofError', { success: false, message: 'Verification error.', debug: err.message });
            }
        }

        // Update doctor profile telemetry and timestamp
        try {
            await prisma.doctorProfile.updateMany({
                where: { userId: doctorUserId },
                data: {
                    currentLat: lat,
                    currentLng: lng,
                    lastLocationAt: new Date()
                }
            });
            socket.emit('locationBroadcastAck', { success: true, timestamp: new Date() });
        } catch (e) {}
    });

    // Critique #18: Authorized room subscription logic with signed per-alert tracking tokens and RBAC
    socket.on('joinAlertRoom', async (payload) => {
        const alertId = typeof payload === 'object' ? payload.alertId : payload;
        const trackingToken = typeof payload === 'object' ? payload.token : null;
        const targetId = parseInt(alertId);

        if (isNaN(targetId)) {
            return socket.emit('joinError', { message: 'Invalid emergency alert ID.' });
        }

        let isAuthorized = false;

        // 1. Dispatchers and Admins have authorized system-wide emergency oversight
        if (socket.user && (socket.user.role === 'ADMIN' || socket.user.role === 'DISPATCHER')) {
            isAuthorized = true;
        }

        // 2. Validate cryptographic per-alert tracking token (for patients & guest SOS)
        if (!isAuthorized && trackingToken) {
            try {
                const decoded = jwt.verify(trackingToken, process.env.JWT_SECRET);
                if (decoded.role === 'ALERT_TRACKER' && decoded.alertId === targetId) {
                    isAuthorized = true;
                }
            } catch (err) {
                // Invalid or expired tracking token
            }
        }

        // 3. Validate authenticated participant (assigned doctor or patient owner)
        if (!isAuthorized && socket.user) {
            try {
                const dispatch = await prisma.dispatchRecord.findUnique({
                    where: { alertId: targetId },
                    include: { doctor: true, alert: { include: { patient: true } } }
                });
                if (dispatch) {
                    if (dispatch.doctor?.userId === socket.user.userId || dispatch.alert?.patient?.userId === socket.user.userId) {
                        isAuthorized = true;
                    }
                }
            } catch (err) {}
        }

        // All environments require participant credentials or a scoped tracking token
        if (isAuthorized) {
            socket.join(`alert_${targetId}`);
            socket.emit('joinedAlertRoom', { alertId: targetId, authorized: isAuthorized });
            console.log(`🔒 Authorized room join: alert_${targetId} by socket ${socket.id}`);
        } else {
            socket.emit('joinError', { message: 'Access denied: Valid emergency tracking authorization token required.' });
            console.warn(`⛔ Unauthorized room join rejected: alert_${targetId} from ${socket.id}`);
        }
    });

    // Two-State Doctor Disconnect Handler:
    // A disconnect during an active mission alerts the dispatcher, and does NOT release the alert or flip duty off.
    socket.on('disconnect', async () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        const doctorUserId = activeDoctorSockets.get(socket.id);
        if (doctorUserId) {
            activeDoctorSockets.delete(socket.id);
            // Check if doctor has any other active open sockets
            const stillConnected = Array.from(activeDoctorSockets.values()).includes(doctorUserId);
            if (!stillConnected) {
                try {
                    const docProfile = await prisma.doctorProfile.findUnique({
                        where: { userId: doctorUserId },
                        include: {
                            dispatches: {
                                where: {
                                    alert: { status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] } }
                                },
                                include: { alert: true }
                            }
                        }
                    });

                    if (docProfile) {
                        const activeDispatches = docProfile.dispatches || [];
                        if (activeDispatches.length > 0) {
                            // Mid-mission signal loss!
                            // Retain assignment, keep isBusy: true, and alert dispatcher & alert room
                            console.warn(`⚠️ Mid-mission signal loss for Dr. ${docProfile.fullName} on Alert #${activeDispatches[0].alertId}`);
                            activeDispatches.forEach(d => {
                                io.to(`alert_${d.alertId}`).emit('doctorSignalLost', {
                                    alertId: d.alertId,
                                    doctorId: doctorUserId,
                                    doctorName: docProfile.fullName,
                                    message: `Telemetric signal lost from responder Dr. ${docProfile.fullName}. Retaining active dispatch while device attempts reconnection.`
                                });
                            });
                            io.to('staff').emit('dispatcherAlertUpdate', {
                                alertId: activeDispatches[0].alertId,
                                doctorSignalLost: true,
                                doctorId: doctorUserId,
                                doctorName: docProfile.fullName
                            });
                        } else {
                            // Doctor had no active missions: mark unavailable (isAvailable = false) while preserving isOnDuty
                            await prisma.doctorProfile.update({
                                where: { id: docProfile.id },
                                data: { isAvailable: false }
                            });
                            io.emit('doctorStatusUpdate', {
                                doctorId: doctorUserId,
                                isOnDuty: docProfile.isOnDuty,
                                isBusy: false,
                                isAvailable: false
                            });
                            console.log(`📵 Doctor #${doctorUserId} disconnected: Availability set to offline (isOnDuty preserved as ${docProfile.isOnDuty}).`);
                        }
                    }
                } catch (e) {
                    console.error('Error handling disconnected doctor:', e.message);
                }
            }
        }
    });
});

// Critique #7: Background retry loop for unassigned PENDING alerts (runs every 15s)
setInterval(() => {
    retryPendingAlerts(io);
}, 15000);

// Make io accessible in controllers
app.locals.io = io;

const { checkOllamaStatus } = require('./utils/ollamaService');

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Emergency API Server is actively running on port ${PORT}`);
    const ollama = await checkOllamaStatus();
    if (ollama.online) {
        console.log(`🧠 Local Ollama AI Engine connected (${ollama.baseUrl}, model: ${ollama.activeModel}, latency: ${ollama.latencyMs}ms)`);
    } else {
        console.warn(`⚠️ Ollama offline or unreachable at ${ollama.baseUrl} (${ollama.error}). Rule-based clinical fallback active.`);
    }
});

