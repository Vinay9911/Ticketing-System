const db = require('../services/dbService');

// ─── GET /notifications ──────────────────────────────────
exports.getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { rows: notifications, total, unread } = await db.notifications.getByUser(req.user.id, { limit: parseInt(limit), offset });

        res.json({
            notifications, unread,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /notifications/unread-count ─────────────────────
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await db.notifications.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /notifications/:id/read ─────────────────────────
exports.markAsRead = async (req, res) => {
    try {
        await db.notifications.markRead(req.params.id, req.user.id);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /notifications/read-all ─────────────────────────
exports.markAllRead = async (req, res) => {
    try {
        await db.notifications.markAllRead(req.user.id);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
