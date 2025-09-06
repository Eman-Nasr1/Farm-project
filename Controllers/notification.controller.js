const Notification = require('../Models/notification.model');
const { collectAllNotifications } = require('../utilits/notificationChecker');
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
  const lang = req.lang || req.user?.language || 'en';

  try {
    const notes = await collectAllNotifications(lang);
    const userNotes = notes.filter(n => String(n.owner) === String(userId));

    await Promise.all(userNotes.map(async (n) => {
      // الأنواع التي تميّز بالمَوعد dueDate
      if ((n.type === 'Weight' || n.type === 'VaccineDose') && n.dueDate) {
        const existing = await Notification.findOne({
          owner: userId, type: n.type, itemId: n.itemId, dueDate: n.dueDate
        });
        if (!existing) {
          await Notification.create({
            owner: userId,
            type: n.type,
            itemId: n.itemId,
            subtype: n.subtype,
            dueDate: n.dueDate,
            message: n.message,
            severity: n.severity,
            stage: n.stage,
            isRead: false
          });
        } else {
          const stageChanged = existing.stage !== n.stage;
          await Notification.updateOne(
            { _id: existing._id },
            { $set: { message: n.message, severity: n.severity, stage: n.stage, ...(stageChanged ? { isRead: false } : {}) } }
          );
        }
        return;
      }

      // الأنواع القديمة بدون dueDate
      const existing = await Notification.findOne({ owner: userId, type: n.type, itemId: n.itemId });
      if (!existing) {
        await Notification.create({
          owner: userId,
          type: n.type,
          itemId: n.itemId,
          message: n.message,
          severity: n.severity,
          stage: n.stage,
          isRead: false
        });
      } else {
        const stageChanged = existing.stage !== n.stage;
        await Notification.updateOne(
          { _id: existing._id },
          { $set: { message: n.message, severity: n.severity, stage: n.stage, ...(stageChanged ? { isRead: false } : {}) } }
        );
      }
    }));

    res.json({ status: httpstatustext.SUCCESS, data: { notifications: userNotes } });
  } catch (error) {
    console.error('Error checking notifications:', error);
    res.status(500).json({ status: httpstatustext.ERROR, message: i18n.__('FAILED_TO_CHECK_NOTIFICATIONS') });
  }
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  checkNotifications
};
