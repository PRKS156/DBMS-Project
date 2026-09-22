const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.patch('/:id/location', doctorController.updateLocation);
router.patch('/:id/status', doctorController.setStatus);

module.exports = router;