const pool = require('../config/db.js');

exports.registerPatient = async (req, res) => {
    const { fullName, age, gender, bloodGroup, phoneNumber, latitude, longitude } = req.body;
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }   

    if (!fullName || !age || !gender || !bloodGroup || !phoneNumber || !latitude || !longitude) {
        return res.status(400).json({ success: false, message: "All fields and location are required." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO patient (fullname, age, gender, bloodgroup, phonenumber, lastlocation)
             VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
             RETURNING patientid`,
            [fullName, age, gender, bloodGroup, phoneNumber, parseFloat(longitude), parseFloat(latitude)]
        );

        return res.status(201).json({ success: true, message: "Patient registered.", patientId: result.rows[0].patientid });

    } catch (error) {
        console.error("❌ Patient Registration Failure:", error.message);
        return res.status(500).json({ success: false, message: "Registration failed.", debug: error.message });
    }
};