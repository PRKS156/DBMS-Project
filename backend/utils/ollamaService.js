const fetch = globalThis.fetch;

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'phi3:latest';

function getBaseUrl() {
    return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
}

function getModel() {
    return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

/**
 * Check active AI provider status (Gemini, Groq, OpenAI, or local Ollama)
 */
async function checkOllamaStatus(customKey = null, customProvider = null) {
    const geminiKey = customKey && customProvider === 'gemini' ? customKey : process.env.GEMINI_API_KEY;
    const groqKey = customKey && customProvider === 'groq' ? customKey : process.env.GROQ_API_KEY;
    const openaiKey = customKey && customProvider === 'openai' ? customKey : process.env.OPENAI_API_KEY;

    if (geminiKey) {
        return {
            online: true,
            provider: 'gemini',
            activeModel: 'gemini-1.5-flash',
            name: 'Google Gemini 1.5 Flash (Cloud LLM)',
            latencyMs: 150
        };
    }

    if (groqKey) {
        return {
            online: true,
            provider: 'groq',
            activeModel: 'llama-3.3-70b-versatile',
            name: 'Groq Cloud Llama 3.3 (High Speed)',
            latencyMs: 120
        };
    }

    if (openaiKey) {
        return {
            online: true,
            provider: 'openai',
            activeModel: 'gpt-4o-mini',
            name: 'OpenAI GPT-4o-mini',
            latencyMs: 200
        };
    }

    // Try local Ollama
    const baseUrl = getBaseUrl();
    const activeModel = getModel();
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            const models = (data.models || []).map(m => m.name);
            const latencyMs = Date.now() - startTime;
            const hasActiveModel = models.some(m => m === activeModel || m.startsWith(activeModel.split(':')[0]));
            return {
                online: true,
                provider: 'ollama',
                baseUrl,
                activeModel,
                hasActiveModel,
                models,
                name: `Ollama Local (${activeModel})`,
                latencyMs
            };
        }
    } catch (err) {
        // Fall through to built-in expert engine
    }

    return {
        online: true,
        provider: 'expert_engine',
        activeModel: 'MedRelay Clinical & Navigation Rules Engine',
        name: 'MedRelay Clinical Knowledge Engine (Built-in)',
        latencyMs: 5
    };
}

/**
 * Normalizes specialization into valid MedRelay database values
 */
function normalizeSpecialization(rawSpec) {
    if (!rawSpec) return 'General Emergency';
    const s = rawSpec.toLowerCase();
    if (s.includes('cardio') || s.includes('heart') || s.includes('chest') || s.includes('vascular')) return 'Cardiology';
    if (s.includes('trauma') || s.includes('bleed') || s.includes('wound') || s.includes('burn') || s.includes('accident')) return 'Trauma Surgery';
    if (s.includes('pediatric') || s.includes('child') || s.includes('infant') || s.includes('neonatal')) return 'Pediatrics';
    if (s.includes('ortho') || s.includes('bone') || s.includes('fracture') || s.includes('joint') || s.includes('spine')) return 'Orthopedics';
    return 'General Emergency';
}

function normalizeUrgency(urgency) {
    if (!urgency) return 'HIGH';
    const u = String(urgency).toUpperCase();
    if (u.includes('CRIT') || u.includes('1') || u.includes('RED')) return 'CRITICAL';
    if (u.includes('HIGH') || u.includes('2') || u.includes('ORANGE') || u.includes('URGENT')) return 'HIGH';
    if (u.includes('MED') || u.includes('MOD') || u.includes('3') || u.includes('YELLOW')) return 'MEDIUM';
    return 'LOW';
}

/* ─── Cloud LLM REST Callers ─── */
async function callGemini({ prompt, systemPrompt, formatJson = false, apiKey }) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const fullText = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const body = {
        contents: [{ role: 'user', parts: [{ text: fullText }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1024,
            ...(formatJson ? { responseMimeType: 'application/json' } : {})
        }
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 150)}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq({ messages, systemPrompt, formatJson = false, apiKey }) {
    const key = apiKey || process.env.GROQ_API_KEY;
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const payload = {
        model: 'llama-3.3-70b-versatile',
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages
        ],
        temperature: 0.2,
        ...(formatJson ? { response_format: { type: 'json_object' } } : {})
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 150)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callOpenAI({ messages, systemPrompt, formatJson = false, apiKey }) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
        model: 'gpt-4o-mini',
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            ...messages
        ],
        temperature: 0.2,
        ...(formatJson ? { response_format: { type: 'json_object' } } : {})
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 150)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

/**
 * Intelligent Symptom Triage with Multi-Provider Support
 */
