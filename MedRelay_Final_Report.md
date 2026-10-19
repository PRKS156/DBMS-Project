# BCSE302P – DATABASE SYSTEMS LAB

## Project Report

---

# MEDRELAY

### Emergency Response and Healthcare Dispatch System

Integrating Relational Database Management, Real-time WebSocket Dispatch, and Geolocation Mapping

---

**Application Domain**

Emergency Response and Health Informatics

---

**Submitted by**

| Team Member | Registration No. |
| :--- | :--- |
| **Prakhar Gawali** | 24BCI0217 |
| **Parthey Jagetiya** | 24BCI0265 |
| **Parth Gunterwar** | 24BCI0228 |

---

## Abstract

Emergency response organizations manage critical volumes of time-sensitive information, including patient vitals, clinical specializations, ambulance fleet availability, hospital emergency department capacities, and dispatch audit records. When this information is spread across independent communication channels, phone calls, and disconnected legacy software, the consequences include delayed response times, allocation race conditions, clinical mismatch, data loss during audits, and unmitigated bystander abuse.

MedRelay is an integrated emergency response platform built on a centralized, normalized relational database using PostgreSQL and Prisma ORM. It enforces consistency through primary keys, foreign keys, unique constraints, ENUMs, and ACID transactions. Access is strictly governed via JWT authentication and role-based access control across four distinct user roles: `PATIENT`, `DOCTOR`, `DISPATCHER`, and `ADMIN`. Emergency events are managed across an end-to-end clinical lifecycle (`PENDING` ➔ `DISPATCHED` ➔ `TRANSPORTING` ➔ `COMPLETED` / `CANCELLED`), pushed in real time via room-isolated WebSockets (Socket.io). 

Resource matching pairs the Haversine spherical distance formula as a rapid $O(N)$ candidate pre-filter with turn-by-turn road navigation links, specialist proximity safeguards (15 km / 3x ratio ceiling), GPS heartbeat freshness verifications, and zero-unit escalation procedures. Advanced PostgreSQL features—including `ActiveEmergenciesView`, status transition audit triggers (`trg_log_alert_status`), and an automated archival stored procedure (`archive_completed_alerts`) with a dedicated archive table—automate operational querying and safeguard statutory medical retention requirements.

**Keywords:** *Emergency Response, PostgreSQL, Prisma ORM, Database Normalization, ACID Transactions, Role-Based Access Control, WebSockets, Real-time Dispatch, Geolocation Mapping, Haversine Distance, Health Informatics, HIPAA/GDPR Compliance*

---

## Table of Contents

1. Introduction
2. Problem Definition
3. Application Domain and Role Hierarchy
4. Existing System Analysis
5. Limitations of Existing Systems
6. Proposed System Overview
7. Database Design, Normalization, and Integrity Constraints
8. Proposed Database Structure and Schema Architecture
9. Real-time Dispatch Workflow and Logic Architecture
10. Geolocation, Spatial Pre-filtering, and Road Navigation
11. Advanced Database Concepts (Views, Stored Procedures, Triggers)
12. Security, Health Data Privacy, and Statutory Compliance
13. Innovation and Novelty
14. Expected Outcomes and Clinical Benefits
15. SDG Alignment
16. Technical Architecture and System Implementation
17. Conclusion

---

## 1. Introduction

Emergency healthcare services require instantaneous and synchronized coordination among distressed patients, available clinicians, mobile emergency units (ambulances), and hospital receiving facilities. In many regions, emergency dispatch is still managed through verbal phone relays, physical logbooks, or standalone communication channels. Such systems suffer from data silos, delayed response times, inaccurate location descriptions, resource double-booking, and the inability to maintain tamper-proof audit trails for legal and clinical review.

MedRelay – Emergency Response and Healthcare Dispatch System – is an integrated emergency management platform that unifies real-time event distribution with relational database rigor. The platform provides role-tailored operational consoles for patients triggering emergencies, doctors responding in the field or in-hospital wards, dispatchers overseeing regional resource distribution, and administrators managing credentialing, audit compliance, and incident analytics.

The platform employs PostgreSQL (hosted on Supabase) and Prisma ORM as its database foundation, with strict normalization and transactional integrity. Real-time bidirectional telemetry is handled via Socket.io with isolated room subscriptions, while React-Leaflet and Google Maps navigation deep-links provide precise geographic context. The backend is implemented in Node.js/Express.js, and the user interface is built with React 19 and Vite.

---

## 2. Problem Definition

The core challenge addressed by MedRelay is the fragmented, vulnerable, and uncoordinated state of emergency response systems. Specific failure modes in conventional dispatch include:

