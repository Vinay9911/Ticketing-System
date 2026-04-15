const express = require('express');
const router = express.Router();
const uc = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', uc.getUsers);
router.get('/departments', uc.getDepartments);
router.get('/:id', uc.getUserById);

module.exports = router;
