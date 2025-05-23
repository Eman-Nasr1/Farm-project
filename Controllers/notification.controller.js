const Notification = require('../Models/notification.model');
const notificationChecker = require('../utilits/notificationChecker');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const i18n = require('../i18n');

// Get all notifications for the current user
const getNotifications = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    
    // Get unread notifications first, then read ones
    const notifications = await Notification.find({ owner: userId })
        .sort({ isRead: 1, createdAt: -1 });

    res.json({
        status: httpstatustext.SUCCESS,
        data: { notifications }
    });
});

// Mark notification as read
const markAsRead = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    const notificationId = req.params.notificationId;

    await Notification.findOneAndUpdate(
        { _id: notificationId, owner: userId },
        { isRead: true }
    );

    res.json({
        status: httpstatustext.SUCCESS,
        message: 'Notification marked as read'
    });
});

// Mark all notifications as read
const markAllAsRead = asyncwrapper(async (req, res) => {
    const userId = req.user.id;

    await Notification.updateMany(
        { owner: userId, isRead: false },
        { isRead: true }
    );

    res.json({
        status: httpstatustext.SUCCESS,
        message: 'All notifications marked as read'
    });
});

// Delete a notification
const deleteNotification = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const notificationId = req.params.notificationId;

    const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        owner: userId
    });

    if (!notification) {
        return next(AppError.create(i18n.__('NOTIFICATION_NOT_FOUND'), 404, httpstatustext.FAIL));
    }

    res.json({
        status: httpstatustext.SUCCESS,
        message: i18n.__('NOTIFICATION_DELETED')
    });
});

// Check for new notifications
const checkNotifications = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    
    try {
        const notifications = await notificationChecker.checkExpiringItems();
        const userNotifications = notifications.filter(n => n.owner.toString() === userId);
        
        // Save new notifications
        await Promise.all(userNotifications.map(notification => 
            Notification.create(notification)
        ));

        res.json({
            status: httpstatustext.SUCCESS,
            data: { notifications: userNotifications }
        });
    } catch (error) {
        console.error('Error checking notifications:', error);
        res.status(500).json({
            status: httpstatustext.ERROR,
            message: 'Failed to check for notifications'
        });
    }
});

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    checkNotifications
}; 