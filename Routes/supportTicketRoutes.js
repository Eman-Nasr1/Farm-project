/**
 * Support Ticket Routes
 * 
 * Routes for support ticket management:
 * - Public: User ticket submission
 * - Authenticated: User's own tickets
 * - Admin: Full ticket management
 */

const express = require('express');
const router = express.Router();
const supportTicketController = require('../Controllers/supportTicket.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const optionalAuth = require('../middleware/optionalAuth');

/**
 * Public Routes (No authentication required)
 */

// Submit a new support ticket (public - works with or without auth)
router.post('/api/support/tickets', optionalAuth, supportTicketController.createTicket);

/**
 * Authenticated User Routes (Users can manage their own tickets)
 */

// Get user's own tickets
router.get('/api/support/tickets', verifytoken, supportTicketController.getUserTickets);

// User reply to their own ticket
router.post('/api/support/tickets/:id/reply', verifytoken, supportTicketController.userReplyToTicket);

/**
 * Admin Routes (Full ticket management)
 */

// Get all tickets (with filters)
router.get('/api/admin/support/tickets', verifytoken, authorize(PERMISSIONS.SUPPORT_READ), supportTicketController.getAllTickets);

// Get single ticket details
router.get('/api/admin/support/tickets/:id', verifytoken, authorize(PERMISSIONS.SUPPORT_READ), supportTicketController.getTicket);

// Update ticket status
router.patch('/api/admin/support/tickets/:id/status', verifytoken, authorize(PERMISSIONS.SUPPORT_MANAGE), supportTicketController.updateStatus);

// Admin reply to ticket
router.post('/api/admin/support/tickets/:id/reply', verifytoken, authorize(PERMISSIONS.SUPPORT_MANAGE), supportTicketController.replyToTicket);

// Delete ticket
router.delete('/api/admin/support/tickets/:id', verifytoken, authorize(PERMISSIONS.SUPPORT_MANAGE), supportTicketController.deleteTicket);

// Get ticket statistics
router.get('/api/admin/support/statistics', verifytoken, authorize(PERMISSIONS.SUPPORT_READ), supportTicketController.getStatistics);

module.exports = router;

