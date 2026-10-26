/**
 * MedRelay Client-Side Emergency Clinical & Website Navigation Knowledge Engine
 * Provides rich, context-specific markdown guides and first-aid instructions
 * when no cloud API key is configured or when the backend AI service is offline.
 */

export function getClientSideKnowledge(queryText, userRole = 'PATIENT') {
  const q = (queryText || '').toLowerCase().trim();

  // 1. Greetings & Conversational
  if (q.match(/^(hi|hello|hey|greetings|hola|good morning|good afternoon|good evening|who are you|what can you do)/)) {
    return `### 👋 Hello! I am MedRelay AI

I am your **Emergency Medical Copilot & Website Guide**. I can assist you right now with:

- 🗺️ **Website Navigation:** Ask how to use any page, trigger an SOS, toggle doctor duty, track ambulances, or navigate the admin console.
- 🩺 **AI Symptom Triage:** Tell me your symptoms, and I will analyze clinical urgency and recommend the right specialty.
- 🫀 **Life-Saving First Aid:** Immediate protocols for CPR, severe bleeding, stroke FAST, choking, fractures, burns, and anaphylaxis.
- 🚨 **Emergency Single Helpline:** In life-threatening emergencies, dial **112** (All-India Helpline) or **108** (Ambulance).

*Type your question below or click any of the quick suggestion buttons above!*`;
  }

  // 2. CPR & Cardiac Arrest
  if (q.includes('cpr') || q.includes('resuscitation') || q.includes('chest compression') || q.includes('not breathing')) {
    return `### 🫀 Adult CPR (Cardiopulmonary Resuscitation) Protocol

> **Immediate Action:** Call **112** immediately. If an AED is available, send someone to retrieve it.

1. **Verify Responsiveness:** Tap the collarbone firmly and shout: *"Are you okay?"* Check for normal breathing for 5–10 seconds.
2. **Hand Placement:** Place the heel of one hand in the **center of the chest** (lower sternum). Interlock fingers with the second hand.
3. **Hard & Fast Compressions (100–120 bpm):**
   - Push down at least **2 inches (5 cm)** deep.
   - Allow complete chest recoil after every compression.
   - *Rhythm tip:* Match the beat of *"Stayin' Alive"* by the Bee Gees.
4. **Ratio:** 30 compressions followed by 2 rescue breaths (or continuous Hands-Only CPR if untrained in breaths) until medical responders arrive.`;
  }

  // 3. Bleeding & Hemorrhage
  if (q.includes('bleed') || q.includes('cut') || q.includes('wound') || q.includes('hemorrhag') || q.includes('stab')) {
    return `### 🩸 Severe Bleeding Control Protocol

1. **Continuous Direct Pressure:**
   - Press firmly on the wound using sterile gauze or clean cloth with both hands.
   - **Do NOT remove soaked dressings;** layer fresh cloth directly on top to protect the clotting process.
2. **Elevate the Injury:**
   - If no fracture is suspected, raise the bleeding extremity above heart level.
3. **Severe Arterial Bleeding (Spurting Blood):**
   - If direct pressure fails, apply a commercial tourniquet 2–3 inches above the wound (never over a joint) and tighten until bleeding ceases. Note the exact application time.
4. **Prevent Shock:**
   - Keep patient lying flat, cover with a warm blanket, and do not provide oral food or drinks.`;
  }

  // 4. Stroke Recognition (FAST)
  if (q.includes('stroke') || q.includes('fast') || q.includes('facial droop') || q.includes('slurred') || q.includes('arm weak')) {
    return `### 🧠 Acute Stroke Recognition — F.A.S.T. Protocol

> **Time is Brain:** 1.9 million brain cells die every minute during an untreated ischemic stroke.

- **F — Face Drooping:** Ask them to smile. Does one side of the face droop or appear uneven?
- **A — Arm Weakness:** Ask them to raise both arms. Does one arm drift downward or cannot be raised?
- **S — Speech Difficulty:** Ask them to repeat a simple phrase. Is their speech slurred or strange?
- **T — Time to Call 112:** If **ANY** symptom is present, call **112** immediately and record the exact time symptoms started.

*Precaution:* Do NOT give aspirin, food, or water until emergency clinical evaluation is performed.`;
  }

  // 5. Choking & Heimlich Maneuver
  if (q.includes('chok') || q.includes('heimlich') || q.includes('airway') || q.includes('strangl')) {
    return `### 👶 Choking First Aid (Heimlich Maneuver)

#### Conscious Adult or Child Over 1 Year:
1. **5 Back Blows:** Lean the person forward and strike firmly between the shoulder blades with the heel of your hand.
2. **5 Abdominal Thrusts:** Stand behind the person, wrap arms around waist, place a fist thumb-side just above the navel, grasp with other hand, and thrust quickly inward and upward.
3. Alternate 5 back blows and 5 abdominal thrusts until the airway is clear.

#### Infant Under 1 Year:
- 5 gentle back slaps resting face down on your forearm, followed by 5 two-finger chest thrusts face up. Never perform blind finger sweeps.`;
  }

  // 6. Heart Attack & Angina
  if (q.includes('heart attack') || q.includes('chest pain') || q.includes('angina') || q.includes('cardiac')) {
    return `### 💔 Heart Attack & Chest Pain First Aid

1. **Immediate Call:** Dial **112** or trigger **1-Tap SOS** immediately.
2. **Semi-Fowler Seated Rest:** Seat the patient propped up against pillows with knees bent. This reduces heart strain and eases breathing.
3. **Loosen Tight Clothes:** Unbutton tight collars, belts, and waistbands.
4. **Nitroglycerin / Aspirin:**
   - If the patient has prescribed sublingual nitroglycerin, assist them with their dose.
   - Non-coated chewable aspirin (300 mg) may be given if no allergy or bleeding disorder is present.
5. If the patient loses consciousness or pulse, begin **CPR** immediately.`;
  }

  // 7. Burns
  if (q.includes('burn') || q.includes('scald') || q.includes('fire')) {
    return `### 🔥 Burn First Aid Protocol

1. **Cool with Running Water:** Hold the burned area under **cool, running tap water for 15–20 minutes**.
2. **NO Ice or Butter:** Never apply ice, butter, oil, or toothpaste — these trap heat and promote infection.
3. **Remove Constricting Items:** Take off rings and watches before swelling starts. Do NOT peel off clothes stuck to the burn.
4. **Cover Cleanly:** Wrap loosely with clean cling wrap or sterile non-stick gauze.`;
  }

  // 8. Fractures & Sprains
  if (q.includes('fractur') || q.includes('broken bone') || q.includes('bone') || q.includes('sprain')) {
    return `### 🦴 Bone Fracture & Injury Protocol

1. **Immobilize the Limb:** Keep the injured limb in the exact position found. **Do NOT attempt to realign or straighten bent bones.**
2. **Splint Safely:** Support the joint above and below with cardboard, wood, or folded newspaper secured gently with cloth.
3. **Cold Compress:** Apply wrapped ice packs for 15 minutes to reduce swelling.
4. **Control Bleeding:** If bone pierces skin (compound fracture), cover with sterile cloth and press gently around the wound.`;
  }

  // 9. Seizures
  if (q.includes('seizur') || q.includes('convulsion') || q.includes('epilep')) {
    return `### ⚡ Seizure First Aid Protocol

1. **Clear Hazards:** Move sharp objects, furniture, and hard items away. Place something soft under the head.
2. **Do NOT Restrain:** Never pin the person down or restrict their movements.
3. **NEVER Put Anything in the Mouth:** No spoons, fingers, or liquids.
4. **Recovery Position:** Once shaking ends, roll the person onto their **side (recovery position)** to keep the airway open. Time the seizure. Call **112** if longer than 5 minutes.`;
  }

  // 10. Allergies & Anaphylaxis
  if (q.includes('allerg') || q.includes('anaphyl') || q.includes('epipen') || q.includes('swelling')) {
    return `### 🐝 Anaphylaxis (Severe Allergic Reaction) Protocol

1. **Use Epinephrine Auto-Injector (EpiPen):** Press firmly into the **outer middle thigh** until click is heard; hold for 3–5 seconds.
2. **Call 112:** Always transport to emergency care, as reactions can have a secondary delayed wave.
3. **Lay Flat with Legs Raised:** Unless having severe respiratory distress, keep patient lying down to prevent fatal blood pressure drop.`;
  }

  // 11. Website: How to Trigger SOS
  if (q.includes('how to trigger') || q.includes('trigger sos') || q.includes('dispatch doctor') || q.includes('how do i trigger')) {
    return `### 🚨 How to Trigger an Emergency SOS on MedRelay

- **One-Tap Guest SOS (Home Page \`/\`):**
  Click the large red **🚨 ONE-TAP GUEST SOS** button. No login needed. Captures your current GPS and dispatches the nearest responder immediately.
- **Patient Dashboard (\`/patient-dashboard\`):**
  Log in as a patient, select your condition (Cardiology, Trauma, etc.), pick Outside GPS or Indoor Hospital Ward (Building, Floor, Room, Bed), and click **🚨 DISPATCH IMMEDIATE DOCTOR**.
- **AI Symptom Triage Box:**
  Type your symptoms in the triage box and click *Analyze Symptoms* — click **1-Click Dispatch** to autofill the form with the recommended medical specialist.`;
  }

  // 12. Website: Doctor On Duty
  if (q.includes('doctor on duty') || q.includes('doctor duty') || q.includes('doctor dashboard') || q.includes('on duty') || q.includes('go on duty')) {
    return `### 🩺 How the Doctor Dashboard & Duty System Works

1. **Go On Duty:** Click the green **🟢 Go On Duty** toggle button at \`/doctor-dashboard\`. Your device initiates a live GPS heartbeat (\`lastLocationAt\`), qualifying you for emergency dispatch matching.
2. **Receive & Accept Alerts:** Dispatches matching your specialty and location appear in your **Active Dispatches** queue.
3. **AI Clinical Handover Briefing:** Review patient medical history, blood group, flagged contraindications, and suggested stabilization steps before arrival.
4. **Transport & Completion:** Click **Start Transport** when moving the patient, and **Complete Emergency** upon hospital delivery.`;
  }

  // 13. Website: Track Ambulance
  if (q.includes('track ambulance') || q.includes('track') || q.includes('ambulance') || q.includes('eta') || q.includes('locat')) {
    return `### 🚑 How to Track the Ambulance & Responder

1. **Open Tracking Console:** Navigate to \`/track-ambulance?alertId=YOUR_ALERT_ID\` or click **📍 Open Full-Screen Live Tracking** on your dashboard.
2. **Live Road Telemetry:** Shows turn-by-turn road route, live distance in meters/km, and calculated arrival ETA.
3. **Doctor Contact Card:** View assigned clinician name, vehicle plate, and a direct **📞 Call Doctor** button.
4. **Helpline Integration:** Includes an instant **🚨 Call 112** button for telephone backup.`;
  }

  // 14. Website: Admin Console
  if (q.includes('admin') || q.includes('dispatcher') || q.includes('admin dashboard') || q.includes('console')) {
    return `### ⚙️ How the Admin & Dispatcher Console Works

Visit \`/admin-dashboard\` with Administrator credentials (\`prakhar@vit.edu\`):
1. **Operations Tab:** Monitor active sector emergencies with 1-click doctor reassignment.
2. **Directory Tab:** View registered doctors and patients. Toggle their **Active / Inactive** status with 1 click in real time, or execute GDPR data erasure.
3. **Analytics Tab:** Live average response times, specialty case distributions, and hospital load indices.`;
  }

  // 15. Website Complete Sitemap
  if (q.includes('website') || q.includes('guide') || q.includes('navigate') || q.includes('features') || q.includes('pages')) {
    return `### 🗺️ MedRelay Platform Guide

- **Home (\`/\`):** Instant One-Tap Guest SOS, AI Symptom Triage, and Account Access.
- **Patient Dashboard (\`/patient-dashboard\`):** Trigger emergency SOS, select Outside vs Indoor Ward, toggle active monitoring, and track ambulances.
- **Doctor Dashboard (\`/doctor-dashboard\`):** Toggle On/Off duty, receive emergency calls, read AI clinical briefings, and log patient transport.
- **Admin Console (\`/admin-dashboard\`):** Emergency fleet dispatch, live doctor/patient directory with active toggles, and response analytics.
- **Live Tracking (\`/track-ambulance\`):** Full-screen road navigation, doctor contact, and 112 helpline.`;
  }

  // 16. Default Fallback
  return `### 🩺 MedRelay Clinical & Platform Guidance

1. **Immediate Emergency Help:**
   - If in an acute crisis, dial **112** or click **🚨 ONE-TAP GUEST SOS** on the home page.
   - Maintain clear airway, reassure the patient, and apply firm pressure to any bleeding.
2. **Navigation Guidance:**
   - Ask me about: *CPR steps, bleeding control, stroke FAST, how to trigger SOS, doctor duty toggle, or how to track an ambulance.*
3. **AI Engine:**
   - Click the ⚙️ icon in the header to add your free **Google Gemini** or **Groq** API key for unlimited live cloud intelligence!`;
}
