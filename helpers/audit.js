const db = require('../services/dbService');

/**
 * Writes an entry to the ts_audit_logs table.
 * Called from every controller that mutates data.
 * Append-only — nobody can edit or delete audit entries.
 */
async function logAudit(userId, module, action, recordId, oldData, newData, ipAddress) {
    await db.audit.log(userId, module, action, recordId, oldData, newData, ipAddress);
}

module.exports = { logAudit };