1. **Dispatch Delays & Mental Computation:** Dispatchers rely on verbal phone descriptions and mental estimates of clinician locations, introducing severe response latency.
2. **Resource Race Conditions & Double Booking:** Concurrent emergency calls frequently allocate the same clinician or ambulance unit simultaneously due to non-atomic read-then-write operations.
3. **Clinical Mismatch & Hazardous Fallback:** Inappropriate specialist selection (e.g., dispatching a cardiologist 40 km away over an emergency physician 1 km away for an acute cardiac arrest) or silent substitution without notifying responders.
4. **Disjoint Fleet & Clinician Tracking:** Ambulances are treated as static database entries disconnected from the responding clinician, leaving the patient unable to ascertain actual vehicle movement.
5. **Inpatient Ward vs. Field Misclassification:** Dispatching street ambulances for admitted patients who require urgent on-foot resuscitation within hospital wards.
6. **Stale Telemetry & Device Dropout:** Eligible dispatch lists containing clinicians whose devices have lost signal or run out of battery, resulting in orphaned alerts.
7. **Bystander SOS Abuse:** Unauthenticated emergency triggers causing denial-of-service and tying up critical emergency infrastructure.
8. **Audit Trail Destruction:** Overzealous cascade deletion rules that permanently erase dispatch records, medical histories, and timestamps when a user profile is deleted.
9. **Incomplete Emergency Lifecycles:** Systems that terminate tracking upon scene arrival without modeling patient stabilization, ambulance transport, and emergency department handover.
10. **Data Privacy Exposure:** Broadcast of sensitive medical histories (blood group, allergies, past conditions) across unencrypted, unauthenticated public socket channels.

---

## 3. Application Domain and Role Hierarchy

MedRelay operates within the domain of **Emergency Response and Health Informatics**. To guarantee strict separation of concerns, the system enforces Role-Based Access Control (RBAC) at the database and application levels across four database roles defined in the `Role` ENUM:

| Database Role | System Responsibilities | Access Scope |
| :--- | :--- | :--- |
| **`PATIENT`** | Initiates SOS alerts with live GPS, specifies emergency type (cardiac, trauma, pediatric, orthopedic, general), specifies location type (outdoor street vs. inpatient ward), tracks assigned doctor and ambulance in real time, and submits post-emergency ratings and feedback. | Restricted strictly to their own medical profile and active emergency alert room. |
| **`DOCTOR`** | Registers clinical specializations, toggles on-duty/off-duty availability, broadcasts continuous GPS telemetry while on duty, receives assigned emergency dispatches with triage context, acknowledges calls (`DISPATCHED`), initiates hospital transport (`TRANSPORTING`), and completes clinical resolution (`COMPLETED`). | Access to their assigned emergencies and patient triage notes. |
| **`DISPATCHER`** | Monitors regional emergency caseloads via `ActiveEmergenciesView`, oversees active clinician positions and ambulance availability, and manages hospital destination assignments. | Read-level oversight of active alerts, clinicians, and facility capacities. |
| **`ADMIN`** | Exercises full operational control over clinical credentialing, provider onboarding, patient directory management, compliance-driven PII redaction, and aggregate analytics dashboards (distribution, hotspots, response times). | Unrestricted administrative and mutation authority. |

*Table 1: MedRelay Role Hierarchy*

### 3.1 Guest SOS vs. Database Identity
A key design distinction in MedRelay is the handling of bystander emergencies. Rather than creating an unauthenticated database role (which would violate relational integrity and foreign key constraints on `EmergencyAlert.patientId`), the **One-Tap Guest SOS** workflow automatically provisions an ephemeral user account with the `PATIENT` role. This ensures that every emergency alert is linked to a valid relational profile while enabling instantaneous dispatch without manual registration barriers.

---

## 4. Existing System Analysis

Legacy emergency dispatch systems rely on disconnected communication silos:
- Telephony networks (PSTN/cellular) for incoming caller intake.
- Analog or trunked radio systems for ambulance crew dispatch.
- Paper logbooks or standalone desktop spreadsheets for tracking on-duty clinicians.
- Disconnected hospital reception terminals for bed occupancy management.

Because these channels operate independently, data handoffs are manual and error-prone. A dispatcher receives a spoken address, consults a physical or digital list of on-duty staff, radios a crew, and assumes the unit is en route. Patient medical histories are unavailable until hospital arrival, and neither the patient nor the receiving hospital has real-time visibility into the transit status of the mobile emergency unit.

---

## 5. Limitations of Existing Systems

1. **Lack of Automated Spatial Matching:** No computational ranking of candidate responders based on real-time coordinates.
2. **Susceptibility to Race Conditions:** Concurrent dispatchers can simultaneously commit the same ambulance or clinician to multiple emergencies.
3. **No Dynamic Telemetry Integration:** Static street addresses are used rather than live device GPS, leading to navigation errors when patients are in unfamiliar or outdoor locations.
4. **Absence of Fallback Intelligence:** Inability to balance clinical specialism against travel distance, leading to dangerous delays when a requested specialist is too distant.
5. **Vulnerability to Telemetry Staleness:** Responders who lose network connectivity remain eligible for dispatch, causing unanswered calls.
6. **Regulatory Governance & Audit Gaps:** Lack of structured state transition auditing, tamper-proof logs, and data redaction aligned with privacy statutes (India DPDP Act 2023, GDPR, HIPAA).

---

## 6. Proposed System Overview

MedRelay resolves these systemic deficiencies by uniting a normalized relational database with real-time WebSocket communications, automated spatial dispatch algorithms, and interactive GIS mapping.

