const db = require('../config/db');
const { logAudit } = require('../helpers/audit');
const { createNotification, notifyAdmins, notifyDeptManagers } = require('../helpers/notification');

// ─── Generate sequential ticket number ───────────────────
function generateTicketNumber() {
    const year = new Date().getFullYear();
    const last = db.prepare("SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1")
        .get(`TKT-${year}-%`);
    let next = 1;
    if (last) {
        const parts = last.ticket_number.split('-');
        next = parseInt(parts[2]) + 1;
    }
    return `TKT-${year}-${String(next).padStart(3, '0')}`;
}

// ─── GET /tickets ────────────────────────────────────────
exports.getTickets = (req, res) => {
    try {
        const { page = 1, limit = 20, search, status, priority, issue_type } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['1=1'];
        let params = [];

        // RBAC
        if (req.user.role === 'staff') {
            conditions.push('(t.raised_by = ? OR t.assigned_to = ?)');
            params.push(req.user.id, req.user.id);
        } else if (req.user.role === 'manager') {
            conditions.push(`(t.raised_by IN (SELECT id FROM users WHERE department_id = ?)
                OR t.assigned_to IN (SELECT id FROM users WHERE department_id = ?))`);
            params.push(req.user.departmentId, req.user.departmentId);
        }

        if (search) {
            conditions.push('(t.ticket_number LIKE ? OR t.title LIKE ? OR ru.name LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (status) { conditions.push('t.status = ?'); params.push(status); }
        if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
        if (issue_type) { conditions.push('t.issue_type = ?'); params.push(issue_type); }

        const where = conditions.join(' AND ');

        const total = db.prepare(`
            SELECT COUNT(*) as c FROM tickets t
            LEFT JOIN users ru ON t.raised_by = ru.id
            WHERE ${where}
        `).get(...params).c;

        const tickets = db.prepare(`
            SELECT t.*, ru.name as raised_by_name, ru.role as raised_by_role,
                   au.name as assigned_to_name, a.name as asset_name
            FROM tickets t
            LEFT JOIN users ru ON t.raised_by = ru.id
            LEFT JOIN users au ON t.assigned_to = au.id
            LEFT JOIN assets a ON t.asset_id = a.id
            WHERE ${where}
            ORDER BY
                CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
                t.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);

        res.json({ tickets, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /tickets/:id ────────────────────────────────────
exports.getTicketById = (req, res) => {
    try {
        const ticket = db.prepare(`
            SELECT t.*, ru.name as raised_by_name, ru.role as raised_by_role, ru.email as raised_by_email,
                   au.name as assigned_to_name, a.name as asset_name, a.serial_number as asset_serial
            FROM tickets t
            LEFT JOIN users ru ON t.raised_by = ru.id
            LEFT JOIN users au ON t.assigned_to = au.id
            LEFT JOIN assets a ON t.asset_id = a.id
            WHERE t.id = ?
        `).get(req.params.id);

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // Get comments (filter internal for staff)
        let commentQuery = `
            SELECT c.*, u.name as user_name, u.role as user_role
            FROM ticket_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.ticket_id = ?
        `;
        if (req.user.role === 'staff') commentQuery += ' AND c.is_internal = 0';
        commentQuery += ' ORDER BY c.created_at ASC';

        const comments = db.prepare(commentQuery).all(req.params.id);

        res.json({ ticket, comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /tickets ───────────────────────────────────────
exports.createTicket = (req, res) => {
    try {
        const { title, description, priority, issue_type, asset_id } = req.body;
        if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });

        const ticketNumber = generateTicketNumber();
        const result = db.prepare(`
            INSERT INTO tickets (ticket_number, title, description, priority, issue_type, asset_id, raised_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(ticketNumber, title, description, priority || 'medium', issue_type || 'other', asset_id || null, req.user.id);

        logAudit(req.user.id, 'ticket', 'create', result.lastInsertRowid, null, { title, priority, issue_type, ticket_number: ticketNumber }, req.ip);

        // Notify admins and dept managers
        notifyAdmins('ticket_created', 'New Ticket Raised', `${req.user.name} raised: ${title} [${priority || 'medium'}]`, result.lastInsertRowid);
        if (req.user.departmentId) {
            notifyDeptManagers(req.user.departmentId, 'ticket_created', 'New Ticket in Department', `${req.user.name} raised: ${title}`, result.lastInsertRowid);
        }

        res.status(201).json({ message: 'Ticket created successfully', id: result.lastInsertRowid, ticket_number: ticketNumber });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /tickets/:id ────────────────────────────────────
exports.updateTicket = (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
        if (!old) return res.status(404).json({ error: 'Ticket not found' });

        const { status, priority, title, description, issue_type } = req.body;

        // Staff can only update their own tickets
        if (req.user.role === 'staff' && old.raised_by !== req.user.id && old.assigned_to !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own tickets' });
        }

        // 48hr reopen check: staff can reopen resolved ticket within 48h
        if (req.user.role === 'staff' && status === 'open' && old.status === 'resolved') {
            if (old.resolved_at) {
                const resolvedTime = new Date(old.resolved_at).getTime();
                const now = Date.now();
                if (now - resolvedTime > 48 * 60 * 60 * 1000) {
                    return res.status(400).json({ error: 'Cannot reopen: 48-hour reopen window has expired' });
                }
            }
        }

        let sql = "UPDATE tickets SET updated_at = datetime('now')";
        let sqlParams = [];

        if (status) {
            sql += ', status = ?';
            sqlParams.push(status);
            if (status === 'resolved') sql += ", resolved_at = datetime('now')";
            if (status === 'closed') sql += ", closed_at = datetime('now')";
        }
        if (priority) { sql += ', priority = ?'; sqlParams.push(priority); }
        if (title) { sql += ', title = ?'; sqlParams.push(title); }
        if (description) { sql += ', description = ?'; sqlParams.push(description); }
        if (issue_type) { sql += ', issue_type = ?'; sqlParams.push(issue_type); }

        sql += ' WHERE id = ?';
        sqlParams.push(id);

        db.prepare(sql).run(...sqlParams);

        const newTicket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
        logAudit(req.user.id, 'ticket', 'update', id, old, newTicket, req.ip);

        // Notify on status change
        if (status && status !== old.status) {
            if (old.raised_by && old.raised_by !== req.user.id) {
                createNotification(old.raised_by, 'ticket_updated', 'Ticket Status Updated',
                    `Ticket ${old.ticket_number} status changed to ${status} by ${req.user.name}`, id);
            }
            if (old.assigned_to && old.assigned_to !== req.user.id) {
                createNotification(old.assigned_to, 'ticket_updated', 'Ticket Status Updated',
                    `Ticket ${old.ticket_number} status changed to ${status} by ${req.user.name}`, id);
            }
        }

        res.json({ message: 'Ticket updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /tickets/:id ─────────────────────────────────
exports.deleteTicket = (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
        if (!old) return res.status(404).json({ error: 'Ticket not found' });

        db.prepare('DELETE FROM ticket_comments WHERE ticket_id = ?').run(id);
        db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
        logAudit(req.user.id, 'ticket', 'delete', id, old, null, req.ip);

        res.json({ message: 'Ticket deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /tickets/:id/assign ────────────────────────────
exports.assignTicket = (req, res) => {
    try {
        const id = req.params.id;
        const { assigned_to } = req.body;
        if (!assigned_to) return res.status(400).json({ error: 'Assignee is required' });

        const old = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
        if (!old) return res.status(404).json({ error: 'Ticket not found' });

        db.prepare("UPDATE tickets SET assigned_to = ?, status = 'in_progress', updated_at = datetime('now') WHERE id = ?")
            .run(assigned_to, id);

        logAudit(req.user.id, 'ticket', 'assign', id, { assigned_to: old.assigned_to }, { assigned_to }, req.ip);

        createNotification(assigned_to, 'ticket_assigned', 'Ticket Assigned to You',
            `Ticket ${old.ticket_number}: ${old.title} has been assigned to you by ${req.user.name}`, id);

        res.json({ message: 'Ticket assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /tickets/:id/comments ──────────────────────────
exports.addComment = (req, res) => {
    try {
        const { comment, is_internal } = req.body;
        if (!comment) return res.status(400).json({ error: 'Comment text is required' });

        // Only admin/manager can mark as internal
        const internal = (is_internal && req.user.role !== 'staff') ? 1 : 0;

        const result = db.prepare('INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?)')
            .run(req.params.id, req.user.id, comment, internal);

        // Notify ticket raiser and assignee
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
        if (ticket && !internal) {
            if (ticket.raised_by && ticket.raised_by !== req.user.id) {
                createNotification(ticket.raised_by, 'comment_added', 'New Comment on Your Ticket',
                    `${req.user.name} commented on ${ticket.ticket_number}`, ticket.id);
            }
            if (ticket.assigned_to && ticket.assigned_to !== req.user.id && ticket.assigned_to !== ticket.raised_by) {
                createNotification(ticket.assigned_to, 'comment_added', 'New Comment on Assigned Ticket',
                    `${req.user.name} commented on ${ticket.ticket_number}`, ticket.id);
            }
        }

        res.status(201).json({ message: 'Comment added', id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /tickets/:id/comments ───────────────────────────
exports.getComments = (req, res) => {
    try {
        let query = `SELECT c.*, u.name as user_name, u.role as user_role
                     FROM ticket_comments c JOIN users u ON c.user_id = u.id
                     WHERE c.ticket_id = ?`;
        if (req.user.role === 'staff') query += ' AND c.is_internal = 0';
        query += ' ORDER BY c.created_at ASC';

        const comments = db.prepare(query).all(req.params.id);
        res.json({ comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /tickets/stats ──────────────────────────────────
exports.getStats = (req, res) => {
    try {
        let deptFilter = '';
        let params = [];

        if (req.user.role === 'staff') {
            deptFilter = 'AND (raised_by = ? OR assigned_to = ?)';
            params = [req.user.id, req.user.id];
        } else if (req.user.role === 'manager') {
            deptFilter = `AND (raised_by IN (SELECT id FROM users WHERE department_id = ?)
                OR assigned_to IN (SELECT id FROM users WHERE department_id = ?))`;
            params = [req.user.departmentId, req.user.departmentId];
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE 1=1 ${deptFilter}`).get(...params).c;
        const open = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE status='open' ${deptFilter}`).get(...params).c;
        const inProgress = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE status='in_progress' ${deptFilter}`).get(...params).c;
        const resolved = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE status='resolved' ${deptFilter}`).get(...params).c;
        const closed = db.prepare(`SELECT COUNT(*) as c FROM tickets WHERE status='closed' ${deptFilter}`).get(...params).c;

        // By priority
        const byPriority = db.prepare(`
            SELECT priority, COUNT(*) as count FROM tickets WHERE 1=1 ${deptFilter}
            GROUP BY priority
        `).all(...params);

        // By status
        const byStatus = db.prepare(`
            SELECT status, COUNT(*) as count FROM tickets WHERE 1=1 ${deptFilter}
            GROUP BY status
        `).all(...params);

        // Tickets over last 30 days
        const last30Days = db.prepare(`
            SELECT DATE(created_at) as date, COUNT(*) as count
            FROM tickets WHERE created_at >= date('now', '-30 days') ${deptFilter}
            GROUP BY DATE(created_at) ORDER BY date
        `).all(...params);

        // Average resolution time (hours)
        const avgRes = db.prepare(`
            SELECT AVG((julianday(resolved_at) - julianday(created_at)) * 24) as avg_hours
            FROM tickets WHERE resolved_at IS NOT NULL ${deptFilter}
        `).get(...params);

        res.json({ total, open, inProgress, resolved, closed, byPriority, byStatus, last30Days, avgResolutionHours: avgRes.avg_hours ? Math.round(avgRes.avg_hours) : null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};