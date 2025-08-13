const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notification.controller');
const verifytoken = require('../middleware/verifytoken');
const setLocale = require('../middleware/setLocale');


router.use(verifytoken, setLocale); // apply to all routes below

router.get('/api/notifications', notificationController.getNotifications);
router.get('/api/notifications/check', notificationController.checkNotifications);
router.patch('/api/notifications/:notificationId/read', notificationController.markAsRead);
router.patch('/api/notifications/read-all', notificationController.markAllAsRead);
router.delete('/api/notifications/:notificationId', notificationController.deleteNotification);

module.exports = router;