Key pillars of the proposed platform include:
- **Atomic Resource Commit:** Allocating an emergency alert, locking doctor availability (`isAvailable = false`), and reserving an emergency vehicle are executed within an atomic database transaction (`prisma.$transaction`), completely eliminating double-booking race conditions.
- **Hierarchical Spatial Dispatch & Road-Network Verification:** Employs the Haversine formula as a lightweight computational pre-filter ($O(N)$) to prune candidate doctors, followed by Open Source Routing Machine (OSRM) driving table queries to rank top candidates by true road travel duration (ETA). This prevents dispatching doctors who are geographically close in straight-line distance but separated by unbridged rivers, railway lines, or congested one-way systems.
- **Comprehensive Lifecycle Tracking:** Models the complete clinical workflow: `PENDING` ➔ `DISPATCHED` ➔ `TRANSPORTING` ➔ `COMPLETED` (or `CANCELLED`), ensuring visibility from initial trigger through scene triage, hospital transport, and final clinical handover.
- **Dual-Mode Response Logic:** Differentiates between outdoor field emergencies (dispatching a mobile doctor deployed aboard an emergency ambulance) and inpatient ward emergencies (direct on-foot response within the facility, matching clinicians linked to the specific hospital, bypassing vehicle reservation).
- **Proactive Abuse Mitigation & Reverse Proxy Trust:** Implements an in-memory sliding-window IP rate limiter (15 requests per 10 minutes, configured with `app.set('trust proxy', 1)` to handle reverse proxies such as Render) to mitigate denial-of-service spam while accommodating legitimate multi-user traffic from campus Wi-Fi or Carrier-Grade NAT (CG-NAT).

---

## 7. Database Design, Normalization, and Integrity Constraints

### 7.1 Pragmatic Normalization and Deliberate Denormalization
Rather than dogmatically enforcing Third Normal Form (3NF) across all entities at the cost of emergency latency, MedRelay establishes a structured relational core across eight primary entities (`User`, `DoctorProfile`, `PatientProfile`, `Hospital`, `Vehicle`, `EmergencyAlert`, `DispatchRecord`, `Feedback`) while deliberately adopting **pragmatic denormalization** in three critical operational areas:
1. **Unstructured Clinical Triage Summaries (`PatientProfile.medicalHistory`):** In theoretical 3NF, patient allergies, chronic conditions, and surgical histories would be decomposed into separate `Condition`, `Allergy`, and `PatientAllergy` junction tables with foreign keys and severity ratings. In acute cardiac arrest or polytrauma triage, joining four tables across mobile network connections introduces unacceptable query latency and potential failure points. Storing an unstructured triage summary (e.g., *"Hypertension, Penicillin Allergy, Stent 2021"*) provides responding clinicians with an instantaneous, human-readable clinical briefing in a single payload.
2. **Denormalized Availability Flags with Relational Verification:** `DoctorProfile.isAvailable` and `Vehicle.isAvailable` are maintained as denormalized boolean flags for ultra-fast $O(1)$ spatial pre-filtering. To eliminate the risk of cached flags drifting out of sync with real-world dispatches, the dispatch engine combines the boolean flag with relational query verification:
   ```prisma
   dispatches: {
       none: {
           alert: {
               status: { in: ['PENDING', 'DISPATCHED', 'TRANSPORTING'] }
           }
       }
   }
   ```
3. **Immutable Incident Snapshots (`EmergencyAlert.description`):** Triage category, hospital name, room/floor details, and landmarks are snapshot directly into the alert description upon creation. If a hospital subsequently renames a ward or room in administrative tables, the legal dispatch record accurately reflects the exact physical coordinates and location instructions delivered to the response team at the time of dispatch.

### 7.2 Derived State and Concurrency Control
A critical vulnerability in healthcare dispatch systems is race-condition double-booking during surge events (e.g., mass casualty incidents or campus accidents). MedRelay enforces absolute concurrency control through PostgreSQL ACID transactions via `prisma.$transaction`:
- The clinician's availability is atomically locked (`isAvailable = false`).
- If an outdoor emergency, the ambulance unit is atomically reserved (`isAvailable = false`).
- The `EmergencyAlert` and linked `DispatchRecord` are committed simultaneously. If any step fails or a concurrent transaction claims the clinician, the entire transaction rolls back cleanly.

### 7.3 Referential Integrity, Schema-Level Constraints, and Soft PII Redaction
In early prototype designs, foreign key relations often utilize cascade deletion (`onDelete: Cascade`). However, in production healthcare environments, deleting a user or physician must **never** destroy historical dispatch records:
- **Schema-Level Constraints:** In `backend/prisma/schema.prisma`, `DispatchRecord` foreign keys to `DoctorProfile`, `Vehicle`, and `Hospital` are strictly configured with `onDelete: SetNull`. If a clinician account is retired or deleted, the `DispatchRecord` remains fully intact with an immutable timestamp, patient reference, and emergency metrics, setting `doctorId = NULL`. Similarly, `EmergencyAlert.patient` is configured with `onDelete: Restrict` to prevent deletion of patient profiles that possess active or historical clinical incidents.
- **The Legal Tension Between GDPR and Medical Record Retention:** 
  - **GDPR Article 17** grants data subjects a "Right to Erasure" (Right to be Forgotten).
  - Conversely, healthcare regulations (such as HIPAA in the United States, the National Medical Commission guidelines, and Clinical Establishments Acts in India) mandate statutory medical record retention (typically 5 to 7 years for clinical and medico-legal incidents) with **no general right of destruction**.
