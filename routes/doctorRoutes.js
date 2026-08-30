const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.post('/register', doctorController.registerDoctor);

module.exports = router;