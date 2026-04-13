const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { requireAuth, requireRole } = require('../middleware/auth');

// All ticket routes require authentication [cite: 77]
router.use(requireAuth);

router.get('/', ticketController.getTickets);
router.post('/', ticketController.createTicket);
router.get('/:id', ticketController.getTicketById);
router.put('/:id/status', ticketController.updateTicketStatus);

// Comments [cite: 86]
router.post('/:id/comments', ticketController.addComment);
router.get('/:id/comments', ticketController.getComments);

module.exports = router;