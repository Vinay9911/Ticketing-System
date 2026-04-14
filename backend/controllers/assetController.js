const db = require('../config/db');
const { logAudit } = require('../helpers/audit');
const { createNotification, notifyAdmins } = require('../helpers/notification');

// ─── GET /assets ─────────────────────────────────────────
exports.getAssets = (req, res) => {
    try {
        const { page = 1, limit = 20, search, status, category_id } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['a.is_deleted = 0'];
        let params = [];

        // RBAC scoping
        if (req.user.role === 'staff') {
            conditions.push('a.assigned_to_user = ?');
            params.push(req.user.id);
        } else if (req.user.role === 'manager') {
            conditions.push(`(a.assigned_to_dept IN (SELECT id FROM departments WHERE id = ?)
                OR a.assigned_to_user IN (SELECT id FROM users WHERE department_id = ?)
                OR a.created_by IN (SELECT id FROM users WHERE department_id = ?))`);
            params.push(req.user.departmentId, req.user.departmentId, req.user.departmentId);
        }

        if (search) {
            conditions.push('(a.name LIKE ? OR a.serial_number LIKE ? OR a.location LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) { conditions.push('a.status = ?'); params.push(status); }
        if (category_id) { conditions.push('a.category_id = ?'); params.push(parseInt(category_id)); }

        const where = conditions.join(' AND ');

        const total = db.prepare(`SELECT COUNT(*) as c FROM assets a WHERE ${where}`).get(...params).c;

        const assets = db.prepare(`
            SELECT a.*, c.name as category_name, u.name as assigned_user_name,
                   d.name as dept_name, cb.name as created_by_name
            FROM assets a
            LEFT JOIN asset_categories c ON a.category_id = c.id
            LEFT JOIN users u ON a.assigned_to_user = u.id
            LEFT JOIN departments d ON a.assigned_to_dept = d.id
            LEFT JOIN users cb ON a.created_by = cb.id
            WHERE ${where}
            ORDER BY a.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        res.json({ assets, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/:id ─────────────────────────────────────
exports.getAssetById = (req, res) => {
    try {
        const asset = db.prepare(`
            SELECT a.*, c.name as category_name, u.name as assigned_user_name,
                   d.name as dept_name, cb.name as created_by_name
            FROM assets a
            LEFT JOIN asset_categories c ON a.category_id = c.id
            LEFT JOIN users u ON a.assigned_to_user = u.id
            LEFT JOIN departments d ON a.assigned_to_dept = d.id
            LEFT JOIN users cb ON a.created_by = cb.id
            WHERE a.id = ? AND a.is_deleted = 0
        `).get(req.params.id);

        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        res.json({ asset });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets ────────────────────────────────────────
exports.createAsset = (req, res) => {
    try {
        const { name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Asset name is required' });

        // Check for duplicate serial number
        if (serial_number) {
            const existing = db.prepare('SELECT id FROM assets WHERE serial_number = ? AND is_deleted = 0').get(serial_number);
            if (existing) return res.status(400).json({ error: 'An asset with this serial number already exists' });
        }

        const result = db.prepare(`
            INSERT INTO assets (name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(name, category_id || null, serial_number || null, purchase_date || null, cost || null,
               warranty_expiry || null, location || null, status || 'available', notes || null, req.user.id);

        logAudit(req.user.id, 'asset', 'create', result.lastInsertRowid, null,
            { name, category_id, serial_number, status: status || 'available' }, req.ip);

        res.status(201).json({ message: 'Asset created successfully', id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'An asset with this serial number already exists' });
        res.status(500).json({ error: 'Failed to create asset. Please try again.' });
    }
};

// ─── PUT /assets/:id ─────────────────────────────────────
exports.updateAsset = (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM assets WHERE id = ? AND is_deleted = 0').get(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        const { name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, notes } = req.body;

        db.prepare(`
            UPDATE assets SET name=?, category_id=?, serial_number=?, purchase_date=?, cost=?,
            warranty_expiry=?, location=?, status=?, notes=?, updated_at=datetime('now')
            WHERE id=?
        `).run(name || old.name, category_id ?? old.category_id, serial_number ?? old.serial_number,
               purchase_date ?? old.purchase_date, cost ?? old.cost, warranty_expiry ?? old.warranty_expiry,
               location ?? old.location, status || old.status, notes ?? old.notes, id);

        const newData = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);

        // Record in asset_history if status changed
        if (status && status !== old.status) {
            db.prepare("INSERT INTO asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES (?, 'status_changed', ?, ?, ?, ?)")
                .run(id, req.user.id, JSON.stringify({ status: old.status }), JSON.stringify({ status }), `Status changed from ${old.status} to ${status}`);
        }

        logAudit(req.user.id, 'asset', 'update', id, old, newData, req.ip);
        res.json({ message: 'Asset updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /assets/:id ──────────────────────────────────
exports.deleteAsset = (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM assets WHERE id = ? AND is_deleted = 0').get(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        db.prepare("UPDATE assets SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?").run(id);
        logAudit(req.user.id, 'asset', 'delete', id, old, { is_deleted: 1 }, req.ip);

        res.json({ message: 'Asset deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets/:id/assign ─────────────────────────────
exports.assignAsset = (req, res) => {
    try {
        const id = req.params.id;
        const { assigned_to_user, assigned_to_dept, notes } = req.body;
        const old = db.prepare('SELECT * FROM assets WHERE id = ? AND is_deleted = 0').get(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        // Block assignment if asset is retired or under maintenance
        if (old.status === 'retired') {
            return res.status(400).json({ error: 'Cannot assign a retired asset. Change its status first.' });
        }
        if (old.status === 'under_maintenance') {
            return res.status(400).json({ error: 'Cannot assign an asset that is currently under maintenance. Complete maintenance first.' });
        }

        // Notify previous assignee that their asset is being reassigned
        if (old.assigned_to_user && old.assigned_to_user !== parseInt(assigned_to_user)) {
            const assetInfo = db.prepare('SELECT name FROM assets WHERE id = ?').get(id);
            createNotification(old.assigned_to_user, 'asset_assigned', 'Asset Reassigned',
                `${assetInfo.name} has been reassigned away from you by ${req.user.name}`, id);
        }

        db.prepare(`UPDATE assets SET assigned_to_user=?, assigned_to_dept=?, status='in_use', updated_at=datetime('now') WHERE id=?`)
            .run(assigned_to_user || null, assigned_to_dept || null, id);

        db.prepare("INSERT INTO asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES (?, 'assigned', ?, ?, ?, ?)")
            .run(id, req.user.id,
                JSON.stringify({ assigned_to_user: old.assigned_to_user, assigned_to_dept: old.assigned_to_dept, status: old.status }),
                JSON.stringify({ assigned_to_user: assigned_to_user || null, assigned_to_dept: assigned_to_dept || null, status: 'in_use' }),
                notes || (old.assigned_to_user ? 'Asset reassigned' : 'Asset assigned'));

        logAudit(req.user.id, 'asset', 'assign', id,
            { assigned_to_user: old.assigned_to_user, status: old.status },
            { assigned_to_user, status: 'in_use' }, req.ip);

        // Notify the new assignee
        if (assigned_to_user) {
            const asset = db.prepare('SELECT name FROM assets WHERE id = ?').get(id);
            createNotification(parseInt(assigned_to_user), 'asset_assigned', 'Asset Assigned to You',
                `${asset.name} has been assigned to you by ${req.user.name}`, id);
        }

        res.json({ message: 'Asset assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets/:id/unassign ───────────────────────────
exports.unassignAsset = (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM assets WHERE id = ? AND is_deleted = 0').get(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        db.prepare(`UPDATE assets SET assigned_to_user=NULL, assigned_to_dept=NULL, status='available', updated_at=datetime('now') WHERE id=?`).run(id);

        db.prepare("INSERT INTO asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES (?, 'unassigned', ?, ?, ?, ?)")
            .run(id, req.user.id,
                JSON.stringify({ assigned_to_user: old.assigned_to_user, status: old.status }),
                JSON.stringify({ assigned_to_user: null, status: 'available' }),
                'Asset unassigned');

        logAudit(req.user.id, 'asset', 'unassign', id, { assigned_to_user: old.assigned_to_user }, { assigned_to_user: null, status: 'available' }, req.ip);
        res.json({ message: 'Asset unassigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/:id/history ─────────────────────────────
exports.getAssetHistory = (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const total = db.prepare('SELECT COUNT(*) as c FROM asset_history WHERE asset_id = ?').get(req.params.id).c;

        const history = db.prepare(`
            SELECT h.*, u.name as performed_by_name
            FROM asset_history h
            LEFT JOIN users u ON h.performed_by = u.id
            WHERE h.asset_id = ?
            ORDER BY h.created_at DESC
            LIMIT ? OFFSET ?
        `).all(req.params.id, parseInt(limit), offset);

        res.json({
            history,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/categories ──────────────────────────────
exports.getCategories = (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT c.*, (SELECT COUNT(*) FROM assets a WHERE a.category_id = c.id AND a.is_deleted = 0) as asset_count
            FROM asset_categories c ORDER BY c.name
        `).all();
        res.json({ categories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets/categories ─────────────────────────────
exports.createCategory = (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required' });

        const result = db.prepare('INSERT INTO asset_categories (name, description) VALUES (?, ?)').run(name, description || null);
        logAudit(req.user.id, 'asset', 'create_category', result.lastInsertRowid, null, { name, description }, req.ip);
        res.status(201).json({ message: 'Category created', id: result.lastInsertRowid });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Category already exists' });
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /assets/categories/:id ──────────────────────────
exports.updateCategory = (req, res) => {
    try {
        const { name, description } = req.body;
        db.prepare('UPDATE asset_categories SET name = ?, description = ? WHERE id = ?')
            .run(name, description || null, req.params.id);
        res.json({ message: 'Category updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /assets/categories/:id ───────────────────────
exports.deleteCategory = (req, res) => {
    try {
        const assetCount = db.prepare('SELECT COUNT(*) as c FROM assets WHERE category_id = ? AND is_deleted = 0').get(req.params.id).c;
        if (assetCount > 0) return res.status(400).json({ error: `Cannot delete: ${assetCount} assets use this category` });

        db.prepare('DELETE FROM asset_categories WHERE id = ?').run(req.params.id);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/stats (Dashboard KPIs) ──────────────────
exports.getStats = (req, res) => {
    try {
        let deptFilter = '';
        let params = [];

        if (req.user.role === 'manager') {
            deptFilter = `AND (assigned_to_dept = ? OR assigned_to_user IN (SELECT id FROM users WHERE department_id = ?))`;
            params = [req.user.departmentId, req.user.departmentId];
        } else if (req.user.role === 'staff') {
            deptFilter = 'AND assigned_to_user = ?';
            params = [req.user.id];
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM assets WHERE is_deleted = 0 ${deptFilter}`).get(...params).c;
        const available = db.prepare(`SELECT COUNT(*) as c FROM assets WHERE is_deleted = 0 AND status = 'available' ${deptFilter}`).get(...params).c;
        const inUse = db.prepare(`SELECT COUNT(*) as c FROM assets WHERE is_deleted = 0 AND status = 'in_use' ${deptFilter}`).get(...params).c;
        const underMaintenance = db.prepare(`SELECT COUNT(*) as c FROM assets WHERE is_deleted = 0 AND status = 'under_maintenance' ${deptFilter}`).get(...params).c;
        const retired = db.prepare(`SELECT COUNT(*) as c FROM assets WHERE is_deleted = 0 AND status = 'retired' ${deptFilter}`).get(...params).c;

        // Assets by category
        const byCategory = db.prepare(`
            SELECT c.name, COUNT(a.id) as count FROM assets a
            JOIN asset_categories c ON a.category_id = c.id
            WHERE a.is_deleted = 0 ${deptFilter}
            GROUP BY c.name ORDER BY count DESC
        `).all(...params);

        res.json({ total, available, inUse, underMaintenance, retired, byCategory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};