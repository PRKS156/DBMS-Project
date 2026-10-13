# BCSE302P – DATABASE SYSTEMS LAB
## Project Report

<div align="center">
  
# MEDRELAY
### Emergency Response and Healthcare Dispatch System

**Integrating Relational Database Management, Real-time WebSockets, and Geolocation Mapping**

<br/>

**Application Domain**
Emergency Response and Health Informatics

<br/>

**Submitted by**

| Team Member | Registration No. |
| :--- | :--- |
| Arna Adhikari | 24BDS0363 |
| Sanidhya Srivastava | 24BCB0135 |

</div>

<hr/>

## Abstract

Emergency response organizations manage critical situations requiring rapid coordination of patients, doctors, hospitals, and ambulances. When this information is managed through fragmented systems or manual dispatching, the result is delayed response times, poor resource allocation, weak access control, and unreliable tracking of emergency vehicles.

MedRelay is an integrated emergency response platform built on a centralized, normalized relational database using PostgreSQL and Prisma ORM. It enforces consistency through primary keys, foreign keys, unique constraints, ENUMs, and referential integrity. Access is restricted through JWT authentication and role-based access control for patients, doctors, dispatchers, and administrators. Important emergency events are tracked in real-time via WebSockets (Socket.io), while live geolocation mapping (Leaflet) visualizes the locations of patients, hospitals, and dispatch vehicles to ensure rapid and accurate emergency response.

**Keywords:** *Emergency Response, PostgreSQL, Prisma ORM, Normalization, Role-Based Access Control, WebSockets, Real-time Dispatch, Geolocation Mapping*

<hr/>

## Table of Contents

1. Introduction
2. Problem Definition
3. Application Domain
4. Existing System
5. Limitations of the Existing System
6. Proposed System
7. Database Design and Technologies
8. Proposed Database Structure
9. Real-time Dispatch Mechanism
10. Geolocation and Live Tracking
11. Innovation
12. Novelty and Differentiation
13. Expected Outcomes and Benefits
14. SDG Alignment
15. Proposed Technical Architecture
16. Conclusion

<hr/>

## 1. Introduction

Emergency healthcare services require rapid coordination of patients, doctors, medical vehicles, and hospital facilities. In many regions, emergency dispatch is handled through phone calls and independent radio networks. Such approaches lead to data silos, delayed response times, inaccurate location tracking, and difficulty maintaining a reliable history of dispatched events.

MedRelay – Emergency Response and Healthcare Dispatch System is proposed as an integrated emergency management platform that coordinates these critical activities through a centralized relational database and a real-time event system.

The platform uses PostgreSQL and Prisma ORM as its database foundation, with normalization and integrity constraints to maintain consistent relationships between emergency entities. WebSockets provide real-time updates for emergency alerts, while mapping libraries provide accurate geographical context to improve dispatch efficiency.

## 2. Problem Definition

The primary problem addressed by MedRelay is the fragmented and inefficient management of emergency alerts, ambulance dispatching, doctor availability, and patient location tracking. Traditional approaches can result in:

- Delayed response times due to manual dispatching
- Inaccurate tracking of patient and vehicle locations
- Weak role-based access control
- Difficulty tracking the complete lifecycle of an emergency event
- Lack of real-time communication between dispatchers and medical personnel

These issues affect patients, doctors, and emergency administrators by making emergency response less efficient and less reliable.

## 3. Application Domain

The proposed system belongs to the domain of Emergency Response and Health Informatics. The platform supports four primary user categories:

| User Category | Responsibilities |
| :--- | :--- |
| **Patients** | Trigger emergency alerts, track dispatch status, and manage medical profiles. |
| **Doctors** | Manage availability, receive emergency dispatches, and respond to alerts. |
| **Dispatchers** | Monitor incoming alerts, allocate resources (vehicles/doctors), and manage hospital assignments. |
| **Administrators** | Manage overall system operations, user accounts, and hospitals/vehicles. |
*Table 1: User categories of MedRelay*

## 4. Existing System

Traditional emergency dispatch centers commonly use independent telecommunication systems, physical records, or legacy software applications to manage emergency calls, ambulance dispatching, and hospital availability.

These approaches often operate as data silos. Information may be lost in verbal translation, and real-time location updates may not be consistently reflected. Access to sensitive patient medical history may also lack fine-grained role-based control and immediate availability to responding doctors.

Furthermore, conventional emergency management systems generally do not combine live WebSocket-based alerting with modern geospatial mapping in a unified web platform.

## 5. Limitations of the Existing System

**5.1 Dispatch Delays**
Without real-time resource matching, manual allocation of doctors and ambulances leads to increased response times.

**5.2 Data Inconsistency**
Changes made to an emergency's status may not be instantly reflected across other independent monitoring systems.

**5.3 Limited Access Control**
Sensitive medical history may not be securely restricted or made immediately available to the specifically assigned doctor.

**5.4 Lack of Live Tracking**
Traditional systems may not maintain a live, visual map of vehicle, patient, and hospital coordinates, relying instead on static addresses.

## 6. Proposed System

MedRelay proposes a centralized emergency management platform that integrates patient profiles, doctor availability, hospitals, vehicles, and real-time emergency alerts.

The system uses a normalized relational database to minimize redundancy and maintain relationships between emergency entities. PostgreSQL is the database management system, while Prisma ORM provides structured interaction between the application and the database. Role-based access is implemented for patients, doctors, dispatchers, and administrators.

For rapid coordination, the system incorporates WebSockets (Socket.io) to push real-time updates regarding alert statuses and dispatch assignments. The platform also utilizes Leaflet for geolocation, mapping patients and available medical resources dynamically on a live dashboard.

## 7. Database Design and Technologies

The proposed system uses the following database concepts and technologies:

