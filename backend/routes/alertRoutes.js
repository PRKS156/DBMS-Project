const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/hospitals', alertController.getHospitals);
router.post('/trigger', alertController.triggerAlert);
router.get('/patient/:patientId/active', alertController.getPatientActiveAlert);
router.get('/doctor/:doctorId', alertController.getDoctorAlerts);
router.get('/active-view', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), alertController.getActiveEmergenciesView);
router.get('/:id/status', alertController.getAlertStatus);
router.patch('/:id/acknowledge', alertController.acknowledgeAlert);
router.patch('/:id/transport', alertController.transportAlert);
router.patch('/:id/complete', alertController.completeAlert);
router.patch('/:id/cancel', alertController.cancelAlert);
router.patch('/:id/reassign', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), alertController.reassignAlert);
router.post('/:id/feedback', alertController.submitFeedback);

module.exports = router;