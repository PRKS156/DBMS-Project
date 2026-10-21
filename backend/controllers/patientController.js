const prisma = require('../config/db.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Register a new patient account and patient profile in PostgreSQL via Prisma.
 */
exports.registerPatient = async (req, res) => {
    const { fullName, age, gender, bloodGroup, phoneNumber, email, password, medicalHistory } = req.body;

    if (!fullName || !password) {
        return res.status(400).json({ success: false, message: "Full name and password are required." });
    }

    if (phoneNumber) {
        const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
        if (!phoneRegex.test(phoneNumber.trim())) {
            return res.status(400).json({ success: false, message: "Invalid phone number format." });
        }
    }

    if (password.length < 4) {
        return res.status(400).json({ success: false, message: "Password must be at least 4 characters long." });
    }

    const patientEmail = email ? email.trim().toLowerCase() : `patient_${Date.now()}@medrelay.internal`;

    try {
        const existing = await prisma.user.findUnique({ where: { email: patientEmail } });
        if (existing) {
            return res.status(400).json({ success: false, message: "An account with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: patientEmail,
                    password: hashedPassword,
                    role: 'PATIENT'
                }
            });

            const profile = await tx.patientProfile.create({
                data: {
                    userId: user.id,
                    fullName: fullName.trim(),
                    phoneNumber: phoneNumber ? phoneNumber.trim() : 'N/A',
                    age: age ? parseInt(age) : null,
                    gender: gender || null,
                    bloodGroup: (bloodGroup && bloodGroup !== 'null') ? bloodGroup : 'Unknown',
                    medicalHistory: medicalHistory || null
                }
            });

            return { user, profile };
        });

        return res.status(201).json({
            success: true,
            message: "Patient registered successfully.",
            patientId: result.profile.id,
            userId: result.user.id,
            email: result.user.email
        });

    } catch (error) {
        console.error("❌ Patient Registration Failure:", error.message);
        return res.status(500).json({ success: false, message: "Registration failed.", debug: error.message });
    }
};

/**
 * Patient login using either email or numeric patient ID with password.
 */
exports.loginPatient = async (req, res) => {
    const { email, patientId, password } = req.body;

    if ((!email && !patientId) || !password) {
        return res.status(400).json({ success: false, message: "Email or Patient ID, and password are required." });
    }

    try {
        let user = null;
        let profile = null;

        if (email) {
            user = await prisma.user.findUnique({
                where: { email: email.trim().toLowerCase() },
                include: { patientProfile: true }
            });
            if (user) profile = user.patientProfile;
        } else if (patientId) {
            const targetId = parseInt(patientId);
            if (!isNaN(targetId)) {
                profile = await prisma.patientProfile.findFirst({
                    where: { OR: [{ id: targetId }, { userId: targetId }] },
                    include: { user: true }
                });
                if (profile) user = profile.user;
            }
        }

        if (!user || !profile) {
            return res.status(401).json({ success: false, message: "No patient account found with those credentials." });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Incorrect password." });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, profileId: profile.id },
            process.env.JWT_SECRET || 'supersecretkey',
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            success: true,
            message: "Login successful.",
            token,
            role: user.role,
            userId: user.id,
            patient: {
                patientId: profile.id,
                userId: user.id,
                fullName: profile.fullName,
                age: profile.age,
                gender: profile.gender,
                bloodGroup: profile.bloodGroup,
                phoneNumber: profile.phoneNumber,
                medicalHistory: profile.medicalHistory
            }
        });

    } catch (error) {
        console.error("❌ Patient Login Failure:", error.message);
        return res.status(500).json({ success: false, message: "Login failed.", debug: error.message });
    }
};

/**
 * Fetch patient profile by userId or profile id.
 */
exports.getPatientProfile = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);

    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid patient ID." });
    }

    try {
        const profile = await prisma.patientProfile.findFirst({
            where: { OR: [{ id: targetId }, { userId: targetId }] },
            include: { user: { select: { id: true, email: true, createdAt: true } } }
        });

        if (!profile) {
            return res.status(404).json({ success: false, message: "Patient profile not found." });
        }

        return res.status(200).json({ success: true, profile });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to fetch patient profile.", debug: error.message });
    }
};

/**
 * Update patient profile details.
 */
exports.updatePatientProfile = async (req, res) => {
    const { id } = req.params;
    const targetId = parseInt(id);
    const { fullName, phoneNumber, age, gender, bloodGroup, medicalHistory } = req.body;

    if (isNaN(targetId)) {
        return res.status(400).json({ success: false, message: "Invalid patient ID." });
    }

    try {
        const profile = await prisma.patientProfile.findFirst({
            where: { OR: [{ id: targetId }, { userId: targetId }] }
        });

        if (!profile) {
            return res.status(404).json({ success: false, message: "Patient profile not found." });
        }

        const updated = await prisma.patientProfile.update({
            where: { id: profile.id },
            data: {
                fullName: fullName !== undefined ? fullName : profile.fullName,
                phoneNumber: phoneNumber !== undefined ? phoneNumber : profile.phoneNumber,
                age: age !== undefined ? parseInt(age) : profile.age,
                gender: gender !== undefined ? gender : profile.gender,
                bloodGroup: bloodGroup !== undefined ? bloodGroup : profile.bloodGroup,
                medicalHistory: medicalHistory !== undefined ? medicalHistory : profile.medicalHistory
            }
        });

        return res.status(200).json({ success: true, message: "Profile updated successfully.", profile: updated });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Failed to update profile.", debug: error.message });
    }
};