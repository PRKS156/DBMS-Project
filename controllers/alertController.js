const db = require('../config/db');

exports.triggerEmergency = async (req, res) => {
    const { patientId, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: "Latitude and Longitude are strictly required." });
    }

    try {
        const findNearestQuery = `
            SELECT da.DoctorID, d.FullName, d.PhoneNumber,
                   ST_DistanceSphere(da.CurrentLocation, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM DOCTOR_AVAILABILITY da
            JOIN DOCTOR d ON da.DoctorID = d.DoctorID
            WHERE da.Status = 'Available'
            ORDER BY distance_meters ASC
            LIMIT 1;
        `;

        const result = await db.query(findNearestQuery, [longitude, latitude]);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                status: "Failed", 
                message: "Emergency logged, but no doctors are currently available nearby." 
            });
        }

        const nearestDoctor = result.rows[0];

        return res.status(200).json({
            status: "Success",
            message: "Emergency matched! Dispatching closest medical personnel.",
            dispatchedDoctor: {
                id: nearestDoctor.doctorid,
                name: nearestDoctor.fullname,
                phone: nearestDoctor.phonenumber,
                distance: `${Math.round(nearestDoctor.distance_meters)} meters`
            }
        });

    } catch (error) {
        console.error("🚨 Controller Error:", error.message);
        return res.status(500).json({ error: "Internal server error during dispatch calculation." });
    }
};
