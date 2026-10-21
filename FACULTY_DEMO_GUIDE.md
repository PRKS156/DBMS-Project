# MedRelay — Faculty Demonstration & Viva Presentation Playbook

This playbook provides a step-by-step strategy to present **MedRelay** during your DBMS project evaluation, lab viva, and faculty review.

---

## 🎯 Executive Strategy: What DBMS Faculty Care About

Faculty evaluators in a **Database Management Systems** course look specifically for:
1. **Relational Schema Rigor (3NF):** Associative entities (`DispatchRecord`), foreign keys, and integrity rules (`Restrict` vs `SetNull`).
2. **ACID Transactions & Concurrency Control:** Prevention of double-booking, race condition handling under simultaneous requests, and atomic multi-table state transitions.
3. **Advanced Database Features:** Custom PostgreSQL Triggers (`AlertStatusAudit`), Database Views (`ActiveEmergenciesView`), and Stored Procedures with reverse-dependency ordering (`archive_completed_alerts`).
4. **Data Privacy & Statutory Compliance:** Soft deletion/anonymization vs forensic audit retention (India DPDP Act 2023 Sec 7(f)).
5. **Algorithmic Data Pipelines:** Spatial Haversine filtering combined with true Road-Network ETA re-ranking (OSRM).

---

## ⏱️ Recommended 6-Minute Presentation Timing

| Time | Phase | Focus |
| :--- | :--- | :--- |
| **0:00 – 1:00** | **The Hook & Problem Statement** | Elevator pitch explaining the spatial, concurrency, and audit failures in emergency dispatch. |
| **1:00 – 3:30** | **Live Dual-Screen Demo** | Side-by-side browser windows showing real-time dispatch, proximity matching, Leaflet map, and status flow. |
| **3:30 – 5:00** | **DBMS Deep-Dive (Grading Core)** | Triggers, views, stored procedures, ACID transactions, and audit snapshots. |
| **5:00 – 6:00** | **Automated Test Suite Execution** | Run `node tests/verify-all.js` live in terminal to show 100% pass on all 7 tests. |

---

## 🚀 1. The 60-Second Opening Pitch (Verbatim Script)

> *"Good morning, Professors. We present **MedRelay**, an emergency medical dispatch platform engineered specifically to solve the data integrity, spatial routing, and concurrency failure modes in pre-hospital emergency care.*
>
> *In critical emergencies, every second counts. However, conventional dispatch systems suffer from three major database and architectural problems:*
> 1. *Resource double-booking during surge events when concurrent requests arrive at the same millisecond.*
> 2. *Naive straight-line Euclidean distance calculations that fail across rivers, bridges, and traffic detours.*
> 3. *Data loss or broken audit trails when clinician records are deleted or completed calls are archived.*
>
> *MedRelay solves this using a normalized PostgreSQL database backed by atomic ACID transactions, an OSRM road-network routing engine for driving ETAs, cryptographic WebSocket isolation, automated PostgreSQL triggers for forensic malpractice auditing, and atomic stored procedures for non-destructive data archival.*
>
> *Allow us to demonstrate the live system."*

---

## 🖥️ 2. Live Dual-Screen Demonstration Flow

