const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Protect all administrative routes with JWT authentication and ADMIN role check
router.use(authenticateToken, requireRole('ADMIN'));

router.get('/data', adminController.getAllData);
router.get('/analytics', adminController.getAnalytics);
router.delete('/doctors/:id', adminController.deleteDoctor);
router.delete('/patients/:id', adminController.deletePatient);

module.exports = router;