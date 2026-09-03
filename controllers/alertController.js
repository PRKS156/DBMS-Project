const pool = require('../config/db.js');

exports.triggerAlert = async (req, res) => {
    const { patientId, latitude, longitude, requiredSpecialization } = req.body;

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ success: false, message: "Missing or invalid GPS coordinates." });
    }

    try {
        let closestDoctor = null;
        let isFallback = false;

        // Attempt 1: find the nearest AVAILABLE doctor matching the required specialization
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
            if (specialistResult.rows.length > 0) {
                closestDoctor = specialistResult.rows[0];
            }
        }

        // Attempt 2 (fallback): if no matching specialist found, get the nearest available doctor of ANY specialization
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
            if (generalResult.rows.length > 0) {
                closestDoctor = generalResult.rows[0];
            }
        }

        if (!closestDoctor) {
            return res.status(200).json({ 
                success: false, 
                message: "No physicians are currently available in your area."
            });
        }

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
        return res.status(500).json({ 
            success: false, 
            message: "Database query failed.",
            debug: realMessage 
        });
    }
};