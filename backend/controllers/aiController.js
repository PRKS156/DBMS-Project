const prisma = require('../config/db');
const ollamaService = require('../utils/ollamaService');

/**
 * Health check & status of local Ollama AI
 */
exports.getStatus = async (req, res) => {
    try {
        const apiKey = req.query.apiKey || req.headers['x-ai-key'];
        const provider = req.query.provider || req.headers['x-ai-provider'];
        const status = await ollamaService.checkOllamaStatus(apiKey, provider);
        return res.status(200).json({
            success: true,
            status
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to query AI engine status',
            error: error.message
        });
    }
};

/**
 * AI Triage for Emergency Symptoms
 */
exports.triageSymptoms = async (req, res) => {
    try {
        const { symptoms, patientId, context, apiKey, provider } = req.body;
        const key = apiKey || req.headers['x-ai-key'];
        const prov = provider || req.headers['x-ai-provider'];

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
            patientContext,
            apiKey: key,
            provider: prov
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
        const apiKey = req.body.apiKey || req.query.apiKey || req.headers['x-ai-key'];
        const provider = req.body.provider || req.query.provider || req.headers['x-ai-provider'];

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
            dispatchRecord: alert.dispatchRecord,
            apiKey,
            provider
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
        const { messages, role, context, apiKey, provider } = req.body;
        const key = apiKey || req.headers['x-ai-key'];
        const prov = provider || req.headers['x-ai-provider'];

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Messages array with at least one message is required.'
            });
        }

        const response = await ollamaService.chatAssistant({
            messages,
            userRole: role || req.user?.role || 'PATIENT',
            context: context || {},
            apiKey: key,
            provider: prov
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
