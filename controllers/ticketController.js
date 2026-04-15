const db = require('../services/dbService');
const { logAudit } = require('../helpers/audit');
const { createNotification, notifyAdmins, notifyDeptManagers } = require('../helpers/notification');

// ─── GET /tickets ────────────────────────────────────────
exports.getTickets = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status, priority, issue_type } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        let conditions = ['1=1'];
        let params = [];
        let idx = 1;

        // RBAC / Filtering
        if (req.user.role === 'staff' || req.query.filter === 'my') {
            conditions.push(`(t.raised_by = $${idx} OR t.assigned_to = $${idx + 1})`);
            params.push(req.user.id, req.user.id);
            idx += 2;
        } else if (req.user.role === 'manager') {
            conditions.push(`(t.raised_by IN (SELECT id FROM ts_users WHERE department_id = $${idx})
                OR t.assigned_to IN (SELECT id FROM ts_users WHERE department_id = $${idx + 1}))`);
            params.push(req.user.departmentId, req.user.departmentId);
            idx += 2;
        }

        if (search) {
            conditions.push(`(t.ticket_number ILIKE $${idx} OR t.title ILIKE $${idx + 1} OR ru.name ILIKE $${idx + 2})`);
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            idx += 3;
        }
        if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
        if (priority) { conditions.push(`t.priority = $${idx++}`); params.push(priority); }
        if (issue_type) { conditions.push(`t.issue_type = $${idx++}`); params.push(issue_type); }

        const { rows: tickets, total } = await db.tickets.getAll({ conditions, params, limit: parseInt(limit), offset });

        res.json({ tickets, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /tickets/:id ────────────────────────────────────
exports.getTicketById = async (req, res) => {
    try {
        const ticket = await db.tickets.getById(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const includeInternal = req.user.role !== 'staff';
        const comments = await db.comments.getByTicket(req.params.id, { includeInternal });

        res.json({ ticket, comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /tickets ───────────────────────────────────────
exports.createTicket = async (req, res) => {
    try {
        const { title, description, priority, issue_type, asset_id } = req.body;
        if (!title || !description) return res.status(400).json({ error: 'Title and description are required' });

        const ticketNumber = await db.tickets.generateNumber();
        const id = await db.tickets.create({
            ticket_number: ticketNumber, title, description, priority, issue_type, asset_id, raised_by: req.user.id
        });

        await logAudit(req.user.id, 'ticket', 'create', id, null, { title, priority, issue_type, ticket_number: ticketNumber }, req.ip);

        await notifyAdmins('ticket_created', 'New Ticket Raised', `${req.user.name} raised: ${title} [${priority || 'medium'}]`, id);
        if (req.user.departmentId) {
            await notifyDeptManagers(req.user.departmentId, 'ticket_created', 'New Ticket in Department', `${req.user.name} raised: ${title}`, id);
        }

        res.status(201).json({ message: 'Ticket created successfully', id, ticket_number: ticketNumber });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── PUT /tickets/:id ────────────────────────────────────
exports.updateTicket = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.tickets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Ticket not found' });

        const { status, priority, title, description, issue_type } = req.body;

        // Staff can only update their own tickets
        if (req.user.role === 'staff' && old.raised_by !== req.user.id && old.assigned_to !== req.user.id) {
            return res.status(403).json({ error: 'You can only update your own tickets' });
        }

        // 48hr reopen check
        if (req.user.role === 'staff' && status === 'open' && old.status === 'resolved') {
            if (old.resolved_at) {
                const resolvedTime = new Date(old.resolved_at).getTime();
                if (Date.now() - resolvedTime > 48 * 60 * 60 * 1000) {
                    return res.status(400).json({ error: 'Cannot reopen: 48-hour reopen window has expired' });
                }
            }
        }

        const newTicket = await db.tickets.update(id, { status, priority, title, description, issue_type });
        await logAudit(req.user.id, 'ticket', 'update', id, old, newTicket, req.ip);

        // Notify on status change
        if (status && status !== old.status) {
            if (old.raised_by && old.raised_by !== req.user.id) {
                await createNotification(old.raised_by, 'ticket_updated', 'Ticket Status Updated',
                    `Ticket ${old.ticket_number} status changed to ${status} by ${req.user.name}`, id);
            }
            if (old.assigned_to && old.assigned_to !== req.user.id) {
                await createNotification(old.assigned_to, 'ticket_updated', 'Ticket Status Updated',
                    `Ticket ${old.ticket_number} status changed to ${status} by ${req.user.name}`, id);
            }
        }

        res.json({ message: 'Ticket updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── DELETE /tickets/:id ─────────────────────────────────
exports.deleteTicket = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.tickets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Ticket not found' });

        await db.tickets.remove(id);
        await logAudit(req.user.id, 'ticket', 'delete', id, old, null, req.ip);

        res.json({ message: 'Ticket deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /tickets/:id/assign ────────────────────────────
exports.assignTicket = async (req, res) => {
    try {
        const id = req.params.id;
        const { assigned_to } = req.body;
        if (!assigned_to) return res.status(400).json({ error: 'Assignee is required' });

        const old = await db.tickets.getRawById(id);
        if (!old) return res.status(404).json({ error: 'Ticket not found' });

        await db.tickets.assign(id, assigned_to);
        await logAudit(req.user.id, 'ticket', 'assign', id, { assigned_to: old.assigned_to }, { assigned_to }, req.ip);

        await createNotification(assigned_to, 'ticket_assigned', 'Ticket Assigned to You',
            `Ticket ${old.ticket_number}: ${old.title} has been assigned to you by ${req.user.name}`, id);

        res.json({ message: 'Ticket assigned successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /tickets/:id/comments ──────────────────────────
exports.addComment = async (req, res) => {
    try {
        const { comment, is_internal } = req.body;
        if (!comment) return res.status(400).json({ error: 'Comment text is required' });

        const internal = (is_internal && req.user.role !== 'staff') ? true : false;

        const id = await db.comments.create({
            ticket_id: req.params.id, user_id: req.user.id, comment, is_internal: internal
        });

        const ticket = await db.tickets.getRawById(req.params.id);
        if (ticket && !internal) {
            if (ticket.raised_by && ticket.raised_by !== req.user.id) {
                await createNotification(ticket.raised_by, 'comment_added', 'New Comment on Your Ticket',
                    `${req.user.name} commented on ${ticket.ticket_number}`, ticket.id);
            }
            if (ticket.assigned_to && ticket.assigned_to !== req.user.id && ticket.assigned_to !== ticket.raised_by) {
                await createNotification(ticket.assigned_to, 'comment_added', 'New Comment on Assigned Ticket',
                    `${req.user.name} commented on ${ticket.ticket_number}`, ticket.id);
            }
        }

        res.status(201).json({ message: 'Comment added', id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /tickets/:id/comments ───────────────────────────
exports.getComments = async (req, res) => {
    try {
        const includeInternal = req.user.role !== 'staff';
        const comments = await db.comments.getByTicket(req.params.id, { includeInternal });
        res.json({ comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /tickets/stats ──────────────────────────────────
exports.getStats = async (req, res) => {
    try {
        const stats = await db.tickets.getStats({
            role: req.user.role, userId: req.user.id, departmentId: req.user.departmentId
        });
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};