const db = require('../config/db');
const { logAudit } = require('../helpers/audit');
const { createNotification, notifyDeptManagers } = require('../helpers/notification');

// ─── GET /maintenance ────────────────────────────────────
exports.getSchedules = (req, res) => {
    try {
        const { page = 1, limit = 20, status, asset_id } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['1=1'];
        let params = [];

        if (status) { conditions.push('m.status = ?'); params.push(status); }
        if (asset_id) { conditions.push('m.asset_id = ?'); params.push(parseInt(asset_id)); }

        // Manager sees only dept assets
        if (req.user.role === 'manager') {
            conditions.push(`m.asset_id IN (SELECT id FROM assets WHERE assigned_to_dept IN
                (SELECT id FROM departments WHERE id = ?) OR created_by IN
                (SELECT id FROM users WHERE department_id = ?))`);
            params.push(req.user.departmentId, req.user.departmentId);
        }

        const where = conditions.join(' AND ');
        const total = db.prepare(`SELECT COUNT(*) as c FROM maintenance_schedules m WHERE ${where}`).get(...params).c;

        // Auto-mark overdue
        db.prepare(`UPDATE maintenance_schedules SET status = 'overdue'
            WHERE status = 'pending' AND scheduled_date < date('now')`).run();

        const schedules = db.prepare(`
            SELECT m.*, a.name as asset_name, a.serial_number,
                   u.name as assigned_to_name, cb.name as created_by_name
            FROM maintenance_schedules m
            LEFT JOIN assets a ON m.asset_id = a.id
            LEFT JOIN users u ON m.assigned_to = u.id
            LEFT JOIN users cb ON m.created_by = cb.id
            WHERE ${where}
            ORDER BY
                CASE m.status WHEN 'overdue' THEN 0 WHEN 'pending' THEN 1 WHEN 'completed' THEN 2 END,
                m.scheduled_date ASC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        res.json({ schedules, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /maintenance ───────────────────────────────────
exports.createSchedule = (req, res) => {
    try {
        const { asset_id, scheduled_date, maintenance_type, assigned_to, notes } = req.body;
        if (!asset_id || !scheduled_date) return res.status(400).json({ error: 'Asset and scheduled date are required' });

        // Check asset exists and is not retired
        const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND is_deleted = 0').get(asset_id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        if (asset.status === 'retired') {
            return res.status(400).json({ error: 'Cannot schedule maintenance on a retired asset' });
        }

        // Store original status before changing to under_maintenance
        const previousStatus = asset.status;

        // Set asset status to under_maintenance
        db.prepare("UPDATE assets SET status = 'under_maintenance', updated_at = datetime('now') WHERE id = ?").run(asset_id);

        const result = db.prepare(`
            INSERT INTO maintenance_schedules (asset_id, scheduled_date, maintenance_type, assigned_to, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(asset_id, scheduled_date, maintenance_type || null, assigned_to || null,
               JSON.stringify({ userNotes: notes || null, previousStatus }), req.user.id);

        // Record asset history
        db.prepare("INSERT INTO asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES (?, 'maintenance', ?, ?, ?, ?)")
            .run(asset_id, req.user.id,
                JSON.stringify({ status: previousStatus }),
                JSON.stringify({ status: 'under_maintenance', maintenance_type, scheduled_date }),
                `Maintenance scheduled: ${maintenance_type || 'General'}`);

        logAudit(req.user.id, 'maintenance', 'create', result.lastInsertRowid, null, { asset_id, scheduled_date, maintenance_type }, req.ip);

        // Notify assigned technician
        if (assigned_to) {
            createNotification(parseInt(assigned_to), 'maintenance_due', 'Maintenance Assigned',
                `You have been assigned maintenance for ${asset.name} on ${scheduled_date}`, result.lastInsertRowid);
        }

        res.status(201).json({ message: 'Maintenance scheduled', id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /maintenance/:id ────────────────────────────────
exports.updateSchedule = (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
        if (!old) return res.status(404).json({ error: 'Schedule not found' });

        const { scheduled_date, maintenance_type, assigned_to, notes, status } = req.body;

        db.prepare(`UPDATE maintenance_schedules SET scheduled_date=?, maintenance_type=?, assigned_to=?, notes=?, status=? WHERE id=?`)
            .run(scheduled_date || old.scheduled_date, maintenance_type || old.maintenance_type,
                 assigned_to ?? old.assigned_to, notes ?? old.notes, status || old.status, id);

        logAudit(req.user.id, 'maintenance', 'update', id, old, req.body, req.ip);
        res.json({ message: 'Schedule updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /maintenance/:id/complete ───────────────────────
exports.completeSchedule = (req, res) => {
    try {
        const id = req.params.id;
        const schedule = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
        if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
        if (schedule.status === 'completed') return res.status(400).json({ error: 'This maintenance is already completed' });

        db.prepare("UPDATE maintenance_schedules SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(id);

        // Determine the correct status to restore the asset to
        // If the asset is currently assigned, restore to in_use; otherwise available
        let restoreStatus = 'available';
        try {
            const notesData = JSON.parse(schedule.notes);
            if (notesData && notesData.previousStatus && notesData.previousStatus !== 'under_maintenance') {
                restoreStatus = notesData.previousStatus;
            }
        } catch (e) {
            // notes is plain text, fallback to checking assignment
            const asset = db.prepare('SELECT assigned_to_user, assigned_to_dept FROM assets WHERE id = ?').get(schedule.asset_id);
            if (asset && (asset.assigned_to_user || asset.assigned_to_dept)) {
                restoreStatus = 'in_use';
            }
        }

        db.prepare(`UPDATE assets SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(restoreStatus, schedule.asset_id);

        db.prepare("INSERT INTO asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes) VALUES (?, 'status_changed', ?, ?, ?, ?)")
            .run(schedule.asset_id, req.user.id,
                JSON.stringify({ status: 'under_maintenance' }),
                JSON.stringify({ status: restoreStatus }),
                `Maintenance completed, asset restored to ${restoreStatus}`);

        logAudit(req.user.id, 'maintenance', 'complete', id, { status: schedule.status }, { status: 'completed' }, req.ip);

        res.json({ message: 'Maintenance marked as complete' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /maintenance/:id ─────────────────────────────
exports.deleteSchedule = (req, res) => {
    try {
        const old = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(req.params.id);
        if (!old) return res.status(404).json({ error: 'Schedule not found' });

        db.prepare('DELETE FROM maintenance_schedules WHERE id = ?').run(req.params.id);
        logAudit(req.user.id, 'maintenance', 'delete', req.params.id, old, null, req.ip);
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /maintenance/upcoming ───────────────────────────
exports.getUpcoming = (req, res) => {
    try {
        const schedules = db.prepare(`
            SELECT m.*, a.name as asset_name, u.name as assigned_to_name
            FROM maintenance_schedules m
            LEFT JOIN assets a ON m.asset_id = a.id
            LEFT JOIN users u ON m.assigned_to = u.id
            WHERE m.status IN ('pending', 'overdue')
            AND m.scheduled_date <= date('now', '+30 days')
            ORDER BY m.scheduled_date ASC
        `).all();
        res.json({ schedules });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /maintenance/stats ──────────────────────────────
exports.getStats = (req, res) => {
    try {
        const pending = db.prepare("SELECT COUNT(*) as c FROM maintenance_schedules WHERE status = 'pending'").get().c;
        const overdue = db.prepare("SELECT COUNT(*) as c FROM maintenance_schedules WHERE status = 'overdue'").get().c;
        const completed = db.prepare("SELECT COUNT(*) as c FROM maintenance_schedules WHERE status = 'completed'").get().c;
        const dueSoon = db.prepare("SELECT COUNT(*) as c FROM maintenance_schedules WHERE status = 'pending' AND scheduled_date <= date('now', '+7 days')").get().c;

        // Warranty expiring within 30 days
        const warrantyExpiring = db.prepare(`
            SELECT COUNT(*) as c FROM assets
            WHERE is_deleted = 0 AND warranty_expiry IS NOT NULL
            AND warranty_expiry <= date('now', '+30 days') AND warranty_expiry >= date('now')
        `).get().c;

        res.json({ pending, overdue, completed, dueSoon, warrantyExpiring });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
