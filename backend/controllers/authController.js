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
            bloodGroup: bloodGroup || null,
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
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '1h' }
    );
    res.json({ message: 'Login successful', token, role: user.role });
  } catch (error) {
    res.status(500).json({ error: 'Login error' });
  }
};
