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

Emergency response organisations manage critical volumes of information, including patient details, doctor availability, ambulance locations, hospital assignments, and dispatch records. When this information is spread across independent communication channels, phone calls, and disconnected software, the result is delayed response times, data inconsistency, poor resource allocation, weak access control, and no reliable history of emergency events.

MedRelay is an integrated emergency response platform built on a centralised, normalised relational database using PostgreSQL and Prisma ORM. It enforces consistency through primary keys, foreign keys, unique constraints, ENUMs, and referential integrity, and restricts access through JWT authentication and role-based access control for patients, doctors, dispatchers, and administrators. Important emergency events are tracked in real time via WebSockets (Socket.io), with live status updates pushed to all connected stakeholders the moment an alert is triggered, dispatched, or acknowledged. A geolocation mapping component (Leaflet) provides a live visual map of patient locations and dispatched doctors, enabling proximity-based resource allocation using the Haversine formula. Advanced database features including Views, Stored Procedures, and Triggers are implemented to automate data management and maintain chronological integrity.

**Keywords:** *Emergency Response, PostgreSQL, Prisma ORM, Normalisation, Role-Based Access Control, JWT Authentication, WebSockets, Real-time Dispatch, Geolocation Mapping, Haversine Distance*

---

## Table of Contents

1. Introduction
2. Problem Definition
3. Application Domain
4. Existing System
5. Limitations of the Existing System
6. Proposed System
7. Database Design and Technologies
8. Proposed Database Structure
9. Real-time WebSocket Dispatch Mechanism
10. Geolocation and Live Tracking
11. Advanced Database Concepts (Views, Stored Procedures, Triggers)
12. Innovation
13. Novelty and Differentiation
14. Expected Outcomes and Benefits
15. SDG Alignment
16. Proposed Technical Architecture
17. Conclusion

---

## 1. Introduction

Emergency healthcare services require rapid coordination of patients, doctors, medical vehicles, and hospital facilities. In many regions, emergency dispatch is still handled through phone calls and independent radio networks. Such approaches lead to data silos, delayed response times, inaccurate location tracking, and difficulty maintaining a reliable history of dispatched events.

MedRelay – Emergency Response and Healthcare Dispatch System – is proposed as an integrated emergency management platform that coordinates these critical activities through a centralised relational database and a real-time event system. The platform is designed to serve four distinct user roles: patients who trigger emergencies, doctors who respond, dispatchers who allocate resources, and administrators who manage the entire system.

The platform uses PostgreSQL and Prisma ORM as its database foundation, with normalisation and integrity constraints to maintain consistent relationships between emergency entities. WebSockets (Socket.io) provide real-time updates for emergency alerts and dispatch acknowledgements, while React-Leaflet provides accurate geographical context by plotting patient and doctor locations on live interactive maps. The backend is powered by Express.js with RESTful API endpoints, and the frontend is built using React with Vite as the build tool.

---

## 2. Problem Definition

The primary problem addressed by MedRelay is the fragmented and inefficient management of emergency alerts, doctor dispatching, patient location tracking, and response coordination. Traditional approaches result in:

- Delayed response times due to manual dispatching via phone calls and radio, with no automated proximity-based matching of the nearest available doctor to the patient.
- Inaccurate tracking of patient and doctor locations, relying on verbal communication of addresses rather than precise GPS coordinates.
- Weak role-based access control where sensitive medical history (blood group, age, prior conditions) may not be securely restricted to only the assigned responding doctor.
- Difficulty tracking the complete lifecycle of an emergency event, from the initial alert through dispatch, acknowledgement, and completion.
- Lack of real-time communication between patients waiting for help and the doctor en route to their location, leading to anxiety and uncertainty.
- No centralised analytics for administrators to understand response patterns, identify high-frequency emergency areas, and optimise resource distribution.

These issues directly affect patient outcomes by making emergency response slower, less organised, and less reliable.

---

## 3. Application Domain

The proposed system belongs to the domain of Emergency Response and Health Informatics. The platform supports four primary user categories, each with clearly defined responsibilities and access levels:

