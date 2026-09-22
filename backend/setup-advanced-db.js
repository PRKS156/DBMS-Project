const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting advanced database setup for PDF requirements...');

  // 1. Create a View
  console.log('Creating ActiveEmergenciesView...');
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE VIEW "ActiveEmergenciesView" AS
    SELECT id, "patientId", latitude, longitude, status, description, "createdAt"
    FROM "EmergencyAlert"
    WHERE status = 'PENDING';
  `);

  // 2. Create a Stored Procedure
  // This procedure could be used to clean up or archive alerts, here we just make a simple one that logs or updates status.
  console.log('Creating Stored Procedure archive_completed_alerts...');
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE PROCEDURE archive_completed_alerts()
    LANGUAGE plpgsql
    AS $$
    BEGIN
      -- Move COMPLETED alerts older than 30 days to a hypothetical archive or just update a flag.
      -- Since we don't have an archive table, we'll just demonstrate the procedure by updating the description
      UPDATE "EmergencyAlert"
      SET description = description || ' [ARCHIVED]'
      WHERE status = 'COMPLETED' AND "updatedAt" < NOW() - INTERVAL '30 days';
      
      COMMIT;
    END;
    $$;
  `);

  // 3. Create a Trigger Function and Trigger
  console.log('Creating Trigger update_alert_timestamp...');
  
  // First, the trigger function
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION update_timestamp_func()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."updatedAt" = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Second, the trigger itself. We drop it first if it exists to avoid errors.
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_update_timestamp ON "EmergencyAlert";`);
  
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER trg_update_timestamp
    BEFORE UPDATE ON "EmergencyAlert"
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp_func();
  `);

  console.log('✅ Successfully created View, Stored Procedure, and Trigger in Supabase!');
}

main()
  .catch(e => {
    console.error('❌ Error during setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
