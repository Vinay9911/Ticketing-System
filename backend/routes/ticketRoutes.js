const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { fakeAuthGuard } = require('../middleware/auth');

router.use(fakeAuthGuard);
router.get('/', ticketController.getTickets);
router.post('/', ticketController.createTicket);
router.put('/:id/status', ticketController.updateTicketStatus);

module.exports = router;