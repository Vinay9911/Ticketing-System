const db = require('../config/db');

// GET /api/v1/tickets [cite: 83]
exports.getTickets = (req, res) => {
    let query = `
        SELECT t.*, u.name as raised_by_name, u.role as raised_by_role, a.name as asset_name 
        FROM tickets t
        LEFT JOIN users u ON t.raised_by = u.id
        LEFT JOIN assets a ON t.asset_id = a.id
        WHERE 1=1
    `;
    let params = [];

    // RBAC Filtering [cite: 39]
    if (req.user.role === 'staff') {
        query += ` AND t.raised_by = ?`;
        params.push(req.user.id);
    } 
    // Managers would ideally see dept tickets, implemented here as seeing all for demo ease, or add dept filter.

    query += ` ORDER BY t.created_at DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ tickets: rows });
    });
};

// GET /api/v1/tickets/:id [cite: 86]
exports.getTicketById = (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT t.*, u.name as raised_by_name, u.role as raised_by_role 
        FROM tickets t
        LEFT JOIN users u ON t.raised_by = u.id
        WHERE t.id = ?
    `;
    db.get(query, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Ticket not found" });
        res.json({ ticket: row });
    });
};

// POST /api/v1/tickets [cite: 86]
exports.createTicket = (req, res) => {
    const { title, description, priority, issue_type, asset_id } = req.body;
    // Auto-generate Ticket Number (e.g., TKT-2026-001) [cite: 65]
    const ticketNumber = 'TKT-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

    const sql = `INSERT INTO tickets (ticket_number, title, description, priority, issue_type, asset_id, raised_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [ticketNumber, title, description, priority || 'medium', issue_type || 'other', asset_id || null, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Ticket created", id: this.lastID });
    });
};

// PUT /api/v1/tickets/:id/status [cite: 86]
exports.updateTicketStatus = (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    // If status is resolved, set resolved_at [cite: 65]
    let sql = `UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP`;
    if (status === 'resolved') sql += `, resolved_at = CURRENT_TIMESTAMP`;
    if (status === 'closed') sql += `, closed_at = CURRENT_TIMESTAMP`;
    
    sql += ` WHERE id = ?`;

    db.run(sql, [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Ticket status updated successfully" });
    });
};

// POST /api/v1/tickets/:id/comments [cite: 86]
exports.addComment = (req, res) => {
    const { id } = req.params;
    const { comment, is_internal } = req.body;
    
    db.run(`INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal) VALUES (?, ?, ?, ?)`, 
        [id, req.user.id, comment, is_internal ? 1 : 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Comment added" });
    });
};

// GET /api/v1/tickets/:id/comments [cite: 86]
exports.getComments = (req, res) => {
    const { id } = req.params;
    let query = `SELECT c.*, u.name as user_name, u.role FROM ticket_comments c JOIN users u ON c.user_id = u.id WHERE c.ticket_id = ?`;
    
    // Hide internal comments from staff [cite: 192]
    if (req.user.role === 'staff') {
        query += ` AND c.is_internal = 0`;
    }
    query += ` ORDER BY c.created_at ASC`;

    db.all(query, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ comments: rows });
    });
};