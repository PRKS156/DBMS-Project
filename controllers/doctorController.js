const pool = require('../config/db.js');

exports.registerDoctor = async (req, res) => {
    const { fullName, phoneNumber, specialization, latitude, longitude } = req.body;

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