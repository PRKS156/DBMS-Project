const prisma = require('../config/db.js');

async function testArchivalProcedure() {
  console.log('🧪 Testing archive_completed_alerts stored procedure with child rows...');

  const patient = await prisma.patientProfile.findFirst();
  const doctor = await prisma.doctorProfile.findFirst();
  const hospital = await prisma.hospital.findFirst();
  const vehicle = await prisma.vehicle.findFirst();

  if (!patient || !doctor) {
    console.error('Missing patient or doctor for test.');
    process.exit(1);
  }

  // 1. Insert test emergency alert marked COMPLETED
  const testAlert = await prisma.emergencyAlert.create({
    data: {
      patientId: patient.id,
      latitude: 12.9715,
      longitude: 79.1585,
      status: 'COMPLETED',
      description: 'Test emergency for archival procedure validation'
    }
  });

  // 2. Insert child DispatchRecord with snapshots
  const testDispatch = await prisma.dispatchRecord.create({
    data: {
      alertId: testAlert.id,
      doctorId: doctor.id,
      vehicleId: vehicle ? vehicle.id : null,
      hospitalId: hospital ? hospital.id : null,
      doctorNameSnapshot: doctor.fullName,
      doctorSpecializationSnapshot: doctor.specialization,
      doctorPhoneSnapshot: doctor.phoneNumber,
      vehiclePlateSnapshot: vehicle ? vehicle.licensePlate : 'TN-23-TEST',
      hospitalNameSnapshot: hospital ? hospital.name : 'Test Hospital',
      completedAt: new Date()
    }
  });

  // 3. Insert child Feedback
  const testFeedback = await prisma.feedback.create({
    data: {
      dispatchRecordId: testDispatch.id,
      userId: patient.userId,
      rating: 5,
      comments: 'Excellent archival test response'
    }
  });

  // 4. Backdate alert to 35 days ago
  await prisma.$executeRawUnsafe(
    `UPDATE "EmergencyAlert" SET "updatedAt" = NOW() - INTERVAL '35 days' WHERE id = $1;`,
    testAlert.id
  );

  // 5. Execute stored procedure
  await prisma.$executeRawUnsafe(`CALL archive_completed_alerts(30);`);

  // 6. Verify moved cleanly
  const alertInOp = await prisma.emergencyAlert.findUnique({ where: { id: testAlert.id } });
  const dispatchInOp = await prisma.dispatchRecord.findUnique({ where: { id: testDispatch.id } });
  const feedbackInOp = await prisma.feedback.findUnique({ where: { id: testFeedback.id } });

  const archivedAlert = await prisma.$queryRawUnsafe(`SELECT * FROM "EmergencyAlertArchive" WHERE id = $1;`, testAlert.id);
  const archivedDispatch = await prisma.$queryRawUnsafe(`SELECT * FROM "DispatchRecordArchive" WHERE id = $1;`, testDispatch.id);
  const archivedFeedback = await prisma.$queryRawUnsafe(`SELECT * FROM "FeedbackArchive" WHERE id = $1;`, testFeedback.id);

  const passed = !alertInOp && !dispatchInOp && !feedbackInOp && 
                 archivedAlert.length > 0 && archivedDispatch.length > 0 && archivedFeedback.length > 0;

  // Cleanup
  await prisma.$executeRawUnsafe(`DELETE FROM "FeedbackArchive" WHERE id = $1;`, testFeedback.id);
  await prisma.$executeRawUnsafe(`DELETE FROM "DispatchRecordArchive" WHERE id = $1;`, testDispatch.id);
  await prisma.$executeRawUnsafe(`DELETE FROM "EmergencyAlertArchive" WHERE id = $1;`, testAlert.id);

  if (passed) {
    console.log('✅ PASS: Archive procedure cleanly moved parent and all child rows without data loss or FK errors.');
  } else {
    throw new Error('FAIL: Archive procedure failed validation check.');
  }
}

testArchivalProcedure()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
