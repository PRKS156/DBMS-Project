const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting MedRelay Database Seeding...');

    // 1. Seed Network Hospitals
    console.log('Seeding hospitals...');
    const hospitalsData = [
        { name: 'City General Hospital', address: 'Sector 4, Katpadi Road, Vellore', latitude: 12.9692, longitude: 79.1559, contactNumber: '+91-416-2244101' },
        { name: 'VIT Health Centre', address: 'Main Campus Health Facility, VIT Vellore', latitude: 12.9719, longitude: 79.1595, contactNumber: '+91-416-2202100' },
        { name: 'Apollo Speciality Care', address: 'Bypass Road, Vellore', latitude: 12.9352, longitude: 79.1330, contactNumber: '+91-416-2228800' },
        { name: 'CMC Vellore', address: 'Ida Scudder Road, Vellore', latitude: 12.9250, longitude: 79.1350, contactNumber: '+91-416-2281000' }
    ];

    for (const h of hospitalsData) {
        const existing = await prisma.hospital.findFirst({ where: { name: h.name } });
        if (!existing) {
            await prisma.hospital.create({ data: h });
        }
    }

    // 2. Seed Emergency Vehicles (Ambulances)
    console.log('Seeding emergency ambulances...');
    const vehiclesData = [
        { licensePlate: 'TN-23-EM-0108', type: 'Advanced Life Support (ALS)', isAvailable: true },
        { licensePlate: 'TN-23-EM-0102', type: 'Basic Life Support (BLS)', isAvailable: true },
        { licensePlate: 'TN-23-EM-0115', type: 'Advanced Life Support (ALS)', isAvailable: true },
        { licensePlate: 'TN-23-EM-0120', type: 'Patient Transport Ambulance', isAvailable: true }
    ];

    for (const v of vehiclesData) {
        const existing = await prisma.vehicle.findUnique({ where: { licensePlate: v.licensePlate } });
        if (!existing) {
            await prisma.vehicle.create({ data: v });
        }
    }

    // 3. Seed Default Administrator (Critique #17: Require explicit env var in production; dynamic random dev fallback)
    console.log('Seeding default administrator...');
    const adminPasswordEnv = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPasswordEnv && process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: In production environments, ADMIN_INITIAL_PASSWORD environment variable must be explicitly defined.');
    }
    const crypto = require('crypto');
    const initialPassword = adminPasswordEnv || crypto.randomBytes(16).toString('hex');
    const adminPassword = await bcrypt.hash(initialPassword, 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@vit.edu' },
        update: { password: adminPassword, role: 'ADMIN' },
        create: {
            email: 'admin@vit.edu',
            password: adminPassword,
            role: 'ADMIN'
        }
    });
    if (!adminPasswordEnv) {
        console.log(`🔐 Generated secure dynamic initial admin password: ${initialPassword}`);
        console.log('⚠️ Please store this password safely or set ADMIN_INITIAL_PASSWORD in your environment.');
    }

    // 4. Seed Clinicians with Specializations, Hospital Affiliations & Coordinates (Critique #12)
    console.log('Seeding clinicians with hospital linkages and fresh heartbeats...');
    const doctorsData = [
        {
            email: 'dr.ramesh@medrelay.com',
            name: 'Dr. Ramesh Kumar',
            specialization: 'Cardiology',
            phone: '9876543210',
            lat: 12.9710,
            lng: 79.1610,
            hospitalId: 1
        },
        {
            email: 'dr.priya@medrelay.com',
            name: 'Dr. Priya Sharma',
            specialization: 'Trauma Surgery',
            phone: '9876543211',
            lat: 12.9698,
            lng: 79.1575,
            hospitalId: 2
        },
        {
            email: 'dr.anita@medrelay.com',
            name: 'Dr. Anita Desai',
            specialization: 'Pediatrics',
            phone: '9876543212',
            lat: 12.9735,
            lng: 79.1625,
            hospitalId: 3
        },
        {
            email: 'dr.vikram@medrelay.com',
            name: 'Dr. Vikram Patel',
            specialization: 'Orthopedics',
            phone: '9876543213',
            lat: 12.9680,
            lng: 79.1540,
            hospitalId: 1
        },
        {
            email: 'dr.suresh@medrelay.com',
            name: 'Dr. Suresh Menon',
            specialization: 'General Medicine',
            phone: '9876543214',
            lat: 12.9705,
            lng: 79.1590,
            hospitalId: 2
        }
    ];

    const defaultDoctorPassword = await bcrypt.hash('doctor123', 10);

    for (const d of doctorsData) {
        let user = await prisma.user.findUnique({ where: { email: d.email } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: d.email,
                    password: defaultDoctorPassword,
                    role: 'DOCTOR',
                    doctorProfile: {
                        create: {
                            fullName: d.name,
                            specialization: d.specialization,
                            phoneNumber: d.phone,
                            isAvailable: true,
                            currentLat: d.lat,
                            currentLng: d.lng,
                            lastLocationAt: new Date(),
                            hospitalId: d.hospitalId
                        }
                    }
                }
            });
        } else {
            await prisma.doctorProfile.updateMany({
                where: { userId: user.id },
                data: {
                    hospitalId: d.hospitalId,
                    lastLocationAt: new Date(),
                    isAvailable: true
                }
            });
        }
    }

    // 5. Seed Test Patients
    console.log('Seeding test patients...');
    const patientPassword = await bcrypt.hash('patient123', 10);
    const patientsData = [
        {
            email: 'john.doe@medrelay.com',
            name: 'John Doe',
            phone: '9840112233',
            age: 42,
            gender: 'Male',
            bloodGroup: 'A+',
            medicalHistory: 'Hypertension'
        },
        {
            email: 'jane.smith@medrelay.com',
            name: 'Jane Smith',
            phone: '9840223344',
            age: 29,
            gender: 'Female',
            bloodGroup: 'O+',
            medicalHistory: 'Asthma, penicillin allergy'
        }
    ];

    for (const p of patientsData) {
        let user = await prisma.user.findUnique({ where: { email: p.email } });
        if (!user) {
            await prisma.user.create({
                data: {
                    email: p.email,
                    password: patientPassword,
                    role: 'PATIENT',
                    patientProfile: {
                        create: {
                            fullName: p.name,
                            phoneNumber: p.phone,
                            age: p.age,
                            gender: p.gender,
                            bloodGroup: p.bloodGroup,
                            medicalHistory: p.medicalHistory
                        }
                    }
                }
            });
        }
    }

    console.log('✅ MedRelay Database Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
