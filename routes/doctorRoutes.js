const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.post('/register', doctorController.registerDoctor);
router.post('/login', doctorController.loginDoctor);
router.patch('/:id/location', doctorController.updateLocation);
router.patch('/:id/status', doctorController.setStatus);

module.exports = router;
router.post('/:id/subscribe', doctorController.subscribeToPush);