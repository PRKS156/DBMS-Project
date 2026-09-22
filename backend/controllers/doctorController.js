const pool = require('../config/db.js');
const bcrypt = require('bcrypt');

exports.registerDoctor = async (req, res) => {
    const { fullName, phoneNumber, specialization, latitude, longitude, password } = req.body;
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    if (!fullName || !phoneNumber || !specialization || !latitude || !longitude) {
        return res.status(400).json({ success: false, message: "All fields and location are required." });
    }

    if (!password || password.length < 4) {
        return res.status(400).json({ success: false, message: "Password must be at least 4 characters." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const hashedPassword = await bcrypt.hash(password, 10);

        const doctorResult = await client.query(
            `INSERT INTO doctor (fullname, phonenumber, specialization, password) VALUES ($1, $2, $3, $4) RETURNING doctorid`,
            [fullName, phoneNumber, specialization, hashedPassword]
        );
        const doctorId = doctorResult.rows[0].doctorid;

        await client.query(
            `INSERT INTO doctor_availability (doctorid, status, currentlocation)
            VALUES ($1, 'Off-Duty', ST_SetSRID(ST_MakePoint($2, $3), 4326))`,
            [doctorId, parseFloat(longitude), parseFloat(latitude)]
        );

        await client.query('COMMIT');
        return res.status(201).json({ success: true, message: "Doctor registered and marked available.", doctorId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Doctor Registration Failure:", error.message);
        return res.status(500).json({ success: false, message: "Registration failed.", debug: error.message });
    } finally {
        client.release();
    }
};

exports.loginDoctor = async (req, res) => {
    const { doctorId, password } = req.body;

    if (!doctorId || !password) {
        return res.status(400).json({ success: false, message: "Doctor ID and password are required." });
    }

    try {
        const result = await pool.query(
            `SELECT doctorid, fullname, phonenumber, specialization, password FROM doctor WHERE doctorid = $1`,
            [doctorId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "No doctor found with that ID." });
        }

        const doctor = result.rows[0];

        if (!doctor.password) {
            return res.status(401).json({ success: false, message: "This doctor has no password set. Please contact admin." });
        }

        const match = await bcrypt.compare(password, doctor.password);
        if (!match) {
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            doctor: {
                doctorId: doctor.doctorid,
                fullName: doctor.fullname,
                phoneNumber: doctor.phonenumber,
                specialization: doctor.specialization
            }
        });

    } catch (error) {
        console.error("❌ Doctor Login Failure:", error.message);
        return res.status(500).json({ success: false, message: "Login failed.", debug: error.message });
    }
};

exports.updateLocation = async (req, res) => {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Location coordinates are required." });
    }

    try {
        await pool.query(
            `UPDATE doctor_availability
             SET currentlocation = ST_SetSRID(ST_MakePoint($1, $2), 4326), lastupdated = CURRENT_TIMESTAMP
             WHERE doctorid = $3`,
            [parseFloat(longitude), parseFloat(latitude), id]
        );
        return res.status(200).json({ success: true, message: "Location updated." });
    } catch (error) {
        console.error("❌ Location Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Location update failed.", debug: error.message });
    }
};

exports.setStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Available', 'Busy', 'Off-Duty'].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status value." });
    }

    try {
        await pool.query(`UPDATE doctor_availability SET status = $1 WHERE doctorid = $2`, [status, id]);
        return res.status(200).json({ success: true, message: "Status updated." });
    } catch (error) {
        console.error("❌ Status Update Failure:", error.message);
        return res.status(500).json({ success: false, message: "Status update failed.", debug: error.message });
    }
};
exports.subscribeToPush = async (req, res) => {
    const { id } = req.params;
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: "Invalid push subscription." });
    }

    try {
        await pool.query(
            `UPDATE doctor_availability SET push_subscription = $1 WHERE doctorid = $2`,
            [JSON.stringify(subscription), id]
        );
        return res.status(200).json({ success: true, message: "Subscribed to push notifications." });
    } catch (error) {
        console.error("❌ Push Subscription Failure:", error.message);
        return res.status(500).json({ success: false, message: "Subscription failed.", debug: error.message });
    }
};