const db = require('../config/db');

/**
 * Create a notification for a single user.
 */
function createNotification(userId, type, title, message, referenceId) {
    try {
        db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, reference_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, type, title, message, referenceId || null);
    } catch (err) {
        console.error('Notification creation failed:', err.message);
    }
}

/**
 * Notify all active admins.
 */
function notifyAdmins(type, title, message, referenceId) {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all();
    admins.forEach(a => createNotification(a.id, type, title, message, referenceId));
}

/**
 * Notify all active managers in a specific department.
 */
function notifyDeptManagers(departmentId, type, title, message, referenceId) {
    const managers = db.prepare(
        "SELECT id FROM users WHERE role = 'manager' AND department_id = ? AND is_active = 1"
    ).all(departmentId);
    managers.forEach(m => createNotification(m.id, type, title, message, referenceId));
}

module.exports = { createNotification, notifyAdmins, notifyDeptManagers };
