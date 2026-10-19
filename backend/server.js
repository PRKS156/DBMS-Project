const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const alertRoutes = require('./routes/alertRoutes');
const prisma = require('./config/db');
const { retryPendingAlerts } = require('./controllers/alertController');
require('dotenv').config();

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
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
            socket.user = decoded;
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
    console.log(`🔌 Client connected: ${socket.id} (Authenticated User: ${socket.user?.userId || 'Anonymous'})`);

    if (socket.user && socket.user.role === 'DOCTOR') {
        activeDoctorSockets.set(socket.id, socket.user.userId);
    }

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
                const decoded = jwt.verify(trackingToken, process.env.JWT_SECRET || 'supersecretkey');
                if (decoded.alertId === targetId) {
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

        // Allow join if authorized or in dev mode, reject unauthorized eavesdroppers
        if (isAuthorized || process.env.NODE_ENV !== 'production') {
            socket.join(`alert_${targetId}`);
            socket.emit('joinedAlertRoom', { alertId: targetId, authorized: isAuthorized });
            console.log(`🔒 Authorized room join: alert_${targetId} by socket ${socket.id}`);
        } else {
            socket.emit('joinError', { message: 'Access denied: Valid emergency tracking authorization token required.' });
            console.warn(`⛔ Unauthorized room join rejected: alert_${targetId} from ${socket.id}`);
        }
    });

    // Critique #9: Mark doctor unavailable upon socket disconnection
    socket.on('disconnect', async () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        const doctorUserId = activeDoctorSockets.get(socket.id);
        if (doctorUserId) {
            activeDoctorSockets.delete(socket.id);
            // Check if doctor has any other active open sockets
            const stillConnected = Array.from(activeDoctorSockets.values()).includes(doctorUserId);
            if (!stillConnected) {
                try {
                    await prisma.doctorProfile.updateMany({
                        where: { userId: doctorUserId },
                        data: { isAvailable: false }
                    });
                    io.emit('doctorStatusUpdate', { doctorId: doctorUserId, isAvailable: false });
                    console.log(`📵 Doctor #${doctorUserId} disconnected: Availability flipped to offline/unavailable.`);
                } catch (e) {
                    console.error('Error marking disconnected doctor offline:', e.message);
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Emergency API Server is actively running on port ${PORT}`);
});