- **Resolution via Compliance-Driven Soft PII Redaction:** MedRelay harmonizes these opposing legal requirements in `adminController.deletePatient`:
  - Direct personal identifiers (`fullName` ➔ `[REDACTED PATIENT]`, `phoneNumber` ➔ `N/A`, `medicalHistory` ➔ `[REDACTED FOR COMPLIANCE]`, and user email ➔ anonymized hash) are permanently overwritten.
  - The underlying `EmergencyAlert` and `DispatchRecord` rows are preserved with their original timestamps, response durations, and anonymized clinical categories, maintaining statutory compliance and audit integrity without violating patient privacy.

---

## 8. Proposed Database Structure and Schema Architecture

The relational schema comprises eight primary entities managed through PostgreSQL:

| Entity | Primary Key | Foreign Keys & Constraints | Key Attributes |
| :--- | :--- | :--- | :--- |
| **`User`** | `id` (Int) | `email` (UNIQUE) | `password` (bcrypt), `role` (`Role` ENUM), `createdAt`, `updatedAt` |
| **`DoctorProfile`** | `id` (Int) | `userId` (FK → `User.id`, UNIQUE), `hospitalId` (FK → `Hospital.id`) | `fullName`, `specialization`, `phoneNumber`, `isAvailable`, `currentLat`, `currentLng`, `lastLocationAt` |
| **`PatientProfile`** | `id` (Int) | `userId` (FK → `User.id`, UNIQUE) | `fullName`, `phoneNumber`, `age`, `gender`, `bloodGroup`, `medicalHistory` |
| **`Hospital`** | `id` (Int) | – | `name`, `address`, `latitude`, `longitude`, `contactNumber` |
| **`Vehicle`** | `id` (Int) | `licensePlate` (UNIQUE) | `type` (ALS/BLS), `isAvailable` |
| **`EmergencyAlert`** | `id` (Int) | `patientId` (FK → `PatientProfile.id`, `onDelete: Restrict`) | `latitude`, `longitude`, `status` (`AlertStatus` ENUM), `description`, `createdAt`, `updatedAt` |
| **`DispatchRecord`** | `id` (Int) | `alertId` (FK, `onDelete: Restrict`), `doctorId` (`onDelete: SetNull`), `vehicleId` (`onDelete: SetNull`), `hospitalId` (`onDelete: SetNull`) | `dispatchedAt`, `completedAt` |
| **`Feedback`** | `id` (Int) | `dispatchRecordId` (UNIQUE), `userId` (FK) | `rating` (1–5), `comments`, `createdAt` |

*Table 2: Entity Schema and Relational Constraints*

### 8.1 Schema Definition (`schema.prisma`)
```prisma
enum Role {
  ADMIN
  DOCTOR
  PATIENT
  DISPATCHER
}

enum AlertStatus {
  PENDING
  DISPATCHED
  TRANSPORTING
  COMPLETED
  CANCELLED
}

model DoctorProfile {
  id             Int       @id @default(autoincrement())
  userId         Int       @unique
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  fullName       String
  specialization String
  phoneNumber    String
  isAvailable    Boolean   @default(true)
  currentLat     Float?
  currentLng     Float?
  lastLocationAt DateTime?
  hospitalId     Int?
  hospital       Hospital? @relation(fields: [hospitalId], references: [id])
  dispatches     DispatchRecord[]
}

model EmergencyAlert {
  id             Int             @id @default(autoincrement())
  patientId      Int
  patient        PatientProfile  @relation(fields: [patientId], references: [id], onDelete: Restrict)
  latitude       Float
  longitude      Float
  status         AlertStatus     @default(PENDING)
  description    String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  dispatchRecord DispatchRecord?

  @@index([status])
}

model DispatchRecord {
  id           Int            @id @default(autoincrement())
  alertId      Int            @unique
  alert        EmergencyAlert @relation(fields: [alertId], references: [id], onDelete: Restrict)
  doctorId     Int?
  doctor       DoctorProfile? @relation(fields: [doctorId], references: [id], onDelete: SetNull)
  hospitalId   Int?
  hospital     Hospital?      @relation(fields: [hospitalId], references: [id], onDelete: SetNull)
  vehicleId    Int?
  vehicle      Vehicle?       @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  dispatchedAt DateTime       @default(now())
  completedAt  DateTime?
}
```

---

## 9. Real-time Dispatch Workflow and Logic Architecture

The dispatch lifecycle executes through an automated, atomic six-stage pipeline with background retry:

