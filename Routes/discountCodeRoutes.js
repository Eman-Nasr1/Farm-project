const express = require('express');
const router = express.Router();
const discountCodeController = require('../Controllers/discountCode.controller');
const verifytoken = require('../middleware/verifytoken');
const allowedto = require('../middleware/allowedto');

// Admin routes (require admin role)
router.post('/api/admin/discount-codes', verifytoken, allowedto('admin'), discountCodeController.createDiscountCode);
router.get('/api/admin/discount-codes', verifytoken, allowedto('admin'), discountCodeController.getAllDiscountCodes);
router.get('/api/admin/discount-codes/:id', verifytoken, allowedto('admin'), discountCodeController.getDiscountCode);
router.put('/api/admin/discount-codes/:id', verifytoken, allowedto('admin'), discountCodeController.updateDiscountCode);
router.delete('/api/admin/discount-codes/:id', verifytoken, allowedto('admin'), discountCodeController.deleteDiscountCode);

// Public route for validating discount codes (used during checkout)
router.get('/api/discount-codes/validate/:code', discountCodeController.validateDiscountCode);

module.exports = router;
