const db = require('../services/dbService');

// ─── GET /audit-logs ─────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 25, module, action, user_id, date_from, date_to } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['1=1'];
        let params = [];
        let idx = 1;

        if (module) { conditions.push(`al.module = $${idx++}`); params.push(module); }
        if (action) { conditions.push(`al.action = $${idx++}`); params.push(action); }
        if (user_id) { conditions.push(`al.user_id = $${idx++}`); params.push(parseInt(user_id)); }
        if (date_from) { conditions.push(`al.created_at >= $${idx++}`); params.push(date_from); }
        if (date_to) { conditions.push(`al.created_at <= ($${idx++} || ' 23:59:59')::timestamptz`); params.push(date_to); }

        const { rows: logs, total, modules, actions } = await db.audit.getAll({ conditions, params, limit: parseInt(limit), offset });

        res.json({
            logs, modules, actions,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