| User Category | Responsibilities |
| :--- | :--- |
| **Patients** | Register with medical profiles (age, gender, blood group, medical history), trigger emergency alerts with GPS location, specify emergency type and landmark details, track dispatch status in real time, and view the assigned doctor's information and live location on a map. |
| **Doctors** | Register with specialisation credentials, toggle on-duty/off-duty status, broadcast live GPS location while on duty (updated every 10 seconds), receive assigned emergency alerts with full patient medical details, and acknowledge alerts to confirm en-route status. |
| **Administrators** | View system-wide statistics (total doctors, available doctors, total patients), manage doctor and patient records (view and delete), and access analytics dashboards showing emergency type distribution (pie charts), area-wise case frequency (bar charts), and average dispatch response time. |
| **Guest / Bystanders** | Use the One-Tap Guest SOS feature on the homepage to dispatch help immediately without registration, using only their current GPS coordinates. |

*Table 1: User categories of MedRelay*

---

## 4. Existing System

Traditional emergency dispatch centres commonly use independent telecommunication systems, physical logbooks, or legacy desktop software applications to manage emergency calls, ambulance dispatching, and hospital bed availability. A dispatcher receives a phone call, manually records the patient's spoken address, searches through printed or digital lists of available doctors and ambulances, and verbally relays instructions over radio.

These approaches operate as data silos. Patient medical history is stored separately from dispatch records. Doctor availability is tracked informally. Location information is based on addresses described verbally by distressed callers, not on precise GPS coordinates. There is no automated system to match the nearest available specialist to the patient's location.

Furthermore, conventional emergency management systems do not combine live WebSocket-based alerting, proximity-based doctor matching, and interactive geospatial mapping in a unified web platform accessible from any device.

---

## 5. Limitations of the Existing System

**5.1 Dispatch Delays**
Without real-time proximity-based resource matching, manual allocation of doctors and ambulances leads to significantly increased response times. A dispatcher must mentally determine which doctor is closest, which is inherently inaccurate and slow.

**5.2 Data Inconsistency**
Changes made to an emergency's status (such as a doctor acknowledging a call) may not be instantly reflected across other independent monitoring systems. A patient has no way to know whether their request has been received or whether a doctor is on the way.

**5.3 Limited Access Control**
Sensitive medical history, including blood group, age, pre-existing conditions, and contact numbers, may not be securely restricted. In existing systems, any staff member may access any patient's data regardless of whether they are the assigned responder.

**5.4 Lack of Live Tracking**
Traditional systems do not maintain a live visual map of doctor and patient coordinates. Dispatchers rely on static addresses rather than dynamic GPS positions, which is especially problematic when the patient is outdoors, in an unfamiliar area, or unable to articulate their exact location.

**5.5 No Specialisation Matching**
Existing systems rarely automate the process of matching a patient's emergency type (cardiac, trauma, paediatric, orthopaedic) to a doctor with the corresponding specialisation. The system either sends the nearest doctor regardless of specialisation, or relies on the dispatcher's knowledge.

**5.6 No Analytical Insights**
Legacy systems provide no dashboards or analytics for administrators to understand response patterns, identify frequently affected areas, or measure average response times.

---

## 6. Proposed System

MedRelay proposes a centralised emergency management platform that integrates patient profiles, doctor availability and specialisation, real-time emergency alerts, proximity-based dispatch, live geolocation tracking, and administrative analytics.

The system uses a normalised relational database (3NF) to minimise redundancy and maintain consistent relationships between emergency entities. PostgreSQL is the database management system, while Prisma ORM provides a type-safe, schema-driven interaction layer between the Node.js application and the database. Role-based access control is implemented for patients, doctors, and administrators using JWT (JSON Web Token) authentication, where each token encodes the user's ID and role, and API endpoints verify the role before granting access.

For rapid coordination, the system incorporates WebSockets (Socket.io) to push real-time updates. When a patient triggers an alert, the system automatically finds the nearest available doctor using the Haversine distance formula applied to GPS coordinates, creates a dispatch record linking the alert to the assigned doctor, and broadcasts the event in real time. The patient can then see the assigned doctor's name, phone number, specialisation, and distance on their screen, along with a live Leaflet map showing both their own location and the doctor's position.

The admin dashboard provides visual analytics using Recharts, including pie charts of emergency type distribution, horizontal bar charts of outdoor emergency hotspots, and a calculated average dispatch response time.

---

## 7. Database Design and Technologies

The proposed system uses the following database concepts and technologies:

