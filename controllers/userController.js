const db = require('../services/dbService');

// ─── GET /users ──────────────────────────────────────────
exports.getUsers = async (req, res) => {
    try {
        const { department_id, role } = req.query;
        let conditions = ['u.is_active = TRUE'];
        let params = [];
        let idx = 1;

        if (department_id) { conditions.push(`u.department_id = $${idx++}`); params.push(parseInt(department_id)); }
        if (role) { conditions.push(`u.role = $${idx++}`); params.push(role); }

        const users = await db.users.getAll({ conditions, params });
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /users/:id ──────────────────────────────────────
exports.getUserById = async (req, res) => {
    try {
        const user = await db.users.getById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /departments ────────────────────────────────────
exports.getDepartments = async (req, res) => {
    try {
        const departments = await db.users.getDepartments();
        res.json({ departments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
