const express = require('express');
const router = express.Router();
const ac = require('../controllers/assetController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// Stats (dashboard KPIs)
router.get('/stats', ac.getStats);

// Categories (must be before /:id routes)
router.get('/categories', ac.getCategories);
router.post('/categories', requireRole(['admin']), ac.createCategory);
router.put('/categories/:id', requireRole(['admin']), ac.updateCategory);
router.delete('/categories/:id', requireRole(['admin']), ac.deleteCategory);

// Asset CRUD
router.get('/', ac.getAssets);
router.get('/:id', ac.getAssetById);
router.post('/', requireRole(['admin']), ac.createAsset);
router.put('/:id', requireRole(['admin']), ac.updateAsset);
router.delete('/:id', requireRole(['admin']), ac.deleteAsset);

// Assign / Unassign
router.post('/:id/assign', requireRole(['admin', 'manager']), ac.assignAsset);
router.post('/:id/unassign', requireRole(['admin', 'manager']), ac.unassignAsset);

// History
router.get('/:id/history', ac.getAssetHistory);

module.exports = router;