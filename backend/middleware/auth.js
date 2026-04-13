const db = require('../config/db');

const requireAuth = (req, res, next) => {
    // In the future, this will extract and verify a JWT from req.headers.authorization
    // For now, we read the simulated headers sent by our Vanilla JS frontend
    const role = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    const userName = req.headers['x-user-name'];

    if (!role || !userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user context headers' });
    }

    // Mocking the decoded JWT payload
    req.user = {
        id: parseInt(userId),
        role: role.toLowerCase(),
        name: userName
    };

    next();
};

const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions for this action' });
        }
        next();
    };
};

module.exports = { requireAuth, requireRole };