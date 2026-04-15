const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');
const { requireAuth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'public', 'ticketing', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

router.use(requireAuth);
// FIX: requireRole must receive an array, not bare strings
router.use(requireRole(['admin', 'manager']));

router.get('/',          repairController.getRepairs);
router.get('/upcoming',  repairController.getUpcoming);
router.get('/stats',     repairController.getStats);
router.get('/:id',       repairController.getRepairById);

router.post('/',         upload.single('invoice'), repairController.createRepair);
router.put('/:id',       upload.single('invoice'), repairController.updateRepair);
// FIX: requireRole must receive an array
router.delete('/:id',    requireRole(['admin']),   repairController.deleteRepair);

// Explicit web-UI approval endpoint
router.post('/:id/approve', repairController.approveRepair);

module.exports = router;