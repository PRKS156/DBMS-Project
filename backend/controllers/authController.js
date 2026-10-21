const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { email, password, role, name, phone, specialization, age, gender, bloodGroup } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const assignedRole = role || 'PATIENT';

    // Use a transaction to create the user and their profile
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          role: assignedRole,
        }
      });

      if (assignedRole === 'DOCTOR') {
        await tx.doctorProfile.create({
          data: {
            userId: user.id,
            fullName: name || '',
            phoneNumber: phone || '',
            specialization: specialization || 'General Medicine',
          }
        });
      } else if (assignedRole === 'PATIENT') {
        await tx.patientProfile.create({
          data: {
            userId: user.id,
            fullName: name || '',
            phoneNumber: phone || '',
            age: age ? parseInt(age) : null,
            gender: gender || null,
            bloodGroup: (bloodGroup && bloodGroup !== 'null') ? bloodGroup : 'Unknown',
          }
        });
      }

      return user;
    });

    res.status(201).json({ message: 'User registered successfully', userId: result.id });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Registration failed. User may already exist.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let fullName = user.email;
    if (user.role === 'DOCTOR') {
      const docProfile = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
      if (docProfile) fullName = docProfile.fullName;
    } else if (user.role === 'PATIENT') {
      const patProfile = await prisma.patientProfile.findUnique({ where: { userId: user.id } });
      if (patProfile) fullName = patProfile.fullName;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1h' }
    );
    res.json({ message: 'Login successful', token, role: user.role, userId: user.id, name: fullName });
  } catch (error) {
    res.status(500).json({ error: 'Login error' });
  }
};

/**
 * Clearly labelled Evaluator Demo Mode Login
 * Strictly gated behind DEMO_MODE=true to prevent arbitrary admin login on public deployments.
 * Limited exclusively to seeded demo accounts.
 */
exports.demoLogin = async (req, res) => {
  try {
    // 1. Gate demo login behind DEMO_MODE=true; return 404 otherwise
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(404).json({ error: "Endpoint not found" });
    }

    const { role } = req.body; // 'ADMIN', 'DISPATCHER', 'DOCTOR', 'PATIENT'

    // 2. Limit strictly to seeded demo accounts
    const SEEDED_DEMO_EMAILS = {
      ADMIN: 'admin@vit.edu',
      DISPATCHER: 'admin@vit.edu',
      DOCTOR: 'dr.ramesh@medrelay.com',
      PATIENT: 'john.doe@medrelay.com'
    };

    const targetEmail = SEEDED_DEMO_EMAILS[role];
    if (!targetEmail) {
      return res.status(400).json({ error: `Invalid demo role requested: ${role}` });
    }

    let targetUser = null;
    if (role === 'ADMIN' || role === 'DISPATCHER') {
      targetUser = await prisma.user.findFirst({
        where: { email: targetEmail, role: 'ADMIN', isActive: true }
      });
    } else if (role === 'DOCTOR') {
      targetUser = await prisma.user.findFirst({
        where: { email: targetEmail, role: 'DOCTOR', isActive: true },
        include: { doctorProfile: true }
      });
    } else if (role === 'PATIENT') {
      targetUser = await prisma.user.findFirst({
        where: { email: targetEmail, role: 'PATIENT', isActive: true },
        include: { patientProfile: true }
      });
    }

    if (!targetUser) {
      return res.status(404).json({ error: `No active seeded ${role} account found for demo session.` });
    }

    let fullName = targetUser.email;
    if (targetUser.role === 'DOCTOR' && targetUser.doctorProfile) fullName = targetUser.doctorProfile.fullName;
    if (targetUser.role === 'PATIENT' && targetUser.patientProfile) fullName = targetUser.patientProfile.fullName;
    if (targetUser.role === 'ADMIN') fullName = role === 'DISPATCHER' ? 'Regional Dispatch Controller' : 'Chief Medical Administrator';

    const token = jwt.sign(
      { userId: targetUser.id, role: role === 'DISPATCHER' ? 'DISPATCHER' : targetUser.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: `Evaluator demo session active as ${role}`,
      token,
      role: role === 'DISPATCHER' ? 'DISPATCHER' : targetUser.role,
      userId: targetUser.id,
      name: fullName,
      isDemo: true
    });
  } catch (err) {
    return res.status(500).json({ error: "Demo login failed", debug: err.message });
  }
};
