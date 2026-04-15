const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');
const { requireAuth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/ticketing/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(requireAuth);
router.use(requireRole('admin', 'manager'));

router.get('/', repairController.getRepairs);
router.get('/upcoming', repairController.getUpcoming);
router.get('/stats', repairController.getStats);
router.get('/:id', repairController.getRepairById);
router.post('/', upload.single('invoice'), repairController.createRepair);
router.put('/:id', upload.single('invoice'), repairController.updateRepair);
router.delete('/:id', requireRole('admin'), repairController.deleteRepair);

// Mock Approval Route (Simulating Email Reply)
router.post('/:id/approve', repairController.approveRepair);

module.exports = router;
