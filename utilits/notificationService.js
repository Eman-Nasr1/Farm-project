// utilits/notificationService.js
const Notification = require('../Models/notification.model');
const NotificationDigest = require('../Models/notificationDigest.model');
const UserAlertPreference = require('../Models/userAlertPreference.model');
const i18n = require('../i18n');

/**
 * Notification Lifecycle Service
 * Handles creation, delivery, digest, and cleanup of notifications
 */
class NotificationService {
  
  /**
   * Create or update a notification with idempotency
   */
  static async upsertNotification(notificationData) {
    try {
      const {
        type, owner, itemId, dueDate, subtype,
        message, messageAr, messageEn,
        severity = 'medium', stage = 'month',
        category = 'routine', metadata = {},
        itemTagId, itemName
      } = notificationData;
  
      const idempotencyKey = Notification.generateIdempotencyKey(
        type, owner, itemId, dueDate, subtype
      );
  
      // ابحث عن إشعار موجود بنفس (owner/type/itemId[/dueDate])
      let notification = await Notification.findOne({
        owner, type, itemId, ...(dueDate && { dueDate })
      });
  
      if (notification) {
        const stageChanged = notification.stage !== stage;
  
        Object.assign(notification, {
          message, messageAr, messageEn, severity, stage, category,
          details: metadata, itemTagId, itemName, idempotencyKey
        });
  
        if (stageChanged) notification.isRead = false;
  
        // سجلّ تاريخ خفيف داخل details.history
        try {
          notification.details = notification.details || {};
          notification.details.history = notification.details.history || [];
          notification.details.history.push({
            at: new Date(),
            stage,
            severity,
            message
          });
        } catch (_) {}
  
        await notification.save();
  
        // اربط الأشقاء فقط لسيناريوهات نقطتين (VaccineDose/Weight)
        try {
          if (['VaccineDose', 'Weight'].includes(type)) {
            const siblings = await Notification.find({
              owner,
              type,
              itemId,
              _id: { $ne: notification._id }
            }).select('_id').lean();
  
            const sibIds = siblings.map(s => s._id);
            if (sibIds.length) {
              await Notification.updateOne(
                { _id: notification._id },
                { $addToSet: { relatedNotifications: { $each: sibIds } } }
              );
              await Notification.updateMany(
                { _id: { $in: sibIds } },
                { $addToSet: { relatedNotifications: notification._id } }
              );
            }
          }
        } catch (e) {
          console.error('Failed to link relatedNotifications (update path):', e.message);
        }
  
        return notification;
      }
  
      // إنشاء جديد
      notification = await Notification.create({
        type, owner, itemId, dueDate, subtype,
        message, messageAr, messageEn, severity, stage,
        category, details: metadata, idempotencyKey,
        itemTagId, itemName,
        isRead: false, isDelivered: false, includeInDigest: true
      });
  
      // Seed history لأول مرة
      try {
        await Notification.updateOne(
          { _id: notification._id },
          { $push: { 'details.history': { at: new Date(), stage, severity, message } } }
        );
      } catch (_) {}
  
      // اربط الأشقاء (لو النوع ثنائي النقطة)
      try {
        if (['VaccineDose', 'Weight'].includes(type)) {
          const siblings = await Notification.find({
            owner,
            type,
            itemId,
            _id: { $ne: notification._id }
          }).select('_id').lean();
  
          const sibIds = siblings.map(s => s._id);
          if (sibIds.length) {
            await Notification.updateOne(
              { _id: notification._id },
              { $addToSet: { relatedNotifications: { $each: sibIds } } }
            );
            await Notification.updateMany(
              { _id: { $in: sibIds } },
              { $addToSet: { relatedNotifications: notification._id } }
            );
          }
        }
      } catch (e) {
        console.error('Failed to link relatedNotifications (create path):', e.message);
      }
  
      return notification;
    } catch (error) {
      console.error('Error upserting notification:', error);
      throw error;
    }
  }
  

  /**
   * Create multiple notifications in batch
   */
  static async createBatchNotifications(notificationsArray) {
    const results = [];
    
    for (const notif of notificationsArray) {
      try {
        const created = await this.upsertNotification(notif);
        results.push(created);
      } catch (error) {
        console.error(`Error creating notification for ${notif.type}:`, error);
        results.push(null);
      }
    }
    
    return results.filter(Boolean);
  }

  /**
   * Mark notification as delivered
   */
  static async markDelivered(notificationId, deliveryChannel) {
    try {
      const notification = await Notification.findById(notificationId);
      if (!notification) return null;

      notification.isDelivered = true;
      notification.deliveredAt = new Date();
      
      if (!notification.deliveryChannels) {
        notification.deliveryChannels = [];
      }
      
      if (!notification.deliveryChannels.includes(deliveryChannel)) {
        notification.deliveryChannels.push(deliveryChannel);
      }
      
      await notification.save();
      return notification;
    } catch (error) {
      console.error('Error marking notification as delivered:', error);
      throw error;
    }
  }

