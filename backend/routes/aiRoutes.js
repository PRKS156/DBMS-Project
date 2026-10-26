const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Status & health check of local Ollama engine
router.get('/status', aiController.getStatus);

// Emergency symptom triage & classification
router.post('/triage', aiController.triageSymptoms);

// Pre-arrival doctor clinical briefing
router.get('/briefing/:alertId', aiController.getDoctorBriefing);
router.post('/briefing', aiController.getDoctorBriefing);

// Emergency medical chat assistant
router.post('/chat', aiController.chat);

module.exports = router;
