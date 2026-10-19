const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Administrative directory & analytics accessible by ADMIN and DISPATCHER
router.get('/data', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), adminController.getAllData);
router.get('/analytics', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), adminController.getAnalytics);

// Mutation operations strictly restricted to ADMIN
router.delete('/doctors/:id', authenticateToken, requireRole('ADMIN'), adminController.deleteDoctor);
router.delete('/patients/:id', authenticateToken, requireRole('ADMIN'), adminController.deletePatient);

module.exports = router;