  /**
   * Check if user should receive notification based on preferences
   */
  static async shouldSendNotification(userId, notificationData) {
    try {
      const preferences = await UserAlertPreference.findOne({ user: userId });
      
      if (!preferences || !preferences.defaultEnabled) {
        return { shouldSend: false, reason: 'notifications_disabled' };
      }

      // Check severity preference
      if (!preferences.severityPreferences[notificationData.severity]) {
        return { shouldSend: false, reason: 'severity_filtered' };
      }

      // Check type preference
      if (!preferences.typePreferences[notificationData.type]) {
        return { shouldSend: false, reason: 'type_filtered' };
      }

      // Check category preference
      if (notificationData.category && 
          !preferences.categoryPreferences[notificationData.category]) {
        return { shouldSend: false, reason: 'category_filtered' };
      }

      // Check quiet hours
      if (preferences.quietHours.enabled) {
        const now = new Date();
        const isCritical = notificationData.severity === 'critical';
        
        // Skip quiet hours check if critical and allowed
        if (!isCritical || !preferences.quietHours.allowCritical) {
          if (preferences.isInQuietHours(now, isCritical)) {
            return { shouldSend: false, reason: 'quiet_hours' };
          }
        }
      }

      // Check channel preferences
      const enabledChannels = preferences.channels
        .filter(c => c.enabled)
        .map(c => c.channel);

      return {
        shouldSend: true,
        enabledChannels,
        preferences
      };
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      // Default to allowing notification if preferences check fails
      return { shouldSend: true, enabledChannels: ['app'], preferences: null };
    }
  }

  /**
   * Create or get weekly digest for user
   */
  static async createWeeklyDigest(userId, year, weekNumber) {
    try {
      // Check if digest already exists
      const existing = await NotificationDigest.findOne({
        owner: userId,
        'digestPeriod.year': year,
        'digestPeriod.weekNumber': weekNumber
      });

      if (existing) {
        return existing;
      }

      // Get user preferences
      const preferences = await UserAlertPreference.findOne({ user: userId });
      
      if (!preferences || !preferences.digestPreferences?.enabled) {
        return null;
      }

      // Calculate week date range
      const startOfWeek = this.getStartOfWeek(year, weekNumber);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      // Find notifications for this week
      const notifications = await Notification.find({
        owner: userId,
        createdAt: {
          $gte: startOfWeek,
          $lte: endOfWeek
        },
        ...((preferences.digestPreferences?.includeRead) ? {} : { isRead: false })
      });

      // Filter by digest preferences
      const includeBySeverity = preferences.digestPreferences?.includeBySeverity || {};
      const includeByType = preferences.digestPreferences?.includeByType || {};
      const includeByCategory = preferences.digestPreferences?.includeByCategory || {};
      const maxItems = preferences.digestPreferences?.maxItems || 20;
      
      const filteredNotifications = notifications.filter(notif => {
        // Default to true if preference not set (backward compatibility)
        if (includeBySeverity[notif.severity] === false) {
          return false;
        }
        if (includeByType[notif.type] === false) {
          return false;
        }
        if (notif.category && includeByCategory[notif.category] === false) {
          return false;
        }
        return true;
      }).slice(0, maxItems);

      // Generate summary
      const summary = this.generateDigestSummary(filteredNotifications);

      // Create digest
      const idempotencyKey = NotificationDigest.generateIdempotencyKey(
        userId, 
        year, 
        weekNumber
      );

      const digest = await NotificationDigest.create({
        owner: userId,
        digestPeriod: {
          startDate: startOfWeek,
          endDate: endOfWeek,
          weekNumber,
          year
        },
        summary,
        notifications: filteredNotifications.map(n => n._id),
        highlights: this.extractHighlights(filteredNotifications),
        idempotencyKey,
        deliveryStatus: 'pending',
        scheduledFor: new Date(endOfWeek.getTime() + 24 * 60 * 60 * 1000), // Send on Monday after week ends
        locale: preferences.language || 'en',
        preferencesSnapshot: {
          digestFrequency: preferences.digestPreferences?.frequency || 'weekly',
          digestDay: preferences.digestPreferences?.digestDay || 'monday',
          digestTime: preferences.digestPreferences?.digestTime || '09:00',
          includeLow: preferences.digestPreferences?.includeBySeverity?.low ?? true,
          includeMedium: preferences.digestPreferences?.includeBySeverity?.medium ?? true,
          includeHigh: preferences.digestPreferences?.includeBySeverity?.high ?? true,
          includeCritical: preferences.digestPreferences?.includeBySeverity?.critical ?? true
        }
      });

      // Update notifications to link to digest
      await Notification.updateMany(
        { _id: { $in: filteredNotifications.map(n => n._id) } },
        { digestId: digest._id }
      );

      return digest;
    } catch (error) {
      console.error('Error creating weekly digest:', error);
      throw error;
    }
  }

