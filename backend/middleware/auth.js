const jwt = require('jsonwebtoken');

/**
 * Middleware to authenticate requests using JWT Bearer token.
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access denied. Authentication token required."
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey', (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: "Invalid or expired authentication token."
            });
        }
        req.user = user;
        next();
    });
};

/**
 * Middleware to restrict access to specific user roles (RBAC).
 * @param  {...string} roles Allowed roles (e.g. 'ADMIN', 'DOCTOR', 'DISPATCHER')
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of the following roles: ${roles.join(', ')}`
            });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    requireRole
};
