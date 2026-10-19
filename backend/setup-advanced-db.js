const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting advanced database setup for MedRelay...');

  // 0. Ensure AlertStatus enum supports TRANSPORTING lifecycle stage
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "AlertStatus" ADD VALUE IF NOT EXISTS 'TRANSPORTING';`);
  } catch (err) {
    console.log('Enum value notice:', err.message);
  }

  // 1. Fix Item 14: View for ALL truly active emergencies (PENDING, DISPATCHED, TRANSPORTING)
  console.log('Creating ActiveEmergenciesView covering all active alert states...');
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW "ActiveEmergenciesView" AS
    SELECT id, "patientId", latitude, longitude, status, description, "createdAt", "updatedAt"
    FROM "EmergencyAlert"
    WHERE status IN ('PENDING', 'DISPATCHED', 'TRANSPORTING');
  `);

  // 2. Fix Item 16: True Archival Table and Stored Procedure (preserves medical records for compliance)
  console.log('Creating EmergencyAlertArchive table and archival procedure...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EmergencyAlertArchive" (
      "id" INT PRIMARY KEY,
      "patientId" INT,
      "latitude" DOUBLE PRECISION,
      "longitude" DOUBLE PRECISION,
      "status" VARCHAR(50),
      "description" TEXT,
      "createdAt" TIMESTAMP,
      "archivedAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE PROCEDURE archive_completed_alerts()
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Copy completed emergencies older than 30 days to archival table for long-term clinical audit compliance
      INSERT INTO "EmergencyAlertArchive" ("id", "patientId", "latitude", "longitude", "status", "description", "createdAt")
      SELECT id, "patientId", latitude, longitude, status, description, "createdAt"
      FROM "EmergencyAlert"
      WHERE status = 'COMPLETED' AND "updatedAt" < NOW() - INTERVAL '30 days'
      ON CONFLICT ("id") DO NOTHING;
    END;
    $$;
  `);

  // 3. Fix Item 15: Meaningful Status Audit Trigger (avoids Prisma @updatedAt redundancy)
  console.log('Creating AlertStatusAudit table and real-time status change audit trigger...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AlertStatusAudit" (
      "auditId" SERIAL PRIMARY KEY,
      "alertId" INT NOT NULL,
      "oldStatus" VARCHAR(50),
      "newStatus" VARCHAR(50),
      "changedAt" TIMESTAMP DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION log_alert_status_transition()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO "AlertStatusAudit" ("alertId", "oldStatus", "newStatus", "changedAt")
        VALUES (NEW.id, OLD.status, NEW.status, NOW());
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_log_alert_status ON "EmergencyAlert";`);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_log_alert_status
    AFTER UPDATE ON "EmergencyAlert"
    FOR EACH ROW
    EXECUTE FUNCTION log_alert_status_transition();
  `);

  console.log('✅ Successfully created View, Archive Stored Procedure, and Audit Trigger in PostgreSQL!');
}

main()
  .catch(e => {
    console.error('❌ Error during advanced DB setup:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
