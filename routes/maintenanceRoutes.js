const express = require('express');
const router = express.Router();
const mc = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

router.get('/stats', mc.getStats);
router.get('/upcoming', mc.getUpcoming);
router.get('/', requireRole(['admin', 'manager']), mc.getSchedules);
router.post('/', requireRole(['admin', 'manager']), mc.createSchedule);
router.put('/:id', requireRole(['admin', 'manager']), mc.updateSchedule);
router.put('/:id/complete', requireRole(['admin', 'manager']), mc.completeSchedule);
router.delete('/:id', requireRole(['admin']), mc.deleteSchedule);

module.exports = router;