| Technology / Concept | Purpose |
| :--- | :--- |
| **PostgreSQL** | Relational database management system for storing all application data |
| **Prisma ORM** | Type-safe database schema definition, migration, and query interface |
| **3NF Normalisation** | Reduce data redundancy by separating User, Profile, Alert, Dispatch, and Feedback entities |
| **Primary Keys** | Auto-incrementing integer IDs uniquely identify every record in every table |
| **Foreign Keys** | Maintain relationships between entities (e.g., PatientProfile → User, DispatchRecord → EmergencyAlert) |
| **Unique Constraints** | Prevent duplicate emails (User.email), duplicate license plates (Vehicle.licensePlate), and one-to-one mappings (DoctorProfile.userId, PatientProfile.userId, DispatchRecord.alertId) |
| **ENUMs** | Restrict the Role field to ADMIN, DOCTOR, PATIENT, DISPATCHER and the AlertStatus field to PENDING, DISPATCHED, COMPLETED, CANCELLED |
| **B-Tree Indexing** | Improve query performance on frequently filtered columns: User.role, EmergencyAlert.status, DoctorProfile.isAvailable |
| **Cascade Deletion** | Maintain referential integrity by automatically deleting dependent profiles, dispatch records, and feedback when a parent record is removed |
| **Database Views** | ActiveEmergenciesView provides a virtual table filtering only PENDING alerts |
| **Stored Procedures** | archive_completed_alerts automates archival of old completed alerts |
| **Triggers** | trg_update_timestamp automatically updates the updatedAt timestamp on every EmergencyAlert modification |
| **Transactions** | Used during user registration to atomically create both the User record and the corresponding DoctorProfile or PatientProfile |
| **bcrypt Hashing** | Passwords are hashed with a salt round of 10 before storage |
| **JWT Authentication** | Stateless authentication tokens encoding userId and role, with 1-hour expiry |
| **Socket.io (WebSockets)** | Real-time bidirectional event communication for alert status updates and doctor location broadcasting |
| **React-Leaflet / Geolocation** | Interactive mapping of patient and doctor positions using OpenStreetMap tiles |
| **Haversine Formula** | Calculates the great-circle distance between GPS coordinates for proximity-based doctor matching |
| **Recharts** | Data visualisation library for admin analytics (PieChart, BarChart) |

*Table 2: Technologies and database concepts used in MedRelay*

---

## 8. Proposed Database Structure

The relational database organises emergency information into eight interconnected entities. Primary and foreign key relationships maintain referential integrity between them.

### 8.1 Entity Descriptions

| Entity | Description | Key Attributes |
| :--- | :--- | :--- |
| **User** | Central authentication entity for all roles | id (PK), email (UNIQUE), password (hashed), role (ENUM), createdAt, updatedAt |
| **DoctorProfile** | Extended profile for doctors | id (PK), userId (FK → User, UNIQUE), fullName, specialization, phoneNumber, isAvailable, currentLat, currentLng |
| **PatientProfile** | Extended profile for patients | id (PK), userId (FK → User, UNIQUE), fullName, phoneNumber, age, gender, medicalHistory, bloodGroup |
| **Hospital** | Registered medical facilities | id (PK), name, address, latitude, longitude, contactNumber |
| **Vehicle** | Emergency vehicles | id (PK), licensePlate (UNIQUE), type, isAvailable |
| **EmergencyAlert** | Individual emergency incidents | id (PK), patientId (FK → PatientProfile), latitude, longitude, status (ENUM), description, createdAt, updatedAt |
| **DispatchRecord** | Links an alert to assigned resources | id (PK), alertId (FK → EmergencyAlert, UNIQUE), doctorId (FK → DoctorProfile), vehicleId (FK → Vehicle), hospitalId (FK → Hospital), dispatchedAt, completedAt |
| **Feedback** | Post-dispatch feedback from users | id (PK), dispatchRecordId (FK → DispatchRecord, UNIQUE), userId (FK → User), rating (1–5), comments, createdAt |

*Table 3: Entity descriptions*

### 8.2 Entity Relationships

