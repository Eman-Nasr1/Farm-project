const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notification.controller');
const verifytoken = require('../middleware/verifytoken');

// Get all notifications
router.get('/api/notifications', verifytoken, notificationController.getNotifications);

// Check for new notifications
router.get('/api/notifications/check', verifytoken, notificationController.checkNotifications);

// Mark notification as read
router.patch('/api/notifications/:notificationId/read', verifytoken, notificationController.markAsRead);

// Mark all notifications as read
router.patch('/api/notifications/read-all', verifytoken, notificationController.markAllAsRead);

// Delete notification
router.delete('/api/notifications/:notificationId', verifytoken, notificationController.deleteNotification);

module.exports = router; 