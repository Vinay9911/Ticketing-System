const express = require('express');
const router = express.Router();
const rc = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(['admin', 'manager']));

router.get('/asset-inventory', rc.assetInventory);
router.get('/maintenance-logs', rc.maintenanceLogs);
router.get('/ticket-summary', rc.ticketSummary);
router.get('/asset-allocation', rc.assetAllocation);
router.get('/depreciation', requireRole(['admin']), rc.depreciation);
router.post('/export', rc.exportReport); // report-type role validation is enforced inside exportReport

module.exports = router;
