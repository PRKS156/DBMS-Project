const pool = require('../config/db.js');

exports.triggerAlert = async (req, res) => {
    const { patientId, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Missing hardware GPS coordinate parameters." });
    }

    try {
        // High-performance spatial query leveraging PostGIS ST_DistanceSphere algorithm mapping functions
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

        const values = [longitude, latitude];
        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(200).json({ 
                success: false, 
                message: "Server processed records, but no physicians are active." 
            });
        }

        // FIX: Extract the first single row object index [0] out of the rows array
        const closestDoctor = result.rows[0]; 
        
        // Format the mathematical metric into a readable string string mapping layout
        const distanceFormatted = closestDoctor.distance_meters > 1000 
            ? `${(closestDoctor.distance_meters / 1000).toFixed(2)} km`
            : `${Math.round(closestDoctor.distance_meters)} meters`;

        return res.status(200).json({
            success: true,
            message: "Closest qualified available medical specialist dispatched successfully.",
            dispatchedDoctor: {
                id: closestDoctor.doctorid,          
                name: closestDoctor.fullname,        
                phone: closestDoctor.phonenumber,    
                specialization: closestDoctor.specialization, 
                distance: distanceFormatted
            }
        });

    } catch (error) {
        console.error("❌ PostGIS Query Processing Failure:", error.message);
        return res.status(500).json({ success: false, message: "Internal Engine Data Transaction Exception." });
    }
};
