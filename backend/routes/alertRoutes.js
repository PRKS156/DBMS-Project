const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
router.post('/trigger', alertController.triggerAlert);
router.get('/doctor/:doctorId', alertController.getDoctorAlerts);
router.get('/:id/status', alertController.getAlertStatus);
router.patch('/:id/acknowledge', alertController.acknowledgeAlert);
module.exports = router;   