const pool = require('../config/db.js');

exports.getAllData = async (req, res) => {
    const providedPassword = req.headers['x-admin-password'];

    if (!providedPassword || providedPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Invalid admin password." });
    }

    try {
        const doctorsResult = await pool.query(`
            SELECT d.doctorid, d.fullname, d.phonenumber, d.specialization,
                   da.status, ST_Y(da.currentlocation) AS latitude, ST_X(da.currentlocation) AS longitude,
                   da.lastupdated
            FROM doctor d
            LEFT JOIN doctor_availability da ON d.doctorid = da.doctorid
            ORDER BY d.doctorid;
        `);

        const patientsResult = await pool.query(`
            SELECT patientid, fullname, phonenumber,
                   ST_Y(lastlocation) AS latitude, ST_X(lastlocation) AS longitude,
                   registeredat
            FROM patient
            ORDER BY patientid DESC;
        `);

        return res.status(200).json({
            success: true,
            doctors: doctorsResult.rows,
            patients: patientsResult.rows
        });

    } catch (error) {
        console.error("❌ Admin Data Fetch Failure:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch admin data.", debug: error.message });
    }
};  