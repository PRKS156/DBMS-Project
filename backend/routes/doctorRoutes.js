const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.get('/', doctorController.getAllDoctors);
router.get('/:id', doctorController.getDoctorProfile);
router.patch('/:id/location', doctorController.updateLocation);
router.patch('/:id/status', doctorController.setStatus);

module.exports = router;