const express = require('express');
const cors = require('cors');
const alertRoutes = require('./routes/alertRoutes');
require('dotenv').config();

const app = express();

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

io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);
    
    // Clients can join a room based on their alert ID or userId to receive targeted updates
    socket.on('joinAlertRoom', (alertId) => {
        socket.join(`alert_${alertId}`);
        console.log(`Client joined room: alert_${alertId}`);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
    });
});

// Make io accessible in controllers
app.locals.io = io;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Emergency API Server is actively running on port ${PORT}`);
});
