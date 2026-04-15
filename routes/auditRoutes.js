const express = require('express');
const router = express.Router();
const alc = require('../controllers/auditController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);
router.use(requireRole(['admin']));

router.get('/', alc.getAuditLogs);

module.exports = router;