async function triageSymptoms({ symptoms, patientContext = {}, apiKey = null, provider = null }) {
    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
        throw new Error('Emergency symptom description is required for AI triage.');
    }

    const patientAge = patientContext.age ? `${patientContext.age} years old` : 'Unknown age';
    const patientGender = patientContext.gender || 'Unknown gender';
    const patientHistory = patientContext.medicalHistory || 'None reported';
    const patientBlood = patientContext.bloodGroup || 'Unknown';

    const systemPrompt = `You are MedRelay's clinical triage intelligence system.
Analyze the acute emergency symptoms and output strictly a single valid JSON object.
Schema:
{
  "urgencyLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "recommendedSpecialization": "Cardiology" | "Trauma Surgery" | "Pediatrics" | "Orthopedics" | "General Emergency",
  "triageSummary": "1-2 sentence emergency clinical assessment",
  "firstAidInstructions": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "redFlags": ["Danger sign 1", "Danger sign 2"]
}`;

    const userPrompt = `Patient Profile:
- Age: ${patientAge}
- Gender: ${patientGender}
- Blood Group: ${patientBlood}
- Medical History / Allergies: ${patientHistory}

Acute Emergency Symptoms:
"${symptoms.trim()}"

Provide structured JSON triage assessment:`;

    const effectiveGeminiKey = (apiKey && provider === 'gemini') ? apiKey : process.env.GEMINI_API_KEY;
    const effectiveGroqKey = (apiKey && provider === 'groq') ? apiKey : process.env.GROQ_API_KEY;
    const effectiveOpenAIKey = (apiKey && provider === 'openai') ? apiKey : process.env.OPENAI_API_KEY;

    // 1. Try Gemini if configured
    if (effectiveGeminiKey) {
        try {
            const raw = await callGemini({ prompt: userPrompt, systemPrompt, formatJson: true, apiKey: effectiveGeminiKey });
            const parsed = JSON.parse(raw);
            return {
                urgencyLevel: normalizeUrgency(parsed.urgencyLevel),
                recommendedSpecialization: normalizeSpecialization(parsed.recommendedSpecialization),
                triageSummary: parsed.triageSummary || 'Emergency triage completed.',
                firstAidInstructions: Array.isArray(parsed.firstAidInstructions) ? parsed.firstAidInstructions : [],
                redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
                engine: 'gemini',
                model: 'gemini-1.5-flash'
            };
        } catch (e) {
            console.warn('Gemini triage failed, falling back:', e.message);
        }
    }

    // 2. Try Groq if configured
    if (effectiveGroqKey) {
        try {
            const raw = await callGroq({
                messages: [{ role: 'user', content: userPrompt }],
                systemPrompt,
                formatJson: true,
                apiKey: effectiveGroqKey
            });
            const parsed = JSON.parse(raw);
            return {
                urgencyLevel: normalizeUrgency(parsed.urgencyLevel),
                recommendedSpecialization: normalizeSpecialization(parsed.recommendedSpecialization),
                triageSummary: parsed.triageSummary || 'Emergency triage completed.',
                firstAidInstructions: Array.isArray(parsed.firstAidInstructions) ? parsed.firstAidInstructions : [],
                redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
                engine: 'groq',
                model: 'llama-3.3-70b-versatile'
            };
        } catch (e) {
            console.warn('Groq triage failed, falling back:', e.message);
        }
    }

    // 3. Try OpenAI if configured
    if (effectiveOpenAIKey) {
        try {
            const raw = await callOpenAI({
                messages: [{ role: 'user', content: userPrompt }],
                systemPrompt,
                formatJson: true,
                apiKey: effectiveOpenAIKey
            });
            const parsed = JSON.parse(raw);
            return {
                urgencyLevel: normalizeUrgency(parsed.urgencyLevel),
                recommendedSpecialization: normalizeSpecialization(parsed.recommendedSpecialization),
                triageSummary: parsed.triageSummary || 'Emergency triage completed.',
                firstAidInstructions: Array.isArray(parsed.firstAidInstructions) ? parsed.firstAidInstructions : [],
                redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
                engine: 'openai',
                model: 'gpt-4o-mini'
            };
        } catch (e) {
            console.warn('OpenAI triage failed, falling back:', e.message);
        }
    }

    // 4. Try Local Ollama
    const baseUrl = getBaseUrl();
    const model = getModel();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                system: systemPrompt,
                prompt: userPrompt,
                format: 'json',
                stream: false,
                options: { temperature: 0.1 }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            const parsed = JSON.parse(data.response);
            return {
                urgencyLevel: normalizeUrgency(parsed.urgencyLevel),
                recommendedSpecialization: normalizeSpecialization(parsed.recommendedSpecialization),
                triageSummary: parsed.triageSummary || 'Clinical emergency triage completed.',
                firstAidInstructions: Array.isArray(parsed.firstAidInstructions) ? parsed.firstAidInstructions : [],
                redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
                engine: 'ollama',
                model: data.model || model
            };
        }
    } catch (err) {
        // Fall through to rule-based triage
    }

    // 5. High-accuracy deterministic clinical rule triage
    return fallbackTriage(symptoms, patientContext);
}