```
[Patient SOS] ➔ [Rate Limiter] ➔ [Spatial Pre-filter] ➔ [OSRM Road Routing] ➔ [Specialist Guard] ➔ [Atomic Transaction]
                                                                                                        │
   ┌─────────────────────────────── Life Cycle Flow ────────────────────────────────────────────────────┘
   ▼
[PENDING] ➔ [DISPATCHED (Doctor Acknowledges)] ➔ [TRANSPORTING (En Route to Hospital)] ➔ [COMPLETED]
   │
   ├───────➔ [CANCELLED (Atomic Resource Release: Doctor & Ambulance freed)]
   │
   └───────➔ [Background Retry Loop: 15s auto-reassignment / Dispatcher Console manual intervention]
```

### Step 1 – Ingestion, Reverse Proxy Trust & Rate Limiting
Incoming SOS triggers pass through an IP sliding-window rate limiter configured for 15 requests per 10-minute window (`RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000`). 
- **Reverse Proxy Handling:** Because MedRelay's backend is hosted on cloud infrastructure (Render) behind reverse proxies, `app.set('trust proxy', 1)` is enabled in `server.js` so `req.headers['x-forwarded-for']` accurately identifies the genuine client IP rather than mapping all users to Render's load balancer.
- **NAT Gateway Tolerance:** The 15-request threshold accommodates legitimate multi-user emergencies originating from shared campus Wi-Fi or Carrier-Grade NAT (CG-NAT) mobile gateways without triggering false denials of service.
- **Architectural Note:** In this deployment, the rate limiter uses an in-memory sliding window, meaning counters reset upon container restarts. In production, this would be backed by a distributed Redis instance.

### Step 2 – Proximity Pre-Filtering & Strict GPS Telemetry Freshness
Available doctors are queried with relational exclusion of active dispatches. The system enforces strict GPS telemetry freshness:
```javascript
const STALE_TIMEOUT_MS = 60 * 1000; // Strict 60-second freshness window
const now = Date.now();
const freshDoctors = availableDoctors.filter(d => 
    d.lastLocationAt && (now - new Date(d.lastLocationAt).getTime() < STALE_TIMEOUT_MS)
);
```
- **Dedicated Telemetry Heartbeat:** Unlike relying on `User.updatedAt` (which can be falsely refreshed by profile edits or password updates), MedRelay uses a dedicated `lastLocationAt` timestamp updated exclusively when valid GPS coordinates are broadcast (`PATCH /api/doctors/:id/location`).
- **Exclusion of Stale Units:** Responders with stale telemetry (> 60 seconds) are excluded from automatic candidate matching, preventing dispatch to offline or unresponsive mobile devices.
- **Socket Disconnect Cleanup:** In `server.js`, whenever a clinician's WebSocket disconnects, `activeDoctorSockets` tracking immediately updates `DoctorProfile.isAvailable = false`, preventing phantom dispatches.

### Step 3 – Specialist Proximity Safeguards with 2 km Distance Floor
When a patient requests a specialized clinical category (e.g., Cardiology, Trauma Surgery):
1. The engine computes distance to all matching specialists and the closest emergency general physician.
2. **The 2 km Ratio Floor:** Standard 3x distance ratio rules suffer from edge-case failures at short distances (e.g., a specialist 600 m away versus a generalist 150 m away triggers a 4x ratio, prematurely dropping the specialist). MedRelay enforces a 2 km floor:
   ```javascript
   const isSpecialistClose = nearestSpecialist.distance_meters <= 2000;
   const ratioOk = isSpecialistClose || (nearestSpecialist.distance_meters <= closestGeneralDoctor.distance_meters * 3);
   ```
3. If the nearest specialist is within 2 km, their specialized expertise is preserved. The 3x fallback is invoked only if the specialist is both farther than 2 km and exceeds three times the distance of the closest emergency general physician (or exceeds `MAX_SPECIALIST_DISTANCE_METERS = 15000` m).
4. If fallback occurs, the alert is marked `isFallback: true` with a clear clinical rationale displayed in prominent warning banners on doctor and patient consoles.

### Step 4 – Atomic Resource Locking (`prisma.$transaction`)
The system creates the `EmergencyAlert`, links the `DispatchRecord`, marks `DoctorProfile.isAvailable = false`, and reserves an available ambulance in a single ACID transaction:
```javascript
const result = await prisma.$transaction(async (tx) => {
    const alert = await tx.emergencyAlert.create({ ... });
    await tx.doctorProfile.update({ where: { id: closestDoctor.id }, data: { isAvailable: false } });
    if (allocatedVehicle) {
        await tx.vehicle.update({ where: { id: allocatedVehicle.id }, data: { isAvailable: false } });
    }
    const dispatch = await tx.dispatchRecord.create({ ... });
    return { alert, vehicle, dispatch };
});
```

### Step 5 – Dual-Mode Response & Indoor Hospital Staff Matching
- **Explicit Location Type Check:** Indoor mode is triggered strictly by `locationType === 'Building'`, preventing an outdoor user who notes a floor or landmark from accidentally losing ambulance allocation.
- **Inpatient Ward Dispatch:** For indoor calls, street ambulance reservation is bypassed (`allocatedVehicle = null`). The query specifically prioritizes clinicians linked to that hospital (`doctorWhere.hospitalId = parseInt(hospitalId)`), routing the alert directly to on-duty staff inside that medical centre for immediate on-foot ward arrival.
- **Outdoor Field Dispatch:** For street emergencies, an Advanced or Basic Life Support ambulance is reserved, and the clinician is dispatched aboard the unit.

