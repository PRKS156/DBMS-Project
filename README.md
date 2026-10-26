# MedRelay — Autonomous Emergency Medical Dispatch & Telemetry System

> **Course:** Database Systems & BCSE307L  
> **Faculty:** Dr. Deepika J  
> **School:** School of Computer Science and Engineering (SCOPE), Vellore Institute of Technology (VIT), Vellore  
> **Academic Term:** Fall Semester 2026–2027  

**Live Production URLs:**
- 🌐 **Web Application (Vercel):** [https://dbms-project-blush.vercel.app](https://dbms-project-blush.vercel.app)
- ⚙️ **Backend API & WebSockets (Render):** [https://emergency-backend-3ppk.onrender.com](https://emergency-backend-3ppk.onrender.com)
- 🗄️ **Cloud Database:** Supabase Managed PostgreSQL (AWS Asia-Pacific)

---

## 📑 Table of Contents
1. [Problem Statement & Project Scope](#1-problem-statement--project-scope)
2. [Demonstration Credentials](#2-demonstration-credentials)
3. [Database Architecture & Design (3NF Normalization)](#3-database-architecture--design-3nf-normalization)
4. [Advanced Relational Database Implementations](#4-advanced-relational-database-implementations)
5. [Application Features & Clinical Logic](#5-application-features--clinical-logic)
6. [Security, Authentication & RBAC](#6-security-authentication--rbac)
7. [Technology Stack](#7-technology-stack)
8. [Installation & Execution Guide](#8-installation--execution-guide)
9. [Database Backup & Recovery Procedures](#9-database-backup--recovery-procedures)
10. [Regulatory Alignment & Operational Tradeoffs](#10-regulatory-alignment--operational-tradeoffs)

---

## 1. Problem Statement & Project Scope

### 1.1 Problem Statement
In emergency medicine, preventable mortality is heavily driven by dispatch latency, uncoordinated resource allocation, and race conditions over clinical personnel. Conventional dispatch workflows rely on manual telephone exchanges that fail to leverage live device GPS, lack concurrent ACID synchronization across ambulances and physicians, and lose vital clinical audit trails during record erasure.

### 1.2 Core Objectives
1. **Autonomous Geolocation Dispatch:** Instantly capture emergency GPS telemetry and evaluate true road network distances to dispatch the nearest qualified clinician and ambulance unit.
2. **ACID Transactional Guarantees:** Wrap emergency alert creation, doctor status locking (`isBusy = true`), and vehicle reservation in atomic database transactions to eliminate clinician double-booking.
3. **Inpatient vs. Outpatient Routing Logic:**
   - **Outpatients (Field Emergencies):** Automatically route the closest hospital base and emergency responder without burdening the distressed patient with facility selection.
   - **Inpatients (Hospital Ward Alerts):** Route strictly to on-duty staff inside the specific hospital facility, capturing floor, room, and bed numbers for immediate on-foot clinical arrival.
4. **Clinical Data Safety:** Guarantee that anonymous bystanders and unverified emergencies strictly default clinical markers (e.g. blood group) to `Unknown`, preventing dangerous medical presumptions.
5. **Auditable Lifecycle & Privacy Compliance:** Support statutory clinical audit retention while allowing GDPR / DPDP Act 2023 soft-erasure through immutable historical snapshots and database trigger logging.

---

## 2. Demonstration Credentials

For evaluator grading and demonstration, the database contains pre-configured verified accounts across each operational role:

| Portal Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `prakhar@vit.edu` | `Prks@15012006` | Live dispatch operations queue, clinician fleet, GDPR redaction, system analytics |
| **Emergency Doctor** | `doctor1@gmail.com` | `doctor123` | Real-time emergency console, alert acknowledgment, transit status, resolution |
| **Registered Patient** | `patient1@gmail.com` | `patient123` | Patient emergency dashboard, medical history display, feedback submission |
| **Anonymous Bystander** | *One-Tap SOS on Home* | *No login needed* | Zero-friction street emergency alert with live ambulance distance telemetry |

---

## 3. Database Architecture & Design (3NF Normalization)

MedRelay is modeled around **10 related tables** managed via Prisma ORM and hosted on a cloud PostgreSQL instance.

### 3.1 Entity Table Breakdown
1. **`User` (Core Authentication Entity):** Single-table authentication store containing `id`, `email`, hashed `password`, and enum `role` (`ADMIN`, `DOCTOR`, `PATIENT`, `DISPATCHER`).
2. **`DoctorProfile` (Clinical & Telemetry Entity):** 1-to-1 extension of `User` containing medical specialization, on-duty status (`isOnDuty`), busy flag (`isBusy`), availability state (`isAvailable`), and live GPS telemetry (`currentLat`, `currentLng`, `lastLocationAt`).
3. **`PatientProfile` (Demographic & Clinical History):** 1-to-1 extension of `User` storing age, gender, medical history notes, and verified `bloodGroup` (defaulting to `Unknown`).
4. **`Hospital` (Facility Base Entity):** Physical medical institution with static GPS coordinates, operational address, and emergency contact registry.
5. **`Vehicle` (Fleet Management Entity):** Ambulance units classified by tier (`Basic Life Support` vs `Advanced Life Support`) with availability status (`isAvailable`).
6. **`EmergencyAlert` (Incident Transaction Entity):** Active and historical emergency alerts recording incident coordinates, emergency category, indoor ward location details, and lifecycle state (`PENDING`, `DISPATCHED`, `TRANSPORTING`, `COMPLETED`, `CANCELLED`).
7. **`DispatchRecord` (Relational Junction Entity):** Central transactional binding connecting the alert, the assigned doctor, the allocated ambulance, and the base hospital facility.
8. **`Feedback` (Clinical Quality Control Entity):** Patient ratings (1–5 scale) and post-dispatch clinical reviews.
9. **`EmergencyAlertArchive` & `DispatchRecordArchive` (Archival Partition):** Partitioned historical tables for closed emergencies, moved via an atomic database stored procedure.
10. **`AlertStatusAudit` (Audit Trail Entity):** Immutable ledger populated automatically by PostgreSQL triggers tracking timestamped state transitions.

### 3.2 Relational Integrity & Constraints
- **Primary Keys:** Every table utilizes an auto-incrementing integer Primary Key (`@id @default(autoincrement())`).
- **Foreign Keys & Referential Actions:**
  - `User` ➔ `DoctorProfile` / `PatientProfile`: `ON DELETE CASCADE` ensures clean identity lifecycle management.
  - `Hospital` ➔ `DoctorProfile`: `ON DELETE SET NULL` preserves doctor records if a facility is restructured.
  - `DispatchRecord` ➔ `EmergencyAlert`: `ON DELETE CASCADE` links child dispatches to parent alerts.
- **Constraints:**
  - `UNIQUE`: Enforced on `User.email` and `Vehicle.licensePlate`.
  - `NOT NULL`: Applied across coordinates, hashed passwords, timestamps, and foreign key bindings.
  - `CHECK / ENUM`: Restricts role to valid values (`ADMIN`, `DOCTOR`, `PATIENT`, `DISPATCHER`) and alert status to valid lifecycle states.

### 3.3 Normalization Proof (Third Normal Form - 3NF)
- **First Normal Form (1NF):** Every attribute contains atomic, non-divisible scalar values (no array columns or repeating groups).
- **Second Normal Form (2NF):** The database is in 1NF and contains **no partial functional dependencies**. Because all tables use single-attribute surrogate primary keys (`id`), every non-key column is fully dependent on the primary key.
- **Third Normal Form (3NF):** The schema is in 2NF and contains **no transitive dependencies** ($X \rightarrow Y \rightarrow Z$). Non-key attributes depend solely on the primary key. For example, hospital name and doctor specialization are not duplicated as living attributes inside `EmergencyAlert`; they are resolved through relational foreign keys.
- *Intentional Audit Denormalization:* Snapshot columns (`doctorNameSnapshot`, `hospitalNameSnapshot`) in `DispatchRecord` are deliberate immutable audit fields required by medical regulations to preserve historical dispatch context if clinician accounts are modified or soft-erased years later.

---

## 4. Advanced Relational Database Implementations

MedRelay leverages native PostgreSQL engine capabilities to optimize performance, maintain clinical auditability, and ensure ACID compliance:

### 4.1 SQL Database View (`ActiveEmergenciesView`)
Instead of executing repeated 5-table joins across the network on every dispatcher polling cycle, PostgreSQL maintains a high-performance database view:
```sql
CREATE OR REPLACE VIEW "ActiveEmergenciesView" AS
SELECT 
  a.id AS "alertId",
  a.status,
  a.latitude,
  a.longitude,
  a.description,
  a."createdAt",
  p.id AS "patientId",
  p."fullName" AS "patientName",
  p."phoneNumber" AS "patientPhone",
  CASE 
    WHEN p."fullName" ILIKE '%Bystander%' OR p."fullName" ILIKE '%Anonymous%' 
         OR p."fullName" ILIKE '%Inpatient%' OR p."bloodGroup" IS NULL 
         OR p."bloodGroup" = 'null' OR p."bloodGroup" = '' THEN 'Unknown'
    ELSE p."bloodGroup"
  END AS "bloodGroup",
  d.id AS "dispatchId",
  doc.id AS "doctorId",
  COALESCE(doc."fullName", d."doctorNameSnapshot") AS "doctorName",
  COALESCE(doc."specialization", d."doctorSpecializationSnapshot") AS "specialization",
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
```

### 4.2 Database Trigger & Automated Audit Trail (`AlertStatusAudit`)
A PostgreSQL trigger monitors alert status transitions and writes immutable lifecycle records into `AlertStatusAudit`:
```sql
CREATE OR REPLACE FUNCTION fn_audit_alert_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO "AlertStatusAudit" ("alertId", "oldStatus", "newStatus", "changedAt")
    VALUES (NEW.id, OLD.status, NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_alert_status
AFTER UPDATE ON "EmergencyAlert"
FOR EACH ROW EXECUTE FUNCTION fn_audit_alert_status();
```

### 4.3 Stored Procedure for Cascading Archival (`archive_completed_alert`)
To ensure high query speeds on production tables while satisfying data retention policies, completed alerts are archived atomically via a stored procedure:
```sql
CREATE OR REPLACE PROCEDURE archive_completed_alert(p_alert_id INT)
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. Archive feedback
  INSERT INTO "FeedbackArchive" ("id", "dispatchRecordId", "userId", "rating", "comments", "createdAt")
  SELECT f.id, f."dispatchRecordId", f."userId", f.rating, f.comments, f."createdAt"
  FROM "Feedback" f
  INNER JOIN "DispatchRecord" d ON f."dispatchRecordId" = d.id
  WHERE d."alertId" = p_alert_id;

  -- 2. Archive dispatch records with audit snapshots
  INSERT INTO "DispatchRecordArchive" ("id", "alertId", "doctorId", "vehicleId", "hospitalId", "dispatchedAt", "completedAt", "doctorNameSnapshot", "doctorSpecializationSnapshot", "doctorPhoneSnapshot", "vehiclePlateSnapshot", "hospitalNameSnapshot")
  SELECT id, "alertId", "doctorId", "vehicleId", "hospitalId", "dispatchedAt", "completedAt", "doctorNameSnapshot", "doctorSpecializationSnapshot", "doctorPhoneSnapshot", "vehiclePlateSnapshot", "hospitalNameSnapshot"
  FROM "DispatchRecord"
  WHERE "alertId" = p_alert_id;

  -- 3. Archive parent alert
  INSERT INTO "EmergencyAlertArchive" ("id", "patientId", "latitude", "longitude", "status", "description", "createdAt")
  SELECT id, "patientId", latitude, longitude, status, description, "createdAt"
  FROM "EmergencyAlert"
  WHERE id = p_alert_id;

  -- 4. Delete from live operational tables in reverse dependency order
  DELETE FROM "Feedback" WHERE "dispatchRecordId" IN (SELECT id FROM "DispatchRecord" WHERE "alertId" = p_alert_id);
  DELETE FROM "DispatchRecord" WHERE "alertId" = p_alert_id;
  DELETE FROM "EmergencyAlert" WHERE id = p_alert_id;
END;
$$;
```

### 4.4 ACID Database Transactions (`prisma.$transaction`)
All emergency matching operations use atomic database transactions. The system locks the chosen doctor using a conditional update:
```javascript
const result = await prisma.$transaction(async (tx) => {
  const newAlert = await tx.emergencyAlert.create({ ... });
  
  // Atomic doctor availability lock
  const claimResult = await tx.doctorProfile.updateMany({
    where: { id: closestDoctor.id, isBusy: false, isOnDuty: true, isActive: true },
    data: { isBusy: true, isAvailable: false, lastLocationAt: new Date() }
  });

  if (claimResult.count === 0) {
    // If another request concurrently claimed the doctor, gracefully fall back to next closest
    const alternative = await tx.doctorProfile.findFirst({ ... });
    ...
  }

  const dispatch = await tx.dispatchRecord.create({ ... });
  return { newAlert, dispatch };
});
```

---

## 5. Application Features & Clinical Logic

### 5.1 Intelligent Outpatient vs. Inpatient Triage
- **Outpatient Emergency (Street / Home):**
  - Patients are **never asked to select a hospital**. In critical trauma or cardiac events, patients do not know medical department availability or road distances.
  - MedRelay captures live GPS coordinates, performs road distance calculations via OSRM, and routes the fastest ambulance unit and affiliated hospital base autonomously.
- **Inpatient Ward Emergency (`locationType === 'Building'`):**
  - When selected, the interface opens the hospital selector (*"Which hospital are you currently admitted in?"*), alongside mandatory **Floor/Ward** and **Room/Bed** input fields.
  - Alerts are dispatched strictly to clinicians stationed inside that facility for on-foot clinical response, with zero vehicle locking.

### 5.2 Clinical Data Safety (Unverified Blood Group Protection)
- For anonymous bystander alerts and unverified guest profiles, the system enforces `bloodGroup = 'Unknown'`.
- Badges render with a neutral, non-alarmist pill (`rgba(100, 116, 139, 0.15)`) across both dark and light modes, preventing fatal errors in pre-hospital emergency transfusions.

### 5.3 Live Road-Network Telemetry & ETA
- MedRelay calculates true road distance and travel duration via Open Source Routing Machine (OSRM) APIs, accounting for bridges, one-way networks, and vehicular detours rather than misleading straight-line distances.

### 5.4 Edge AI Emergency Triage & Clinical Handover (Ollama Integration)
- **Local On-Premise LLM Engine:** Powered by a local Ollama service (`http://127.0.0.1:11434`, model: `phi3:latest`), eliminating dependency on external commercial cloud AI APIs.
- **Natural Language Symptom Triage (`/api/ai/triage`):** Analyzes free-form patient and bystander symptom descriptions in real time, classifies urgency (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and automatically recommends the optimal clinical specialization (`Cardiology`, `Trauma Surgery`, `Pediatrics`, `Orthopedics`, `General Emergency`).
- **Immediate Pre-Arrival First Aid Guidance:** Generates instant step-by-step pre-arrival life-saving instructions (e.g., CPR rhythm, bleeding compression, semi-Fowler position) for bystanders while responders are en route.
- **Pre-Arrival Doctor Clinical Briefing (`/api/ai/briefing/:alertId`):** Automatically synthesizes patient age, verified blood group, reported symptoms, and pre-existing medical history to flag critical contraindications (e.g. penicillin or aspirin allergies) and formulate initial scene stabilization steps.
- **Privacy & Statutory Compliance:** Because inference runs strictly on-device, zero Protected Health Information (PHI) is transmitted to third-party AI cloud vendors, upholding Section 7(f) of the **India DPDP Act 2023** and **HIPAA** clinical data isolation principles.
- **Deterministic Rule Fallback:** If the local Ollama instance is ever unreachable or paused, an integrated medical keywords heuristic fallback activates seamlessly without interrupting emergency dispatch.

---


## 6. Security, Authentication & RBAC

### 6.1 Single Users Table Constraint (Rubric Requirement)
In compliance with relational best practices, **all user roles exist in a single `User` table** with an indexed enum `role` (`ADMIN`, `DOCTOR`, `PATIENT`, `DISPATCHER`). No fragmented or redundant role tables exist.

### 6.2 Password Hashing & Token Authentication
- **BCrypt:** All user passwords are encrypted using BCrypt with **10 salt rounds** prior to database insertion.
- **JWT (JSON Web Tokens):** User sessions issue signed JWT bearer tokens storing user identity and role.
- **Role-Based Access Control Middleware:** Sensitive API endpoints are guarded via Express middleware:
  ```javascript
  router.get('/data', authenticateToken, requireRole('ADMIN', 'DISPATCHER'), adminController.getAllData);
  ```

### 6.3 SQL Injection Prevention & Secrets Management
- **SQL Injection:** 100% prevented through Prisma ORM's parameterized query engine. Raw SQL queries for views and triggers strictly execute static DDL or parameterized arguments.
- **Secrets Isolation:** Database URIs, JWT signing keys, and port bindings are loaded via `.env` and excluded from version control via `.gitignore`.

---

## 7. Technology Stack

```text
├── Layer              ├── Technology
├── Frontend           │   React 19 (SPA), Vite 8, React Router 7, Recharts, Lucide Icons
├── Backend Server     │   Node.js 20, Express.js 4, Socket.io 4 (Real-Time WebSockets)
├── Database & ORM     │   PostgreSQL (Supabase Managed Cloud), Prisma ORM 6
├── Routing Telemetry  │   OSRM Road-Routing Engine, HTML5 Geolocation API
├── Authentication     │   JSON Web Tokens (JWT), BCrypt.js (10 Rounds)
├── Deployment Cloud   │   Vercel (Frontend), Render (Backend), Supabase AWS (Database)
```

---

## 8. Installation & Execution Guide

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- PostgreSQL database URL (Local or Cloud Supabase instance)

### 8.1 Backend Setup
```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Configure environment variables (.env)
# Create a .env file based on .env.example
# DATABASE_URL="postgresql://user:password@host:5432/medrelay?schema=public"
# JWT_SECRET="your_secure_jwt_secret"

# 4. Generate Prisma Client and apply migrations
npx prisma generate
npx prisma db push

# 5. Provision SQL Views, Triggers, and Stored Procedures
node setup-advanced-db.js

# 6. Seed initial test accounts (optional)
node prisma/seed.js

# 7. Start backend server
npm start
# Server listens on http://localhost:3000
```

### 8.2 Frontend Setup
```bash
# 1. Navigate to frontend directory
cd ../frontend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# Vite runs local application at http://localhost:5173
```

### 8.3 Production Build
```bash
cd frontend
npm run build
# Generates optimized static bundle in frontend/dist
```

---

## 9. Database Backup & Recovery Procedures

To satisfy relational recovery standards, database dumps can be executed natively using standard PostgreSQL CLI utilities:

### 9.1 Database Backup (`pg_dump`)
```bash
# Full schema and data backup to SQL script
pg_dump "postgresql://postgres:password@host:5432/postgres" -F p -v -f "medrelay_backup.sql"

# Custom compressed archive format (recommended for production)
pg_dump "postgresql://postgres:password@host:5432/postgres" -F c -v -f "medrelay_backup.dump"
```

### 9.2 Database Recovery (`pg_restore` / `psql`)
```bash
# Restore plain text SQL backup
psql "postgresql://postgres:password@host:5432/postgres" -f "medrelay_backup.sql"

# Restore compressed dump archive
pg_restore -d "postgresql://postgres:password@host:5432/postgres" -v "medrelay_backup.dump"
```

---

## 10. Regulatory Alignment & Operational Tradeoffs

### 10.1 Statutory Emergency Data Protections
- **India DPDP Act 2023 Section 7(f):** Permits medical emergency processing without prior bureaucratic consent when responding to life threats.
- **GDPR Article 9(2)(c):** Special category health data processed under vital interest exemptions for unconscious or incapacitated patients.
- **Right to Erasure vs. Clinical Audit:** When an administrator initiates a GDPR erasure (`DELETE /api/admin/patients/:id`), patient PII is redacted, while historical dispatch timestamps and clinical response metrics are retained in compliance with hospital audit statutes.

### 10.2 Known Operational Tradeoffs
1. **In-Memory Rate Limiting:** Sliding-window rate limiter (15 requests / 10 minutes) operates in Node process memory; horizontally scaling across multiple container instances requires a shared Redis cache.
2. **Render Cold-Start Delay:** On Render free-tier instances, idling services sleep after 15 minutes of inactivity, resulting in a 30–50 second spin-up latency on initial wake requests.
3. **Mobile Screen-Lock Throttling:** iOS and Android browsers throttle background GPS updates. Emergency doctors must keep the application tab active to maintain the strict 60-second telemetry heartbeat.

---

### 👨‍💻 Project Maintainer
- **Prakhar Gawali** — School of Computer Science & Engineering, VIT Vellore  
- **Email:** `prakhargawali15@gmail.com` / `prakhar@vit.edu`  
- **Repository:** [https://github.com/PRKS156/DBMS-Project](https://github.com/PRKS156/DBMS-Project)
