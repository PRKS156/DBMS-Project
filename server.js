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
const doctorRoutes = require('./routes/doctorRoutes');
const patientRoutes = require('./routes/patientRoutes');

app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);

// Catch-all health check route pathway for the Render deployment environment verification
app.get('/', (req, res) => {
    res.status(200).json({ status: "healthy", message: "Emergency Core Server Engine is awake." });
});

// Dynamic port configuration rule allowing Render to pass down random cloud ports automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Emergency API Server is actively running on port ${PORT}`);
});
