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

  // 1. Add dedicated status flags and columns to DoctorProfile and User
  console.log('Migrating DoctorProfile columns for duty state, busy state, and snapshots...');
  const alterColumns = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "isOnDuty" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "isBusy" BOOLEAN DEFAULT false;`,
    `ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;`,
    `ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3);`,
    `ALTER TABLE "DoctorProfile" ADD COLUMN IF NOT EXISTS "hospitalId" INT;`,
    `ALTER TABLE "DispatchRecord" ADD COLUMN IF NOT EXISTS "doctorNameSnapshot" TEXT;`,
    `ALTER TABLE "DispatchRecord" ADD COLUMN IF NOT EXISTS "doctorSpecializationSnapshot" TEXT;`,
    `ALTER TABLE "DispatchRecord" ADD COLUMN IF NOT EXISTS "doctorPhoneSnapshot" TEXT;`,
    `ALTER TABLE "DispatchRecord" ADD COLUMN IF NOT EXISTS "vehiclePlateSnapshot" TEXT;`,
    `ALTER TABLE "DispatchRecord" ADD COLUMN IF NOT EXISTS "hospitalNameSnapshot" TEXT;`
  ];

  for (const sql of alterColumns) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn('Column notice:', e.message);
    }
  }

  // 1c. Set existing doctors isOnDuty = true, isBusy = false
  await prisma.$executeRawUnsafe(`
    UPDATE "DoctorProfile" 
    SET "isOnDuty" = COALESCE("isAvailable", true), 
        "isBusy" = CASE WHEN "isAvailable" = false THEN true ELSE false END
    WHERE "isOnDuty" IS NULL OR "isBusy" IS NULL;
  `);

  // Foreign key constraints on DispatchRecord: preserve audit trail
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
      COALESCE(doc."fullName", d."doctorNameSnapshot") AS "doctorName",
      COALESCE(doc."specialization", d."doctorSpecializationSnapshot") AS "specialization",
      COALESCE(doc."phoneNumber", d."doctorPhoneSnapshot") AS "doctorPhone",
      COALESCE(h.name, d."hospitalNameSnapshot") AS "hospitalName",
      COALESCE(v."licensePlate", d."vehiclePlateSnapshot") AS "vehiclePlate",
      v."type" AS "vehicleType"
    FROM "EmergencyAlert" a
    LEFT JOIN "PatientProfile" p ON a."patientId" = p.id
    LEFT JOIN "DispatchRecord" d ON a.id = d."alertId"
    LEFT JOIN "DoctorProfile" doc ON d."doctorId" = doc.id
    LEFT JOIN "Hospital" h ON d."hospitalId" = h.id
    LEFT JOIN "Vehicle" v ON d."vehicleId" = v.id
    WHERE a.status IN ('PENDING', 'DISPATCHED', 'TRANSPORTING');
  `);

  // 3. Fix Item 16: Complete Child-Table Atomic Move Archival Procedure (Critique #16)
  console.log('Creating archive tables and robust cascading atomic move procedure...');
  const archiveTables = [
    `CREATE TABLE IF NOT EXISTS "EmergencyAlertArchive" (
      "id" INT PRIMARY KEY,
      "patientId" INT,
      "latitude" DOUBLE PRECISION,
      "longitude" DOUBLE PRECISION,
      "status" VARCHAR(50),
      "description" TEXT,
      "createdAt" TIMESTAMP,
      "archivedAt" TIMESTAMP DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS "DispatchRecordArchive" (
      "id" INT PRIMARY KEY,
      "alertId" INT,
      "doctorId" INT,
      "vehicleId" INT,
      "hospitalId" INT,
      "dispatchedAt" TIMESTAMP,
      "completedAt" TIMESTAMP,
      "doctorNameSnapshot" TEXT,
      "doctorSpecializationSnapshot" TEXT,
      "doctorPhoneSnapshot" TEXT,
      "vehiclePlateSnapshot" TEXT,
      "hospitalNameSnapshot" TEXT,
      "archivedAt" TIMESTAMP DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS "FeedbackArchive" (
      "id" INT PRIMARY KEY,
      "dispatchRecordId" INT,
      "userId" INT,
      "rating" INT,
      "comments" TEXT,
      "createdAt" TIMESTAMP,
      "archivedAt" TIMESTAMP DEFAULT NOW()
    );`
  ];

  for (const sql of archiveTables) {
    await prisma.$executeRawUnsafe(sql);
  }

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE PROCEDURE archive_completed_alerts(retention_days INT DEFAULT 30)
    LANGUAGE plpgsql
    AS $$
    DECLARE
      v_cutoff TIMESTAMP := NOW() - (retention_days || ' days')::INTERVAL;
    BEGIN
      -- Step 1: Move Feedback child records belonging to eligible completed alerts
      INSERT INTO "FeedbackArchive" ("id", "dispatchRecordId", "userId", "rating", "comments", "createdAt", "archivedAt")
      SELECT f."id", f."dispatchRecordId", f."userId", f."rating", f."comments", f."createdAt", NOW()
      FROM "Feedback" f
      JOIN "DispatchRecord" d ON f."dispatchRecordId" = d."id"
      JOIN "EmergencyAlert" a ON d."alertId" = a."id"
      WHERE a.status = 'COMPLETED' AND a."updatedAt" < v_cutoff
      ON CONFLICT ("id") DO NOTHING;

      DELETE FROM "Feedback" f
      USING "DispatchRecord" d, "EmergencyAlert" a
      WHERE f."dispatchRecordId" = d."id" 
        AND d."alertId" = a."id"
        AND a.status = 'COMPLETED' 
        AND a."updatedAt" < v_cutoff;

      -- Step 2: Move DispatchRecord child records belonging to eligible completed alerts
      INSERT INTO "DispatchRecordArchive" ("id", "alertId", "doctorId", "vehicleId", "hospitalId", "dispatchedAt", "completedAt", "doctorNameSnapshot", "doctorSpecializationSnapshot", "doctorPhoneSnapshot", "vehiclePlateSnapshot", "hospitalNameSnapshot", "archivedAt")
      SELECT d."id", d."alertId", d."doctorId", d."vehicleId", d."hospitalId", d."dispatchedAt", d."completedAt", d."doctorNameSnapshot", d."doctorSpecializationSnapshot", d."doctorPhoneSnapshot", d."vehiclePlateSnapshot", d."hospitalNameSnapshot", NOW()
      FROM "DispatchRecord" d
      JOIN "EmergencyAlert" a ON d."alertId" = a."id"
      WHERE a.status = 'COMPLETED' AND a."updatedAt" < v_cutoff
      ON CONFLICT ("id") DO NOTHING;

      DELETE FROM "DispatchRecord" d
      USING "EmergencyAlert" a
      WHERE d."alertId" = a."id"
        AND a.status = 'COMPLETED' 
        AND a."updatedAt" < v_cutoff;

      -- Step 3: Move parent EmergencyAlert rows
      INSERT INTO "EmergencyAlertArchive" ("id", "patientId", "latitude", "longitude", "status", "description", "createdAt", "archivedAt")
      SELECT a."id", a."patientId", a."latitude", a."longitude", a."status"::text, a."description", a."createdAt", NOW()
      FROM "EmergencyAlert" a
      WHERE a.status = 'COMPLETED' AND a."updatedAt" < v_cutoff
      ON CONFLICT ("id") DO NOTHING;

      DELETE FROM "EmergencyAlert" a
      WHERE a.status = 'COMPLETED' AND a."updatedAt" < v_cutoff;
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

  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_update_timestamp ON "EmergencyAlert";`);
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
