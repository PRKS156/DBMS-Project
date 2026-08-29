const pool = require('../config/db.js');

exports.triggerAlert = async (req, res) => {
    const { patientId, latitude, longitude } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: "Missing or invalid GPS coordinates." });
    }

    try {
        const queryText = `
            SELECT 
                d.doctorid, d.fullname, d.phonenumber, d.specialization,
                ST_DistanceSphere(da.currentlocation, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM doctor d
            INNER JOIN doctor_availability da ON d.doctorid = da.doctorid
            WHERE da.status = 'Available'
            ORDER BY distance_meters ASC
            LIMIT 1;
        `;

        const result = await pool.query(queryText, [lng, lat]);

        if (result.rows.length === 0) {
            return res.status(200).json({ 
                success: false, 
                message: "No available doctors found in the database." 
            });
        }

        const closestDoctor = result.rows[0];
        const distanceFormatted = closestDoctor.distance_meters > 1000 
            ? `${(closestDoctor.distance_meters / 1000).toFixed(2)} km`
            : `${Math.round(closestDoctor.distance_meters)} meters`;

        return res.status(200).json({
            success: true,
            message: "Closest doctor dispatched successfully.",
            dispatchedDoctor: {
                id: closestDoctor.doctorid,
                name: closestDoctor.fullname,
                phone: closestDoctor.phonenumber,
                specialization: closestDoctor.specialization,
                distance: distanceFormatted
            }
        });

    } catch (error) {
        console.error("❌ Query Failure:", error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Database query failed.",
            debug: error.message 
        });
    }
};