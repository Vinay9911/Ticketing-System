const jwt = require('jsonwebtoken');
const db = require('../services/dbService');

const JWT_SECRET = 'YourSuperSecretKey123!';

/**
 * Authenticates the request using JWT from Authorization header.
 * Populates req.user with { id, role, name, email, departmentId }.
 */
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            role: decoded.role,
            name: decoded.name,
            email: decoded.email,
            departmentId: decoded.departmentId
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
};

/**
 * RBAC middleware — restricts route to specified roles.
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions for this action' });
        }
        next();
    };
};

module.exports = { requireAuth, requireRole, JWT_SECRET };