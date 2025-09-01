const Notification = require('../Models/notification.model');
const notificationChecker = require('../utilits/notificationChecker');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const i18n = require('../i18n');

// Get all notifications for the current user
const getNotifications = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
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
    message: i18n.__('NOTIFICATION_MARKED_READ')
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
    message: i18n.__('ALL_NOTIFICATIONS_MARKED_READ')
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
  const lang = req.lang || req.user?.language || 'en';  // from middleware or user

  try {
    // ⬇️ Pass lang so messages come out localized
    const notifications = await notificationChecker.checkExpiringItems(lang);

    const userNotifications = notifications.filter(n => n.owner.toString() === userId);

    // (Optional) prevent duplicates by upserting on (type,itemId,expiryDate)
    // (Optional) prevent duplicates & control unread based on stage changes
    await Promise.all(
      userNotifications.map(async (n) => {
        // دوري على إشعار قديم لنفس (owner, type, itemId)
        const existing = await Notification.findOne({
          owner: userId,
          type: n.type,
          itemId: n.itemId
        });

        if (!existing) {
          // أول مرة: أنشئيه Unread
          await Notification.create({
            owner: userId,
            type: n.type,
            itemId: n.itemId,
            message: n.message,
            severity: n.severity,
            stage: n.stage,   // ← المرحلة
            isRead: false
          });
          return;
        }

        // لو المرحلة اتغيّرت (month→week أو week→expired)
        const stageChanged = existing.stage !== n.stage;

        await Notification.updateOne(
          { _id: existing._id },
          {
            $set: {
              message: n.message,
              severity: n.severity,
              stage: n.stage,
              ...(stageChanged ? { isRead: false } : {}) // رجّعه Unread بس لو المرحلة اتغيّرت
            }
          }
        );
      })
    );


    res.json({
      status: httpstatustext.SUCCESS,
      data: { notifications: userNotifications }
    });
  } catch (error) {
    console.error('Error checking notifications:', error);
    res.status(500).json({
      status: httpstatustext.ERROR,
      message: i18n.__('FAILED_TO_CHECK_NOTIFICATIONS')
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
