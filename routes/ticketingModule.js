/* ════════════════════════════════════════════════════════════════
   TICKETING MODULE — Master Router
   Aggregates all ticketing sub-routes under /api/ticketing
   ════════════════════════════════════════════════════════════════ */
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../services/dbService');
const { JWT_SECRET } = require('../middleware/auth');

// ─── Login Endpoint (Testing Phase — No Password) ────────
router.post('/login', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await db.users.getByEmail(email);
        if (!user) return res.status(404).json({ error: 'User not found. Please check the email address.' });

        const token = jwt.sign(
            {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.department_id,
                departmentName: user.department_name
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                departmentId: user.department_id,
                departmentName: user.department_name
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

// ─── Mount Sub-Routers ──────────────────────────────────
router.use('/assets', require('./assetRoutes'));
router.use('/tickets', require('./ticketRoutes'));
router.use('/repairs', require('./repairRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/audit-logs', require('./auditRoutes'));
router.use('/users', require('./userRoutes'));

module.exports = router;
