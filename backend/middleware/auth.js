const db = require('../config/db');

/**
 * Authenticates the request using simulated headers.
 * In production, this would validate a JWT from Authorization header.
 * Populates req.user with { id, role, name, departmentId }.
 */
const requireAuth = (req, res, next) => {
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    const userName = req.headers['x-user-name'];

    if (!role || !userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user context headers' });
    }

    // Look up department from DB so managers can filter by dept
    const user = db.prepare('SELECT department_id FROM users WHERE id = ?').get(parseInt(userId));

    req.user = {
        id: parseInt(userId),
        role: role.toLowerCase(),
        name: userName || 'Unknown',
        departmentId: user ? user.department_id : null
    };

    next();
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

module.exports = { requireAuth, requireRole };