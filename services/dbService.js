/* ════════════════════════════════════════════════════════════════
   DATA ACCESS LAYER — services/dbService.js
   All SQL queries live here. Controllers call these methods only.
   All tables use the ts_ prefix for monolith namespace isolation.
   All queries use PostgreSQL $1, $2 parameterized syntax.
   ════════════════════════════════════════════════════════════════ */
const { pool } = require('../config/db');

// ─── Helper: single-row query ────────────────────────────
async function queryOne(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
}

// ─── Helper: multi-row query ─────────────────────────────
async function queryAll(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows;
}

// ─── Helper: insert returning id ─────────────────────────
async function insertReturning(sql, params = []) {
    const { rows } = await pool.query(sql + ' RETURNING id', params);
    return rows[0].id;
}

// ─── Helper: run (UPDATE/DELETE) ─────────────────────────
async function run(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rowCount;
}


/* ══════════════════════════════════════════════════════════
   ASSETS
   ══════════════════════════════════════════════════════════ */
const assets = {
    async getAll({ conditions, params, limit, offset }) {
        const where = conditions.join(' AND ');
        const countRes = await queryOne(
            `SELECT COUNT(*) AS c FROM ts_assets a WHERE ${where}`, params
        );
        const total = parseInt(countRes.c);

        const idx = params.length;
        const rows = await queryAll(`
            SELECT a.*, c.name AS category_name, u.name AS assigned_user_name, u.emp_id AS assigned_user_emp_id,
                   d.name AS dept_name, cb.name AS created_by_name
            FROM ts_assets a
            LEFT JOIN ts_asset_categories c ON a.category_id = c.id
            LEFT JOIN ts_users u ON a.assigned_to_user = u.id
            LEFT JOIN ts_departments d ON a.assigned_to_dept = d.id
            LEFT JOIN ts_users cb ON a.created_by = cb.id
            WHERE ${where}
            ORDER BY a.created_at DESC LIMIT $${idx + 1} OFFSET $${idx + 2}
        `, [...params, limit, offset]);

        return { rows, total };
    },

    async getById(id) {
        return queryOne(`
            SELECT a.*, c.name AS category_name, u.name AS assigned_user_name, u.emp_id AS assigned_user_emp_id,
                   d.name AS dept_name, cb.name AS created_by_name
            FROM ts_assets a
            LEFT JOIN ts_asset_categories c ON a.category_id = c.id
            LEFT JOIN ts_users u ON a.assigned_to_user = u.id
            LEFT JOIN ts_departments d ON a.assigned_to_dept = d.id
            LEFT JOIN ts_users cb ON a.created_by = cb.id
            WHERE a.id = $1 AND a.is_deleted = FALSE
        `, [id]);
    },

    async getRawById(id) {
        return queryOne('SELECT * FROM ts_assets WHERE id = $1 AND is_deleted = FALSE', [id]);
    },

    async getBySerialNumber(serialNumber) {
        return queryOne('SELECT id FROM ts_assets WHERE serial_number = $1 AND is_deleted = FALSE', [serialNumber]);
    },

    async create({ name, category_id, serial_number, express_service_code, make_model, purchase_date, cost, warranty_start_date, warranty_expiry, location, status, notes, created_by }) {
        return insertReturning(`
            INSERT INTO ts_assets (name, category_id, serial_number, express_service_code, make_model, purchase_date, cost, warranty_start_date, warranty_expiry, location, status, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
            name,
            category_id || null,
            serial_number || null,
            express_service_code || null,
            make_model || null,
            purchase_date || null,
            cost || null,
            warranty_start_date || null,
            warranty_expiry || null,
            location || null,
            status || 'available',
            notes || null,
            created_by
        ]);
    },

    async update(id, { name, category_id, serial_number, express_service_code, make_model, purchase_date, cost, warranty_start_date, warranty_expiry, location, status, notes }) {
        await run(`
            UPDATE ts_assets
            SET name=$1, category_id=$2, serial_number=$3, express_service_code=$4, make_model=$5,
                purchase_date=$6, cost=$7, warranty_start_date=$8, warranty_expiry=$9,
                location=$10, status=$11, notes=$12, updated_at=NOW()
            WHERE id=$13
        `, [name, category_id, serial_number, express_service_code, make_model, purchase_date, cost, warranty_start_date, warranty_expiry, location, status, notes, id]);
        return queryOne('SELECT * FROM ts_assets WHERE id = $1', [id]);
    },

    async softDelete(id) {
        return run('UPDATE ts_assets SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1', [id]);
    },

    async assign(id, { assigned_to_user, assigned_to_dept }) {
        return run(
            `UPDATE ts_assets SET assigned_to_user=$1, assigned_to_dept=$2, status='in_use', updated_at=NOW() WHERE id=$3`,
            [assigned_to_user || null, assigned_to_dept || null, id]
        );
    },

    async unassign(id) {
        return run(
            `UPDATE ts_assets SET assigned_to_user=NULL, assigned_to_dept=NULL, status='available', updated_at=NOW() WHERE id=$1`,
            [id]
        );
    },

    async setStatus(id, status) {
        return run(`UPDATE ts_assets SET status=$1, updated_at=NOW() WHERE id=$2`, [status, id]);
    },

    async getName(id) {
        const row = await queryOne('SELECT name FROM ts_assets WHERE id = $1', [id]);
        return row ? row.name : null;
    },

    async getAssignment(id) {
        return queryOne('SELECT assigned_to_user, assigned_to_dept FROM ts_assets WHERE id = $1', [id]);
    },

    async getHistory({ assetId, limit, offset }) {
        const countRes = await queryOne('SELECT COUNT(*) AS c FROM ts_asset_history WHERE asset_id = $1', [assetId]);
        const total = parseInt(countRes.c);
        const rows = await queryAll(`
            SELECT h.*, u.name AS performed_by_name
            FROM ts_asset_history h
            LEFT JOIN ts_users u ON h.performed_by = u.id
            WHERE h.asset_id = $1
            ORDER BY h.created_at DESC
            LIMIT $2 OFFSET $3
        `, [assetId, limit, offset]);
        return { rows, total };
    },

    async addHistory({ asset_id, action_type, performed_by, previous_value, new_value, notes }) {
        return insertReturning(`
            INSERT INTO ts_asset_history (asset_id, action_type, performed_by, previous_value, new_value, notes)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [asset_id, action_type, performed_by, previous_value || null, new_value || null, notes || null]);
    },

    async getStats({ role, userId, departmentId }) {
        let deptFilter = '';
        let params = [];

        if (role === 'manager') {
            deptFilter = `AND (assigned_to_dept = $1 OR assigned_to_user IN (SELECT id FROM ts_users WHERE department_id = $2))`;
            params = [departmentId, departmentId];
        } else if (role === 'staff') {
            deptFilter = 'AND assigned_to_user = $1';
            params = [userId];
        }

        const total          = (await queryOne(`SELECT COUNT(*) AS c FROM ts_assets WHERE is_deleted = FALSE ${deptFilter}`, params)).c;
        const available      = (await queryOne(`SELECT COUNT(*) AS c FROM ts_assets WHERE is_deleted = FALSE AND status = 'available' ${deptFilter}`, params)).c;
        const inUse          = (await queryOne(`SELECT COUNT(*) AS c FROM ts_assets WHERE is_deleted = FALSE AND status = 'in_use' ${deptFilter}`, params)).c;
        const underMaintenance = (await queryOne(`SELECT COUNT(*) AS c FROM ts_assets WHERE is_deleted = FALSE AND status = 'under_maintenance' ${deptFilter}`, params)).c;
        const retired        = (await queryOne(`SELECT COUNT(*) AS c FROM ts_assets WHERE is_deleted = FALSE AND status = 'retired' ${deptFilter}`, params)).c;

        const byCategory = await queryAll(`
            SELECT c.name, COUNT(a.id) AS count FROM ts_assets a
            JOIN ts_asset_categories c ON a.category_id = c.id
            WHERE a.is_deleted = FALSE ${deptFilter}
            GROUP BY c.name ORDER BY count DESC
        `, params);

        return {
            total: parseInt(total), available: parseInt(available), inUse: parseInt(inUse),
            underMaintenance: parseInt(underMaintenance), retired: parseInt(retired), byCategory
        };
    }
};


