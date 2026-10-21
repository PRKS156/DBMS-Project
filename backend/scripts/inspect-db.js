const prisma = require('../config/db.js');

async function inspect() {
  try {
    const alerts = await prisma.emergencyAlert.findMany({
      include: {
        dispatchRecord: {
          include: {
            feedback: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });
    console.log('Total Emergency Alerts:', alerts.length);
    console.log('Alerts:', alerts.map(a => ({
      id: a.id,
      patientId: a.patientId,
      status: a.status,
      desc: a.description,
      createdAt: a.createdAt,
      dispatch: a.dispatchRecord ? {
        id: a.dispatchRecord.id,
        doctorId: a.dispatchRecord.doctorId,
        vehicleId: a.dispatchRecord.vehicleId,
        feedback: a.dispatchRecord.feedback ? a.dispatchRecord.feedback.id : null
      } : null
    })));

    const audits = await prisma.$queryRawUnsafe(`SELECT * FROM "AlertStatusAudit" ORDER BY "auditId" DESC LIMIT 10;`).catch(e => e.message);
    console.log('Audits (last 10):', audits);

    const archives = await prisma.emergencyAlertArchive.findMany();
    console.log('Archived alerts count:', archives.length);
  } catch (err) {
    console.error('Error inspecting:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
