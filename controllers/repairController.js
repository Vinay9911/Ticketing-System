const db = require('../services/dbService');
const { logAudit } = require('../helpers/audit');
const nodemailer = require('nodemailer');

// Set up Nodemailer for Demo purposes
// In a real scenario, these would be in .env
const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "demo", // Placeholder
      pass: "demo"
    }
});

exports.getRepairs = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (page - 1) * limit;
        let conditions = ['1=1'];
        let params = [];
        let idx = 1;

        if (status) { conditions.push(`r.status = $${idx++}`); params.push(status); }
        if (search) {
            conditions.push(`a.name ILIKE $${idx}`); params.push(`%${search}%`);
        }

        const { rows: repairs, total } = await db.repairs.getAll({ conditions, params, limit, offset });
        res.json({ repairs, pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) } });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getRepairById = async (req, res) => {
    try {
        const repair = await db.repairs.getById(req.params.id);
        if (!repair) return res.status(404).json({ error: 'Repair not found' });
        res.json({ repair });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createRepair = async (req, res) => {
    try {
        const { asset_id, repair_date, description, estimated_cost, requires_approval, status, provider } = req.body;
        const invoice_path = req.file ? `/ticketing/uploads/${req.file.filename}` : null;
        const reqAppr = requires_approval === 'true' || requires_approval === true;

        const id = await db.repairs.create({
            asset_id,
            repair_date,
            issue_description: description,
            cost: estimated_cost,
            provider,
            invoice_path,
            requires_approval: reqAppr,
            is_approved: reqAppr ? false : true,
            status: status || 'scheduled',
            created_by: req.user.id
        });

        await logAudit(req.user.id, 'repair', 'create', id, null, { asset_id, repair_date }, req.ip);

        // Simulated Email sending
        if (reqAppr) {
            console.log(`[EMAIL MOCK] Sending approval email...`);
            setTimeout(async () => {
                try { 
                    await db.repairs.update(id, { is_approved: true, status: 'completed' }); 
                } catch(e) { console.error('Simulated error:', e); }
            }, 60000);
        }

        res.status(201).json({ message: 'Repair logged successfully', id });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateRepair = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.repairs.getById(id);
        if (!old) return res.status(404).json({ error: 'Repair not found' });

        const { repair_date, description, estimated_cost, status, provider } = req.body;
        const invoice_path = req.file ? `/ticketing/uploads/${req.file.filename}` : old.invoice_path;

        await db.repairs.update(id, {
            repair_date, issue_description: description, cost: estimated_cost, status, provider, invoice_path
        });

        await logAudit(req.user.id, 'repair', 'update', id, old, { repair_date, status }, req.ip);
        res.json({ message: 'Repair updated successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteRepair = async (req, res) => {
    try {
        const id = req.params.id;
        const old = await db.repairs.getById(id);
        if (!old) return res.status(404).json({ error: 'Repair not found' });

        await db.queryOne('DELETE FROM ts_repairs WHERE id = $1 RETURNING id', [id]);
        await logAudit(req.user.id, 'repair', 'delete', id, old, null, req.ip);
        res.json({ message: 'Repair deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getUpcoming = async (req, res) => {
    try {
        // Find upcoming repairs
        const { rows: repairs } = await db.repairs.getAll({ 
            conditions: ["r.status IN ('scheduled', 'in_progress')"], 
            params: [], limit: 10, offset: 0 
        });
        res.json({ repairs });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getStats = async (req, res) => {
    try {
        const stats = await db.repairs.getStats({});
        res.json(stats);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.approveRepair = async (req, res) => {
    try {
        const id = req.params.id;
        await db.repairs.update(id, { is_approved: true, approved_by: req.user.id });
        res.json({ message: 'Repair approved explicitly via Web Interface' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
