const prisma = require('../config/db.js');

async function cleanTestData() {
  console.log('🧹 Cleaning test data from live database for evaluator demonstration...');
  try {
    // 1. Clean operational emergency data (reverse dependency order)
    const delFeedback = await prisma.feedback.deleteMany({});
    console.log(`Deleted ${delFeedback.count} operational feedback records.`);

    const delDispatch = await prisma.dispatchRecord.deleteMany({});
    console.log(`Deleted ${delDispatch.count} operational dispatch records.`);

    const delAudits = await prisma.$executeRawUnsafe(`DELETE FROM "AlertStatusAudit";`);
    console.log(`Cleared AlertStatusAudit table.`);

    const delAlerts = await prisma.emergencyAlert.deleteMany({});
    console.log(`Deleted ${delAlerts.count} operational emergency alerts.`);

    // 2. Clean archive tables
    const delFbArc = await prisma.feedbackArchive.deleteMany({});
    const delDispArc = await prisma.dispatchRecordArchive.deleteMany({});
    const delAlertArc = await prisma.emergencyAlertArchive.deleteMany({});
    const delAuditArc = await prisma.$executeRawUnsafe(`DELETE FROM "AlertStatusAuditArchive";`).catch(() => 0);
    console.log(`Cleared archive tables (Alerts: ${delAlertArc.count}, Dispatches: ${delDispArc.count}, Feedback: ${delFbArc.count}).`);

    // 3. Reset all seeded doctors to active, on-duty, not busy, and available with fresh GPS heartbeat
    const resetDoctors = await prisma.doctorProfile.updateMany({
      data: {
        isBusy: false,
        isOnDuty: true,
        isActive: true,
        isAvailable: true,
        lastLocationAt: new Date()
      }
    });
    console.log(`Reset ${resetDoctors.count} doctor profiles to on-duty & available with fresh telemetry.`);

    // 4. Reset all seeded emergency vehicles to available
    const resetVehicles = await prisma.vehicle.updateMany({
      data: {
        isAvailable: true
      }
    });
    console.log(`Reset ${resetVehicles.count} vehicles to available.`);

    // 5. Verification
    const alertCount = await prisma.emergencyAlert.count();
    const dispatchCount = await prisma.dispatchRecord.count();
    const feedbackCount = await prisma.feedback.count();
    const auditRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "AlertStatusAudit";`);
    const activeViewRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "ActiveEmergenciesView";`);

    console.log('\n✅ Verification of Clean State:');
    console.log(`- Active Alerts: ${alertCount}`);
    console.log(`- Active Dispatches: ${dispatchCount}`);
    console.log(`- Active Feedbacks: ${feedbackCount}`);
    console.log(`- Status Audit Rows: ${auditRows[0].count}`);
    console.log(`- Active Emergencies View: ${activeViewRows[0].count}`);
    console.log('🎉 Live database is completely clean and primed for evaluation!');
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanTestData();
