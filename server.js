const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const alertRoutes = require('./routes/alertRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/alerts', alertRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: "UP", message: "Emergency system is active." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Emergency API Server is actively running on port ${PORT}`);
});
