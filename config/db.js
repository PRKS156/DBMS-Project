const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Cloud Database Connection Failure:', err.message);
    } else {
        console.log('✅ Connected to Cloud Supabase Instance Successfully.');
    }
});

module.exports = pool;