const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { fakeAuthGuard } = require('../middleware/auth');

router.use(fakeAuthGuard);
router.get('/', assetController.getAssets);
router.post('/', assetController.createAsset); // Admins only in real app

module.exports = router;