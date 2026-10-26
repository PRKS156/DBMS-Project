const prisma = require('../config/db');
const { formatRoadDistance, formatRoadETA, fetchRoadRoute, getHaversineDistance } = require('../../frontend/src/utils/routeService');
const { chatAssistant, checkOllamaStatus } = require('../utils/ollamaService');
const alertController = require('../controllers/alertController');
const doctorController = require('../controllers/doctorController');
const patientController = require('../controllers/patientController');
const adminController = require('../controllers/adminController');

async function runVerification() {
    console.log('=====================================================');
    console.log('🧪 VERIFYING DASHBOARD PARALLEL STATUS, CHATBOT & ROUTING');
    console.log('=====================================================\n');

    let allPassed = true;

    // -----------------------------------------------------------------
    // TEST 1: ROUTING SERVICE METRICS (Eliminating Locating... / Calculating...)
    // -----------------------------------------------------------------
    console.log('--- TEST 1: Road Distance & ETA Formatters ---');
    const testCasesDistance = [
        { input: null, expectedNot: 'Locating...' },
        { input: undefined, expectedNot: 'Locating...' },
        { input: 0, expected: 'At your location' },
        { input: 20, isAdmitted: true, expected: 'Within Facility Ward' },
        { input: 850, expected: '850 m' },
        { input: 2400, expected: '2.4 km' }
    ];

    testCasesDistance.forEach(tc => {
        const res = formatRoadDistance(tc.input, tc.isAdmitted);
        if (tc.expected && res !== tc.expected) {
            console.error(`❌ Distance format failed for ${tc.input}: expected "${tc.expected}", got "${res}"`);
            allPassed = false;
        } else if (tc.expectedNot && res === tc.expectedNot) {
            console.error(`❌ Distance format returned stuck string "${tc.expectedNot}" for input ${tc.input}`);
            allPassed = false;
        } else {
            console.log(`  ✅ formatRoadDistance(${tc.input}) => "${res}"`);
        }
    });

    const testCasesETA = [
        { duration: null, meters: null, expectedNot: 'Calculating...' },
        { duration: 0, meters: 0, expected: 'Immediate (Same ward)' },
        { duration: 120, meters: 1500, expected: '~2 mins' },
        { duration: null, meters: 2000, expected: '~3 mins' },
        { duration: 25, meters: 10, isAdmitted: true, expected: 'Immediate (Same ward)' }
    ];

    testCasesETA.forEach(tc => {
        const res = formatRoadETA(tc.duration, tc.meters, tc.isAdmitted);
        if (tc.expected && res !== tc.expected) {
            console.error(`❌ ETA format failed for (${tc.duration}, ${tc.meters}): expected "${tc.expected}", got "${res}"`);
            allPassed = false;
        } else if (tc.expectedNot && res === tc.expectedNot) {
            console.error(`❌ ETA format returned stuck string "${tc.expectedNot}"`);
            allPassed = false;
        } else {
            console.log(`  ✅ formatRoadETA(${tc.duration}, ${tc.meters}) => "${res}"`);
        }
    });

    // -----------------------------------------------------------------
    // TEST 2: GET ALERT STATUS & ROUTE BACKEND ENDPOINTS
    // -----------------------------------------------------------------
    console.log('\n--- TEST 2: Alert Status & Route Distance Resolution ---');
    const recentAlert = await prisma.emergencyAlert.findFirst({
        orderBy: { id: 'desc' }
    });

    if (recentAlert) {
        let statusResult = null;
        const mockReq = { params: { id: String(recentAlert.id) }, headers: {}, socket: {} };
        const mockRes = {
            status: (code) => ({
                json: (data) => { statusResult = { code, data }; return data; }
            })
        };

        await alertController.getAlertStatus(mockReq, mockRes);
        console.log(`  Alert #${recentAlert.id} status response:`, {
            status: statusResult?.data?.alert?.status,
            distanceFormatted: statusResult?.data?.alert?.distanceFormatted,
            etaFormatted: statusResult?.data?.alert?.etaFormatted,
            doctorLat: statusResult?.data?.alert?.doctorLat,
            doctorLng: statusResult?.data?.alert?.doctorLng
        });

        if (statusResult?.data?.alert?.distanceFormatted === 'Locating...' || statusResult?.data?.alert?.distanceFormatted === 'Unknown') {
            console.error('❌ Alert status returned stuck distanceFormatted!');
            allPassed = false;
        } else if (statusResult?.data?.alert?.etaFormatted === 'Calculating...') {
            console.error('❌ Alert status returned stuck etaFormatted!');
            allPassed = false;
        } else {
            console.log('  ✅ Backend getAlertStatus provides live distance and ETA without getting stuck!');
        }
    }

    // -----------------------------------------------------------------
    // TEST 3: SOCKET EMISSIONS FOR PARALLEL STATUS UPDATES
    // -----------------------------------------------------------------
    console.log('\n--- TEST 3: Parallel Socket Broadcasting for Doctor & Patient Status ---');
    const emittedEvents = [];
    const mockApp = {
        locals: {
            io: {
                emit: (event, payload) => {
                    emittedEvents.push({ event, payload });
                },
                to: () => ({ emit: (event, payload) => emittedEvents.push({ event, payload }) })
            }
        }
    };

    const doc = await prisma.doctorProfile.findFirst({ include: { user: true } });
    if (doc) {
        const docReq = {
            params: { id: String(doc.userId) },
            body: { status: true, isOnDuty: true },
            app: mockApp
        };
        let docResData = null;
        const docRes = {
            status: () => ({ json: (d) => { docResData = d; return d; } })
        };

        await doctorController.setStatus(docReq, docRes);
        const docEvent = emittedEvents.find(e => e.event === 'doctorStatusUpdate');
        if (docEvent) {
            console.log('  ✅ doctorStatusUpdate emitted for parallel dashboards:', docEvent.payload);
        } else {
            console.error('❌ doctorStatusUpdate was NOT emitted!');
            allPassed = false;
        }
    }

    const pat = await prisma.patientProfile.findFirst({ include: { user: true } });
    if (pat) {
        const patReq = {
            params: { id: String(pat.userId) },
            body: { isActive: true },
            app: mockApp
        };
        let patResData = null;
        const patRes = {
            status: () => ({ json: (d) => { patResData = d; return d; } })
        };

        await patientController.setStatus(patReq, patRes);
        const patEvent = emittedEvents.find(e => e.event === 'patientStatusUpdate');
        if (patEvent) {
            console.log('  ✅ patientStatusUpdate emitted for parallel dashboards:', patEvent.payload);
        } else {
            console.error('❌ patientStatusUpdate was NOT emitted!');
            allPassed = false;
        }

        // Test admin toggle for patient
        const adminTogglePatReq = {
            params: { id: String(pat.userId) },
            app: mockApp
        };
        await adminController.togglePatientActive(adminTogglePatReq, patRes);
        const adminPatEvent = emittedEvents.filter(e => e.event === 'patientStatusUpdate').pop();
        if (adminPatEvent) {
            console.log('  ✅ admin togglePatientActive emitted patientStatusUpdate:', adminPatEvent.payload);
        } else {
            console.error('❌ admin togglePatientActive did NOT emit patientStatusUpdate!');
            allPassed = false;
        }
    }

    // -----------------------------------------------------------------
    // TEST 4: OLLAMA WEBSITE CHATBOT ASSISTANT
    // -----------------------------------------------------------------
    console.log('\n--- TEST 4: Ollama Website Guide & Emergency Chatbot ---');
    const guideQuestions = [
        'How do I trigger an emergency SOS on MedRelay?',
        'How does the Doctor On Duty feature work?',
        'How can I track the ambulance on the live map?'
    ];

    for (const q of guideQuestions) {
        const reply = await chatAssistant({
            messages: [{ role: 'user', content: q }],
            userRole: 'PATIENT'
        });
        console.log(`\n  Q: "${q}"`);
        console.log(`  Engine: ${reply.engine} (${reply.model})`);
        console.log(`  Preview: ${reply.message.split('\n')[0]}...`);
        if (!reply.message || reply.message.length < 30) {
            console.error('❌ Chatbot reply was empty or incomplete!');
            allPassed = false;
        } else {
            console.log('  ✅ Informative website guide response received.');
        }
    }

    console.log('\n=====================================================');
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED: PARALLEL STATUS, CHATBOT & ROUTING FIXED!');
    } else {
        console.log('⚠️ SOME CHECKS FAILED');
    }
    console.log('=====================================================');

    await prisma.$disconnect();
    process.exit(allPassed ? 0 : 1);
}

runVerification().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
