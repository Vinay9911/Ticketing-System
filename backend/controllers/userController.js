const db = require('../config/db');

// ─── GET /users ──────────────────────────────────────────
exports.getUsers = (req, res) => {
    try {
        const { department_id, role } = req.query;
        let conditions = ['is_active = 1'];
        let params = [];

        if (department_id) { conditions.push('department_id = ?'); params.push(parseInt(department_id)); }
        if (role) { conditions.push('role = ?'); params.push(role); }

        const users = db.prepare(`
            SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            WHERE ${conditions.join(' AND ')}
            ORDER BY u.name
        `).all(...params);

        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /users/:id ──────────────────────────────────────
exports.getUserById = (req, res) => {
    try {
        const user = db.prepare(`
            SELECT u.id, u.name, u.email, u.role, u.department_id, d.name as department_name
            FROM users u LEFT JOIN departments d ON u.department_id = d.id
            WHERE u.id = ?
        `).get(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /departments ────────────────────────────────────
exports.getDepartments = (req, res) => {
    try {
        const departments = db.prepare(`
            SELECT d.*, (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.is_active = 1) as user_count
            FROM departments d ORDER BY d.name
        `).all();
        res.json({ departments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
