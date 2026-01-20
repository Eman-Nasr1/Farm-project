const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notification.controller');
const verifytoken = require('../middleware/verifytoken');
const setLocale = require('../middleware/setLocale');

// Notification CRUD
router.get('/api/notifications', verifytoken, setLocale, notificationController.getNotifications);
router.get('/api/notifications/unread', verifytoken, setLocale, notificationController.getUnreadNotifications);
router.get('/api/notifications/stats', verifytoken, setLocale, notificationController.getNotificationStats);
router.get('/api/notifications/check', verifytoken, setLocale, notificationController.checkNotifications);
router.patch('/api/notifications/:notificationId/read', verifytoken, setLocale, notificationController.markAsRead);
router.patch('/api/notifications/read-all', verifytoken, setLocale, notificationController.markAllAsRead);
router.delete('/api/notifications/:notificationId', verifytoken, setLocale, notificationController.deleteNotification);
router.delete('/api/notifications/cleanup', verifytoken, setLocale, notificationController.cleanupNotifications);

// Digest
router.get('/api/notifications/digest', verifytoken, setLocale, notificationController.getWeeklyDigest);

// User Preferences
router.get('/api/notifications/preferences', verifytoken, setLocale, notificationController.getUserPreferences);
router.patch('/api/notifications/preferences', verifytoken, setLocale, notificationController.updateUserPreferences);

module.exports = router;