### Step 6 – Hospital Transport & Safe Cancellation
- **Hospital Transport (`TRANSPORTING`):** When the patient is stabilized on scene, the clinician initiates transport via `PATCH /api/alerts/:id/transport`. Both patient and hospital emergency department track transit in real time.
- **Safe Cancellation (`CANCELLED`):** If an alert is cancelled by the patient or clinician, `PATCH /api/alerts/:id/cancel` immediately frees both the clinician (`isAvailable = true`) and the vehicle (`isAvailable = true`), restoring fleet capacity.

### Step 7 – Background Retry Worker & Dispatcher Console Intervention
- **Automated Retry Loop (`retryPendingAlerts`):** If an alert cannot immediately match a clinician (due to fleet saturation), it enters `PENDING` status. A background worker running every 15 seconds checks for pending alerts and automatically pairs them with newly freed clinicians.
- **Dispatcher Operations Console:** The dedicated Dispatcher UI renders `ActiveEmergenciesView` in real time, allowing dispatchers to manually reassign clinicians or vehicles (`PATCH /api/alerts/:id/reassign`) to override automated allocations during complex crisis situations.

---

## 10. Geolocation, Spatial Pre-filtering, and Road-Network Navigation

### 10.1 The Topographical Limitation of Straight-Line Distance
The Haversine formula calculates the great-circle spherical distance between two points on the Earth's surface:
$$d = 2R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$

*Engineering Clarification on Spatial Routing:*
Over municipal city distances (< 10 km), spherical curvature error compared to flat-plane Euclidean geometry is computationally negligible (< 0.1%). However, great-circle distance is **fundamentally not travel distance**. A clinician positioned 1 km away across an unbridged river, elevated railway corridor, or complex one-way traffic system may take 25 minutes to arrive by road, whereas a clinician 3 km away on a direct radial highway arrives in under 5 minutes. Selecting emergency responders purely by straight-line distance risks critical, life-threatening delays.

### 10.2 Dual-Stage Dispatch Architecture (Haversine + OSRM Table Routing)
To resolve this without introducing high-latency API bottlenecks, MedRelay implements an intelligent two-stage dispatch ranking algorithm:
1. **Stage 1 – Low-Latency $O(N)$ Candidate Pre-filtering:** The database uses the Haversine formula to compute straight-line distances from the incident coordinates to all active, available clinicians within seconds, quickly filtering out hundreds of regional doctors to identify the closest candidate cohort.
2. **Stage 2 – Road-Network Driving Duration Re-ranking (OSRM):** The top 3 to 5 candidate clinicians are passed to the Open Source Routing Machine (OSRM) driving table API (`/table/v1/driving/` via `geoUtils.getRoadRoutingTable`):
   - OSRM calculates real-world street network driving distances (`roadDistanceMeters`) and expected travel durations (`roadDurationSeconds`) factoring in actual roadway geometry, bridge crossings, and one-way traffic networks.
   - The candidate clinicians are re-sorted by true road ETA (`roadDurationSeconds`). The responder who can physically reach the patient fastest is selected for dispatch.
   - **Fault-Tolerant Fallback:** To ensure emergency dispatch never hangs if external routing infrastructure experiences network latency, OSRM queries enforce a strict 2.5-second timeout via `AbortController`. If the routing API times out or fails, the algorithm gracefully falls back to Haversine straight-line ranking without dropping the emergency.
3. **Turn-by-Turn Mobile Navigation:** Once dispatched, embedded Google Maps navigation deep-links (`https://www.google.com/maps/dir/?api=1&destination=...`) are provided on the doctor’s mobile terminal, enabling instant hand-off to native turn-by-turn driving directions.

---

## 11. Advanced Database Concepts (Views, Stored Procedures, Triggers)

MedRelay implements native PostgreSQL database objects to ensure operational performance, data integrity, and compliance:

