const db = require('../services/dbService');
const { logAudit } = require('../helpers/audit');
const { createNotification } = require('../helpers/notification');

// ─── GET /maintenance ────────────────────────────────────
exports.getSchedules = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, asset_id } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['1=1'];
        let params = [];
        let idx = 1;

        if (status) { conditions.push(`m.status = $${idx++}`); params.push(status); }
        if (asset_id) { conditions.push(`m.asset_id = $${idx++}`); params.push(parseInt(asset_id)); }

        if (req.user.role === 'manager') {
            conditions.push(`m.asset_id IN (SELECT id FROM ts_assets WHERE assigned_to_dept IN
                (SELECT id FROM ts_departments WHERE id = $${idx}) OR created_by IN
                (SELECT id FROM ts_users WHERE department_id = $${idx + 1}))`);
            params.push(req.user.departmentId, req.user.departmentId);
            idx += 2;
        }

        const { rows: schedules, total } = await db.maintenance.getAll({ conditions, params, limit: parseInt(limit), offset });

        res.json({ schedules, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /maintenance ───────────────────────────────────
exports.createSchedule = async (req, res) => {
    try {
        const { asset_id, scheduled_date, maintenance_type, assigned_to, notes } = req.body;
        if (!asset_id || !scheduled_date) return res.status(400).json({ error: 'Asset and scheduled date are required' });

        const asset = await db.assets.getRawById(asset_id);
        if (!asset) return res.status(404).json({ error: 'Asset not found' });
        if (asset.status === 'retired') {
            return res.status(400).json({ error: 'Cannot schedule maintenance on a retired asset' });
        }

        const previousStatus = asset.status;
        await db.assets.setStatus(asset_id, 'under_maintenance');

        const id = await db.maintenance.create({
            asset_id, scheduled_date, maintenance_type, assigned_to,
            notes: JSON.stringify({ userNotes: notes || null, previousStatus }),
            created_by: req.user.id
        });

        await db.assets.addHistory({
            asset_id, action_type: 'maintenance', performed_by: req.user.id,
            previous_value: JSON.stringify({ status: previousStatus }),
            new_value: JSON.stringify({ status: 'under_maintenance', maintenance_type, scheduled_date }),
            notes: `Maintenance scheduled: ${maintenance_type || 'General'}`
        });

        await logAudit(req.user.id, 'maintenance', 'create', id, null, { asset_id, scheduled_date, maintenance_type }, req.ip);

        if (assigned_to) {
            await createNotification(parseInt(assigned_to), 'maintenance_due', 'Maintenance Assigned',
                `You have been assigned maintenance for ${asset.name} on ${scheduled_date}`, id);
        }

        res.status(201).json({ message: 'Maintenance scheduled', id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /maintenance/:id ────────────────────────────────
exports.updateSchedule = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.maintenance.getById(id);
        if (!old) return res.status(404).json({ error: 'Schedule not found' });

        const { scheduled_date, maintenance_type, assigned_to, notes, status } = req.body;

        await db.maintenance.update(id, {
            scheduled_date: scheduled_date || old.scheduled_date,
            maintenance_type: maintenance_type || old.maintenance_type,
            assigned_to: assigned_to ?? old.assigned_to,
            notes: notes ?? old.notes,
            status: status || old.status
        });

        await logAudit(req.user.id, 'maintenance', 'update', id, old, req.body, req.ip);
        res.json({ message: 'Schedule updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /maintenance/:id/complete ───────────────────────
exports.completeSchedule = async (req, res) => {
    try {
        const id = req.params.id;
        const schedule = await db.maintenance.getById(id);
        if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
        if (schedule.status === 'completed') return res.status(400).json({ error: 'This maintenance is already completed' });

        await db.maintenance.complete(id);

        let restoreStatus = 'available';
        try {
            const notesData = JSON.parse(schedule.notes);
            if (notesData && notesData.previousStatus && notesData.previousStatus !== 'under_maintenance') {
                restoreStatus = notesData.previousStatus;
            }
        } catch (e) {
            const assetInfo = await db.assets.getAssignment(schedule.asset_id);
            if (assetInfo && (assetInfo.assigned_to_user || assetInfo.assigned_to_dept)) {
                restoreStatus = 'in_use';
            }
        }

        await db.assets.setStatus(schedule.asset_id, restoreStatus);

        await db.assets.addHistory({
            asset_id: schedule.asset_id, action_type: 'status_changed', performed_by: req.user.id,
            previous_value: JSON.stringify({ status: 'under_maintenance' }),
            new_value: JSON.stringify({ status: restoreStatus }),
            notes: `Maintenance completed, asset restored to ${restoreStatus}`
        });

        await logAudit(req.user.id, 'maintenance', 'complete', id, { status: schedule.status }, { status: 'completed' }, req.ip);
        res.json({ message: 'Maintenance marked as complete' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /maintenance/:id ─────────────────────────────
exports.deleteSchedule = async (req, res) => {
    try {
        const old = await db.maintenance.getById(req.params.id);
        if (!old) return res.status(404).json({ error: 'Schedule not found' });

        await db.maintenance.remove(req.params.id);
        await logAudit(req.user.id, 'maintenance', 'delete', req.params.id, old, null, req.ip);
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /maintenance/upcoming ───────────────────────────
exports.getUpcoming = async (req, res) => {
    try {
        const schedules = await db.maintenance.getUpcoming();
        res.json({ schedules });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /maintenance/stats ──────────────────────────────
exports.getStats = async (req, res) => {
    try {
        const stats = await db.maintenance.getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