| Relationship | Type | Description |
| :--- | :--- | :--- |
| User → DoctorProfile | One-to-One | Each doctor account has exactly one professional profile |
| User → PatientProfile | One-to-One | Each patient account has exactly one medical profile |
| PatientProfile → EmergencyAlert | One-to-Many | A patient can trigger multiple emergency alerts over time |
| EmergencyAlert → DispatchRecord | One-to-One | Each alert generates exactly one dispatch record upon resource allocation |
| DoctorProfile → DispatchRecord | One-to-Many | A doctor may be assigned to multiple dispatch records across different emergencies |
| Vehicle → DispatchRecord | One-to-Many | A vehicle may be dispatched to multiple emergencies |
| Hospital → DispatchRecord | One-to-Many | A hospital may be the destination for multiple dispatch records |
| DispatchRecord → Feedback | One-to-One | A completed dispatch may generate exactly one feedback entry |
| User → Feedback | One-to-Many | A user may submit feedback for multiple completed dispatches |

*Table 4: Entity relationships*

The normalised structure ensures that patient information is stored once in PatientProfile, doctor information once in DoctorProfile, and emergency event data is separated into EmergencyAlert and DispatchRecord, avoiding duplication while allowing efficient retrieval through foreign key joins.

---

## 9. Real-time WebSocket Dispatch Mechanism

MedRelay incorporates WebSockets (Socket.io) to improve the speed and reliability of emergency coordination. The real-time communication flow operates as follows:

**Step 1 – Alert Trigger:** When a patient triggers an emergency, the browser captures the patient's GPS coordinates via the Geolocation API and sends a POST request to the backend. The backend creates an EmergencyAlert record with status set to PENDING.

**Step 2 – Proximity-Based Doctor Matching:** The backend fetches all doctors where isAvailable is true and whose currentLat and currentLng are not null. Using the Haversine formula, it calculates the great-circle distance in metres between the patient's GPS coordinates and each available doctor's coordinates. If the patient specified a required specialisation (such as Cardiology or Trauma Surgery), the system first filters doctors by that specialisation and selects the nearest one. If no specialist is available, the system falls back to the nearest available doctor of any specialisation and flags the dispatch as a fallback.

**Step 3 – Dispatch Record Creation:** The system creates a DispatchRecord linking the EmergencyAlert to the selected DoctorProfile. The patient immediately receives the doctor's name, phone number, specialisation, and distance.

**Step 4 – Real-time Status Updates:** The patient's frontend establishes a Socket.io connection and joins a room identified by the alert ID. When the assigned doctor views the alert on their dashboard and clicks "Acknowledge En Route," the backend updates the alert status to DISPATCHED and emits a Socket.io event to the patient's room. The patient's interface instantly updates without requiring a page refresh.

**Step 5 – Live Doctor Location:** While on duty, the doctor's browser sends their GPS coordinates to the backend every 10 seconds via a PATCH request. The backend stores these coordinates and emits them via Socket.io. The patient's live map (React-Leaflet) updates the doctor's marker position in real time.

This end-to-end real-time pipeline ensures zero-delay communication from the moment an alert is triggered to the moment the doctor arrives.

---

## 10. Geolocation and Live Tracking

The mapping component of MedRelay provides a crucial visual layer for emergency response. The system stores exact latitude and longitude coordinates for:

- **EmergencyAlert:** The patient's GPS position at the time the alert was triggered.
- **DoctorProfile:** The doctor's continuously updated GPS position (refreshed every 10 seconds while on duty).
- **Hospital:** The registered coordinates of each hospital facility.

Using React-Leaflet on the frontend with OpenStreetMap tile layers, the patient dashboard displays an interactive map showing their own location and, once dispatched, the assigned doctor's live position. The Haversine formula implementation in the backend calculates distances in metres and formats them as either metres or kilometres for display.

The system uses the browser's native Geolocation API (navigator.geolocation.getCurrentPosition) to obtain coordinates. For doctors, a setInterval function re-reads their position every 10 seconds and sends a PATCH request to update their profile in the database, simultaneously emitting the new position via Socket.io to any connected patient tracking that doctor.

This eliminates the need for manual address lookup and significantly optimises the assignment of the closest available medical personnel.

---

## 11. Advanced Database Concepts

To enhance the performance, maintainability, and automation of MedRelay, several advanced PostgreSQL database features were implemented beyond the standard schema.

### 11.1 Database Views for Simplified Querying

