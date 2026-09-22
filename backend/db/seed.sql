INSERT INTO DOCTOR (FullName, PhoneNumber, Specialization) VALUES 
('Dr. Ramesh Kumar', '9876543210', 'Cardiology'),
('Dr. Priya Sharma', '9876543211', 'Trauma Surgery'),
('Dr. Anita Desai', '9876543212', 'General Medicine');

INSERT INTO DOCTOR_AVAILABILITY (DoctorID, Status, CurrentLocation) VALUES 
(1, 'Available', ST_SetSRID(ST_MakePoint(79.1559, 12.9692), 4326)),
(2, 'Available', ST_SetSRID(ST_MakePoint(79.1600, 12.9720), 4326)),
(3, 'Busy',      ST_SetSRID(ST_MakePoint(79.1540, 12.9680), 4326));
