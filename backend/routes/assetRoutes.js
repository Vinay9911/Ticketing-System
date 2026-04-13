const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { requireAuth, requireRole } = require('../middleware/auth');

// All asset routes require authentication [cite: 77]
router.use(requireAuth);

router.get('/', assetController.getAssets);
router.get('/categories', assetController.getCategories);
router.get('/:id', assetController.getAssetById);

// Admin-only routes [cite: 79]
router.post('/', requireRole(['admin']), assetController.createAsset);
router.post('/categories', requireRole(['admin']), (req, res) => {
    // Implement simple category insert if needed
    res.json({ message: "Feature coming soon" }); 
});

// Admin & Manager routes
router.post('/:id/assign', requireRole(['admin', 'manager']), assetController.assignAsset);

module.exports = router;