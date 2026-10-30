const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const staff = user => ['ADMIN', 'DISPATCHER'].includes(user?.role);
async function identity(req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    try {
        const claims = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: claims.userId } });
        return user?.isActive && user.role === claims.role ? claims : null;
    } catch { return null; }
}

exports.profile = kind => async (req, res, next) => {
    try {
        req.user = await identity(req);
        if (!req.user) return res.status(401).json({ error: 'Authentication required' });
        const id = req.params.id || req.params.patientId || req.params.doctorId;
        if (staff(req.user)) return next();
        if (req.user.role !== kind.toUpperCase() || Number(id) !== req.user.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    } catch (err) { next(err); }
};

exports.alert = (mode = 'read') => async (req, res, next) => {
    try {
        const id = Number(req.params.id || req.params.alertId || req.body.alertId);
        if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid alert ID' });
        req.user = await identity(req);
        if (staff(req.user)) return next();
        const alert = await prisma.emergencyAlert.findUnique({
            where: { id }, include: { patient: true, dispatchRecord: { include: { doctor: true } } }
        });
        if (!alert) return res.status(404).json({ error: 'Alert not found' });
        const doctor = req.user?.role === 'DOCTOR' && alert.dispatchRecord?.doctor?.userId === req.user.userId;
        const patient = req.user?.role === 'PATIENT' && alert.patient.userId === req.user.userId;
        let tracker = false;
        try {
            const claims = jwt.verify(req.headers['x-tracking-token'], process.env.JWT_SECRET);
            tracker = claims.role === 'ALERT_TRACKER' && claims.alertId === id;
        } catch { /* Tracking credentials are optional for authenticated users. */ }
        const allowed = mode === 'doctor' ? doctor : mode === 'feedback' ? patient : mode === 'cancel' ? (patient || tracker) : (doctor || patient || tracker);
        if (!allowed) return res.status(403).json({ error: 'Access denied' });
        next();
    } catch (err) { next(err); }
};

exports.trigger = async (req, res, next) => {
    if (!req.body.patientId) return next();
    req.user = await identity(req);
    if (!req.user || (!staff(req.user) && req.user.userId !== Number(req.body.patientId))) {
        return res.status(403).json({ error: 'Cannot create an alert for another patient' });
    }
    next();
};
