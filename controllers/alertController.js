const pool = require('../config/db.js');

exports.triggerAlert = async (req, res) => {
    const { patientId, latitude, longitude, requiredSpecialization, floor, roomNumber, bedNumber } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: "Missing or invalid GPS coordinates." });
    }

    try {
        let closestDoctor = null;
        let isFallback = false;

        if (requiredSpecialization && requiredSpecialization !== 'Unsure / General') {
            const specialistQuery = `
                SELECT 
                    d.doctorid, d.fullname, d.phonenumber, d.specialization,
                    ST_DistanceSphere(da.currentlocation, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
                FROM doctor d
                INNER JOIN doctor_availability da ON d.doctorid = da.doctorid
                WHERE da.status = 'Available' AND d.specialization = $3
                ORDER BY distance_meters ASC, d.doctorid ASC
                LIMIT 1;
            `;
            const specialistResult = await pool.query(specialistQuery, [lng, lat, requiredSpecialization]);
            if (specialistResult.rows.length > 0) closestDoctor = specialistResult.rows[0];
        }

        if (!closestDoctor) {
            isFallback = true;
            const generalQuery = `
                SELECT 
                    d.doctorid, d.fullname, d.phonenumber, d.specialization,
                    ST_DistanceSphere(da.currentlocation, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
                FROM doctor d
                INNER JOIN doctor_availability da ON d.doctorid = da.doctorid
                WHERE da.status = 'Available'
                ORDER BY distance_meters ASC, d.doctorid ASC
                LIMIT 1;
            `;
            const generalResult = await pool.query(generalQuery, [lng, lat]);
            if (generalResult.rows.length > 0) closestDoctor = generalResult.rows[0];
        }

        if (!closestDoctor) {
            return res.status(200).json({ success: false, message: "No physicians are currently available in your area." });
        }

        // Log this dispatch as an active alert for the doctor to see
        const alertInsert = await pool.query(
            `INSERT INTO alert (patientid, doctorid, floor, roomnumber, bednumber, status)
             VALUES ($1, $2, $3, $4, $5, 'Pending')
             RETURNING alertid`,
            [patientId || null, closestDoctor.doctorid, floor || null, roomNumber || null, bedNumber || null]
        );
        const newAlertId = alertInsert.rows[0].alertid;

        const distanceFormatted = closestDoctor.distance_meters > 1000 
            ? `${(closestDoctor.distance_meters / 1000).toFixed(2)} km`
            : `${Math.round(closestDoctor.distance_meters)} meters`;

        const dispatchMessage = isFallback && requiredSpecialization && requiredSpecialization !== 'Unsure / General'
            ? `No ${requiredSpecialization} specialist was available nearby. The nearest available physician has been dispatched instead.`
            : "A qualified physician has been dispatched to your location.";

        return res.status(200).json({
            success: true,
            message: dispatchMessage,
            isFallback: isFallback,
            alertId: newAlertId,
            dispatchedDoctor: {
                id: closestDoctor.doctorid,
                name: closestDoctor.fullname,
                phone: closestDoctor.phonenumber,
                specialization: closestDoctor.specialization,
                distance: distanceFormatted
            }
        });

    } catch (error) {
        const realMessage = error.errors?.length 
            ? error.errors.map(e => e.message).join(' | ') 
            : error.message || error.code || 'Unknown error (no message)';
        console.error("❌ Query Failure:", realMessage);
        return res.status(500).json({ success: false, message: "Database query failed.", debug: realMessage });
    }
};
exports.getAlertStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT a.alertid, a.status,
                    d.fullname AS doctorname, d.phonenumber AS doctorphone, d.specialization
             FROM alert a
             LEFT JOIN doctor d ON a.doctorid = d.doctorid
             WHERE a.alertid = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Alert not found." });
        }
        return res.status(200).json({ success: true, alert: result.rows[0] });
    } catch (error) {
        console.error("❌ Get Alert Status Failure:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch alert status.", debug: error.message });
    }
};

exports.getDoctorAlerts = async (req, res) => {
    const { doctorId } = req.params;
    try {
        const result = await pool.query(
            `SELECT a.alertid, a.floor, a.roomnumber, a.bednumber, a.status, a.createdat,
                    p.fullname AS patientname, p.age, p.gender, p.bloodgroup, p.phonenumber AS patientphone
             FROM alert a
             LEFT JOIN patient p ON a.patientid = p.patientid
             WHERE a.doctorid = $1 AND a.status = 'Pending'
             ORDER BY a.createdat DESC`,
            [doctorId]
        );
        return res.status(200).json({ success: true, alerts: result.rows });
    } catch (error) {
        console.error("❌ Get Alerts Failure:", error.message);
        return res.status(500).json({ success: false, message: "Failed to fetch alerts.", debug: error.message });
    }
};

exports.acknowledgeAlert = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE alert SET status = 'Acknowledged' WHERE alertid = $1`, [id]);
        return res.status(200).json({ success: true, message: "Alert acknowledged." });
    } catch (error) {
        console.error("❌ Acknowledge Alert Failure:", error.message);
        return res.status(500).json({ success: false, message: "Failed to acknowledge alert.", debug: error.message });
    }
};