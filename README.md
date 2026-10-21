# MedRelay — Emergency Response and Healthcare Dispatch System

MedRelay is an integrated healthcare dispatch and emergency response platform built on a normalized relational database (PostgreSQL via Prisma ORM), real-time WebSockets (Socket.io), and geospatial tracking (Leaflet). It connects patients and bystanders with the nearest qualified clinician and emergency vehicle through proximity-based matching, intelligent triage thresholds, atomic resource locking, and hospital transport lifecycle tracking.

---

## 🚀 Key Features & Capabilities

- **🆘 One-Tap Bystander SOS & Rate-Limited Dispatch:** Emergency dispatch directly from the homepage using browser GPS coordinates with IP sliding-window rate limiting (15 requests per 10 minutes) and `app.set('trust proxy', 1)` for cloud reverse proxies (Render) to prevent spam while supporting campus Wi-Fi / CG-NAT gateways.
- **📍 Dual-Stage Road-Network Dispatch (Haversine + OSRM):** Employs the Haversine formula as a low-latency spatial candidate filter, followed by Open Source Routing Machine (OSRM) driving table queries to re-rank top candidates by true road travel duration (ETA), routing around rivers, railways, and one-way grids. Dispatched doctors receive turn-by-turn Google Maps navigation deep-links.
- **🩺 Specialist Safeguards with 2 km Proximity Floor:** Specialization triage (Cardiology, Trauma, Pediatrics, Orthopedics) with a 15 km safe ceiling and 3x proximity ratio cutoff. A 2 km floor ensures specialists in close proximity (e.g. 600 m) are not dropped prematurely.
- **🔒 Race-Condition Elimination via Atomic Transactions:** Doctor availability locking (`isAvailable = false`), emergency vehicle reservation, and alert generation are wrapped in a single database transaction (`prisma.$transaction`), preventing concurrent double-booking.
- **🚑 Full Response & Hospital Transport Lifecycle:** 
  `PENDING` ➔ `DISPATCHED` (Physician & Ambulance en route) ➔ `TRANSPORTING` (Patient secured; en route to hospital ER) ➔ `COMPLETED` (Clinical handover at hospital). Includes a complete `CANCELLED` flow that immediately releases locked personnel and vehicles.
- **🔄 Auto-Retry Loop & Dispatcher Operations Console:** Background retry loop (runs every 15s) automatically matches waiting `PENDING` emergencies when doctors become free, paired with a dedicated Dispatcher Console (`ActiveEmergenciesView`) allowing manual doctor/vehicle reassignment (`PATCH /api/alerts/:id/reassign`).
- **🏥 Inpatient Ward vs. Field Dispatch:** Differentiates between outdoor field emergencies (dispatching street ambulance + mobile doctor) and admitted inpatient calls (strictly checking `locationType === 'Building'`, matching medical staff linked to that `hospitalId`, with zero vehicle locking).
- **📡 Cryptographically Authorized WebSockets:** Sockets authenticate via JWT in handshake. Room subscription (`joinAlertRoom`) requires matching roles, participant identity, or a signed cryptographic per-alert `trackingToken`.
- **⏳ Dedicated GPS Heartbeat & 60s Freshness:** Strict 60-second stale location cutoff (`STALE_TIMEOUT_MS = 60 * 1000`) on a dedicated `lastLocationAt` timestamp excludes stale clinicians from dispatch. Doctors are flipped to `isAvailable = false` automatically upon socket disconnection.
- **📊 Administrative Analytics & Audit Retention:** Recharts-powered analytics for emergency distribution and response times. Foreign keys use `onDelete: SetNull` on dispatch relations and `onDelete: Restrict` on alerts. Patient deletion performs soft PII redaction, preserving historical dispatch rows and timestamps for statutory clinical audit trails.

---

## 🏛️ Advanced Database Concepts (PostgreSQL)

MedRelay incorporates specialized database objects directly inside PostgreSQL to ensure auditability, performance, and referential integrity:

1. **`ActiveEmergenciesView` (Database View):**
   ```sql
   CREATE OR REPLACE VIEW "ActiveEmergenciesView" AS
   SELECT a.id AS "alertId", a.status, a.latitude, a.longitude, a.description, a."createdAt",
          p."fullName" AS "patientName", p."phoneNumber" AS "patientPhone", p."bloodGroup",
          d."id" AS "dispatchId", doc."fullName" AS "doctorName", doc."specialization",
          h."name" AS "hospitalName", v."licensePlate" AS "vehiclePlate"
   FROM "EmergencyAlert" a
   LEFT JOIN "PatientProfile" p ON a."patientId" = p.id
   LEFT JOIN "DispatchRecord" d ON a.id = d."alertId"
   LEFT JOIN "DoctorProfile" doc ON d."doctorId" = doc.id
   LEFT JOIN "Hospital" h ON d."hospitalId" = h.id
   LEFT JOIN "Vehicle" v ON d."vehicleId" = v.id
   WHERE a.status IN ('PENDING', 'DISPATCHED', 'TRANSPORTING');
   ```
   Aggregates all active, unresolved alerts across 5 tables into an efficient virtual table powering the Dispatcher Console.

