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
 * Check if the local Ollama instance is online and list models
 */
async function checkOllamaStatus() {
    const baseUrl = getBaseUrl();
    const activeModel = getModel();
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            return {
                online: false,
                baseUrl,
                activeModel,
                error: `HTTP error ${res.status}: ${res.statusText}`
            };
        }

        const data = await res.json();
        const models = (data.models || []).map(m => m.name);
        const latencyMs = Date.now() - startTime;
        const hasActiveModel = models.some(m => m === activeModel || m.startsWith(activeModel.split(':')[0]));

        return {
            online: true,
            baseUrl,
            activeModel,
            hasActiveModel,
            models,
            latencyMs
        };
    } catch (err) {
        return {
            online: false,
            baseUrl,
            activeModel,
            error: err.name === 'AbortError' ? 'Ollama connection timed out (3.5s)' : err.message
        };
    }
}

/**
 * Normalizes output specialization into valid MedRelay database values
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

/**
 * Normalizes urgency level
 */
function normalizeUrgency(urgency) {
    if (!urgency) return 'HIGH';
    const u = String(urgency).toUpperCase();
    if (u.includes('CRIT') || u.includes('1') || u.includes('RED')) return 'CRITICAL';
    if (u.includes('HIGH') || u.includes('2') || u.includes('ORANGE') || u.includes('URGENT')) return 'HIGH';
    if (u.includes('MED') || u.includes('MOD') || u.includes('3') || u.includes('YELLOW')) return 'MEDIUM';
    return 'LOW';
}

/**
 * Rule-based fallback triage if Ollama is unreachable or response fails to parse
 */
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
 * Intelligent Symptom Triage using local Ollama LLM
 */
async function triageSymptoms({ symptoms, patientContext = {} }) {
    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length === 0) {
        throw new Error('Emergency symptom description is required for AI triage.');
    }

    const baseUrl = getBaseUrl();
    const model = getModel();

    const patientAge = patientContext.age ? `${patientContext.age} years old` : 'Unknown age';
    const patientGender = patientContext.gender || 'Unknown gender';
    const patientHistory = patientContext.medicalHistory || 'None reported';
    const bloodGroup = patientContext.bloodGroup || 'Unknown';

    const systemPrompt = `You are MedRelay's clinical emergency triage AI. You evaluate emergency complaints, classify medical urgency, determine the appropriate physician specialization, and provide immediate, actionable, pre-arrival first-aid guidance.
Your response MUST be strictly a single, valid JSON object with NO commentary or markdown wrappers outside the JSON.`;

    const userPrompt = `A patient or emergency bystander reports the following situation:
Symptom Description: "${symptoms.trim()}"
Patient Profile: Age: ${patientAge}, Gender: ${patientGender}, Blood Group: ${bloodGroup}, Pre-existing Conditions / History: ${patientHistory}.

Analyze this emergency and output ONLY a JSON object matching this schema:
{
  "urgencyLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "recommendedSpecialization": "Cardiology" | "Trauma Surgery" | "Pediatrics" | "Orthopedics" | "General Emergency",
  "triageSummary": "Concise 1-2 sentence medical summary of why this category was determined",
  "firstAidInstructions": [
    "Immediate step 1 for caller/patient while ambulance is en route",
    "Immediate step 2",
    "Immediate step 3"
  ],
  "redFlags": [
    "Critical warning sign 1 to monitor",
    "Critical warning sign 2"
  ]
}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout for local inference

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                system: systemPrompt,
                prompt: userPrompt,
                format: 'json',
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.85
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`⚠️ Ollama HTTP error ${response.status}. Falling back to internal clinical rules.`);
            return fallbackTriage(symptoms, patientContext);
        }

        const data = await response.json();
        const rawContent = data.response;

        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        } catch (parseErr) {
            // Try extracting json block if wrapped in markdown
            const match = rawContent.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            } else {
                throw parseErr;
            }
        }

        return {
            urgencyLevel: normalizeUrgency(parsed.urgencyLevel),
            recommendedSpecialization: normalizeSpecialization(parsed.recommendedSpecialization),
            triageSummary: parsed.triageSummary || 'Emergency triage evaluation complete.',
            firstAidInstructions: Array.isArray(parsed.firstAidInstructions) && parsed.firstAidInstructions.length > 0
                ? parsed.firstAidInstructions
                : ['Keep patient calm and stationary', 'Monitor airway and breathing', 'Wait for dispatched medical team'],
            redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : ['Sudden deterioration in responsiveness'],
            engine: 'ollama',
            model: data.model || model,
            totalDurationMs: data.total_duration ? Math.round(data.total_duration / 1e6) : null
        };
    } catch (err) {
        console.warn('⚠️ Ollama triage request failed or timed out:', err.message);
        return fallbackTriage(symptoms, patientContext);
    }
}

/**
 * Generate Pre-arrival Clinical Briefing for Responding Doctor
 */
async function generateDoctorBriefing({ alert, patientProfile, dispatchRecord }) {
    const baseUrl = getBaseUrl();
    const model = getModel();

    const patientName = patientProfile?.fullName || 'Anonymous Patient';
    const age = patientProfile?.age ? `${patientProfile.age}y` : 'Age unknown';
    const gender = patientProfile?.gender || 'Gender unrecorded';
    const bloodGroup = patientProfile?.bloodGroup || 'Unknown';
    const medicalHistory = patientProfile?.medicalHistory || 'None recorded';
    const incidentDescription = alert?.description || 'No incident description provided';
    const locationCoords = alert?.latitude && alert?.longitude ? `${alert.latitude}, ${alert.longitude}` : 'GPS coordinates active';

    const systemPrompt = `You are MedRelay's clinical handover copilot for emergency physicians and paramedics en route to a crisis.
