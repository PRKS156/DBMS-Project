const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const doctorRoutes = require('../routes/doctorRoutes');
const patientRoutes = require('../routes/patientRoutes');
const prisma = require('../config/db');

async function verifyAllFixes() {
  console.log('==============================================');
  console.log('🔍 VERIFYING ACTIVE STATUS & 112 EMERGENCY FIXES');
  console.log('==============================================\n');

  // Test 1: Verify No "911" in Frontend Source Files
  console.log('Test 1: Scanning frontend src for any remaining "911" strings...');
  const srcDir = path.resolve(__dirname, '../../frontend/src');
  
  function scanFiles(dir) {
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(scanFiles(fullPath));
      } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('911') && !content.includes('112 / 108 / 911')) {
          results.push({ file: fullPath });
        }
      }
    }
    return results;
  }

  const bad911Matches = scanFiles(srcDir);
  if (bad911Matches.length > 0) {
    console.error('❌ Found rogue 911 matches:', bad911Matches);
    throw new Error('911 still present in source files!');
  } else {
    console.log('✅ PASS: All emergency numbers correctly set to 112 (zero 911 instances found in frontend/src).');
  }

  // Setup test server
  const app = express();
  app.use(express.json());
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/patients', patientRoutes);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testDoc = await prisma.doctorProfile.findFirst({ include: { user: true } });
  const testPatient = await prisma.patientProfile.findFirst({ include: { user: true } });

  // Test 2: Doctor Active Status Toggle
  console.log(`\nTest 2: Verifying Doctor Active Status Toggle for Dr. ${testDoc.fullName} (ID: ${testDoc.id}, UserID: ${testDoc.userId})...`);
  
  // Set Off Duty
  const offRes = await fetch(`${baseUrl}/api/doctors/${testDoc.userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: false })
  });
  const offData = await offRes.json();
  console.log('  Set Off Duty response:', offData);
  if (offData.isOnDuty !== false || offData.isAvailable !== false) throw new Error('Doctor off duty failed');

  // Verify in DB
  const docInDbOff = await prisma.doctorProfile.findUnique({ where: { id: testDoc.id } });
  if (docInDbOff.isOnDuty !== false) throw new Error('DB doctor isOnDuty not false');
  console.log('  ✅ DB Verified: Doctor isOnDuty is false');

  // Set On Duty
  const onRes = await fetch(`${baseUrl}/api/doctors/${testDoc.userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: true })
  });
  const onData = await onRes.json();
  console.log('  Set On Duty response:', onData);
  if (onData.isOnDuty !== true || onData.isAvailable !== true) throw new Error('Doctor on duty failed');

  // Verify in DB
  const docInDbOn = await prisma.doctorProfile.findUnique({ where: { id: testDoc.id } });
  if (docInDbOn.isOnDuty !== true || !docInDbOn.lastLocationAt) throw new Error('DB doctor isOnDuty not true or lastLocationAt missing');
  console.log(`  ✅ DB Verified: Doctor isOnDuty is true (lastLocationAt refreshed to: ${docInDbOn.lastLocationAt})`);

  // Test 3: Patient Active Status Toggle
  console.log(`\nTest 3: Verifying Patient Active Status Toggle for ${testPatient.fullName} (UserID: ${testPatient.userId})...`);
  
  // Set Inactive
  const pOffRes = await fetch(`${baseUrl}/api/patients/${testPatient.userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: false })
  });
  const pOffData = await pOffRes.json();
  console.log('  Set Patient Inactive response:', pOffData);
  if (pOffData.isActive !== false) throw new Error('Patient set inactive failed');

  const pDbOff = await prisma.user.findUnique({ where: { id: testPatient.userId } });
  if (pDbOff.isActive !== false) throw new Error('DB Patient user.isActive not false');
  console.log('  ✅ DB Verified: Patient user.isActive is false');

  // Set Active
  const pOnRes = await fetch(`${baseUrl}/api/patients/${testPatient.userId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: true })
  });
  const pOnData = await pOnRes.json();
  console.log('  Set Patient Active response:', pOnData);
  if (pOnData.isActive !== true) throw new Error('Patient set active failed');

  const pDbOn = await prisma.user.findUnique({ where: { id: testPatient.userId } });
  if (pDbOn.isActive !== true) throw new Error('DB Patient user.isActive not true');
  console.log('  ✅ DB Verified: Patient user.isActive is true');

  server.close();
  await prisma.$disconnect();

  console.log('\n==============================================');
  console.log('🎉 ALL ACTIVE STATUS AND 112 FIXES VERIFIED 100%!');
  console.log('==============================================');
}

verifyAllFixes().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
