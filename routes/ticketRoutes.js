const express = require('express');
const router = express.Router();
const tc = require('../controllers/ticketController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

// Stats (dashboard KPIs)
router.get('/stats', tc.getStats);

// Ticket CRUD
router.get('/', tc.getTickets);
router.post('/', tc.createTicket);
router.get('/:id', tc.getTicketById);
router.put('/:id', tc.updateTicket);
router.delete('/:id', requireRole(['admin']), tc.deleteTicket);

// Assignment
router.post('/:id/assign', requireRole(['admin', 'manager']), tc.assignTicket);

// Comments
router.post('/:id/comments', tc.addComment);
router.get('/:id/comments', tc.getComments);

module.exports = router;