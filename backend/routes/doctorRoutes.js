const express = require('express');
const router = express.Router();
const { profile } = require('../middleware/access');
const { authenticateToken, requireRole } = require('../middleware/auth');
const doctorController = require('../controllers/doctorController');

router.get('/', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), doctorController.getAllDoctors);
router.get('/:id', profile('doctor'), doctorController.getDoctorProfile);
router.patch('/:id/location', profile('doctor'), doctorController.updateLocation);
router.patch('/:id/status', profile('doctor'), doctorController.setStatus);

module.exports = router;