/* ══════════════════════════════════════════════════════════
   ASSET CATEGORIES
   ══════════════════════════════════════════════════════════ */
const categories = {
    async getAll() {
        return queryAll(`
            SELECT c.*, (SELECT COUNT(*) FROM ts_assets a WHERE a.category_id = c.id AND a.is_deleted = FALSE) AS asset_count
            FROM ts_asset_categories c ORDER BY c.name
        `);
    },

    async create({ name, description }) {
        return insertReturning(
            'INSERT INTO ts_asset_categories (name, description) VALUES ($1, $2)',
            [name, description || null]
        );
    },

    async update(id, { name, description }) {
        return run('UPDATE ts_asset_categories SET name = $1, description = $2 WHERE id = $3', [name, description || null, id]);
    },

    async remove(id) {
        return run('DELETE FROM ts_asset_categories WHERE id = $1', [id]);
    },

    async getAssetCount(id) {
        const row = await queryOne('SELECT COUNT(*) AS c FROM ts_assets WHERE category_id = $1 AND is_deleted = FALSE', [id]);
        return parseInt(row.c);
    }
};


/* ══════════════════════════════════════════════════════════
   TICKETS
   ══════════════════════════════════════════════════════════ */
const tickets = {
    async generateNumber() {
        const year = new Date().getFullYear();
        const last = await queryOne(
            "SELECT ticket_number FROM ts_tickets WHERE ticket_number LIKE $1 ORDER BY id DESC LIMIT 1",
            [`TKT-${year}-%`]
        );
        let next = 1;
        if (last) {
            const parts = last.ticket_number.split('-');
            next = parseInt(parts[2]) + 1;
        }
        return `TKT-${year}-${String(next).padStart(3, '0')}`;
    },

    async getAll({ conditions, params, limit, offset }) {
        const where = conditions.join(' AND ');
        const countRes = await queryOne(`
            SELECT COUNT(*) AS c FROM ts_tickets t
            LEFT JOIN ts_users ru ON t.raised_by = ru.id
            WHERE ${where}
        `, params);
        const total = parseInt(countRes.c);

        const idx = params.length;
        const rows = await queryAll(`
            SELECT t.*, ru.name AS raised_by_name, ru.role AS raised_by_role,
                   au.name AS assigned_to_name, a.name AS asset_name
            FROM ts_tickets t
            LEFT JOIN ts_users ru ON t.raised_by = ru.id
            LEFT JOIN ts_users au ON t.assigned_to = au.id
            LEFT JOIN ts_assets a ON t.asset_id = a.id
            WHERE ${where}
            ORDER BY
                CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                t.created_at DESC
            LIMIT $${idx + 1} OFFSET $${idx + 2}
        `, [...params, limit, offset]);

        return { rows, total };
    },

    async getById(id) {
        return queryOne(`
            SELECT t.*,
                   ru.name AS raised_by_name, ru.role AS raised_by_role, ru.email AS raised_by_email,
                   ru.emp_id AS raised_by_emp_id, d.name AS raised_by_dept,
                   au.name AS assigned_to_name,
                   a.name AS asset_name, a.serial_number AS asset_serial
            FROM ts_tickets t
            LEFT JOIN ts_users ru ON t.raised_by = ru.id
            LEFT JOIN ts_departments d ON ru.department_id = d.id
            LEFT JOIN ts_users au ON t.assigned_to = au.id
            LEFT JOIN ts_assets a ON t.asset_id = a.id
            WHERE t.id = $1
        `, [id]);
    },

    async getRawById(id) {
        return queryOne('SELECT * FROM ts_tickets WHERE id = $1', [id]);
    },

    async create({ ticket_number, title, description, priority, issue_type, asset_id, raised_by }) {
        return insertReturning(`
            INSERT INTO ts_tickets (ticket_number, title, description, priority, issue_type, asset_id, raised_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [ticket_number, title, description, priority || 'medium', issue_type || 'other', asset_id || null, raised_by]);
    },

    async update(id, updates) {
        let setClauses = ['updated_at = NOW()'];
        let params = [];
        let idx = 1;

        if (updates.status !== undefined) {
            setClauses.push(`status = $${idx++}`);
            params.push(updates.status);
            if (updates.status === 'resolved') setClauses.push('resolved_at = NOW()');
            if (updates.status === 'closed')   setClauses.push('closed_at = NOW()');
        }
        if (updates.priority    !== undefined) { setClauses.push(`priority = $${idx++}`);    params.push(updates.priority); }
        if (updates.title       !== undefined) { setClauses.push(`title = $${idx++}`);       params.push(updates.title); }
        if (updates.description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(updates.description); }
        if (updates.issue_type  !== undefined) { setClauses.push(`issue_type = $${idx++}`);  params.push(updates.issue_type); }

        params.push(id);
        await run(`UPDATE ts_tickets SET ${setClauses.join(', ')} WHERE id = $${idx}`, params);
        return queryOne('SELECT * FROM ts_tickets WHERE id = $1', [id]);
    },

    async remove(id) {
        await run('DELETE FROM ts_ticket_comments WHERE ticket_id = $1', [id]);
        return run('DELETE FROM ts_tickets WHERE id = $1', [id]);
    },

    async assign(id, assignedTo) {
        return run(
            "UPDATE ts_tickets SET assigned_to = $1, status = 'in_progress', updated_at = NOW() WHERE id = $2",
            [assignedTo, id]
        );
    },

    async getStats({ role, userId, departmentId }) {
        let deptFilter = '';
        let params = [];

        if (role === 'staff') {
            deptFilter = 'AND (raised_by = $1 OR assigned_to = $2)';
            params = [userId, userId];
        } else if (role === 'manager') {
            deptFilter = `AND (raised_by IN (SELECT id FROM ts_users WHERE department_id = $1)
                OR assigned_to IN (SELECT id FROM ts_users WHERE department_id = $2))`;
            params = [departmentId, departmentId];
        }

        const total      = parseInt((await queryOne(`SELECT COUNT(*) AS c FROM ts_tickets WHERE 1=1 ${deptFilter}`, params)).c);
        const open       = parseInt((await queryOne(`SELECT COUNT(*) AS c FROM ts_tickets WHERE status='open' ${deptFilter}`, params)).c);
        const inProgress = parseInt((await queryOne(`SELECT COUNT(*) AS c FROM ts_tickets WHERE status='in_progress' ${deptFilter}`, params)).c);
        const resolved   = parseInt((await queryOne(`SELECT COUNT(*) AS c FROM ts_tickets WHERE status='resolved' ${deptFilter}`, params)).c);
        const closed     = parseInt((await queryOne(`SELECT COUNT(*) AS c FROM ts_tickets WHERE status='closed' ${deptFilter}`, params)).c);

        const byPriority = await queryAll(
            `SELECT priority, COUNT(*) AS count FROM ts_tickets WHERE 1=1 ${deptFilter} GROUP BY priority`, params
        );
        const byStatus = await queryAll(
            `SELECT status, COUNT(*) AS count FROM ts_tickets WHERE 1=1 ${deptFilter} GROUP BY status`, params
        );
        const last30Days = await queryAll(`
            SELECT created_at::date AS date, COUNT(*) AS count
            FROM ts_tickets WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' ${deptFilter}
            GROUP BY created_at::date ORDER BY date
        `, params);
        const avgRes = await queryOne(`
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) AS avg_hours
            FROM ts_tickets WHERE resolved_at IS NOT NULL ${deptFilter}
        `, params);

        return {
            total, open, inProgress, resolved, closed,
            byPriority, byStatus, last30Days,
            avgResolutionHours: avgRes && avgRes.avg_hours ? Math.round(parseFloat(avgRes.avg_hours)) : null
        };
    }
};


/* ══════════════════════════════════════════════════════════
   TICKET COMMENTS
   ══════════════════════════════════════════════════════════ */
const comments = {
    async getByTicket(ticketId, { includeInternal = true } = {}) {
        let query = `
            SELECT c.*, u.name AS user_name, u.role AS user_role
            FROM ts_ticket_comments c
            JOIN ts_users u ON c.user_id = u.id
            WHERE c.ticket_id = $1
        `;
        if (!includeInternal) query += ' AND c.is_internal = FALSE';
        query += ' ORDER BY c.created_at ASC';
        return queryAll(query, [ticketId]);
    },

    // ─── FIX: was missing — ticketController.addComment calls this ───
    async create({ ticket_id, user_id, comment, is_internal }) {
        return insertReturning(
            'INSERT INTO ts_ticket_comments (ticket_id, user_id, comment, is_internal) VALUES ($1, $2, $3, $4)',
            [ticket_id, user_id, comment, is_internal || false]
        );
    }
};


/* ══════════════════════════════════════════════════════════
   REPAIRS
   ══════════════════════════════════════════════════════════ */
const repairs = {
    async getAll({ conditions, params, limit, offset }) {
        const where = conditions.join(' AND ');

        // ─── FIX: was using \${where} (escaped, literal string) ─────
        const countRes = await queryOne(
            `SELECT COUNT(*) AS c FROM ts_repairs r LEFT JOIN ts_assets a ON r.asset_id = a.id WHERE ${where}`,
            params
        );
        const total = parseInt(countRes.c);

        const idx = params.length;
        // ─── FIX: was using \${where}, $\${idx+1}, $\${idx+2} ───────
        const rows = await queryAll(`
            SELECT r.*, a.name AS asset_name, a.serial_number AS asset_serial,
                   u.name AS assigned_to_name, cb.name AS created_by_name
            FROM ts_repairs r
            LEFT JOIN ts_assets a ON r.asset_id = a.id
            LEFT JOIN ts_users u ON r.assigned_to = u.id
            LEFT JOIN ts_users cb ON r.created_by = cb.id
            WHERE ${where}
            ORDER BY r.repair_date DESC
            LIMIT $${idx + 1} OFFSET $${idx + 2}
        `, [...params, limit, offset]);

        return { rows, total };
    },

    // ─── FIX: was bare SELECT * — no asset info for the edit form ───
    async getById(id) {
        return queryOne(`
            SELECT r.*,
                   a.name AS asset_name, a.serial_number AS asset_serial,
                   a.make_model, a.warranty_expiry, a.status AS asset_current_status
            FROM ts_repairs r
            LEFT JOIN ts_assets a ON r.asset_id = a.id
            WHERE r.id = $1
        `, [id]);
    },

    async create({ asset_id, repair_date, issue_description, assigned_to, requires_approval, cost, invoice_path, is_approved, status, provider, notes, created_by }) {
        return insertReturning(`
            INSERT INTO ts_repairs (asset_id, repair_date, issue_description, assigned_to, requires_approval, is_approved, status, invoice_path, provider, cost, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
            asset_id,
            repair_date,
            issue_description,
            assigned_to || null,
            requires_approval || false,
            is_approved || false,
            status || 'scheduled',
            invoice_path || null,
            provider || null,
            cost || null,
            notes || null,
            created_by
        ]);
    },

    async update(id, updates) {
        let setClauses = [];
        let params = [];
        let idx = 1;

        if (updates.repair_date      !== undefined) { setClauses.push(`repair_date = $${idx++}`);      params.push(updates.repair_date); }
        if (updates.issue_description !== undefined) { setClauses.push(`issue_description = $${idx++}`); params.push(updates.issue_description); }
        if (updates.assigned_to      !== undefined) { setClauses.push(`assigned_to = $${idx++}`);      params.push(updates.assigned_to); }
        if (updates.status           !== undefined) { setClauses.push(`status = $${idx++}`);           params.push(updates.status); }
        if (updates.cost             !== undefined) { setClauses.push(`cost = $${idx++}`);             params.push(updates.cost); }
        if (updates.notes            !== undefined) { setClauses.push(`notes = $${idx++}`);            params.push(updates.notes); }
        if (updates.invoice_path     !== undefined) { setClauses.push(`invoice_path = $${idx++}`);     params.push(updates.invoice_path); }
        if (updates.provider         !== undefined) { setClauses.push(`provider = $${idx++}`);         params.push(updates.provider); }
        if (updates.is_approved      !== undefined) { setClauses.push(`is_approved = $${idx++}`);      params.push(updates.is_approved); }
        if (updates.approved_by      !== undefined) { setClauses.push(`approved_by = $${idx++}`);      params.push(updates.approved_by); }

        if (setClauses.length === 0) return 0;

        params.push(id);
        // ─── FIX: was using \${setClauses.join(', ')} ────────────────
        return run(`UPDATE ts_repairs SET ${setClauses.join(', ')} WHERE id = $${idx}`, params);
    },

    async approve(id, user_id) {
        return run('UPDATE ts_repairs SET is_approved = true, approved_by = $2 WHERE id = $1', [id, user_id]);
    },

    async complete(id) {
        return run("UPDATE ts_repairs SET status = 'completed', completed_at = NOW() WHERE id = $1", [id]);
    },

    async remove(id) {
        return run('DELETE FROM ts_repairs WHERE id = $1', [id]);
    },

    async getUpcoming() {
        return queryAll(`
            SELECT r.*, a.name AS asset_name, a.serial_number AS asset_serial, u.name AS assigned_to_name
            FROM ts_repairs r
            LEFT JOIN ts_assets a ON r.asset_id = a.id
            LEFT JOIN ts_users u ON r.assigned_to = u.id
            WHERE r.status IN ('scheduled', 'pending', 'in_progress')
            ORDER BY r.repair_date ASC
            LIMIT 10
        `);
    },

    async getStats() {
        const scheduled   = parseInt((await queryOne("SELECT COUNT(*) AS c FROM ts_repairs WHERE status = 'scheduled'")).c);
        const pending     = parseInt((await queryOne("SELECT COUNT(*) AS c FROM ts_repairs WHERE status = 'pending'")).c);
        const inProgress  = parseInt((await queryOne("SELECT COUNT(*) AS c FROM ts_repairs WHERE status = 'in_progress'")).c);
        const completed   = parseInt((await queryOne("SELECT COUNT(*) AS c FROM ts_repairs WHERE status = 'completed'")).c);
        const warrantyExpiring = parseInt((await queryOne(`
            SELECT COUNT(*) AS c FROM ts_assets
            WHERE is_deleted = FALSE AND warranty_expiry IS NOT NULL
            AND warranty_expiry <= CURRENT_DATE + INTERVAL '30 days' AND warranty_expiry >= CURRENT_DATE
        `)).c);
        return { scheduled, pending: scheduled + pending, inProgress, completed, warrantyExpiring };
    }
};


