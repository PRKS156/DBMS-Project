const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Cleanly map the POST sub-route endpoint path directly to the named controller function
router.post('/trigger', alertController.triggerAlert);

module.exports = router;