In a real-time emergency dispatch system, dispatchers frequently need to retrieve a list of ongoing emergencies. Instead of repeatedly writing complex queries to filter alerts across the system, a Database View named ActiveEmergenciesView was created. This view acts as a virtual table that continuously presents only the emergencies with a PENDING status. By querying this view instead of the raw EmergencyAlert table, the application simplifies frontend data fetching, reduces query complexity, and ensures consistent filtering logic across the entire platform. Any query issued against the view automatically reflects the latest state of the underlying EmergencyAlert table.

### 11.2 Automated Data Archiving via Stored Procedures

As the system handles thousands of emergency alerts over time, keeping historical data in the active operational tables can eventually degrade query performance. To mitigate this, a Stored Procedure named archive_completed_alerts was developed using the PL/pgSQL procedural language. This procedure automatically scans the EmergencyAlert table to identify alerts that have been marked as COMPLETED for more than 30 days, and updates their description field to indicate they are archived. Using a stored procedure allows this heavy batch-processing operation to be executed entirely on the database server side, significantly reducing network overhead between the application and the database and improving overall system performance.

### 11.3 Maintaining Data Integrity with Database Triggers

Accurate timestamping is critical in an emergency dispatch system to track exactly when an alert's status changes, for example from PENDING to DISPATCHED or from DISPATCHED to COMPLETED. To ensure the updatedAt timestamp is always perfectly accurate without relying on application-level code, a Database Trigger was implemented. A trigger function named update_timestamp_func was created to automatically set the updatedAt field to the current database server time (NOW()) whenever any column in the row is modified. The trigger trg_update_timestamp is bound directly to the EmergencyAlert table and fires immediately before every UPDATE operation on any row. This guarantees strict chronological integrity for all emergency events and provides a tamper-proof audit trail, since the timestamp is set by the database server itself rather than the application.

---

## 12. Innovation

The primary innovation of MedRelay is the integration of relational emergency data management, live WebSocket broadcasting, proximity-based specialisation matching, and geographic mapping within a single unified web platform.

Unlike systems that manage calls and vehicle dispatching separately through independent tools, MedRelay connects all emergency entities – patients, doctors, vehicles, hospitals, alerts, and dispatches – through a normalised relational database with enforced integrity constraints. The Haversine formula provides mathematically accurate proximity matching to assign the nearest available specialist to each emergency. Live Socket.io events provide a mechanism for immediate, bidirectional incident communication without polling. Integrated React-Leaflet mapping enables visually guided, GPS-precise allocation of healthcare resources.

The One-Tap Guest SOS feature further differentiates MedRelay by allowing any bystander, even without an account, to dispatch emergency help using only their current GPS location with a single button press.

---

## 13. Novelty and Differentiation

The novelty of the proposed system lies in combining the following capabilities within a single platform:

- Centralised emergency data management with normalised relational schema in 3NF.
- Role-based access control across four distinct user types (Patient, Doctor, Admin, Guest) enforced through JWT token verification.
- Automated proximity-based doctor matching using the Haversine distance formula on stored GPS coordinates.
- Specialisation-aware dispatching with intelligent fallback (if no cardiologist is nearby, the nearest general doctor is dispatched instead).
- Real-time WebSocket-based dispatch alerts and status updates with zero polling latency.
- Live interactive geolocation mapping of patients and doctors on the same map.
- Comprehensive lifecycle tracking of each emergency from Alert creation through Dispatch, Acknowledgement, Completion, and Feedback.
- Administrative analytics with visual charts (emergency type distribution, area-wise hotspot analysis, average response time).
- Advanced database automation through Views, Stored Procedures, and Triggers.
- Guest SOS capability requiring no registration for bystander emergencies.

This combination differentiates MedRelay from conventional emergency systems that primarily focus on basic data storage, manual resource allocation, and offline dispatching.

---

## 14. Expected Outcomes and Benefits

- **Reduced response times** through automated, proximity-based doctor dispatching and live WebSocket notifications that eliminate manual phone-based coordination.
- **Optimised resource allocation** through visual geolocation mapping and the Haversine formula, ensuring the closest available doctor is always assigned.
- **Specialisation matching** that prioritises doctors with the relevant specialisation for the emergency type, improving clinical outcomes.
- **Reduced data redundancy** through 3NF database normalisation, with separate entities for Users, Profiles, Alerts, Dispatches, and Feedback.
- **Improved data consistency** through relational constraints including foreign keys, unique constraints, ENUMs, and cascade deletion rules.
- **Secure access** through JWT-based authentication and role-based authorisation, ensuring patients see only their own data and doctors see only their assigned alerts with full patient medical context.
- **Better incident traceability** through comprehensive dispatch logging from alert creation to feedback submission.
- **Real-time patient reassurance** through live map tracking and instant status updates, reducing anxiety during emergencies.
- **Administrative insights** through analytics dashboards that reveal emergency patterns, area hotspots, and system performance metrics.