Your job is to synthesize patient medical records, identify life-threatening contraindications (especially drug allergies), and formulate acute stabilization priorities.
Output MUST be strictly a single, valid JSON object with NO extra text or markdown formatting.`;

    const userPrompt = `Patient Record:
- Name: ${patientName} (${age}, ${gender})
- Verified Blood Group: ${bloodGroup}
- Recorded Medical History & Allergies: ${medicalHistory}
- Emergency Incident Telemetry: ${incidentDescription}
- Location: ${locationCoords}

Generate a structured pre-arrival clinical briefing for the responding doctor. Schema:
{
  "clinicalHeadline": "1-sentence acute clinical presentation summary",
  "criticalContraindications": ["Array of any flagged drug allergies, surgical risks, or medications to strictly avoid"],
  "immediateAssessmentSteps": ["Step 1 on scene", "Step 2 on scene", "Step 3 on scene"],
  "recommendedMedications": ["Medication 1 consideration", "Medication 2 consideration"],
  "handoverNote": "2-3 sentence clinical handover summary for emergency department reception"
}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                system: systemPrompt,
                prompt: userPrompt,
                format: 'json',
                stream: false,
                options: {
                    temperature: 0.15
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ollama returned status ${response.status}`);
        }

        const data = await response.json();
        let parsed;
        try {
            parsed = JSON.parse(data.response);
        } catch (e) {
            const match = data.response.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
            else throw e;
        }

        return {
            success: true,
            clinicalHeadline: parsed.clinicalHeadline || `Emergency clinical intervention for ${patientName}`,
            criticalContraindications: Array.isArray(parsed.criticalContraindications) ? parsed.criticalContraindications : [],
            immediateAssessmentSteps: Array.isArray(parsed.immediateAssessmentSteps) ? parsed.immediateAssessmentSteps : ['Assess ABCs (Airway, Breathing, Circulation)', 'Obtain baseline vitals', 'Establish venous access'],
            recommendedMedications: Array.isArray(parsed.recommendedMedications) ? parsed.recommendedMedications : [],
            handoverNote: parsed.handoverNote || `Patient ${patientName} encountered with acute symptoms. Primary care administered on scene.`,
            engine: 'ollama',
            model: data.model || model
        };
    } catch (err) {
        console.warn('⚠️ Ollama doctor briefing generation failed, using rule synthesis:', err.message);
        // Fallback rule synthesis
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
}

/**
 * Conversational Emergency Medical Copilot
 */
async function chatAssistant({ messages, userRole = 'PATIENT', context = {} }) {
    const baseUrl = getBaseUrl();
    const model = getModel();

    let roleGuidance = '';
    if (userRole === 'DOCTOR') {
        roleGuidance = 'You are speaking with an emergency doctor or paramedic. Provide clinical recommendations, dosages, ACLS/ATLS algorithmic steps, and explain how to use the Doctor Dashboard (Duty toggle, alert confirmations, AI clinical briefings, patient transport).';
    } else if (userRole === 'ADMIN' || userRole === 'DISPATCHER') {
        roleGuidance = 'You are assisting an emergency dispatch/admin officer. Guide them on using the Admin Console (reassigning doctors, managing the verified doctor & patient directories, toggling active statuses, monitoring real-time response analytics).';
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
  * Real-world road navigation map, live road distance (meters/km), calculated ETA, direct 'Call Doctor' button, and 112 emergency hotline.
- **Emergency Helpline:** National emergency single helpline is **112** (and **108** for ambulance).

INSTRUCTIONS:
1. When asked about website features or navigation, provide clear, step-by-step instructions referencing the specific pages, buttons, and tools.
2. When asked about medical emergencies, provide immediate life-saving first-aid steps (e.g., CPR rhythm, direct pressure on bleeding, stroke FAST protocol) and advise calling 112.
3. Keep answers concise, highly actionable, and formatted in clean markdown bullet points.`;

    // Rule-based instant answer for website navigation if offline or quick match
    const lastUserMsg = (messages[messages.length - 1]?.content || '').toLowerCase();
    const isNavQuery = lastUserMsg.includes('website') || lastUserMsg.includes('how to use') || lastUserMsg.includes('navigate') || lastUserMsg.includes('guide') || lastUserMsg.includes('feature') || lastUserMsg.includes('dashboard') || lastUserMsg.includes('sos') || lastUserMsg.includes('track');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages.map(m => ({ role: m.role || 'user', content: m.content }))
                ],
                stream: false,
                options: {
                    temperature: 0.25
                }
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Ollama chat HTTP error ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            message: data.message?.content || data.response || 'No response generated.',
            engine: 'ollama',
            model: data.model || model
        };
    } catch (err) {
        console.warn('⚠️ Ollama chat error, generating intelligent guide fallback:', err.message);

        let fallbackMsg = '';
        if (lastUserMsg.includes('sos') || lastUserMsg.includes('trigger') || lastUserMsg.includes('emergency')) {
            fallbackMsg = `### 🚨 How to Trigger an Emergency SOS on MedRelay:\n\n1. **One-Tap Guest SOS (Home Page):** On the landing page, click the red **🚨 ONE-TAP GUEST SOS** button. No login needed.\n2. **From Patient Dashboard:** Go to **Need Help?**, select your emergency type (Cardiology, Trauma, etc.), pick Outside GPS or Indoor Ward, and click **🚨 DISPATCH IMMEDIATE DOCTOR**.\n3. **AI Triage Assist:** Enter symptoms into the **AI Symptom Triage** box and click *Analyze Symptoms* — it automatically recommends the right specialist and sets up your SOS.`;
        } else if (lastUserMsg.includes('doctor') || lastUserMsg.includes('duty') || lastUserMsg.includes('on duty')) {
            fallbackMsg = `### 🩺 How the Doctor Dashboard Works:\n\n1. **Go On Duty:** Click the green **🟢 Go On Duty** button. Your live GPS location and status will be securely transmitted to the dispatch engine.\n2. **Accept Dispatches:** When an emergency alert is assigned to you, it appears in your **Active Dispatches** queue.\n3. **AI Clinical Briefing:** View pre-arrival handover notes, flagged drug allergies, and contraindications before reaching the scene.\n4. **Transport & Complete:** Click **Start Transport** when moving the patient, and **Complete Emergency** once delivered.`;
        } else if (lastUserMsg.includes('track') || lastUserMsg.includes('ambulance') || lastUserMsg.includes('locat')) {
            fallbackMsg = `### 🚑 How to Track an Ambulance / Doctor:\n\n1. When you trigger an SOS, click **📍 Open Full-Screen Live Tracking** or navigate to \`/track-ambulance\`.\n2. You will see:\n   - **Live Distance & ETA:** Updated in real time via street-level road routing.\n   - **Assigned Doctor Card:** Doctor name, specialization, vehicle plate number, and a direct **📞 Call Doctor** button.\n   - **Live Navigation Map:** Turn-by-turn route connecting the doctor to your location.`;
        } else if (lastUserMsg.includes('admin') || lastUserMsg.includes('dispatcher')) {
            fallbackMsg = `### ⚙️ How the Admin & Dispatcher Console Works:\n\n1. **Operations Tab:** View live sector emergencies and manually reassign clinicians.\n2. **Directory Tab:** See all registered doctors & patients. Toggle their **Active/Inactive** status with one click, or perform GDPR data erasure.\n3. **Analytics Tab:** Inspect response times, specialty distributions, and hospital case loads.`;
        } else if (isNavQuery) {
            fallbackMsg = `### 🗺️ MedRelay Platform Guide:\n\n- **Home Page (\`/\`):** 1-Tap Emergency SOS, AI Symptom Triage, and account login.\n- **Patient Dashboard (\`/patient-dashboard\`):** Trigger emergency dispatches, toggle active monitoring status, and track ambulances.\n- **Doctor Dashboard (\`/doctor-dashboard\`):** Toggle On/Off duty, receive emergency calls, and read AI clinical briefings.\n- **Admin Console (\`/admin-dashboard\`):** Dispatch management, live doctor/patient directory toggles, and system telemetry.\n- **Live Tracking (\`/track-ambulance\`):** Full-screen road navigation, doctor contact, and 112 helpline.`;
        } else {
            fallbackMsg = `⚠️ **MedRelay Safety Protocol:** Stay calm. Emergency responders are dispatched. For medical assistance, keep airway open and apply direct pressure to wounds. Call **112** for immediate emergency telephone dispatch. (Local Ollama: ${err.message})`;
        }

        return {
            success: true,
            message: fallbackMsg,
            engine: 'guide_engine',
            model: 'MedRelay Intelligent Guide Engine'
        };
    }
}

module.exports = {
    checkOllamaStatus,
    triageSymptoms,
    generateDoctorBriefing,
    chatAssistant,
    getBaseUrl,
    getModel
};
