const db = require('../config/db');

// ─── GET /notifications ──────────────────────────────────
exports.getNotifications = (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const total = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ?').get(req.user.id).c;
        const unread = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id).c;

        const notifications = db.prepare(`
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.user.id, parseInt(limit), offset);

        res.json({
            notifications, unread,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /notifications/unread-count ─────────────────────
exports.getUnreadCount = (req, res) => {
    try {
        const { c } = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
        res.json({ count: c });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /notifications/:id/read ─────────────────────────
exports.markAsRead = (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /notifications/read-all ─────────────────────────
exports.markAllRead = (req, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
