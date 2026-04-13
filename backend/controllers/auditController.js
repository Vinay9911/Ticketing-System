const db = require('../config/db');

// ─── GET /audit-logs ─────────────────────────────────────
exports.getAuditLogs = (req, res) => {
    try {
        const { page = 1, limit = 25, module, action, user_id, date_from, date_to } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['1=1'];
        let params = [];

        if (module) { conditions.push('al.module = ?'); params.push(module); }
        if (action) { conditions.push('al.action = ?'); params.push(action); }
        if (user_id) { conditions.push('al.user_id = ?'); params.push(parseInt(user_id)); }
        if (date_from) { conditions.push('al.created_at >= ?'); params.push(date_from); }
        if (date_to) { conditions.push("al.created_at <= ? || ' 23:59:59'"); params.push(date_to); }

        const where = conditions.join(' AND ');

        const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs al WHERE ${where}`).get(...params).c;

        const logs = db.prepare(`
            SELECT al.*, u.name as user_name, u.role as user_role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE ${where}
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        // Get unique modules and actions for filter dropdowns
        const modules = db.prepare('SELECT DISTINCT module FROM audit_logs ORDER BY module').all().map(r => r.module);
        const actions = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all().map(r => r.action);

        res.json({
            logs, modules, actions,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