  /**
   * Generate digest summary statistics
   */
  static generateDigestSummary(notifications) {
    const summary = {
      totalNotifications: notifications.length,
      unreadCount: notifications.filter(n => !n.isRead).length,
      highPriorityCount: notifications.filter(n => n.severity === 'high' || n.severity === 'critical').length,
      criticalCount: notifications.filter(n => n.severity === 'critical').length,
      byType: new Map(),
      byCategory: new Map(),
      bySeverity: new Map()
    };

    notifications.forEach(notif => {
      // Count by type
      const typeCount = summary.byType.get(notif.type) || 0;
      summary.byType.set(notif.type, typeCount + 1);

      // Count by category
      const categoryCount = summary.byCategory.get(notif.category) || 0;
      summary.byCategory.set(notif.category, categoryCount + 1);

      // Count by severity
      const severityCount = summary.bySeverity.get(notif.severity) || 0;
      summary.bySeverity.set(notif.severity, severityCount + 1);
    });

    // Convert Maps to Objects
    summary.byType = Object.fromEntries(summary.byType);
    summary.byCategory = Object.fromEntries(summary.byCategory);
    summary.bySeverity = Object.fromEntries(summary.bySeverity);

    return summary;
  }

  /**
   * Extract highlights (most important notifications)
   */
  static extractHighlights(notifications, maxHighlights = 5) {
    const sorted = notifications
      .filter(n => n.severity === 'critical' || n.severity === 'high')
      .sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'critical' ? -1 : 1;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      })
      .slice(0, maxHighlights);

    return sorted.map(n => ({
      notificationId: n._id,
      headline: n.title || n.message.substring(0, 100),
      priority: n.severity,
      actionRequired: n.severity === 'critical' || n.severity === 'high'
    }));
  }

  /**
   * Get start date of week for given year and week number
   */
  static getStartOfWeek(year, weekNumber) {
    const date = new Date(year, 0, 1);
    const days = (weekNumber - 1) * 7;
    date.setDate(date.getDate() + days);
    
    // Adjust to Monday of that week
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    date.setDate(diff);
    
    return new Date(date.setHours(0, 0, 0, 0));
  }

  /**
   * Get unread notifications for user
   */
  static async getUnreadNotifications(userId, options = {}) {
    const {
      limit = 50,
      skip = 0,
      type,
      severity,
      category
    } = options;

    const query = {
      owner: userId,
      isRead: false,
      ...(type && { type }),
      ...(severity && { severity }),
      ...(category && { category })
    };

    return await Notification.find(query)
      .sort({ severity: 1, createdAt: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Get unread notifications with pagination
   */
  static async getUnreadNotificationsPaginated(userId, options = {}) {
    const {
      page = 1,
      limit = 50,
      type,
      severity,
      category
    } = options;

    const query = {
      owner: userId,
      isRead: false,
      ...(type && { type }),
      ...(severity && { severity }),
      ...(category && { category })
    };

    const skip = (page - 1) * limit;

    const [notifications, totalDocuments] = await Promise.all([
      Notification.find(query)
        .sort({ severity: 1, createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Notification.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalDocuments / limit);

    return {
      notifications,
      pagination: {
        currentPage: page,
        totalPages,
        totalDocuments,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Clean up old notifications based on user preferences
   */
  static async cleanupOldNotifications(userId) {
    try {
      const preferences = await UserAlertPreference.findOne({ user: userId });
      
      if (!preferences) {
        return { deleted: 0 };
      }

      const retentionDays = preferences.retentionDays || 90;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await Notification.deleteMany({
        owner: userId,
        createdAt: { $lt: cutoffDate },
        ...(preferences.keepReadNotifications ? { isRead: false } : {})
      });

      return { deleted: result.deletedCount };
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for user
   */
  static async getNotificationStats(userId) {
    const stats = await Notification.aggregate([
      { $match: { owner: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          },
          bySeverity: {
            $push: {
              severity: '$severity',
              isRead: '$isRead'
            }
          },
          byType: {
            $push: {
              type: '$type',
              isRead: '$isRead'
            }
          }
        }
      }
    ]);

    if (!stats.length) {
      return {
        total: 0,
        unread: 0,
        bySeverity: {},
        byType: {},
        recentUnread: []
      };
    }

    const stat = stats[0];
    
    // Count by severity
    const bySeverity = {};
    stat.bySeverity.forEach(n => {
      bySeverity[n.severity] = (bySeverity[n.severity] || 0) + 1;
    });

    // Count by type
    const byType = {};
    stat.byType.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    // Get recent unread
    const recentUnread = await Notification.find({
      owner: userId,
      isRead: false
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('type message severity stage createdAt');

    return {
      total: stat.total,
      unread: stat.unread,
      read: stat.total - stat.unread,
      bySeverity,
      byType,
      recentUnread
    };
  }
}

module.exports = NotificationService;

