const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/data', adminController.getAllData);

module.exports = router;