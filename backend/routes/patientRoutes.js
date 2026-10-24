const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

router.post('/register', patientController.registerPatient);
router.post('/login', patientController.loginPatient);
router.get('/:id', patientController.getPatientProfile);
router.patch('/:id', patientController.updatePatientProfile);
router.patch('/:id/status', patientController.setStatus);
router.patch('/:id/active', patientController.setStatus);

module.exports = router;