const express = require('express');
const router = express.Router();
const { profile } = require('../middleware/access');
const { authenticateToken, requireRole } = require('../middleware/auth');
const patientController = require('../controllers/patientController');

router.post('/register', patientController.registerPatient);
router.post('/login', patientController.loginPatient);
router.get('/:id', profile('patient'), patientController.getPatientProfile);
router.patch('/:id', profile('patient'), patientController.updatePatientProfile);
router.patch('/:id/status', profile('patient'), patientController.setStatus);
router.patch('/:id/active', profile('patient'), patientController.setStatus);

module.exports = router;