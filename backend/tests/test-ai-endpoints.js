const fetch = globalThis.fetch;
const http = require('http');

async function runTests() {
  console.log('Testing MedRelay Ollama AI Endpoints...');

  // 1. Direct status test
  const { checkOllamaStatus, triageSymptoms, generateDoctorBriefing } = require('../utils/ollamaService');
  
  console.log('\n--- 1. Testing Ollama Status ---');
  const status = await checkOllamaStatus();
  console.log('Status Result:', status);

  console.log('\n--- 2. Testing Symptom Triage (Cardiac Case) ---');
  const cardiacTriage = await triageSymptoms({
    symptoms: 'Crushing central chest pain radiating to left arm with excessive diaphoresis and nausea',
    patientContext: { age: 54, gender: 'Male', bloodGroup: 'O+', medicalHistory: 'Hypertension' }
  });
  console.log('Cardiac Triage Result:');
  console.log('Specialization:', cardiacTriage.recommendedSpecialization);
  console.log('Urgency:', cardiacTriage.urgencyLevel);
  console.log('Summary:', cardiacTriage.triageSummary);
  console.log('First Aid Steps:', cardiacTriage.firstAidInstructions);

  console.log('\n--- 3. Testing Symptom Triage (Pediatric Case) ---');
  const pedsTriage = await triageSymptoms({
    symptoms: '3-year-old child with persistent high fever 104F and febrile seizure, shaking uncontrollably',
    patientContext: { age: 3, gender: 'Female', bloodGroup: 'B+' }
  });
  console.log('Pediatric Triage Result:');
  console.log('Specialization:', pedsTriage.recommendedSpecialization);
  console.log('Urgency:', pedsTriage.urgencyLevel);

  console.log('\n--- 4. Testing Doctor Briefing ---');
  const briefing = await generateDoctorBriefing({
    alert: { description: 'Trauma Surgery | Deep laceration to right forearm from broken glass, profuse bleeding, patient dizzy' },
    patientProfile: {
      fullName: 'David Miller',
      age: 42,
      gender: 'Male',
      bloodGroup: 'A-',
      medicalHistory: 'Penicillin allergy, Asthma, previous splenectomy'
    }
  });
  console.log('Doctor Briefing Result:');
  console.log('Headline:', briefing.clinicalHeadline);
  console.log('Contraindications:', briefing.criticalContraindications);
  console.log('Steps:', briefing.immediateAssessmentSteps);
  console.log('Medications:', briefing.recommendedMedications);

  console.log('\n✅ All Ollama AI Service Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