/* ══════════════════════════════════════════════════════════
   NOTIFICATIONS
   ══════════════════════════════════════════════════════════ */
const notifications = {
    async getByUser(userId, { limit, offset }) {
        const totalRow  = await queryOne('SELECT COUNT(*) AS c FROM ts_notifications WHERE user_id = $1', [userId]);
        const unreadRow = await queryOne('SELECT COUNT(*) AS c FROM ts_notifications WHERE user_id = $1 AND is_read = FALSE', [userId]);
        const rows = await queryAll(`
            SELECT * FROM ts_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
        `, [userId, limit, offset]);
        return { rows, total: parseInt(totalRow.c), unread: parseInt(unreadRow.c) };
    },

    async getUnreadCount(userId) {
        const row = await queryOne('SELECT COUNT(*) AS c FROM ts_notifications WHERE user_id = $1 AND is_read = FALSE', [userId]);
        return parseInt(row.c);
    },

    async markRead(id, userId) {
        return run('UPDATE ts_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2', [id, userId]);
    },

    async markAllRead(userId) {
        return run('UPDATE ts_notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE', [userId]);
    },

    async create(userId, type, title, message, referenceId) {
        try {
            return insertReturning(
                'INSERT INTO ts_notifications (user_id, type, title, message, reference_id) VALUES ($1, $2, $3, $4, $5)',
                [userId, type, title, message, referenceId || null]
            );
        } catch (err) {
            console.error('Notification creation failed:', err.message);
        }
    },

    async notifyAdmins(type, title, message, referenceId) {
        const admins = await queryAll("SELECT id FROM ts_users WHERE role = 'admin' AND is_active = TRUE");
        for (const a of admins) {
            await notifications.create(a.id, type, title, message, referenceId);
        }
    },

    async notifyDeptManagers(departmentId, type, title, message, referenceId) {
        const managers = await queryAll(
            "SELECT id FROM ts_users WHERE role = 'manager' AND department_id = $1 AND is_active = TRUE",
            [departmentId]
        );
        for (const m of managers) {
            await notifications.create(m.id, type, title, message, referenceId);
        }
    }
};