2. **`AlertStatusAudit` & `trg_log_alert_status` (Database Trigger):**
   Fires `AFTER UPDATE OF status ON "EmergencyAlert"`, inserting `alertId`, `oldStatus`, `newStatus`, and server timestamp (`NOW()`) into an audit ledger for statutory healthcare compliance.

3. **`EmergencyAlertArchive` & `archive_completed_alerts(retention_days)` (Stored Procedure):**
   Executes an atomic cascading move across child tables (`FeedbackArchive`, `DispatchRecordArchive`, `AlertStatusAuditArchive`) and parent `EmergencyAlertArchive` in strict reverse-dependency order, migrating completed alerts older than the retention threshold into cold storage without foreign key errors or data loss.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, Vite, React Router 7, Leaflet, React-Leaflet, Recharts, Lucide Icons
- **Backend:** Node.js 20, Express.js, Socket.io, JWT (`jsonwebtoken`), `bcryptjs`, Prisma ORM
- **Database:** PostgreSQL (Supabase) with ACID transactions, Views, Triggers, and Stored Procedures
- **Deployment:** Vercel (Frontend SPA) & Render (Backend API + WebSockets)

---

## 📂 Project Structure

```text
├── backend/
│   ├── config/             # Database client (Prisma Client instance)
│   ├── controllers/        # Controllers (admin, alert, auth, doctor, patient)
│   ├── middleware/         # JWT authentication & RBAC middleware
│   ├── prisma/             # schema.prisma relational model definitions & seed.js
│   ├── routes/             # Express API routes (admin, alert, auth, doctor, patient)
│   ├── utils/              # Geodesic (Haversine) and distance formatting utilities
│   ├── setup-advanced-db.js# Script provisioning Views, Triggers, and Stored Procedures
│   ├── server.js           # Express application, Socket.io server & room management
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Layout, navigation, top bar
│   │   ├── config/         # Centralized API & WebSocket endpoints (api.js)
│   │   ├── pages/          # Home, PatientAccess, DoctorAccess, AdminAccess, Dashboard, TrackAmbulance
│   │   ├── App.jsx         # App router configuration
│   │   └── index.css       # Custom design system tokens, themes, and animations
│   ├── vercel.json         # Frontend Vercel SPA routing rules
│   └── package.json
├── MedRelay_Final_Report.md# Comprehensive academic report addressing all 20 design criteria
├── vercel.json             # Root deployment configuration
└── README.md
```

---

## ⚙️ Environment Configuration

### Backend (`backend/.env`)
```ini
PORT=3000
DATABASE_URL="postgresql://user:password@host:5432/medrelay?schema=public"
JWT_SECRET="your_jwt_secret_key"
ADMIN_INITIAL_PASSWORD="SecureInitialPassword2026!"
```

### Frontend (`frontend/.env`)
```ini
VITE_API_BASE=https://emergency-backend-3ppk.onrender.com
VITE_SOCKET_URL=https://emergency-backend-3ppk.onrender.com
```

---

## 🚦 Getting Started

