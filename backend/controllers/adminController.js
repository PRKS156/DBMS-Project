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
    SELECT patientid, fullname, age, gender, bloodgroup, phonenumber,
           ST_Y(lastlocation) AS latitude, ST_X(lastlocation) AS longitude,
           registrationdate
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
exports.deleteDoctor = async (req, res) => {
    const providedPassword = req.headers['x-admin-password'];
    if (!providedPassword || providedPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Invalid admin password." });
    }

    const { id } = req.params;
    try {
        await pool.query('DELETE FROM doctor_availability WHERE doctorid = $1', [id]);
        await pool.query('DELETE FROM doctor WHERE doctorid = $1', [id]);
        return res.status(200).json({ success: true, message: "Doctor deleted." });
    } catch (error) {
        console.error("❌ Delete Doctor Failure:", error.message);
        return res.status(500).json({ success: false, message: "Delete failed.", debug: error.message });
    }
};

exports.deletePatient = async (req, res) => {
    const providedPassword = req.headers['x-admin-password'];
    if (!providedPassword || providedPassword !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, message: "Invalid admin password." });
    }

    const { id } = req.params;
    try {
        await pool.query('DELETE FROM patient WHERE patientid = $1', [id]);
        return res.status(200).json({ success: true, message: "Patient deleted." });
    } catch (error) {
        console.error("❌ Delete Patient Failure:", error.message);
        return res.status(500).json({ success: false, message: "Delete failed.", debug: error.message });
    }
};