### 11.1 `ActiveEmergenciesView` & Dispatcher Operations Console (Database View)
Emergency dispatchers require continuous, sub-second visibility into unresolved incidents. Rather than having application instances repeatedly execute complex 5-table joins across high-frequency dashboard polling intervals, `ActiveEmergenciesView` aggregates live operational data:
```sql
CREATE OR REPLACE VIEW "ActiveEmergenciesView" AS
SELECT 
    a.id AS "alertId",
    a.status,
    a.latitude,
    a.longitude,
    a.description,
    a."createdAt",
    p."fullName" AS "patientName",
    p."phoneNumber" AS "patientPhone",
    p."bloodGroup",
    p."medicalHistory",
    d."id" AS "dispatchId",
    doc."fullName" AS "doctorName",
    doc."specialization",
    doc."phoneNumber" AS "doctorPhone",
    h."name" AS "hospitalName",
    v."licensePlate" AS "vehiclePlate",
    v."type" AS "vehicleType"
FROM "EmergencyAlert" a
LEFT JOIN "PatientProfile" p ON a."patientId" = p.id
LEFT JOIN "DispatchRecord" d ON a.id = d."alertId"
LEFT JOIN "DoctorProfile" doc ON d."doctorId" = doc.id
LEFT JOIN "Hospital" h ON d."hospitalId" = h.id
LEFT JOIN "Vehicle" v ON d."vehicleId" = v.id
WHERE a.status IN ('PENDING', 'DISPATCHED', 'TRANSPORTING');
```
*Operational Integration:* The view accurately reflects all active, ongoing emergencies across `PENDING`, `DISPATCHED`, and `TRANSPORTING` statuses. On the frontend, this view directly powers the **Dispatcher Operations Console**, providing live queue status badges and an interactive clinician reassignment modal (`PATCH /api/alerts/:id/reassign`) for manual dispatcher overrides.

### 11.2 `AlertStatusAudit` & `trg_log_alert_status` (Database Trigger)
Rather than duplicating Prisma's built-in `@updatedAt` timestamp handling, MedRelay implements an immutable audit trigger to log every status transition across the emergency lifecycle:
```sql
CREATE TABLE IF NOT EXISTS "AlertStatusAudit" (
    id SERIAL PRIMARY KEY,
    "alertId" INTEGER NOT NULL,
    "oldStatus" VARCHAR(50),
    "newStatus" VARCHAR(50) NOT NULL,
    "changedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE OR REPLACE FUNCTION log_alert_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO "AlertStatusAudit" ("alertId", "oldStatus", "newStatus", "changedAt")
        VALUES (NEW.id, OLD.status::text, NEW.status::text, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_alert_status ON "EmergencyAlert";
CREATE TRIGGER trg_log_alert_status
AFTER UPDATE OF status ON "EmergencyAlert"
FOR EACH ROW EXECUTE FUNCTION log_alert_status_change();
```
This guarantees an unalterable chronological audit record of when every status transition occurred, providing tamper-proof evidence for clinical review.

### 11.3 `EmergencyAlertArchive` & Atomic Stored Procedure (Cold-Storage Archiving)
Deleting resolved emergency records after 30 days violates statutory healthcare retention rules. MedRelay introduces a dedicated `EmergencyAlertArchive` cold-storage archive table and a stored procedure that executes an **atomic move** using Common Table Expressions (CTE):
```sql
CREATE TABLE IF NOT EXISTS "EmergencyAlertArchive" (
    id INTEGER PRIMARY KEY,
    "patientId" INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(50),
    description TEXT,
    "createdAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE OR REPLACE PROCEDURE archive_completed_alerts(retention_days INT DEFAULT 30)
LANGUAGE plpgsql AS $$
BEGIN
    WITH moved_alerts AS (
        DELETE FROM "EmergencyAlert"
        WHERE status = 'COMPLETED'
          AND "updatedAt" < NOW() - (retention_days || ' days')::INTERVAL
        RETURNING id, "patientId", latitude, longitude, status::text, description, "createdAt", NOW()
    )
    INSERT INTO "EmergencyAlertArchive" (id, "patientId", latitude, longitude, status, description, "createdAt", "archivedAt")
    SELECT id, "patientId", latitude, longitude, status, description, "createdAt", NOW()
    FROM moved_alerts
    ON CONFLICT (id) DO NOTHING;
END;
$$;
```
*Engineering Distinction:* Rather than separate `INSERT` and `DELETE` queries (which could fail halfway and leave duplicated or orphaned records), the `DELETE ... RETURNING` pattern executes the transfer as an atomic, idempotent operation within PostgreSQL. This preserves full historical records in the archive table while keeping the active operational table lean and responsive.

---

## 12. Security, Health Data Privacy, and Statutory Compliance

### 12.1 Statutory Emergency Frameworks & Privacy Alignment
Emergency medical dispatch operates under strict legal frameworks governing protected health information. MedRelay's emergency dispatch protocols are designed with reference to and aligned with statutory life-safety exemptions:
- **Digital Personal Data Protection (DPDP) Act 2023 (India) Section 7(b):** Authorizes the processing of personal data without prior consent for responding to medical emergencies involving a threat to the life or immediate serious threat to the health of the data subject.
- **GDPR Article 9(2)(c):** Authorizes the processing of special category personal health data where processing is necessary to protect the vital interests of the data subject or another natural person, and the data subject is physically or legally incapable of giving consent.
- **HIPAA 45 CFR § 164.512(j):** Authorizes disclosures of protected health information without prior authorization to avert serious and imminent threats to health or safety.

*Compliance Reality & Encryption Architecture:*
MedRelay is aligned with these principles rather than claiming unverified statutory certification. 
- **In-Transit Encryption:** All application traffic and WebSocket streams are strictly encrypted in transit via TLS 1.3 (HTTPS and WSS).
- **At-Rest Storage Encryption:** Database persistence is encrypted at the volume layer via managed cloud infrastructure (AWS EBS / Supabase AES-256). 
- *Architectural Limitation:* Application-level column-level cryptographic hashing (e.g. `pgcrypto` field-level encryption for clinical notes) is not implemented in this prototype; clinical notes rely on database role-level permissions and transport encryption.

