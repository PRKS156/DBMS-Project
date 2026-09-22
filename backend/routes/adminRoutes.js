const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/data', adminController.getAllData);
router.delete('/doctors/:id', adminController.deleteDoctor);
router.delete('/patients/:id', adminController.deletePatient);

module.exports = router;