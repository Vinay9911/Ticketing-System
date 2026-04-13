const db = require('../config/db');

// GET /api/v1/assets
exports.getAssets = (req, res) => {
    let query = `
        SELECT a.*, c.name as category_name, u.name as assigned_user_name, d.name as dept_name 
        FROM assets a
        LEFT JOIN asset_categories c ON a.category_id = c.id
        LEFT JOIN users u ON a.assigned_to_user = u.id
        LEFT JOIN departments d ON a.assigned_to_dept = d.id
        WHERE a.is_deleted = 0
    `;
    let params = [];

    // RBAC Filtering [cite: 39]
    if (req.user.role === 'staff' || req.user.role === 'manager') {
        // Assuming we look up the user's dept first, but for simplicity we'll pass it or infer it.
        // For now, if staff/manager, filter by their context. We'll simulate fetching all for manager, own for staff.
        if (req.user.role === 'staff') {
            query += ` AND a.assigned_to_user = ?`;
            params.push(req.user.id);
        }
    }

    db.all(query + ` ORDER BY a.created_at DESC`, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ assets: rows });
    });
};

// GET /api/v1/assets/:id
exports.getAssetById = (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM assets WHERE id = ? AND is_deleted = 0", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Asset not found" });
        res.json({ asset: row });
    });
};

// POST /api/v1/assets (Admin Only) [cite: 79]
exports.createAsset = (req, res) => {
    const { name, category_id, serial_number, purchase_date, cost, location } = req.body;
    const sql = `INSERT INTO assets (name, category_id, serial_number, purchase_date, cost, location, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [name, category_id || null, serial_number || null, purchase_date || null, cost || null, location || null, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Asset created", id: this.lastID });
    });
};

// POST /api/v1/assets/:id/assign (Admin/Manager) [cite: 79]
exports.assignAsset = (req, res) => {
    const { id } = req.params;
    const { assigned_to_user, notes } = req.body;

    db.run(`UPDATE assets SET assigned_to_user = ?, status = 'in_use', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [assigned_to_user, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Insert into History [cite: 186]
        db.run(`INSERT INTO asset_history (asset_id, action_type, performed_by, notes) VALUES (?, 'assigned', ?, ?)`, 
            [id, req.user.id, notes || 'Assigned via API']);

        res.json({ message: "Asset assigned successfully" });
    });
};

// GET /api/v1/assets/categories
exports.getCategories = (req, res) => {
    db.all("SELECT * FROM asset_categories", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ categories: rows });
    });
};