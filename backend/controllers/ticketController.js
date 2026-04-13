const db = require('../config/db');

exports.getTickets = (req, res) => {
    // Admins and Managers see all, Staff only see their own
    let query = "SELECT * FROM tickets ORDER BY created_at DESC";
    let params = [];

    if (req.user.role === 'Staff') {
        query = "SELECT * FROM tickets WHERE raised_by_name = ? ORDER BY created_at DESC";
        params = [req.user.name];
    }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ tickets: rows });
    });
};

exports.createTicket = (req, res) => {
    const { title, description, priority } = req.body;
    const ticketNumber = 'TKT-' + Math.floor(1000 + Math.random() * 9000);

    const sql = `INSERT INTO tickets (ticket_number, title, description, priority, raised_by_role, raised_by_name) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [ticketNumber, title, description, priority, req.user.role, req.user.name], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Ticket created", id: this.lastID });
    });
};

exports.updateTicketStatus = (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    
    db.run(`UPDATE tickets SET status = ? WHERE id = ?`, [status, id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Status updated successfully" });
    });
};

// NEW: Fetch a single ticket for the detail page
exports.getTicketById = (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM tickets WHERE id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Ticket not found" });
        res.json({ ticket: row });
    });
};