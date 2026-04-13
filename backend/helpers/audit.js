const db = require('../config/db');

/**
 * Writes an entry to the audit_logs table.
 * Called from every controller that mutates data.
 * Append-only — nobody can edit or delete audit entries.
 */
function logAudit(userId, module, action, recordId, oldData, newData, ipAddress) {
    try {
        db.prepare(`
            INSERT INTO audit_logs (user_id, module, action, record_id, old_data, new_data, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            userId,
            module,
            action,
            recordId,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null,
            ipAddress || null
        );
    } catch (err) {
        // Audit failures should never block the main operation
        console.error('Audit log write failed:', err.message);
    }
}

module.exports = { logAudit };