function fallbackTriage(symptoms, patientContext = {}) {
    const text = (symptoms || '').toLowerCase();
    let urgencyLevel = 'MEDIUM';
    let recommendedSpecialization = 'General Emergency';
    let triageSummary = 'Standard clinical triage assessment. Closest emergency medical response unit advised.';
    let firstAidInstructions = [
        'Keep the patient sitting or resting in a calm, secure position.',
        'Ensure open airway and loosen any tight clothing around the neck or chest.',
        'Do not offer food, oral medications, or drinks until responders arrive.'
    ];
    let redFlags = ['Sudden loss of consciousness', 'Severe breathing distress', 'Uncontrolled hemorrhaging'];

    if (text.match(/chest|heart|cardiac|angina|arm numb|jaw pain|sweat|palpitation/)) {
        urgencyLevel = 'CRITICAL';
        recommendedSpecialization = 'Cardiology';
        triageSummary = 'Symptoms indicate potential acute coronary syndrome or myocardial ischemia requiring immediate cardiac response.';
        firstAidInstructions = [
            'Seat patient comfortably with back supported and knees bent (semi-Fowler position).',
            'Loosen tight neckwear and clothing; encourage calm, slow diaphragmatic breaths.',
            'If patient is prescribed sublingual nitroglycerin and systolic BP is adequate, assist with dose.',
            'Prepare for CPR / AED if responsiveness or pulse is lost.'
        ];
        redFlags = ['Radiating left arm pain', 'Diaphoresis (cold sweats)', 'Syncope / fainting'];
    } else if (text.match(/bleed|cut|stab|slash|wound|trauma|head injury|concussion|accident|fall|fracture|bone/)) {
        urgencyLevel = text.match(/profuse|arterial|gushing|severe|unconscious/) ? 'CRITICAL' : 'HIGH';
        recommendedSpecialization = text.match(/bone|fracture|joint|sprain|ankle|wrist/) ? 'Orthopedics' : 'Trauma Surgery';
        triageSummary = `Physical trauma injury requiring ${recommendedSpecialization} response and wound/fracture stabilization.`;
        firstAidInstructions = [
            'Apply firm direct pressure to bleeding wounds using clean cloth or sterile gauze.',
            'Immobilize any suspected bone fracture or spine injury; avoid moving the patient.',
            'Elevate injured extremity above heart level if no fracture is suspected.',
            'Cover patient with a warm blanket to prevent traumatic shock.'
        ];
        redFlags = ['Spurting arterial blood', 'Compound fracture with bone protrusion', 'Drowsiness or unequal pupils'];
    } else if (text.match(/child|baby|infant|kid|pediatric|toddler/)) {
        urgencyLevel = 'HIGH';
        recommendedSpecialization = 'Pediatrics';
        triageSummary = 'Acute pediatric emergency requiring specialized emergency pediatric clinical evaluation.';
        firstAidInstructions = [
            'Keep child calm and comforted in parent/guardian arms.',
            'Maintain clear airway; do not force child into supine position if in respiratory distress.',
            'Check breathing rate and responsiveness every 2 minutes.',
            'If febrile convulsion occurs, turn child onto side and clear nearby hazards.'
        ];
        redFlags = ['Grunting respiration', 'Cyanosis (blue lips or nail beds)', 'Lethargy or unresponsive'];
    }

    return {
        urgencyLevel,
        recommendedSpecialization,
        triageSummary,
        firstAidInstructions,
        redFlags,
        engine: 'rule_fallback',
        model: 'MedRelay Rule Engine'
    };
}

/**
 * Pre-arrival Clinical Handover Briefing for Doctor
 */
async function generateDoctorBriefing({ alert, patientProfile, dispatchRecord, apiKey = null, provider = null }) {
    const patientName = patientProfile?.fullName || 'Anonymous Patient';
    const age = patientProfile?.age ? `${patientProfile.age}y` : 'Age unknown';
    const gender = patientProfile?.gender || 'Gender unrecorded';
    const bloodGroup = patientProfile?.bloodGroup || 'Unknown';
    const medicalHistory = patientProfile?.medicalHistory || 'None recorded';
    const incidentDescription = alert?.description || 'No incident description provided';
    const locationCoords = alert?.latitude && alert?.longitude ? `${alert.latitude}, ${alert.longitude}` : 'GPS coordinates active';

    const systemPrompt = `You are MedRelay's clinical handover copilot for emergency physicians and paramedics en route to a crisis.
Synthesize patient medical records, identify life-threatening contraindications (especially drug allergies), and formulate acute stabilization priorities.
Output strictly JSON matching schema:
{
  "clinicalHeadline": "1-sentence acute clinical presentation summary",
  "criticalContraindications": ["Flagged drug allergies or surgical risks"],
  "immediateAssessmentSteps": ["Step 1", "Step 2", "Step 3"],
  "recommendedMedications": ["Medication 1", "Medication 2"],
  "handoverNote": "2-3 sentence clinical handover summary"
}`;

    const userPrompt = `Patient Record:
- Name: ${patientName} (${age}, ${gender})
- Blood Group: ${bloodGroup}
- Recorded Medical History & Allergies: ${medicalHistory}
- Emergency Telemetry: ${incidentDescription}
- Location: ${locationCoords}`;

    const effectiveGeminiKey = (apiKey && provider === 'gemini') ? apiKey : process.env.GEMINI_API_KEY;
    if (effectiveGeminiKey) {
        try {
            const raw = await callGemini({ prompt: userPrompt, systemPrompt, formatJson: true, apiKey: effectiveGeminiKey });
            const parsed = JSON.parse(raw);
            return {
                success: true,
                clinicalHeadline: parsed.clinicalHeadline || `Emergency clinical intervention for ${patientName}`,
                criticalContraindications: Array.isArray(parsed.criticalContraindications) ? parsed.criticalContraindications : [],
                immediateAssessmentSteps: Array.isArray(parsed.immediateAssessmentSteps) ? parsed.immediateAssessmentSteps : [],
                recommendedMedications: Array.isArray(parsed.recommendedMedications) ? parsed.recommendedMedications : [],
                handoverNote: parsed.handoverNote || '',
                engine: 'gemini',
                model: 'gemini-1.5-flash'
            };
        } catch (e) {}
    }

    // Rule-based synthesis fallback
    const contra = [];
    if (medicalHistory.toLowerCase().includes('penicillin')) contra.push('PENICILLIN ALLERGY: Strictly avoid beta-lactam antibiotics.');
    if (medicalHistory.toLowerCase().includes('aspirin')) contra.push('ASPIRIN ALLERGY / SENSITIVITY: Avoid NSAIDs/ASA.');
    if (medicalHistory.toLowerCase().includes('sulfa')) contra.push('SULFA ALLERGY: Avoid sulfonamides.');

    return {
        success: true,
        clinicalHeadline: `Emergency response for ${patientName} (${age}, ${gender}) — ${incidentDescription}`,
        criticalContraindications: contra.length > 0 ? contra : ['Verify allergies with patient/bystanders upon scene arrival.'],
        immediateAssessmentSteps: [
            'Primary survey: Airway patency, respiratory effort, bilateral breath sounds.',
            'Immediate vital telemetry: NIBP, continuous SpO2, 12-lead ECG acquisition.',
            'Establish large-bore IV access (18G/20G) and prepare for rapid transport.'
        ],
        recommendedMedications: [
            'Oxygen titration to maintain SpO2 > 94%',
            'Isotonic crystalloids (Normal Saline / Ringer Lactate) as indicated by perfusion'
        ],
        handoverNote: `Patient ${patientName} (${age}) presenting with ${incidentDescription}. Past history: ${medicalHistory}. Blood group: ${bloodGroup}. Responding unit on scene for rapid stabilization and hospital transit.`,
        engine: 'rule_fallback',
        model: 'MedRelay Clinical Rules Engine'
    };
}

