const express = require('express');
const router = express.Router();
const nc = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', nc.getNotifications);
router.get('/unread-count', nc.getUnreadCount);
router.put('/:id/read', nc.markAsRead);
router.put('/read-all', nc.markAllRead);

module.exports = router;