### 1. Database & Backend Setup
```bash
cd backend
npm install
npx prisma generate
node setup-advanced-db.js  # Provisions PostgreSQL Views, Triggers, and Stored Procedures
npm start
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

---

## 📡 API Endpoints Summary

| Method | Endpoint | Role | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new user (`PATIENT`, `DOCTOR`, `DISPATCHER`, `ADMIN`) |
| `POST` | `/api/auth/login` | Public | Authenticate user and receive JWT bearer token |
| `POST` | `/api/alerts/trigger` | Patient / Guest | Trigger SOS alert with atomic matching, distance fallback, and rate limit |
| `GET` | `/api/alerts/:id/status` | Authenticated | Fetch real-time alert status, fallback notices, and vehicle details |
| `GET` | `/api/alerts/doctor/:id` | Doctor | Fetch active pending/dispatched/transporting alerts assigned to a doctor |
| `GET` | `/api/alerts/hospitals` | Public | List available network hospital facilities and emergency departments |
| `GET` | `/api/alerts/patient/:id/active` | Patient | Restore active emergency state on page reload |
| `PATCH`| `/api/alerts/:id/acknowledge`| Doctor | Doctor accepts alert (`DISPATCHED`) |
| `PATCH`| `/api/alerts/:id/transport` | Doctor | Patient secured; transit to hospital begins (`TRANSPORTING`) |
| `PATCH`| `/api/alerts/:id/complete` | Doctor | Clinical handover / resolution complete (`COMPLETED`) |
| `PATCH`| `/api/alerts/:id/cancel` | Patient / Doctor | Cancel emergency; atomically release locked doctor and vehicle |
| `POST` | `/api/alerts/:id/feedback` | Patient | Submit post-dispatch rating (1-5) and feedback notes |
| `PATCH`| `/api/doctors/:id/location` | Doctor | Broadcast live GPS coordinates and refresh heartbeat |
| `GET` | `/api/alerts/active-view` | Admin / Dispatcher | Aggregated active emergencies queue from `ActiveEmergenciesView` |
| `PATCH`| `/api/alerts/:id/reassign`| Admin / Dispatcher | Manual clinician and vehicle reassignment for active incidents |
| `PATCH`| `/api/doctors/:id/status` | Doctor | Toggle availability (on-duty / off-duty) |
| `GET` | `/api/admin/data` | Admin / Dispatcher | View clinicians, patients, and system KPIs |
| `GET` | `/api/admin/analytics` | Admin / Dispatcher | Aggregated incident metrics, case distribution, and response times |
| `DELETE`| `/api/admin/patients/:id`| Admin | Anonymize/redact patient PII while retaining audit rows |
| `DELETE`| `/api/admin/doctors/:id` | Admin | Remove clinician account |

---

## 🛡️ Health Data Privacy & Emergency Consent (DPDP Act 2023 / GDPR / HIPAA Design Reference)

- **Statutory Emergency Exemptions:** MedRelay's emergency workflows are aligned with life-safety exemptions under **India's Digital Personal Data Protection (DPDP) Act 2023 Section 7(f)** (*medical emergencies involving a threat to life or immediate threat to health*), **GDPR Article 9(2)(c)** (*vital interests*), and **HIPAA 45 CFR § 164.512(j)** (*architectural design reference for emergency access*), sharing patient triage records strictly with authorized response teams.
- **Cryptographic WebSocket Isolation & Anti-Spoofing:** Real-time location and clinical context are restricted to authenticated participants and signed per-alert tracking tokens (`alert_${alertId}`). Doctor location broadcasts strictly verify that the emitting socket belongs to the assigned physician.
- **Right to Erasure vs Clinical Audit Retention:** Reconciles privacy erasure rights with statutory clinical record retention through Soft PII Redaction—overwriting personal identifiers and soft-deactivating staff (`isActive: false`) while retaining immutable audit snapshots on dispatch records.
- **Encryption Architecture:** Full in-transit encryption via **TLS (HTTPS & WSS)**. At-rest storage encryption managed at the cloud database volume level (AES-256).

---

## ⚠️ Known Practical, Operational & Infrastructure Limitations

1. **In-Memory Rate Limiting:** The IP sliding-window rate limiter (**15 requests per 10 minutes**) operates in server process memory (`rateLimitMap`). Counter state resets upon container restarts; horizontal scaling across multiple replicas requires a distributed Redis cache.
2. **Render Free-Tier Idle Sleep:** On Render's free tier, backend instances enter an idle sleep state after 15 minutes of inactivity. Background retry loops pause while sleeping, and waking requests experience a 30–50 second cold-start initialization delay.
3. **No Column-Level Database Encryption:** While data is encrypted in transit (TLS 1.3) and at rest (Supabase AWS EBS AES-256), individual table columns (e.g., patient medical history and triage notes) lack application-level `pgcrypto` field-level encryption, relying on relational role-based access control (RBAC).
4. **Mobile Browser GPS Throttling:** Mobile operating systems (iOS Safari and Android Chrome) aggressively throttle Geolocation updates when the device screen locks or the tab enters the background. Clinicians must keep the browser tab active and screen awake to satisfy the strict **60-second telemetry cutoff** (`STALE_TIMEOUT_MS = 60 * 1000`).
5. **Public OSRM Demonstration Server:** Road-network driving distance and ETA estimations rely on the public Open Source Routing Machine demonstration server (`router.project-osrm.org`), which lacks contractual SLAs and live traffic congestion feeds. Production deployment requires a dedicated, containerized OSRM instance with traffic overlays.

Additionally, Evaluator Demo Mode (`POST /api/auth/demo-login`) is strictly gated behind `DEMO_MODE=true` (returning 404 otherwise) and limited to pre-seeded demo accounts (`prakhar@vit.edu`, `dr.ramesh@medrelay.com`, `john.doe@medrelay.com`). Per-alert tracking tokens enforce a strict **2-hour expiry** (`expiresIn: '2h'`).

