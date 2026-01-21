/**
 * Contact Routes
 * 
 * Public routes for contact form submissions
 */

const express = require('express');
const router = express.Router();
const contactController = require('../Controllers/contact.controller');

// Public route - Send contact form email (no authentication required)
router.post('/api/contact', contactController.sendContactEmail);

module.exports = router;
