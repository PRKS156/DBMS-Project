const express = require('express');
const router = express.Router();
const access = require('../middleware/access');
const alertController = require('../controllers/alertController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/hospitals', alertController.getHospitals);
router.post('/trigger', access.trigger, alertController.triggerAlert);
router.get('/patient/:patientId/active', access.profile('patient'), alertController.getPatientActiveAlert);
router.get('/doctor/:doctorId', access.profile('doctor'), alertController.getDoctorAlerts);
router.get('/active-view', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), alertController.getActiveEmergenciesView);
router.get('/route', alertController.getRealRoute);
router.get('/:id/route', access.alert('read'), alertController.getAlertRoute);
router.get('/:id/status', access.alert('read'), alertController.getAlertStatus);
router.patch('/:id/acknowledge', access.alert('doctor'), alertController.acknowledgeAlert);
router.patch('/:id/transport', access.alert('doctor'), alertController.transportAlert);
router.patch('/:id/complete', access.alert('doctor'), alertController.completeAlert);
router.patch('/:id/cancel', access.alert('cancel'), alertController.cancelAlert);
router.patch('/:id/reassign', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), alertController.reassignAlert);
router.post('/:id/feedback', access.alert('feedback'), alertController.submitFeedback);

module.exports = router;