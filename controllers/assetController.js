const db = require('../services/dbService');
const { logAudit } = require('../helpers/audit');
const { createNotification, notifyAdmins } = require('../helpers/notification');

// ─── GET /assets ─────────────────────────────────────────
exports.getAssets = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status, category_id } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['a.is_deleted = FALSE'];
        let params = [];
        let idx = 1;

        // RBAC scoping
        if (req.user.role === 'staff') {
            conditions.push(`a.assigned_to_user = $${idx++}`);
            params.push(req.user.id);
        } else if (req.user.role === 'manager') {
            conditions.push(`(a.assigned_to_dept IN (SELECT id FROM ts_departments WHERE id = $${idx})
                OR a.assigned_to_user IN (SELECT id FROM ts_users WHERE department_id = $${idx + 1})
                OR a.created_by IN (SELECT id FROM ts_users WHERE department_id = $${idx + 2}))`);
            params.push(req.user.departmentId, req.user.departmentId, req.user.departmentId);
            idx += 3;
        }

        if (search) {
            conditions.push(`(a.name ILIKE $${idx} OR a.serial_number ILIKE $${idx + 1} OR a.location ILIKE $${idx + 2})`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            idx += 3;
        }
        if (status) { conditions.push(`a.status = $${idx++}`); params.push(status); }
        if (category_id) { conditions.push(`a.category_id = $${idx++}`); params.push(parseInt(category_id)); }

        const { rows: assets, total } = await db.assets.getAll({ conditions, params, limit: parseInt(limit), offset });

        res.json({ assets, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/:id ─────────────────────────────────────
exports.getAssetById = async (req, res) => {
    try {
        const asset = await db.assets.getById(req.params.id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        res.json({ asset });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets ────────────────────────────────────────
exports.createAsset = async (req, res) => {
    try {
        const { name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'Asset name is required' });

        if (serial_number) {
            const existing = await db.assets.getBySerialNumber(serial_number);
            if (existing) return res.status(400).json({ error: 'An asset with this serial number already exists' });
        }

        const id = await db.assets.create({ name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, notes, created_by: req.user.id });

        await logAudit(req.user.id, 'asset', 'create', id, null, { name, category_id, serial_number, status: status || 'available' }, req.ip);

        res.status(201).json({ message: 'Asset created successfully', id });
    } catch (err) {
        if (err.message && err.message.includes('unique')) return res.status(400).json({ error: 'An asset with this serial number already exists' });
        res.status(500).json({ error: 'Failed to create asset. Please try again.' });
    }
};

// ─── PUT /assets/:id ─────────────────────────────────────
exports.updateAsset = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.assets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        const { name, category_id, serial_number, purchase_date, cost, warranty_expiry, location, status, notes } = req.body;

        const newData = await db.assets.update(id, {
            name: name || old.name, category_id: category_id ?? old.category_id,
            serial_number: serial_number ?? old.serial_number, purchase_date: purchase_date ?? old.purchase_date,
            cost: cost ?? old.cost, warranty_expiry: warranty_expiry ?? old.warranty_expiry,
            location: location ?? old.location, status: status || old.status, notes: notes ?? old.notes
        });

        if (status && status !== old.status) {
            await db.assets.addHistory({
                asset_id: id, action_type: 'status_changed', performed_by: req.user.id,
                previous_value: JSON.stringify({ status: old.status }), new_value: JSON.stringify({ status }),
                notes: `Status changed from ${old.status} to ${status}`
            });
        }

        await logAudit(req.user.id, 'asset', 'update', id, old, newData, req.ip);
        res.json({ message: 'Asset updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /assets/:id ──────────────────────────────────
exports.deleteAsset = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.assets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        await db.assets.softDelete(id);
        await logAudit(req.user.id, 'asset', 'delete', id, old, { is_deleted: true }, req.ip);

        res.json({ message: 'Asset deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets/:id/assign ─────────────────────────────
exports.assignAsset = async (req, res) => {
    try {
        const id = req.params.id;
        const { assigned_to_user, assigned_to_dept, notes } = req.body;
        const old = await db.assets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        if (old.status === 'retired') {
            return res.status(400).json({ error: 'Cannot assign a retired asset. Change its status first.' });
        }
        if (old.status === 'under_maintenance') {
            return res.status(400).json({ error: 'Cannot assign an asset that is currently under maintenance. Complete maintenance first.' });
        }

        // Notify previous assignee
        if (old.assigned_to_user && old.assigned_to_user !== parseInt(assigned_to_user)) {
            const assetName = await db.assets.getName(id);
            await createNotification(old.assigned_to_user, 'asset_assigned', 'Asset Reassigned',
                `${assetName} has been reassigned away from you by ${req.user.name}`, id);
        }

        await db.assets.assign(id, { assigned_to_user, assigned_to_dept });

        await db.assets.addHistory({
            asset_id: id, action_type: 'assigned', performed_by: req.user.id,
            previous_value: JSON.stringify({ assigned_to_user: old.assigned_to_user, assigned_to_dept: old.assigned_to_dept, status: old.status }),
            new_value: JSON.stringify({ assigned_to_user: assigned_to_user || null, assigned_to_dept: assigned_to_dept || null, status: 'in_use' }),
            notes: notes || (old.assigned_to_user ? 'Asset reassigned' : 'Asset assigned')
        });

        await logAudit(req.user.id, 'asset', 'assign', id,
            { assigned_to_user: old.assigned_to_user, status: old.status },
            { assigned_to_user, status: 'in_use' }, req.ip);

        if (assigned_to_user) {
            const assetName = await db.assets.getName(id);
            await createNotification(parseInt(assigned_to_user), 'asset_assigned', 'Asset Assigned to You',
                `${assetName} has been assigned to you by ${req.user.name}`, id);
        }

        res.json({ message: 'Asset assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets/:id/unassign ───────────────────────────
exports.unassignAsset = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.assets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Asset not found' });

        await db.assets.unassign(id);

        await db.assets.addHistory({
            asset_id: id, action_type: 'unassigned', performed_by: req.user.id,
            previous_value: JSON.stringify({ assigned_to_user: old.assigned_to_user, status: old.status }),
            new_value: JSON.stringify({ assigned_to_user: null, status: 'available' }),
            notes: 'Asset unassigned'
        });

        await logAudit(req.user.id, 'asset', 'unassign', id, { assigned_to_user: old.assigned_to_user }, { assigned_to_user: null, status: 'available' }, req.ip);
        res.json({ message: 'Asset unassigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/:id/history ─────────────────────────────
exports.getAssetHistory = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { rows: history, total } = await db.assets.getHistory({ assetId: req.params.id, limit: parseInt(limit), offset });

        res.json({
            history,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/categories ──────────────────────────────
exports.getCategories = async (req, res) => {
    try {
        const categories = await db.categories.getAll();
        res.json({ categories });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /assets/categories ─────────────────────────────
exports.createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required' });

        const id = await db.categories.create({ name, description });
        await logAudit(req.user.id, 'asset', 'create_category', id, null, { name, description }, req.ip);
        res.status(201).json({ message: 'Category created', id });
    } catch (err) {
        if (err.message && err.message.includes('unique')) return res.status(400).json({ error: 'Category already exists' });
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /assets/categories/:id ──────────────────────────
exports.updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        await db.categories.update(req.params.id, { name, description });
        res.json({ message: 'Category updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /assets/categories/:id ───────────────────────
exports.deleteCategory = async (req, res) => {
    try {
        const assetCount = await db.categories.getAssetCount(req.params.id);
        if (assetCount > 0) return res.status(400).json({ error: `Cannot delete: ${assetCount} assets use this category` });

        await db.categories.remove(req.params.id);
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /assets/stats (Dashboard KPIs) ──────────────────
exports.getStats = async (req, res) => {
    try {
        const stats = await db.assets.getStats({
            role: req.user.role, userId: req.user.id, departmentId: req.user.departmentId
        });
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};