/* ══════════════════════════════════════════════════════════
   AUDIT LOGS
   ══════════════════════════════════════════════════════════ */
const audit = {
    async log(userId, module, action, recordId, oldData, newData, ipAddress) {
        try {
            await run(`
                INSERT INTO ts_audit_logs (user_id, module, action, record_id, old_data, new_data, ip_address)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                userId, module, action, recordId,
                oldData ? JSON.stringify(oldData) : null,
                newData ? JSON.stringify(newData) : null,
                ipAddress || null
            ]);
        } catch (err) {
            console.error('Audit log write failed:', err.message);
        }
    },

    async getAll({ conditions, params, limit, offset }) {
        const where = conditions.join(' AND ');
        const countRes = await queryOne(`SELECT COUNT(*) AS c FROM ts_audit_logs al WHERE ${where}`, params);
        const total = parseInt(countRes.c);

        const idx = params.length;
        const rows = await queryAll(`
            SELECT al.*, u.name AS user_name, u.role AS user_role
            FROM ts_audit_logs al
            LEFT JOIN ts_users u ON al.user_id = u.id
            WHERE ${where}
            ORDER BY al.created_at DESC
            LIMIT $${idx + 1} OFFSET $${idx + 2}
        `, [...params, limit, offset]);

        const modules = (await queryAll('SELECT DISTINCT module FROM ts_audit_logs ORDER BY module')).map(r => r.module);
        const actions = (await queryAll('SELECT DISTINCT action FROM ts_audit_logs ORDER BY action')).map(r => r.action);

        return { rows, total, modules, actions };
    }
};


/* ══════════════════════════════════════════════════════════
   USERS
   ══════════════════════════════════════════════════════════ */
const users = {
    async getAll({ conditions, params }) {
        const where = conditions.join(' AND ');
        return queryAll(`
            SELECT u.id, u.emp_id, u.name, u.email, u.role, u.department_id, d.name AS department_name
            FROM ts_users u
            LEFT JOIN ts_departments d ON u.department_id = d.id
            WHERE ${where}
            ORDER BY u.name
        `, params);
    },

    async getById(id) {
        return queryOne(`
            SELECT u.id, u.emp_id, u.name, u.email, u.role, u.department_id, d.name AS department_name
            FROM ts_users u LEFT JOIN ts_departments d ON u.department_id = d.id
            WHERE u.id = $1
        `, [id]);
    },

    async getByEmail(email) {
        return queryOne(`
            SELECT u.id, u.emp_id, u.name, u.email, u.role, u.department_id, d.name AS department_name
            FROM ts_users u LEFT JOIN ts_departments d ON u.department_id = d.id
            WHERE u.email = $1 AND u.is_active = TRUE
        `, [email]);
    },

    async getDepartments() {
        return queryAll(`
            SELECT d.*, (SELECT COUNT(*) FROM ts_users u WHERE u.department_id = d.id AND u.is_active = TRUE) AS user_count
            FROM ts_departments d ORDER BY d.name
        `);
    }
};


/* ══════════════════════════════════════════════════════════
   REPORTS (read-only queries)
   ══════════════════════════════════════════════════════════ */
const reports = {
    async assetInventory({ conditions, params }) {
        const where = conditions.join(' AND ');
        return queryAll(`
            SELECT a.*, c.name AS category_name, u.name AS assigned_user_name, d.name AS dept_name
            FROM ts_assets a
            LEFT JOIN ts_asset_categories c ON a.category_id = c.id
            LEFT JOIN ts_users u ON a.assigned_to_user = u.id
            LEFT JOIN ts_departments d ON a.assigned_to_dept = d.id
            WHERE ${where}
            ORDER BY a.name
        `, params);
    },

    // ─── FIX: was missing — reportController calls db.reports.maintenanceLogs() ───
    async maintenanceLogs() {
        return queryAll(`
            SELECT r.*, a.name AS asset_name, a.serial_number, u.name AS technician_name
            FROM ts_repairs r
            LEFT JOIN ts_assets a ON r.asset_id = a.id
            LEFT JOIN ts_users u ON r.assigned_to = u.id
            ORDER BY r.repair_date DESC
        `);
    },

    async ticketSummary() {
        const byStatus     = await queryAll('SELECT status, COUNT(*) AS count FROM ts_tickets GROUP BY status');
        const byPriority   = await queryAll('SELECT priority, COUNT(*) AS count FROM ts_tickets GROUP BY priority');
        const byIssueType  = await queryAll('SELECT issue_type, COUNT(*) AS count FROM ts_tickets GROUP BY issue_type ORDER BY count DESC');
        const avgRes       = await queryOne(`
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) AS avg_hours
            FROM ts_tickets WHERE resolved_at IS NOT NULL
        `);
        const monthly      = await queryAll(`
            SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS count
            FROM ts_tickets GROUP BY month ORDER BY month DESC LIMIT 12
        `);
        const topRaisers   = await queryAll(`
            SELECT u.name, COUNT(t.id) AS count FROM ts_tickets t
            JOIN ts_users u ON t.raised_by = u.id GROUP BY u.name, t.raised_by ORDER BY count DESC LIMIT 5
        `);
        return {
            byStatus, byPriority, byIssueType,
            avgResolutionHours: avgRes && avgRes.avg_hours ? Math.round(parseFloat(avgRes.avg_hours)) : null,
            monthly, topRaisers,
            total: byStatus.reduce((s, r) => s + parseInt(r.count), 0)
        };
    },

    async depreciation() {
        return queryAll(`
            SELECT a.*, c.name AS category_name
            FROM ts_assets a
            LEFT JOIN ts_asset_categories c ON a.category_id = c.id
            WHERE a.is_deleted = FALSE AND a.cost IS NOT NULL AND a.purchase_date IS NOT NULL
            ORDER BY a.purchase_date ASC
        `);
    },

    async assetAllocation() {
        const byUser = await queryAll(`
            SELECT u.name AS assignee, u.email, d.name AS department, COUNT(a.id) AS asset_count,
                   STRING_AGG(a.name, ', ') AS assets
            FROM ts_assets a
            JOIN ts_users u ON a.assigned_to_user = u.id
            LEFT JOIN ts_departments d ON u.department_id = d.id
            WHERE a.is_deleted = FALSE AND a.assigned_to_user IS NOT NULL
            GROUP BY u.name, u.email, d.name, a.assigned_to_user ORDER BY asset_count DESC
        `);
        const byDept = await queryAll(`
            SELECT d.name AS department, COUNT(a.id) AS asset_count, SUM(a.cost) AS total_value
            FROM ts_assets a
            JOIN ts_departments d ON a.assigned_to_dept = d.id
            WHERE a.is_deleted = FALSE AND a.assigned_to_dept IS NOT NULL
            GROUP BY d.name, a.assigned_to_dept ORDER BY asset_count DESC
        `);
        const unassigned = parseInt((await queryOne(`
            SELECT COUNT(*) AS c FROM ts_assets
            WHERE is_deleted = FALSE AND assigned_to_user IS NULL AND assigned_to_dept IS NULL AND status != 'retired'
        `)).c);
        return { byUser, byDept, unassigned };
    },

    // Export-specific queries
    async exportAssetData() {
        return queryAll(`
            SELECT a.name, c.name AS category, a.serial_number, a.status, a.cost,
                   a.location, u.name AS assigned_to
            FROM ts_assets a
            LEFT JOIN ts_asset_categories c ON a.category_id = c.id
            LEFT JOIN ts_users u ON a.assigned_to_user = u.id
            WHERE a.is_deleted = FALSE
        `);
    },

    async exportTicketData() {
        return queryAll(`
            SELECT t.ticket_number, t.title, t.priority, t.status, t.issue_type,
                   u.name AS raised_by, t.created_at
            FROM ts_tickets t
            LEFT JOIN ts_users u ON t.raised_by = u.id
        `);
    },

    // ─── FIX: was missing — reportController calls db.reports.exportMaintenanceData() ───
    async exportMaintenanceData() {
        return queryAll(`
            SELECT a.name AS asset_name,
                   r.issue_description AS maintenance_type,
                   r.repair_date       AS scheduled_date,
                   r.status,
                   u.name              AS technician,
                   r.completed_at
            FROM ts_repairs r
            LEFT JOIN ts_assets a ON r.asset_id = a.id
            LEFT JOIN ts_users u ON r.assigned_to = u.id
            ORDER BY r.repair_date DESC
        `);
    },

    async exportAssetsPDF() {
        return queryAll(`SELECT a.name, a.serial_number, a.status, a.cost FROM ts_assets a WHERE a.is_deleted = FALSE`);
    },

    async exportTicketsPDF() {
        return queryAll(`SELECT t.ticket_number, t.title, t.priority, t.status FROM ts_tickets t`);
    }
};


module.exports = { assets, categories, tickets, comments, repairs, notifications, audit, users, reports };