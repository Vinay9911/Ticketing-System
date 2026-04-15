const db = require('../services/dbService');

/**
 * Create a notification for a single user.
 */
async function createNotification(userId, type, title, message, referenceId) {
    await db.notifications.create(userId, type, title, message, referenceId);
}

/**
 * Notify all active admins.
 */
async function notifyAdmins(type, title, message, referenceId) {
    await db.notifications.notifyAdmins(type, title, message, referenceId);
}

/**
 * Notify all active managers in a specific department.
 */
async function notifyDeptManagers(departmentId, type, title, message, referenceId) {
    await db.notifications.notifyDeptManagers(departmentId, type, title, message, referenceId);
}

module.exports = { createNotification, notifyAdmins, notifyDeptManagers };