| Technology / Concept | Purpose |
| :--- | :--- |
| **PostgreSQL** | Relational database management |
| **Prisma ORM** | Database schema and application interaction |
| **3NF Normalization** | Reduce data redundancy |
| **Primary Keys** | Uniquely identify records |
| **Foreign Keys** | Maintain relationships between entities |
| **Unique Constraints** | Prevent duplicate values |
| **ENUMs** | Restrict roles and alert statuses to predefined categories |
| **B-Tree Indexing** | Improve query performance on roles, statuses, and availability |
| **Referential Integrity** | Maintain valid relationships via Cascade deletions |
| **JWT Authentication** | User authentication |
| **Socket.io (WebSockets)** | Real-time event communication and live dispatching |
| **Leaflet / Geolocation** | Spatial mapping of hospitals, patients, and dispatches |
*Table 2: Technologies and database concepts*

## 8. Proposed Database Structure

The relational database organizes emergency information into interconnected entities. Primary and foreign key relationships maintain referential integrity between them.

| Relationship | Description |
| :--- | :--- |
| **User → Doctor / Patient** | Each doctor or patient profile is linked to a user account. |
| **Patient → Emergency Alert** | A patient profile initiates one or more emergency alerts. |
| **Emergency Alert → Dispatch Record** | Each alert generates a dispatch record upon resource allocation. |
| **Doctor → Dispatch Record** | A doctor is assigned to a specific dispatch record. |
| **Vehicle → Dispatch Record** | A vehicle is dispatched to handle the emergency alert. |
| **Hospital → Dispatch Record** | A destination hospital is designated in the dispatch record. |
| **Dispatch Record → Feedback** | A completed dispatch may generate a feedback entry from the user. |
*Table 3: Entity relationships*

The normalized structure reduces duplicated patient and resource information while allowing dispatch data to be retrieved efficiently.

## 9. Real-time Dispatch Mechanism

MedRelay incorporates WebSockets to improve the speed and reliability of emergency coordination.

When a patient triggers an `EmergencyAlert`, the status is instantly set to `PENDING`. Through Socket.io, this event is broadcasted immediately to available dispatchers. Once a dispatcher creates a `DispatchRecord`, assigning a `Doctor`, `Vehicle`, and `Hospital`, the alert status shifts to `DISPATCHED`. The assigned doctor and patient instantly receive push events updating their dashboards, ensuring zero delay in communication.

## 10. Geolocation and Live Tracking

The mapping component of MedRelay provides a crucial visual layer for emergency response.

The system stores exact latitude and longitude coordinates for `Hospital`, `EmergencyAlert` (Patient location), and `DoctorProfile`. Using React-Leaflet on the frontend and geo-utilities on the backend, dispatchers can visualize the physical distance between emergencies and available resources. This eliminates the need for manual address lookup and significantly optimizes the assignment of the closest available medical personnel and vehicles.

## 11. Innovation

The primary innovation of MedRelay is the integration of relational emergency data management, live WebSocket broadcasting, and geographic mapping within a single web platform.

Unlike systems that manage calls and vehicle dispatching separately, MedRelay connects these entities through a normalized relational database. Live socket events provide a mechanism for immediate incident response, while integrated mapping enables intelligent, visually-guided allocation of healthcare resources.

## 12. Novelty and Differentiation

The novelty of the proposed system lies in combining:
- Centralized emergency data management
- Normalized relational database design
- Geospatial mapping of patients and resources
- Real-time WebSocket-based dispatch alerts
- Role-based access control across four distinct user types
- Comprehensive lifecycle tracking from Alert to Feedback

This combination differentiates MedRelay from conventional emergency systems that primarily focus on basic data storage and offline dispatching.

## 13. Expected Outcomes and Benefits

- **Reduced response times** through live, socket-based dispatching.
- **Optimized resource allocation** through visual geolocation mapping.
- **Reduced data redundancy** through database normalization.
- **Improved data consistency** through relational constraints and cascade rules.
- **Secure access** through role-based authentication and authorization.
- **Better incident traceability** through comprehensive dispatch logging.

## 14. SDG Alignment

**SDG 3 – Good Health and Well-being**
MedRelay supports efficient and organized emergency healthcare services by improving dispatch times, resource organization, and immediate access to critical care.

**SDG 9 – Industry, Innovation and Infrastructure**
The project promotes the use of modern database, real-time web technologies, and geographic information systems to improve digital healthcare infrastructure.

## 15. Proposed Technical Architecture

The overall architecture is organized in layers, from the user-facing application through security and data management to live event handling and mapping.

| Layer | Components |
| :--- | :--- |
| **Presentation Layer** | Web application (React) used by Patients, Doctors, Dispatchers, and Admins |
| **Security Layer** | JWT authentication and Role-Based Access Control (RBAC) |
| **Application Layer** | Backend / API services (Express.js) |
| **Data Layer** | PostgreSQL with Prisma ORM: Users, Profiles, Alerts, Dispatches, Hospitals |
| **Event Layer** | Socket.io for Real-time WebSockets and live status updates |
| **Geospatial Layer** | Leaflet mapping and coordinate tracking |
*Table 4: MedRelay layered architecture*

User requests pass through authentication and role-based access control to the backend API. The API reads and writes emergency data in PostgreSQL through Prisma ORM, and routes live events through the Socket server.

## 16. Conclusion

MedRelay proposes an integrated emergency management platform for improving the organization, speed, and accuracy of emergency healthcare response. The system combines PostgreSQL-based relational database management, Prisma ORM, database normalization, role-based access control, real-time WebSockets, and geolocation mapping.

The proposed solution addresses common limitations of fragmented emergency response systems and demonstrates how database technologies can be combined with modern real-time and spatial techniques to create a more reliable and intelligent healthcare dispatch platform.
