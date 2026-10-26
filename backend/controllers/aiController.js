const prisma = require('../config/db');
const ollamaService = require('../utils/ollamaService');

/**
 * Health check & status of local Ollama AI
 */
exports.getStatus = async (req, res) => {
    try {
        const status = await ollamaService.checkOllamaStatus();
        return res.status(200).json({
            success: true,
            status
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to query Ollama engine status',
            error: error.message
        });
    }
};

/**
 * AI Triage for Emergency Symptoms
 */
exports.triageSymptoms = async (req, res) => {
    try {
        const { symptoms, patientId, context } = req.body;

        if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Symptoms description is required for AI triage analysis.'
            });
        }

        let patientContext = context || {};

        // If patientId provided, fetch clinical history to enrich context
        if (patientId) {
            try {
                const profile = await prisma.patientProfile.findUnique({
                    where: { userId: parseInt(patientId) }
                });
                if (profile) {
                    patientContext = {
                        ...patientContext,
                        age: profile.age,
                        gender: profile.gender,
                        medicalHistory: profile.medicalHistory,
                        bloodGroup: profile.bloodGroup
                    };
                }
            } catch (dbErr) {
                console.warn('⚠️ Could not load patient profile for AI triage:', dbErr.message);
            }
        }

        const triageResult = await ollamaService.triageSymptoms({
            symptoms: symptoms.trim(),
            patientContext
        });

        return res.status(200).json({
            success: true,
            triage: triageResult
        });
    } catch (error) {
        console.error('❌ AI Triage Error:', error);
        return res.status(500).json({
            success: false,
            message: 'AI Triage processing failed',
            error: error.message
        });
    }
};

/**
 * Pre-arrival Clinical Briefing for Doctor
 */
exports.getDoctorBriefing = async (req, res) => {
    try {
        const alertId = parseInt(req.params.alertId || req.body.alertId);

        if (!alertId || isNaN(alertId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid alertId is required to generate doctor clinical briefing.'
            });
        }

        const alert = await prisma.emergencyAlert.findUnique({
            where: { id: alertId },
            include: {
                patient: true,
                dispatchRecord: {
                    include: {
                        doctor: true,
                        hospital: true,
                        vehicle: true
                    }
                }
            }
        });

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: `Alert #${alertId} not found.`
            });
        }

        const briefing = await ollamaService.generateDoctorBriefing({
            alert,
            patientProfile: alert.patient,
            dispatchRecord: alert.dispatchRecord
        });

        return res.status(200).json({
            success: true,
            alertId,
            briefing
        });
    } catch (error) {
        console.error('❌ Doctor Briefing Generation Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate clinical briefing',
            error: error.message
        });
    }
};

/**
 * Conversational Emergency Medical Copilot
 */
exports.chat = async (req, res) => {
    try {
        const { messages, role, context } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Messages array with at least one message is required.'
            });
        }

        const response = await ollamaService.chatAssistant({
            messages,
            userRole: role || req.user?.role || 'PATIENT',
            context: context || {}
        });

        return res.status(200).json({
            success: true,
            reply: response.message,
            engine: response.engine,
            model: response.model
        });
    } catch (error) {
        console.error('❌ AI Chat Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Chat copilot failed to respond',
            error: error.message
        });
    }
};
