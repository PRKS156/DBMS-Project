const pool = require('../config/db.js');

exports.triggerAlert = async (req, res) => {
    const { patientId, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Missing hardware GPS coordinates coordinates inputs parameters." });
    }

    try {
        // High-performance spatial query leveraging PostGIS ST_DistanceSphere algorithm mapping functions
        const queryText = `
            SELECT 
                d.DoctorID, d.FullName, d.PhoneNumber, d.Specialization,
                ST_DistanceSphere(da.CurrentLocation, ST_SetSRID(ST_MakePoint($1, $2), 4326)) AS distance_meters
            FROM DOCTOR d
            INNER JOIN DOCTOR_AVAILABILITY da ON d.DoctorID = da.DoctorID
            WHERE da.Status = 'Available'
            ORDER BY distance_meters ASC
            LIMIT 1;
        `;

        const values = [longitude, latitude];
        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(200).json({ 
                success: false, 
                message: "Server processed records, but no physicians are active." 
            });
        }

       // --- REPLACE THE BOTTOM OF YOUR CONTROLLER WITH THIS LOWERCASE VERSION ---
        const closestDoctor = result.rows[0];
        const distanceFormatted = closestDoctor.distance_meters > 1000 
            ? `${(closestDoctor.distance_meters / 1000).toFixed(2)} km`
            : `${Math.round(closestDoctor.distance_meters)} meters`;

        return res.status(200).json({
            success: true,
            message: "Closest qualified available medical specialist dispatched successfully.",
            dispatchedDoctor: {
                id: closestDoctor.doctorid,          // Changed to full lowercase keys
                name: closestDoctor.fullname,        // Changed to full lowercase keys
                phone: closestDoctor.phonenumber,    // Changed to full lowercase keys
                specialization: closestDoctor.specialization, // Changed to full lowercase keys
                distance: distanceFormatted
            }
        });


    } catch (error) {
        console.error("❌ PostGIS Query Processing Failure:", error.message);
        return res.status(500).json({ success: false, message: "Internal Engine Data Transaction Exception." });
    }
};
