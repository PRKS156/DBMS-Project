const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.post('/trigger', alertController.triggerEmergency);

module.exports = router;