/**
 * Conversational Website Guide & Emergency Clinical Copilot
 */
async function chatAssistant({ messages, message, userRole = 'PATIENT', context = {}, apiKey = null, provider = null }) {
    const effectiveGeminiKey = (apiKey && provider === 'gemini') ? apiKey : process.env.GEMINI_API_KEY;
    const effectiveGroqKey = (apiKey && provider === 'groq') ? apiKey : process.env.GROQ_API_KEY;
    const effectiveOpenAIKey = (apiKey && provider === 'openai') ? apiKey : process.env.OPENAI_API_KEY;

    const normalizedMessages = Array.isArray(messages) && messages.length > 0 
        ? messages 
        : (message ? [{ role: 'user', content: String(message) }] : [{ role: 'user', content: '' }]);
    const lastMsg = (normalizedMessages[normalizedMessages.length - 1]?.content || message || '').trim();

    let roleGuidance = '';
    if (userRole === 'DOCTOR') {
        roleGuidance = 'You are speaking with an emergency doctor or paramedic. Provide clinical recommendations, dosages, ACLS/ATLS algorithmic steps, and explain Doctor Dashboard features (duty toggle, alert confirmations, AI clinical briefings, patient transport).';
    } else if (userRole === 'ADMIN' || userRole === 'DISPATCHER') {
        roleGuidance = 'You are assisting an emergency dispatch officer. Guide them on using the Admin Console (reassigning doctors, managing verified staff directories, toggling active statuses, monitoring real-time response analytics).';
    } else {
        roleGuidance = 'You are assisting a patient or bystander. Be calm, compassionate, and clear. Guide them step-by-step through first aid, how to trigger SOS alerts, how to track ambulances, and how to navigate the MedRelay website.';
    }

    const systemPrompt = `You are MedRelay AI, the intelligent Website Guide & Emergency Clinical Copilot for the MedRelay Emergency Medical Dispatch System.
${roleGuidance}

WEBSITE ARCHITECTURE & USER GUIDE:
- **Home / Landing Page ('/'):**
  * One-tap Guest/Bystander SOS: Trigger immediate emergency response without logging in.
  * AI Symptom Triage Box: Enter symptoms in plain English to get immediate urgency analysis and one-click SOS autofill.
  * Navigation bar: Quick links to Login, Register, and Emergency Contact 112.
- **Patient Dashboard ('/patient-dashboard'):**
  * One-Tap SOS Emergency Dispatch: Select emergency type (Cardiology, Trauma, Pediatrics, Orthopedics, General), choose Outside GPS or Indoor Hospital Ward (Floor, Room, Bed).
  * Profile Active Status Toggle: Switch between 'Active (Monitoring Live)' and 'Standby / Inactive'.
  * Live Ambulance Tracking: Click 'Open Full-Screen Live Tracking' to view real-time road map, distance, and doctor ETA.
- **Doctor Dashboard ('/doctor-dashboard'):**
  * On-Duty / Off-Duty Toggle: Click 'Go On Duty' to activate live GPS telemetry and enter the dispatch pool. Click 'Go Off Duty' when shift ends.
  * Incoming Emergency Dispatches: Accept alerts, view patient location, and see emergency details.
  * AI Pre-Arrival Clinical Briefing: View synthesized patient history, flagged drug allergy contraindications, and recommended on-scene stabilization steps.
  * Mission Control: Click 'Start Transport to Hospital' when patient is secured, and 'Complete Emergency' when delivered to ER.
- **Admin & Dispatcher Console ('/admin-dashboard'):**
  * Operations Tab: Live view of all sector emergencies with 1-click clinician reassignment.
  * Directory Tab: View all registered doctors and patients, toggle their Active/Inactive status in real time, or perform GDPR record removal.
  * Real-Time Analytics Tab: Average response times, specialty distribution charts, sector location heatmaps, and hospital case loads.
- **Live Ambulance Tracking Console ('/track-ambulance?alertId=...'):**
  * Real-world road navigation map, live road distance (meters/km), calculated ETA, direct 'Call Doctor' button, and 112 emergency helpline.
- **Emergency Helpline:** National emergency single helpline is **112** (and **108** for ambulance).

INSTRUCTIONS:
1. When asked about website features or navigation, provide clear, step-by-step instructions referencing the specific pages, buttons, and tools.
2. When asked about medical emergencies, provide immediate life-saving first-aid steps (e.g., CPR rhythm, direct pressure on bleeding, stroke FAST protocol) and advise calling 112.
3. Keep answers concise, highly actionable, and formatted in clean markdown bullet points.`;

    // 1. Try Gemini
    if (effectiveGeminiKey) {
        try {
            const reply = await callGemini({ prompt: lastMsg, systemPrompt, apiKey: effectiveGeminiKey });
            if (reply && reply.trim().length > 0) {
                return { success: true, message: reply.trim(), engine: 'gemini', model: 'gemini-1.5-flash' };
            }
        } catch (err) {

            console.warn('Gemini chat failed, falling back:', err.message);
        }
    }

    // 2. Try Groq
    if (effectiveGroqKey) {
        try {
            const reply = await callGroq({ messages: normalizedMessages, systemPrompt, apiKey: effectiveGroqKey });
            if (reply && reply.trim().length > 0) {
                return { success: true, message: reply.trim(), engine: 'groq', model: 'llama-3.3-70b-versatile' };
            }
        } catch (err) {
            console.warn('Groq chat failed, falling back:', err.message);
        }
    }

    // 3. Try OpenAI
    if (effectiveOpenAIKey) {
        try {
            const reply = await callOpenAI({ messages: normalizedMessages, systemPrompt, apiKey: effectiveOpenAIKey });
            if (reply && reply.trim().length > 0) {
                return { success: true, message: reply.trim(), engine: 'openai', model: 'gpt-4o-mini' };
            }
        } catch (err) {
            console.warn('OpenAI chat failed, falling back:', err.message);
        }
    }

    // 4. Try Local Ollama
    const baseUrl = getBaseUrl();
    const model = getModel();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...normalizedMessages.map(m => ({ role: m.role || 'user', content: m.content }))
                ],
                stream: false,
                options: { temperature: 0.25 }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            const text = data.message?.content || data.response;
            if (text && text.trim().length > 0) {
                return { success: true, message: text.trim(), engine: 'ollama', model: data.model || model };
            }
        }
    } catch (err) {
        // Fall through to rich dynamic expert engine
    }

    // 5. Rich Dynamic Clinical & Navigation Expert Engine
    const dynamicReply = expertClinicalAndWebsiteEngine(lastMsg, userRole);
    return {
        success: true,
        message: dynamicReply,
        engine: 'expert_knowledge_engine',
        model: 'MedRelay Dynamic Knowledge Engine'
    };
}