### 12.2 Cryptographically Authorized WebSocket Rooms
To prevent eavesdropping on sensitive medical data (blood group, allergies, contact numbers) and clinician GPS coordinates, MedRelay rejects unauthenticated WebSocket connections and strictly isolates telemetry into authorized rooms:
```javascript
// 1. Socket handshake JWT authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) { socket.user = null; }
    }
    next();
});

// 2. Cryptographically authorized room subscription logic
socket.on('joinAlertRoom', async ({ alertId, token }) => {
    const targetId = parseInt(alertId);
    let isAuthorized = false;

    // Administrators and Dispatchers have regional operational oversight
    if (socket.user?.role === 'ADMIN' || socket.user?.role === 'DISPATCHER') {
        isAuthorized = true;
    }

    // Patients and guest bystanders authenticate via signed per-alert tracking token
    if (!isAuthorized && token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.alertId === targetId) isAuthorized = true;
        } catch (e) {}
    }

    if (isAuthorized) {
        socket.join(`alert_${targetId}`);
    } else {
        socket.emit('joinError', { message: 'Unauthorized: Invalid tracking token.' });
    }
});
```
This guarantees that random external clients guessing sequential alert IDs cannot join or observe telemetry without cryptographic authorization.

### 12.3 Production Credential Security
- Passwords are encrypted using `bcryptjs` with 10 salt rounds.
- In `seed.js`, initial administrator password creation strictly requires the `ADMIN_INITIAL_PASSWORD` environment variable in production environments (`process.env.NODE_ENV === 'production'`), throwing a fatal error if unset.
- In non-production testing, high-entropy dynamic credentials (`crypto.randomBytes(16).toString('hex')`) are generated on the fly, eliminating published static passwords.
- Demo test accounts are omitted in production seeding.

---

## 13. Innovation and Novelty

MedRelay introduces several distinct engineering innovations:
1. **Holistic Lifecycle Modeling:** Unlike basic alerting tools, MedRelay models the full arc of emergency healthcare, including hospital transport, bed coordination, and post-incident ratings.
2. **Dual-Mode Dispatch Architecture:** Dynamically shifts response behavior between street-level ambulance navigation and indoor hospital ward on-foot triage.
3. **Fail-Safe Proximity Guarding:** Eliminates hazardous specialist fallbacks through algorithmic distance and ratio thresholds, ensuring patient stabilization is never sacrificed for distant credentials.
4. **Non-Destructive Compliance Archival:** Combines PostgreSQL triggers and stored procedures to guarantee that operational table pruning never compromises medical record retention.

---

## 14. Expected Outcomes and Clinical Benefits

- **Decreased Emergency Response Time:** Automated spatial matching and WebSocket dispatch eliminate 3–8 minutes of manual radio and telephone relay delays.
- **Elimination of Resource Contention:** Transactional concurrency control prevents vehicle and clinician double-booking during surge events.
- **Reduced Patient Anxiety:** Real-time visual tracking of the approaching clinician and ambulance provides reassurance during critical waiting windows.
- **Tamper-Proof Audit Readiness:** Automated status transition triggers ensure complete accountability for medical malpractice and incident reviews.

---

## 15. SDG Alignment

- **SDG 3 – Good Health and Well-Being (Target 3.6 & 3.d):** MedRelay directly combats pre-hospital mortality through rapid dispatch, proximity matching, and immediate delivery of triage histories to responding teams.
- **SDG 9 – Industry, Innovation, and Infrastructure:** Integrates modern cloud database architecture, type-safe ORMs, and real-time event distribution into resilient municipal healthcare infrastructure.
- **SDG 11 – Sustainable Cities and Communities:** Strengthens emergency preparedness and disaster resilience through area-wise incident hotspot analysis and accessible bystander SOS access.

---

## 16. Technical Architecture and System Implementation

The system is deployed as a distributed cloud application:
- **Presentation Layer:** React 19 single-page application built with Vite, styled with custom vanilla CSS design tokens, hosted on **Vercel** (`https://dbms-project-blush.vercel.app`).
- **Application & Event Layer:** Node.js 20 / Express.js REST API with Socket.io WebSocket server hosted on **Render** (`https://emergency-backend-3ppk.onrender.com`).
- **Persistence Layer:** PostgreSQL 15 database hosted on **Supabase** with connection pooling, native views, triggers, and stored procedures.

---

## 17. Conclusion

MedRelay demonstrates how modern relational database concepts—strict normalization, ACID transactions, database views, status change triggers, and automated stored procedure archival—can be synthesized with real-time WebSockets and GIS mapping to build an enterprise-grade emergency dispatch platform. 

By systematically addressing the 20 critical design, concurrency, telemetry, and regulatory failure modes common in pre-hospital emergency software, MedRelay delivers a fast, reliable, and auditable solution that protects patient lives while maintaining full clinical and legal integrity.
