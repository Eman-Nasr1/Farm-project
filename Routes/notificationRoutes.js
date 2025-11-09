const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notification.controller');
const verifytoken = require('../middleware/verifytoken');
const setLocale = require('../middleware/setLocale');


router.use(verifytoken, setLocale); // apply to all routes below

// Notification CRUD
router.get('/api/notifications', notificationController.getNotifications);
router.get('/api/notifications/unread', notificationController.getUnreadNotifications);
router.get('/api/notifications/stats', notificationController.getNotificationStats);
router.get('/api/notifications/check', notificationController.checkNotifications);
router.patch('/api/notifications/:notificationId/read', notificationController.markAsRead);
router.patch('/api/notifications/read-all', notificationController.markAllAsRead);
router.delete('/api/notifications/:notificationId', notificationController.deleteNotification);
router.delete('/api/notifications/cleanup', notificationController.cleanupNotifications);

// Digest
router.get('/api/notifications/digest', notificationController.getWeeklyDigest);

// User Preferences
router.get('/api/notifications/preferences', notificationController.getUserPreferences);
router.patch('/api/notifications/preferences', notificationController.updateUserPreferences);

module.exports = router;