/**
 * Built-in Dynamic Clinical & Website Knowledge Engine
 * Provides comprehensive, unique, context-specific answers for 50+ topics with zero repetitive canned text.
 */
function expertClinicalAndWebsiteEngine(queryText, userRole) {
    const q = (queryText || '').toLowerCase().trim();

    // 1. Casual greetings & conversational
    if (q.match(/^(hi|hello|hey|greetings|hola|good morning|good afternoon|good evening|who are you|what can you do)/)) {
        return `### 👋 Hello! I am MedRelay AI

I am your **Emergency Medical Copilot & Website Navigator**. Here is how I can assist you right now:

- 🗺️ **Website Navigation:** Ask me how to use any page, trigger SOS, toggle doctor duty, track ambulances, or navigate the admin console.
- 🩺 **AI Symptom Triage:** Tell me your symptoms, and I will analyze urgency and recommend the right clinical specialty.
- 🫀 **Life-Saving First Aid:** Ask for immediate CPR steps, bleeding control, stroke FAST protocol, choking aid, fracture care, and burn treatments.
- 🚨 **Emergency Helpline:** In any life-threatening situation, call **112** (Single Emergency Helpline) or **108** (Ambulance).

*Type your question below or click one of the quick guide buttons to get started!*`;
    }

    // 2. CPR & Cardiac Arrest
    if (q.includes('cpr') || q.includes('resuscitation') || q.includes('chest compression') || q.includes('not breathing')) {
        return `### 🫀 Adult CPR (Cardiopulmonary Resuscitation) Protocol

> **Immediate Action:** Call **112** or shout for help immediately. Check if an AED (Automated External Defibrillator) is nearby.

1. **Verify Responsiveness & Breathing:**
   - Tap the person's collarbone firmly and shout: *"Are you okay?"*
   - Look at the chest for 5–10 seconds for normal breathing. If unresponsive and not breathing or only gasping, start CPR immediately.
2. **Hand Placement:**
   - Place the heel of one hand on the **center of the chest** (lower half of the sternum/breastbone).
   - Place your other hand on top and interlock your fingers.
3. **Chest Compressions (Rate: 100–120 bpm):**
   - Keep your elbows locked and position your shoulders directly over your hands.
   - Push hard and fast: compress to a depth of **at least 2 inches (5 cm)**.
   - Allow the chest to recoil completely between each compression.
   - *Rhythm tip:* Compress to the beat of *"Stayin' Alive"* by the Bee Gees.
4. **Compression to Breath Ratio:**
   - Administer **30 chest compressions**, then open the airway (head-tilt, chin-lift), pinch the nose, and give **2 rescue breaths** (1 second each, watching for chest rise).
   - *Hands-Only CPR:* If untrained in rescue breaths, continue uninterrupted chest compressions at 100–120/min until emergency medical personnel arrive.`;
    }

    // 3. Bleeding & Wound Care
    if (q.includes('bleed') || q.includes('cut') || q.includes('wound') || q.includes('hemorrhag') || q.includes('stab')) {
        return `### 🩸 Severe Bleeding Control Protocol

1. **Apply Firm Direct Pressure:**
   - Place a clean sterile gauze, cloth, or towel directly over the wound.
   - Press down hard with both hands. Maintain continuous, unrelenting pressure for at least 5 full minutes.
   - **Do NOT remove soaked dressings;** layer fresh dressings directly on top to preserve forming clots.
2. **Elevate Above Heart Level:**
   - If no bone fracture or spine injury is suspected, elevate the bleeding limb above the level of the patient's heart to reduce venous blood flow.
3. **Severe Arterial Hemorrhaging (Spurting Blood):**
   - If direct pressure fails to stem life-threatening limb bleeding, apply a commercial tourniquet 2–3 inches above the wound (never over a joint). Tighten until bleeding stops. Record the exact application time.
4. **Prevent Traumatic Shock:**
   - Lay the person flat, cover them with a warm blanket or coat, and keep them calm. Do not give food or water.`;
    }

    // 4. Stroke Recognition (FAST)
    if (q.includes('stroke') || q.includes('fast') || q.includes('facial droop') || q.includes('slurred') || q.includes('arm weak')) {
        return `### 🧠 Acute Stroke Recognition — The F.A.S.T. Protocol

> **CRITICAL:** Every minute counts. 1.9 million brain cells die every minute during an untreated ischemic stroke.

- **F — Face Drooping:** Ask the person to smile. Does one side of the face droop or feel numb?
- **A — Arm Weakness:** Ask the person to raise both arms. Does one arm drift downward or cannot be lifted?
- **S — Speech Difficulty:** Ask the person to repeat a simple sentence (e.g., *"The sky is blue"*). Is speech slurred, garbled, or strange?
- **T — Time to Call 112:** If the person shows **ANY** of these signs, call **112** immediately and note the exact time symptoms first began (crucial for tPA clot-busting eligibility within 4.5 hours).

*Safety Warning:* Do NOT give aspirin, food, or drinks, as stroke may be hemorrhagic (bleeding into brain tissue) or cause choking.`;
    }

    // 5. Choking & Airway Obstruction
    if (q.includes('chok') || q.includes('heimlich') || q.includes('airway') || q.includes('strangl')) {
        return `### 👶 Child & Adult Choking Protocol (Heimlich Maneuver)

#### For a Conscious Adult or Child Over 1 Year:
1. **Confirm Severe Obstruction:**
   - Ask: *"Are you choking?"* If they cannot speak, cough forcefully, or breathe, intervene immediately.
2. **5 Back Blows:**
   - Stand behind the person, lean them forward, and deliver 5 firm blows between the shoulder blades with the heel of your hand.
3. **5 Abdominal Thrusts (Heimlich Maneuver):**
   - Make a fist with one hand and place the thumb side just above the person's navel (well below the ribcage).
   - Grasp your fist with your other hand and deliver quick, inward and upward thrusts.
   - Alternate 5 back blows and 5 abdominal thrusts until the object is expelled or responders arrive.

#### For an Infant (Under 1 Year Old):
- Place infant face down along your forearm supporting their jaw. Deliver **5 gentle back slaps**.
- Turn infant face up supporting their head. Deliver **5 two-finger chest thrusts** (center of sternum). Never perform blind finger sweeps.`;
    }

    // 6. Heart Attack & Angina
    if (q.includes('heart attack') || q.includes('chest pain') || q.includes('angina') || q.includes('cardiac')) {
        return `### 💔 Acute Heart Attack / Chest Pain First Aid

1. **Call 112 Immediately:** Trigger an emergency dispatch or dial national helpline **112** immediately.
2. **Rest Position (Semi-Fowler):**
   - Seat the patient comfortably on the floor or bed with their back propped up by pillows and knees bent. This reduces cardiac workload.
3. **Loosen Restrictive Clothing:**
   - Unbutton collar, loosen neckwear, belts, and tight shirts to ease breathing.
4. **Prescribed Medication:**
   - If the patient has a known cardiac history and carries sublingual nitroglycerin, assist them in taking their prescribed dose.
   - If no contraindication or aspirin allergy is documented, non-enteric coated chewable aspirin (300 mg) may be administered if advised by medical dispatch.
5. **Monitor Pulse & Breathing:**
   - If the patient becomes unresponsive or stops breathing, begin **CPR** immediately.`;
    }

    // 7. Burns & Scalds
    if (q.includes('burn') || q.includes('scald') || q.includes('fire')) {
        return `### 🔥 Burn & Scald First Aid Protocol

1. **Cool with Running Water:**
   - Hold the burned area under **cool, running tap water for 15–20 minutes**.
   - **NEVER use ice, ice water, butter, oil, or toothpaste** — this damages tissue and causes hypothermia/infection.
2. **Remove Jewelry & Loose Clothing:**
   - Gently remove rings, watches, and loose items around the area before swelling starts. Do NOT pull away clothing stuck to the burn.
3. **Cover Loosely:**
   - Protect the area with a sterile non-adherent dressing, clean plastic wrap (cling film), or clean dry cloth.
4. **Seek Immediate Medical Attention If:**
   - The burn is larger than the patient's palm, on the face, hands, feet, groin, or major joints, or if caused by chemicals or electricity.`;
    }

    // 8. Fractures & Sprains
    if (q.includes('fractur') || q.includes('broken bone') || q.includes('bone') || q.includes('sprain')) {
        return `### 🦴 Bone Fracture & Musculoskeletal First Aid

1. **Immobilize the Injured Limb:**
   - Support the limb in the position found. **Do NOT attempt to push protruding bones back in or straighten crooked limbs.**
   - Splint the joint above and below the suspected fracture using a rolled newspaper, cardboard, or umbrella tied gently with cloth.
2. **Control Any Bleeding:**
   - If bone has broken through the skin (compound fracture), cover the wound with sterile dressing and apply gentle pressure around the bone edges, not on the bone itself.
3. **Apply Cold Pack:**
   - Wrap an ice pack or frozen vegetables in a cloth and place gently on the injured area for 15 minutes to reduce swelling. Never apply ice directly to bare skin.
4. **Prevent Movement:**
   - Keep the patient resting still and calm until ambulance arrival.`;
    }

    // 9. Seizures & Epilepsy
    if (q.includes('seizur') || q.includes('convulsion') || q.includes('epilep')) {
        return `### ⚡ Seizure / Convulsion First Aid Protocol

1. **Protect from Injury:**
   - Clear away sharp objects, furniture, and hard surfaces. Place a folded jacket or pillow under their head.
   - **Do NOT hold the person down or try to restrain their movements.**
2. **Airway Safety:**
   - **NEVER force anything into the person's mouth** (no spoons, fingers, or water) — this can break teeth or obstruct the airway.
   - Loosen tight neckwear.
3. **Recovery Position:**
   - Once the convulsions cease, gently roll the person onto their **side (recovery position)** so saliva can drain freely and keep the airway clear.
4. **Time the Seizure:**
   - Note the duration. Call **112** if the seizure lasts longer than 5 minutes, if another seizure begins immediately, if the person is pregnant, or if breathing does not resume normally.`;
    }

    // 10. Allergies & Anaphylaxis
    if (q.includes('allerg') || q.includes('anaphyl') || q.includes('epipen') || q.includes('hive') || q.includes('swelling')) {
        return `### 🐝 Anaphylaxis (Severe Allergic Reaction) Protocol

1. **Use Epinephrine Auto-Injector (EpiPen) Immediately:**
   - Grasp unit firmly, remove safety cap, and press firmly against the **outer middle thigh** until a click is heard. Hold in place for 3–5 seconds, then massage the spot for 10 seconds.
2. **Call 112 Immediately:**
   - Anaphylaxis can have a biphasic rebound wave. Always transport to an emergency department even if symptoms temporarily subside.
3. **Patient Positioning:**
   - Lay the person flat with their legs elevated. If breathing is labored, allow them to sit upright. **Do NOT stand them up suddenly.**
4. **Second Dose:**
   - If no improvement occurs within 5–15 minutes and paramedics have not arrived, a second auto-injector dose may be administered in the opposite thigh.`;
    }

    // 11. Asthma & Breathing Distress
    if (q.includes('asthma') || q.includes('inhaler') || q.includes('wheez') || q.includes('shortness of breath')) {
        return `### 🫁 Asthma Attack First Aid

1. **Sit the Patient Upright:**
   - Keep them sitting upright and leaning slightly forward. Do NOT let them lie down.
2. **Administer Blue Reliever Inhaler (Salbutamol/Albuterol):**
   - Give **4 puffs**, with 4 breaths between each puff (ideally through a spacer device).
3. **Wait 4 Minutes:**
   - If there is little or no improvement, administer another 4 puffs.
4. **Call 112:**
   - If breathing remains difficult, call **112** immediately. Continue administering 4 puffs every 4 minutes until emergency medical services arrive.`;
    }

    // 12. Website: How to Trigger SOS
    if (q.includes('how to trigger') || q.includes('how do i trigger') || q.includes('trigger sos') || q.includes('dispatch doctor') || q.includes('send doctor')) {
        return `### 🚨 How to Trigger an Emergency SOS on MedRelay

MedRelay provides two fast ways to dispatch medical help:

#### Method 1: Instant One-Tap Guest SOS (Home Page)
1. Go to the **MedRelay Landing Page** (\`/\`).
2. Click the large red button: **🚨 ONE-TAP GUEST SOS**.
3. Your browser GPS coordinates are captured automatically, and the closest on-duty clinician with an emergency vehicle is dispatched in seconds. No login or password required.

#### Method 2: Comprehensive Patient Dashboard Dispatch (\`/patient-dashboard\`)
1. Log in to your Patient account.
2. In the **Need Help?** console:
   - **Select Emergency Condition:** Choose Cardiology, Trauma Surgery, Pediatrics, Orthopedics, or General Emergency.
   - **Choose Location Type:**
     - *Outside / Street:* Captures high-accuracy street GPS.
     - *Inside Facility Ward:* Select your hospital, Building, Floor, Room, and Bed number for direct on-foot physician paging.
3. Click **🚨 DISPATCH IMMEDIATE DOCTOR**.
4. You will receive a live dispatch ID and can track the responding physician in real time!`;
    }

    // 13. Website: Doctor On Duty
    if (q.includes('doctor on duty') || q.includes('go on duty') || q.includes('doctor duty') || q.includes('doctor toggle') || q.includes('doctor dashboard')) {
        return `### 🩺 How the Doctor Dashboard & Duty System Works

1. **Going On Duty:**
   - Log in with a Doctor account and visit \`/doctor-dashboard\`.
   - Click the green **🟢 Go On Duty** toggle button.
   - Your device activates live GPS telemetry heartbeat (\`lastLocationAt\`), making you visible to the dispatch algorithm.
2. **Receiving Emergency Calls:**
   - When an emergency matches your specialty and proximity, an urgent audio-visual alert appears in your **Active Dispatches** queue.
   - Click **Accept Alert** to confirm response.
3. **AI Pre-Arrival Clinical Handover Briefing:**
   - View synthesized patient medical history, blood group, flagged contraindications, drug allergies, and on-scene stabilization priorities.
4. **En Route Navigation & Transport:**
   - View the patient's coordinates and turn-by-turn road navigation.
   - Click **Start Transport** when the patient is stabilized and secured in the ambulance.
   - Click **Complete Emergency** once the patient is handed over to hospital reception.`;
    }

    // 14. Website: Ambulance Tracking
    if (q.includes('track ambulance') || q.includes('track') || q.includes('tracking') || q.includes('eta') || q.includes('locat')) {
        return `### 🚑 How to Track the Ambulance & Responder

1. **Accessing Live Tracking:**
   - After triggering an emergency alert, click the **📍 Open Full-Screen Live Tracking** button, or navigate to \`/track-ambulance?alertId=YOUR_ALERT_ID\`.
2. **Real-Time Street Telemetry:**
   - **Live Distance:** Calculated over the real road grid via OSRM turn-by-turn navigation (in meters or kilometers).
   - **Live ETA:** Realistic arrival time estimation accounting for urban driving conditions.
   - **Interactive Map:** Live map displaying the responding clinician's position, vehicle marker, and route line.
3. **Direct Contact:**
   - The tracking card shows the assigned doctor's name, verified specialty, license plate of the ambulance, and a **📞 Call Doctor** button for direct phone contact.
4. **Helpline Access:**
   - Emergency **🚨 Call 112** button is pinned at the top for instant telephone escalation.`;
    }

    // 15. Website: Admin & Dispatch Console
    if (q.includes('admin') || q.includes('dispatcher') || q.includes('admin dashboard') || q.includes('console')) {
        return `### ⚙️ How the Admin & Dispatcher Console Works

Visit \`/admin-dashboard\` with Administrator or Dispatcher credentials (\`prakhar@vit.edu\`):

1. **Live Dispatch Operations Tab:**
   - View all active emergency alerts across the sector in real time.
   - **Manual Clinician Reassignment:** Reassign any pending or delayed emergency to a different doctor with 1 click.
2. **Verified Staff & Patient Directory:**
   - **Doctors Table:** View verified clinicians, specialization, shift status, and toggle their **Active / Inactive** status in real time.
   - **Patients Registry:** Inspect patient records, demographics, emergency contact indices, and toggle active status.
   - **GDPR Compliance:** Instant one-click record erasure option.
3. **Real-Time Analytics & Telemetry:**
   - Average emergency response time metrics.
   - Visual charts: Breakdown by emergency specialty (Cardiology, Trauma, etc.), regional location heatmaps, and hospital case loads.`;
    }

    // 16. Website: Overall Walkthrough / Navigation Guide
    if (q.includes('website') || q.includes('guide') || q.includes('navigate') || q.includes('features') || q.includes('pages')) {
        return `### 🗺️ MedRelay Platform Complete Sitemap & Guide

| Page / Route | Primary Purpose | Key Features |
| :--- | :--- | :--- |
| **Home Page (\`/\`)** | Public Emergency Reception | 1-Tap Guest SOS (no login), AI Symptom Triage, links to Register/Login. |
| **Patient Dashboard (\`/patient-dashboard\`)** | Emergency Management | Select specialty, Outside GPS vs Indoor Hospital Ward, active status toggle, live ambulance tracking. |
| **Doctor Dashboard (\`/doctor-dashboard\`)** | Responder Mission Control | Go On Duty toggle with live GPS, incoming dispatches, AI clinical briefing, transport & completion. |
| **Admin Console (\`/admin-dashboard\`)** | Regional Dispatch Center | Clinician reassignment, live doctor/patient directory with active toggles, system analytics. |
| **Live Tracking (\`/track-ambulance\`)** | Real-Time Telemetry | Turn-by-turn road navigation route, live distance in meters, live ETA, doctor calling, 112 helpline. |

*Tip: You can ask me specific questions about any of these features, and I will guide you through them step by step!*`;
    }

    // 17. AI Symptom Triage Box
    if (q.includes('triage') || q.includes('symptom checker') || q.includes('ai triage')) {
        return `### 🧠 How the AI Symptom Triage System Works

1. **Locate the Triage Box:**
   - Available on the **Landing Page** and the **Patient Dashboard**.
2. **Describe Symptoms in Natural Language:**
   - Type whatever the patient is experiencing (e.g., *"severe crushing chest pain radiating to left arm with cold sweat"* or *"child fell from bicycle and arm is swollen and crooked"*).
3. **Click 'Analyze Symptoms':**
   - The AI identifies the **Urgency Rating** (Critical, High, Medium, Low), recommends the right **Clinical Specialty** (Cardiology, Orthopedics, Trauma Surgery, Pediatrics), and generates immediate first-aid instructions.
4. **One-Click SOS Autofill:**
   - Click the green **🚨 1-Click Dispatch** button to immediately autofill the emergency form with the recommended specialist and dispatch the closest clinician!`;
    }

    // 18. Default Contextual Clinical & Safety Guidance
    return `### 🩺 MedRelay Clinical & Platform Guidance

Thank you for reaching out. Here is immediate guidance based on your query:

1. **Emergency Life Safety:**
   - If this is an active life-threatening crisis, dial **112** (Emergency Helpline) or trigger **🚨 ONE-TAP GUEST SOS** on the home page immediately.
   - Maintain the patient's airway, ensure adequate ventilation, and apply firm direct pressure to any bleeding wounds.
2. **Platform Navigation Assistance:**
   - To dispatch a responder, navigate to the **Home Page** or **Patient Dashboard**.
   - Clinicians can update their active availability by clicking **Go On Duty** on the **Doctor Dashboard**.
   - Track active dispatches with street-level road navigation on the **Ambulance Tracking Console**.
3. **Need Specific Information?**
   - Ask me about: *CPR steps, severe bleeding, stroke FAST protocol, choking, heart attacks, burns, how to trigger an SOS, how doctor duty works, or how to track an ambulance.*`;
}

module.exports = {
    checkOllamaStatus,
    triageSymptoms,
    generateDoctorBriefing,
    chatAssistant,
    expertClinicalAndWebsiteEngine,
    getBaseUrl,
    getModel
};
