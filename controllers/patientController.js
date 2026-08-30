const pool = require('../config/db.js');

exports.registerPatient = async (req, res) => {
    const { fullName, phoneNumber, latitude, longitude } = req.body;

    if (!fullName || !phoneNumber || !latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Name, phone, and location are required." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO patient (fullname, phonenumber, lastlocation)
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
             RETURNING patientid`,
            [fullName, phoneNumber, parseFloat(longitude), parseFloat(latitude)]
        );

        return res.status(201).json({ success: true, message: "Patient registered.", patientId: result.rows[0].patientid });

    } catch (error) {
        console.error("❌ Patient Registration Failure:", error.message);
        return res.status(500).json({ success: false, message: "Registration failed.", debug: error.message });
    }
};