> **Setup Before Your Turn:**
> Open two browser windows side-by-side on your screen:
> - **Left Window (Doctor):** [https://dbms-project-blush.vercel.app/doctor](https://dbms-project-blush.vercel.app/doctor)
> - **Right Window (Patient / SOS):** [https://dbms-project-blush.vercel.app/](https://dbms-project-blush.vercel.app/)

### Step 1: Doctor Commences Duty (Left Window)
1. Navigate to `/doctor`.
2. Click **⚡ Quick Evaluator Login: Emergency Clinician** (demonstrating Evaluator Demo Mode).
3. Point out the **Mobile Browser Telemetry Notice**:
   > *"Notice our advisory: Mobile OSs aggressively throttle background GPS when screens lock. Our system explicitly informs clinicians to keep the tab active to maintain the strict 60-second telemetry freshness cutoff."*
4. Click **Commence on-duty session**.
5. Explain the **Two-State Clinician Flag Architecture**:
   > *"Availability is decoupled into two fields: `isOnDuty` (controlled by the clinician's shift toggle) and `isBusy` (controlled strictly by dispatch transactions). A doctor is eligible only when `isOnDuty && !isBusy && lastLocationAt < 60s`."*

### Step 2: Trigger Instant Guest SOS (Right Window)
1. On the home page (`/`), click **🚨 ONE-TAP GUEST SOS**.
2. Observe both screens update simultaneously:
   - Patient screen immediately displays assigned doctor, allocated vehicle license plate, and real-time Leaflet map.
   - Doctor screen immediately sounds and displays the assigned emergency with triage details.
3. Click **📍 Track Doctor on Full Live Map ➔** on the patient screen.
4. Point out the **URL address bar**:
   > *"Notice how the signed tracking token was passed cryptographically to authenticate the WebSocket room, but was instantly scrubbed from the URL using `window.history.replaceState`. This prevents token leakage through browser history and HTTP referrer headers."*

### Step 3: Mission Lifecycle (Doctor Acknowledges, Transports, Completes)
1. In the **Doctor window**, click **Acknowledge & En Route** (`PENDING` ➔ `DISPATCHED`).
   - The patient tracker map updates in real time via WebSockets.
2. In the Doctor window, select a receiving facility (e.g., *VIT Health Centre*) and click **Initiate Hospital Transport** (`DISPATCHED` ➔ `TRANSPORTING`).
   - Highlight:
   > *"The receiving facility is selected at transport time based on clinical triage needs, updating both `hospitalId` and the immutable `hospitalNameSnapshot`."*
3. Click **Mark Emergency Completed & Release Units** (`TRANSPORTING` ➔ `COMPLETED`).
   - Both clinician and vehicle are automatically released back to the available pool.

### Step 4: Dispatcher Console & Ward Escalation (New Tab)
1. Open a new tab and go to `/admin`.
2. Click **⚡ Quick Evaluator Login: Regional Dispatcher**.
3. Open the **Dispatch Operations** tab.
4. Show the **Active Emergencies View** and the **Manual Reassign** modal:
   > *"If an ambulance breaks down, the dispatcher can perform an atomic handoff. The database transaction validates that the new doctor is on-duty and not busy, locks them, releases the old doctor, and updates audit snapshots in a single ACID commit."*

---

## 🗄️ 3. The DBMS Core Deep-Dive (Grading Criteria)

Open your code editor or Supabase SQL editor to highlight these **5 core DBMS achievements**:

### 1. Relational Integrity & 3NF Normalization
* Show `schema.prisma` or your ER diagram:
  * Entities: `User`, `DoctorProfile`, `PatientProfile`, `Hospital`, `Vehicle`, `EmergencyAlert`, `DispatchRecord`, `Feedback`, and `AlertStatusAudit`.
  * `DispatchRecord` acts as a central associative entity connecting alerts, clinicians, vehicles, and hospitals with foreign key constraints.

### 2. Concurrency Control: Preventing Double-Booking Race Conditions
* Explain the atomic conditional claim in `backend/controllers/alertController.js`:
  ```javascript
  const claimResult = await tx.doctorProfile.updateMany({
      where: { id: closestDoctor.id, isBusy: false, isOnDuty: true, isActive: true },
      data: { isBusy: true, isAvailable: false }
  });
  ```
  > *"If two patients click SOS at the exact same millisecond, naive systems assign both to the same doctor. MedRelay uses conditional atomic locking: if `claimResult.count === 0`, it detects that a concurrent transaction already locked that doctor, and automatically claims the next available candidate or escalates cleanly."*

### 3. Automated PostgreSQL Audit Trigger (`AlertStatusAudit`)
* Show that every lifecycle transition is captured automatically at the database engine level:
  > *"Even if someone modifies the database directly via SQL, our PostgreSQL trigger `trg_alert_status_audit` intercepts the `UPDATE`, logging the old status, new status, and timestamp into `AlertStatusAudit` for medical malpractice compliance."*

### 4. Non-Destructive Stored Procedure Archival (`archive_completed_alerts`)
* Show `setup-advanced-db.js`:
  > *"When archiving emergencies older than 30 days, a direct `DELETE FROM EmergencyAlert` fails foreign key constraints or deletes audit history. Our stored procedure executes in a **child-first reverse dependency order**: it archives `Feedback` first, then `DispatchRecord` with responder snapshots, then `AlertStatusAudit` audit rows into `AlertStatusAuditArchive`, and finally `EmergencyAlert` inside a single atomic transaction without foreign key errors or data loss."*

### 5. Statutory Privacy: India DPDP Act 2023 Section 7(f) & Soft Redaction
* > *"When a patient exercises their 'Right to Erasure', medical regulations still require retaining incident response timestamps. We reconcile this by soft-redacting patient PII (anonymizing names and phone numbers) while keeping the relational dispatch record intact."*
* > *"Emergency data processing without prior consent is statutorily grounded in **Section 7(f) of India's Digital Personal Data Protection (DPDP) Act, 2023** for medical emergencies involving threat to life or health."*

---

## 🧪 4. Run the Live Verification Suite

In your terminal (`backend` directory), run:
```bash
node tests/verify-all.js
```

Show the faculty the live output:
```
================================================================
🏥 MedRelay Comprehensive Verification & Concurrency Test Suite
================================================================
[Test 1] Archival Procedure on Alert with Children (Feedback & DispatchRecord)...
  ✅ PASS: Archive procedure executed atomically with zero data loss.
[Test 2] Anti-Spoofing: Reject fake telemetry from unassigned doctor...
  ✅ PASS: Unassigned doctor spoofing attempt was detected and rejected with spoofError.
[Test 3] Doctor Disconnect & Reconnect Mid-Mission (Retains busy & assigned)...
  ✅ PASS: Doctor mid-mission disconnect emitted signalLost, retained assignment, and restored on reconnect.
[Test 4] Concurrency: Two concurrent SOS calls never double-book doctor...
  ✅ PASS: Concurrent SOS requests allocated distinct doctors and vehicles with zero double-booking.
[Test 5] Hospital Choice at Transport Time (#6 verification)...
  ✅ PASS: Transport status updated to TRANSPORTING and hospitalNameSnapshot updated.
[Test 6] Inpatient Ward Escalation with Zero Doctors at Hospital (#12 verification)...
  ✅ PASS: Inpatient alert with zero on-duty doctors routed directly to Dispatcher Console.
[Test 7] Database Views & PostgreSQL Audit Trigger (#14 / #15 verification)...
  ✅ PASS: ActiveEmergenciesView operational; AlertStatusAudit trigger logged recent transitions.
================================================================
🎉 TEST SUMMARY: 7 / 7 TESTS PASSED (100% SUCCESS)
================================================================
```

---

## ❓ Tough Faculty Viva Questions & Model Answers

### Q1: *"Why use PostgreSQL over MongoDB / NoSQL?"*
> **Answer:** *"Emergency medical dispatch is an absolute ACID domain. If an ambulance is allocated, we cannot have 'eventual consistency' where two patients are told the same ambulance is en route. PostgreSQL guarantees serializable transactions, relational foreign keys, database views, stored procedures, and triggers. Emergency healthcare records are inherently structured and relational."*

### Q2: *"How do you handle straight-line Haversine distance vs actual driving distance?"*
> **Answer:** *"We use a two-tiered spatial ranking pipeline. Haversine is used as a fast, low-cost geometric pre-filter to find candidate doctors within a 15 km bounding box. Then, the top 5 candidates are dynamically re-ranked using OSRM (Open Source Routing Machine) road-network driving durations. This prevents dispatching a doctor who is 1 km away across a river with no bridge over a doctor 3 km away on a direct highway."*

### Q3: *"What happens if a doctor loses internet connectivity while driving to a patient?"*
> **Answer:** *"In naive systems, the socket disconnect handler sets `isAvailable = false` and might unassign the alert. In MedRelay, availability is decoupled into `isOnDuty` and `isBusy`. When a doctor disconnects mid-mission, the alert is NOT released, `isBusy` remains true, and a `doctorSignalLost` event alerts the dispatcher. When the doctor reconnects, `doctorSignalRestored` re-establishes live telemetry seamlessly."*

### Q4: *"If an admin deletes a doctor from the system, what happens to historical dispatches?"*
> **Answer:** *"If we used CASCADE, medical dispatch history would be wiped out. If we used SET NULL without snapshots, we would lose who responded. In MedRelay, we solved this twofold: first, every `DispatchRecord` stores immutable snapshot columns (`doctorNameSnapshot`, `doctorSpecializationSnapshot`, `doctorPhoneSnapshot`). Second, in `adminController.deleteDoctor`, if a clinician has past dispatch history, the account is soft-deactivated (`isActive = false`) rather than deleted, preserving relational integrity."*

### Q5: *"Can any malicious client emit coordinates and move the doctor icon on the patient's map?"*
> **Answer:** *"No. We implemented an anti-spoofing verification layer in our WebSocket gateway (`server.js`). When a socket client emits a `locationBroadcast` for an alert, the server cryptographically checks that the sender's JWT role is `DOCTOR` AND queries the database to confirm that this exact user ID is assigned to that specific alert in `DispatchRecord`. Any spoofed emission is rejected with `spoofError`."*

---

## 📋 Evaluation Checklist Before Presenting
- [ ] Laptop connected to internet / phone hotspot.
- [ ] Deployed URLs bookmarked and verified:
  - App: [https://dbms-project-blush.vercel.app](https://dbms-project-blush.vercel.app)
  - Backend API: [https://emergency-backend-3ppk.onrender.com](https://emergency-backend-3ppk.onrender.com)
- [ ] Two side-by-side browser windows open (Doctor Portal on Left, Home/SOS on Right).
- [ ] Terminal open at `c:\Users\ASUS\Desktop\DBMS Project\backend` ready to run `node tests/verify-all.js`.
- [ ] PDF or printout of `MedRelay_Final_Report.md` ready for submission.
