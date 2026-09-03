const pool = require('../config/db.js');

exports.registerDoctor = async (req, res) => {
    const { fullName, phoneNumber, specialization, latitude, longitude } = req.body;
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({ success: false, message: "Invalid phone number format." });
    }

    if (!fullName || !phoneNumber || !specialization || !latitude || !longitude) {
        return res.status(400).json({ success: false, message: "All fields and location are required." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const doctorResult = await client.query(
            `INSERT INTO doctor (fullname, phonenumber, specialization) VALUES ($1, $2, $3) RETURNING doctorid`,
            [fullName, phoneNumber, specialization]
        );
        const doctorId = doctorResult.rows[0].doctorid;

        await client.query(
            `INSERT INTO doctor_availability (doctorid, status, currentlocation)
             VALUES ($1, 'Available', ST_SetSRID(ST_MakePoint($2, $3), 4326))`,
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