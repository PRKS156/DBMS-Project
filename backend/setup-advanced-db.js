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

  // 1. Add dedicated lastLocationAt and hospitalId to DoctorProfile (Items #9, #10, #12)
  console.log('Migrating DoctorProfile columns for dedicated GPS heartbeat and hospital linkage...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "hospitalId" INT;
  `);

  // Foreign key constraint on DispatchRecord: protect historical audit rows with SET NULL (Item #10)
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DispatchRecord_doctorId_fkey') THEN
          ALTER TABLE "DispatchRecord" DROP CONSTRAINT "DispatchRecord_doctorId_fkey";
        END IF;
        ALTER TABLE "DispatchRecord" ADD CONSTRAINT "DispatchRecord_doctorId_fkey" 
          FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"(id) ON DELETE SET NULL;
      END $$;
    `);
  } catch (err) {
    console.log('Notice adjusting DispatchRecord foreign key:', err.message);
  }

  // 2. Fix Item 14: View for ALL truly active emergencies (PENDING, DISPATCHED, TRANSPORTING)
  console.log('Creating ActiveEmergenciesView covering all active alert states...');
  await prisma.$executeRawUnsafe(`DROP VIEW IF EXISTS "ActiveEmergenciesView";`);
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW "ActiveEmergenciesView" AS
    SELECT 
      a.id AS "alertId",
      a.status,
      a.latitude,
      a.longitude,
      a.description,
      a."createdAt",
      a."updatedAt",
      p.id AS "patientId",
      p."fullName" AS "patientName",
      p."phoneNumber" AS "patientPhone",
      p."bloodGroup",
      p."medicalHistory",
      d.id AS "dispatchId",
      doc.id AS "doctorId",
      doc."fullName" AS "doctorName",
      doc."specialization",
      doc."phoneNumber" AS "doctorPhone",
      h.name AS "hospitalName",
      v."licensePlate" AS "vehiclePlate",
      v."type" AS "vehicleType"
    FROM "EmergencyAlert" a
    LEFT JOIN "PatientProfile" p ON a."patientId" = p.id
    LEFT JOIN "DispatchRecord" d ON a.id = d."alertId"
    LEFT JOIN "DoctorProfile" doc ON d."doctorId" = doc.id
    LEFT JOIN "Hospital" h ON d."hospitalId" = h.id
    LEFT JOIN "Vehicle" v ON d."vehicleId" = v.id
    WHERE a.status IN ('PENDING', 'DISPATCHED', 'TRANSPORTING');
  `);

  // 3. Fix Item 16: Atomic Move Archival Table and Stored Procedure (DELETE ... RETURNING moved)
  console.log('Creating EmergencyAlertArchive table and atomic move archival procedure...');
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
    CREATE OR REPLACE PROCEDURE archive_completed_alerts(retention_days INT DEFAULT 30)
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Atomically move completed emergencies past retention window from operational table to cold storage archive table
      WITH moved_alerts AS (
        DELETE FROM "EmergencyAlert"
        WHERE status = 'COMPLETED' 
          AND "updatedAt" < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING id, "patientId", latitude, longitude, status::text, description, "createdAt"
      )
      INSERT INTO "EmergencyAlertArchive" ("id", "patientId", "latitude", "longitude", "status", "description", "createdAt", "archivedAt")
      SELECT id, "patientId", latitude, longitude, status, description, "createdAt", NOW()
      FROM moved_alerts
      ON CONFLICT ("id") DO NOTHING;
    END;
    $$;
  `);

  // 4. Fix Item 15: Meaningful Status Audit Trigger (avoids Prisma @updatedAt redundancy)
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

  console.log('✅ Successfully applied schema enhancements, View, Atomic Archival Stored Procedure, and Audit Trigger!');
}

main()
  .catch(e => {
    console.error('❌ Error during advanced DB setup:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