---

## 15. SDG Alignment

**SDG 3 – Good Health and Well-being**
MedRelay directly supports efficient and organised emergency healthcare services by reducing dispatch response times, automating proximity-based resource allocation, and providing immediate access to critical patient medical information for responding doctors. By ensuring that the nearest qualified specialist reaches the patient as quickly as possible, the platform contributes to improved health outcomes and reduced mortality from delayed emergency response.

**SDG 9 – Industry, Innovation and Infrastructure**
The project promotes the use of modern database management, real-time web technologies (WebSockets), and geographic information systems to build resilient digital healthcare infrastructure. By integrating PostgreSQL, Prisma ORM, Socket.io, and React-Leaflet into a unified platform, MedRelay demonstrates how contemporary software architecture can be applied to improve emergency response infrastructure.

**SDG 11 – Sustainable Cities and Communities**
By providing real-time emergency dispatch coverage, area-wise analytics for resource planning, and one-tap SOS access for any bystander, MedRelay contributes to making communities safer and more resilient to medical emergencies.

---

## 16. Proposed Technical Architecture

The overall architecture is organised in distinct layers, from the user-facing application through security and data management to live event handling and spatial mapping.

| Layer | Components |
| :--- | :--- |
| **Presentation Layer** | React (Vite) web application with role-specific dashboards for Patients, Doctors, and Administrators. Routing handled by React Router DOM. |
| **Security Layer** | JWT authentication (jsonwebtoken) with bcrypt password hashing (salt rounds: 10). Role-based access control encoded in tokens (userId, role). |
| **Application Layer** | Express.js REST API with modular route and controller architecture: authRoutes, alertRoutes, doctorRoutes, patientRoutes, adminRoutes. |
| **Data Layer** | PostgreSQL database with Prisma ORM. Eight normalised entities: User, DoctorProfile, PatientProfile, Hospital, Vehicle, EmergencyAlert, DispatchRecord, Feedback. Advanced features: Views, Stored Procedures, Triggers. |
| **Event Layer** | Socket.io WebSocket server for real-time bidirectional communication. Room-based architecture (alert rooms) for targeted event broadcasting. |
| **Geospatial Layer** | React-Leaflet with OpenStreetMap tiles for interactive mapping. Haversine formula for distance calculation. Browser Geolocation API for GPS coordinate acquisition. |
| **Analytics Layer** | Recharts library for data visualisation. PieChart for emergency type distribution. BarChart for area-wise case frequency. Computed average response time metrics. |
| **Deployment Layer** | Frontend deployed on Vercel (static hosting). Backend deployed on Render (Node.js hosting). PostgreSQL database hosted on a cloud provider. |

*Table 5: MedRelay layered architecture*

User requests pass through JWT authentication and role-based access control to the Express.js backend API. The API reads and writes emergency data in PostgreSQL through Prisma ORM, and routes live events through the Socket.io server. The frontend consumes REST API responses for data and Socket.io events for real-time updates, rendering interactive maps and analytics charts accordingly.

---

## 17. Conclusion

MedRelay proposes and implements an integrated emergency management platform for improving the organisation, speed, and accuracy of emergency healthcare response. The system combines PostgreSQL-based relational database management, Prisma ORM for type-safe schema interaction, 3NF database normalisation, role-based access control with JWT authentication, real-time WebSocket communication via Socket.io, proximity-based doctor matching using the Haversine formula, and live geolocation mapping through React-Leaflet.

Advanced database features including Views, Stored Procedures, and Triggers further enhance the platform by automating common queries, batch data processing, and timestamp integrity. The administrative analytics dashboard provides actionable insights into emergency patterns and system performance.

The proposed solution addresses common limitations of fragmented emergency response systems and demonstrates how modern database technologies, combined with real-time web communication and spatial computing, can create a more reliable, faster, and more intelligent healthcare dispatch platform.
