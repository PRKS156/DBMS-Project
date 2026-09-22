const pool = require('../config/db.js');
const bcrypt = require('bcrypt');

exports.registerPatient = async (req, res) => {
    const { fullName, age, gender, bloodGroup, phoneNumber, emergencyType, latitude, longitude, password } = req.body;

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    if (!fullName || !age || !gender || !bloodGroup || !phoneNumber || !latitude || !longitude) {
        return res.status(400).json({ success: false, message: "All fields and location are required." });
    }

    if (!password || password.length < 4) {
        return res.status(400).json({ success: false, message: "Password must be at least 4 characters." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO patient (fullname, age, gender, bloodgroup, phonenumber, emergencytype, lastlocation, password)
             VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326), $9)
             RETURNING patientid`,
            [fullName, age, gender, bloodGroup, phoneNumber, emergencyType, parseFloat(longitude), parseFloat(latitude), hashedPassword]
        );

        return res.status(201).json({ success: true, message: "Patient registered.", patientId: result.rows[0].patientid });

    } catch (error) {
        console.error("❌ Patient Registration Failure:", error.message);
        return res.status(500).json({ success: false, message: "Registration failed.", debug: error.message });
    }
};

exports.loginPatient = async (req, res) => {
    const { patientId, password } = req.body;

    if (!patientId || !password) {
        return res.status(400).json({ success: false, message: "Patient ID and password are required." });
    }

    try {
        const result = await pool.query(
            `SELECT patientid, fullname, age, gender, bloodgroup, phonenumber, emergencytype, password
             FROM patient WHERE patientid = $1`,
            [patientId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "No patient found with that ID." });
        }

        const patient = result.rows[0];

        if (!patient.password) {
            return res.status(401).json({ success: false, message: "This patient has no password set. Please contact admin." });
        }

        const match = await bcrypt.compare(password, patient.password);
        if (!match) {
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            patient: {
                patientId: patient.patientid,
                fullName: patient.fullname,
                age: patient.age,
                gender: patient.gender,
                bloodGroup: patient.bloodgroup,
                phoneNumber: patient.phonenumber,
                emergencyType: patient.emergencytype
            }
        });

    } catch (error) {
        console.error("❌ Patient Login Failure:", error.message);
        return res.status(500).json({ success: false, message: "Login failed.", debug: error.message });
    }
};