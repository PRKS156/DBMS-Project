# MedRelay — Emergency Response and Healthcare Dispatch System

MedRelay is an integrated healthcare dispatch and emergency response platform built on a normalized relational database (PostgreSQL via Prisma ORM), real-time WebSockets (Socket.io), and geospatial tracking (Leaflet). It connects patients and bystanders with the nearest qualified clinician and emergency vehicle through proximity-based matching, intelligent triage thresholds, atomic resource locking, and hospital transport lifecycle tracking.

---

## 🚀 Key Features & Capabilities

- **🆘 One-Tap Bystander SOS & Rate-Limited Dispatch:** Emergency dispatch directly from the homepage using browser GPS coordinates with IP sliding-window rate limiting to prevent spam and denial of service.
- **📍 Proximity Pre-Filter & Road-Network Navigation:** Computes spherical distance using the Haversine formula as a low-latency spatial candidate filter, coupled with Google Maps turn-by-turn road navigation deep-links to route around physical barriers (rivers, one-way systems, traffic).
- **🩺 Specialist Safeguards & Explicit Fallback:** Specialization triage (Cardiology, Trauma, Pediatrics, Orthopedics) with a 15 km safe distance ceiling and a 3x proximity ratio cutoff. If a specialist is dangerously far, the system dispatches the closest emergency physician and alerts both patient and doctor of the fallback justification.
- **🔒 Race-Condition Elimination via Atomic Transactions:** Doctor availability locking (`isAvailable = false`), emergency vehicle reservation, and alert generation are wrapped in a single database transaction (`prisma.$transaction`), preventing concurrent double-booking.
- **🚑 Full Response & Hospital Transport Lifecycle:** 
  `PENDING` ➔ `DISPATCHED` (Physician & Ambulance en route) ➔ `TRANSPORTING` (Patient secured; en route to hospital ER) ➔ `COMPLETED` (Clinical handover at hospital). Includes a complete `CANCELLED` flow that immediately releases locked personnel and vehicles.
- **🏥 Inpatient Ward vs. Field Dispatch:** Automatically differentiates between outdoor field emergencies (dispatching street ambulance + mobile doctor) and admitted inpatient ward calls (direct on-foot response with floor/bed details and zero vehicle locking).
- **📡 Isolated Real-Time WebSockets:** Targeted Socket.io rooms (`alert_${id}`) isolate patient medical context (blood group, allergies, contact) and doctor GPS streams to only authorized participants.
- **⏳ GPS Heartbeat & Telemetry Freshness:** 30-minute stale location cutoff (`STALE_TIMEOUT_MS`) prioritizes clinicians with active, recent GPS broadcasts over unresponsive units.
- **📊 Administrative Analytics & Audit Retention:** Recharts-powered analytics for emergency distribution and response times. Patient deletion performs GDPR/HIPAA-compliant PII redaction while preserving historical dispatch rows and timestamps for clinical audit trails.

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
   Aggregates all active, unresolved alerts across 5 tables into an efficient virtual table for real-time dispatch dashboards.

2. **`AlertStatusAudit` & `trg_log_alert_status` (Database Trigger):**
   Fires `AFTER UPDATE OF status ON "EmergencyAlert"`, inserting `alertId`, `oldStatus`, `newStatus`, and server timestamp (`NOW()`) into an audit ledger for statutory healthcare compliance.

3. **`EmergencyAlertArchive` & `archive_completed_alerts(retention_days)` (Stored Procedure):**
   Copies resolved alerts older than the retention threshold (default 30 days) into the archive partition without destroying historical records.

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
| `PATCH`| `/api/doctors/:id/status` | Doctor | Toggle availability (on-duty / off-duty) |
| `GET` | `/api/admin/data` | Admin / Dispatcher | View clinicians, patients, and system KPIs |
| `GET` | `/api/admin/analytics` | Admin / Dispatcher | Aggregated incident metrics, case distribution, and response times |
| `DELETE`| `/api/admin/patients/:id`| Admin | Anonymize/redact patient PII while retaining audit rows |
| `DELETE`| `/api/admin/doctors/:id` | Admin | Remove clinician account |

---

## 🛡️ Health Data Privacy & Emergency Consent (HIPAA / GDPR)

- **Emergency Medical Exemption:** Emergency data sharing is conducted under statutory life-safety exemptions (HIPAA 45 CFR § 164.512(j) / GDPR Art. 9(2)(c)), sharing vital triage context solely with assigned clinicians.
- **WebSocket Channel Isolation:** Patient contact information and clinician GPS coordinates are published exclusively into isolated alert rooms (`alert_${alertId}`).
- **Right to Erasure & Audit Retention:** User deletion performs soft PII redaction (redacting full names, phone numbers, and unstructured clinical notes) while strictly preserving response timestamps and dispatch records in compliance with clinical record retention laws.
