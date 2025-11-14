const Notification = require('../Models/notification.model');
const NotificationDigest = require('../Models/notificationDigest.model');
const UserAlertPreference = require('../Models/userAlertPreference.model');
const NotificationService = require('../utilits/notificationService');
const { collectAllNotifications } = require('../utilits/notificationChecker');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const i18n = require('../i18n');

// Get all notifications for the current user
const getNotifications = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const { 
    type, 
    severity, 
    category, 
    isRead, 
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    lang = 'en' // Get language from query or default to 'en'
  } = req.query;

  // Validate and normalize language
  const normalizedLang = lang === 'ar' ? 'ar' : 'en';

  // Build query
  const query = { owner: userId };
  
  if (type) query.type = type;
  if (severity) query.severity = severity;
  if (category) query.category = category;
  if (isRead !== undefined) query.isRead = isRead === 'true';

  // Pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Validate pagination
  if (pageNum < 1) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: 'Page number must be greater than 0'
    });
  }

  if (limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: 'Limit must be between 1 and 100'
    });
  }

  // Build sort object
  const sort = {};
  const allowedSortFields = ['createdAt', 'dueDate', 'severity', 'type', 'stage'];
  const allowedSortOrders = ['asc', 'desc'];
  
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDir = allowedSortOrders.includes(sortOrder) ? sortOrder : 'desc';
  sort[sortField] = sortDir === 'desc' ? -1 : 1;
  
  // Execute queries in parallel
  const [notifications, totalDocuments] = await Promise.all([
    Notification.find(query)
      .sort(sort)
      .limit(limitNum)
      .skip(skip)
      .lean(),
    Notification.countDocuments(query)
  ]);

  // Map notifications to include appropriate language version
  const mappedNotifications = notifications.map(notif => {
    const mapped = { ...notif };
    
    // Use language-specific message if available, otherwise use default message
    if (normalizedLang === 'ar' && notif.messageAr) {
      mapped.message = notif.messageAr;
    } else if (normalizedLang === 'en' && notif.messageEn) {
      mapped.message = notif.messageEn;
    }
    // If language-specific version doesn't exist, keep default message
    
    // Remove language-specific fields from response to clean up
    delete mapped.messageAr;
    delete mapped.messageEn;
    
    // Remove history from details if it exists
    if (mapped.details && mapped.details.history) {
      delete mapped.details.history;
    }
    
    return mapped;
  });

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalDocuments / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  res.json({
    status: httpstatustext.SUCCESS,
    data: { 
      notifications: mappedNotifications,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalDocuments,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      }
    }
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
    const userNotes = await collectAllNotifications(userId, lang);

    if (!userNotes.length) {
      return res.json({
        status: httpstatustext.SUCCESS,
        data: { notifications: [], checked: 0, created: 0, unreadCount: 0 }
      });
    }

    // فلترة أي عنصر ناقص له مفاتيح أساسية قبل الـ bulk
    const validNotes = userNotes.filter(n =>
      n?.type && n?.owner && n?.itemId
    );

    if (validNotes.length !== userNotes.length) {
      console.warn('Some notes were skipped due to missing keys', {
        total: userNotes.length, valid: validNotes.length
      });
    }

    const createdOrUpdated = await NotificationService.createBatchNotifications(
      validNotes.map(n => ({
        type: n.type,
        owner: n.owner,           // خليه زي ما جه من المصدر (ObjectId)
        itemId: n.itemId,
        dueDate: n.dueDate,       // ممكن undefined — تمام
        subtype: n.subtype,
        message: n.message,
        messageAr: n.messageAr,
        messageEn: n.messageEn,
        severity: n.severity,
        stage: n.stage,
        category: n.category || 'routine',
        metadata: n.details || {},
        itemTagId: n.itemTagId,
        itemName: n.itemName
      }))
    );

    // Remove history from details if it exists
    const cleanedNotifications = createdOrUpdated.map(notif => {
      const cleaned = notif.toObject ? notif.toObject() : { ...notif };
      if (cleaned.details && cleaned.details.history) {
        delete cleaned.details.history;
      }
      return cleaned;
    });

    const unreadCount = cleanedNotifications.filter(n => !n.isRead).length;

    res.json({
      status: httpstatustext.SUCCESS,
      data: {
        notifications: cleanedNotifications,
        checked: userNotes.length,
        created: cleanedNotifications.length,
        unreadCount
      }
    });
  } catch (error) {
    console.error('[checkNotifications] failed:', error?.message, error?.stack);
    // تأكدي إن i18n متستورد في نفس الملف
    return res.status(500).json({
      status: httpstatustext.ERROR,
      message: i18n.__('FAILED_TO_CHECK_NOTIFICATIONS')
    });
  }
});



// Get notification statistics
const getNotificationStats = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const stats = await NotificationService.getNotificationStats(userId);

  res.json({
    status: httpstatustext.SUCCESS,
    data: stats
  });
});

// Get unread notifications only
const getUnreadNotifications = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const { 
    page = 1,
    limit = 50,
    type, 
    severity, 
    category 
  } = req.query;

  // Pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Validate pagination
  if (pageNum < 1) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: 'Page number must be greater than 0'
    });
  }

  if (limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: 'Limit must be between 1 and 100'
    });
  }

  // Build query
  const query = { owner: userId, isRead: false };
  if (type) query.type = type;
  if (severity) query.severity = severity;
  if (category) query.category = category;

  // Execute queries in parallel
  const [notifications, totalDocuments] = await Promise.all([
    Notification.find(query)
      .sort({ severity: 1, createdAt: -1 })
      .limit(limitNum)
      .skip(skip)
      .lean(),
    Notification.countDocuments(query)
  ]);

  // Remove history from details if it exists
  const cleanedNotifications = notifications.map(notif => {
    if (notif.details && notif.details.history) {
      delete notif.details.history;
    }
    return notif;
  });

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalDocuments / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  res.json({
    status: httpstatustext.SUCCESS,
    data: { 
      notifications: cleanedNotifications,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalDocuments,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      }
    }
  });
});

// Get or create weekly digest
const getWeeklyDigest = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const { 
    year, 
    week, 
    page = 1,
    limit = 20,
    lang = 'en'
  } = req.query;

  // Validate and normalize language
  const normalizedLang = lang === 'ar' ? 'ar' : 'en';
  
  // Set i18n locale for translations
  i18n.setLocale(normalizedLang);

  const currentDate = new Date();
  const targetYear = parseInt(year) || currentDate.getFullYear();
  const targetWeek = parseInt(week) || NotificationDigest.getWeekNumber(currentDate);

  // Pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Validate pagination
  if (pageNum < 1) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: i18n.__('PAGE_NUMBER_INVALID')
    });
  }

  if (limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: i18n.__('LIMIT_INVALID')
    });
  }

  const digest = await NotificationService.createWeeklyDigest(
    userId,
    targetYear,
    targetWeek
  );

  if (!digest) {
    return res.json({
      status: httpstatustext.SUCCESS,
      message: i18n.__('DIGEST_NOT_ENABLED')
    });
  }

  // Populate notifications
  await digest.populate('notifications');

  // Sort notifications by severity (critical -> high -> medium -> low) and then by date (newest first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedNotifications = [...digest.notifications].sort((a, b) => {
    const aSeverity = a.severity || 'low';
    const bSeverity = b.severity || 'low';
    
    // Sort by severity first
    if (severityOrder[aSeverity] !== severityOrder[bSeverity]) {
      return severityOrder[aSeverity] - severityOrder[bSeverity];
    }
    
    // Then by creation date (newest first)
    const aDate = new Date(a.createdAt || 0);
    const bDate = new Date(b.createdAt || 0);
    return bDate - aDate;
  });

  // Get total count of notifications
  const totalNotifications = sortedNotifications.length;

  // Paginate notifications
  const paginatedNotifications = sortedNotifications
    .slice(skip, skip + limitNum)
    .map(notif => {
      const mapped = notif.toObject ? notif.toObject() : notif;
      
      // Use language-specific message if available, otherwise fall back to default message
      if (normalizedLang === 'ar' && mapped.messageAr) {
        mapped.message = mapped.messageAr;
      } else if (normalizedLang === 'en' && mapped.messageEn) {
        mapped.message = mapped.messageEn;
      }
      // If language-specific version doesn't exist, mapped.message already contains the default message
      
      // Remove language-specific fields from response
      delete mapped.messageAr;
      delete mapped.messageEn;
      
      // Remove history from details if it exists
      if (mapped.details && mapped.details.history) {
        delete mapped.details.history;
      }
      
      return mapped;
    });

  // Calculate pagination metadata
  const totalPages = Math.ceil(totalNotifications / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // Convert digest to object and remove full notifications array
  const digestObj = digest.toObject ? digest.toObject() : digest;
  const { notifications: _, ...digestWithoutNotifications } = digestObj;

  // Translate highlights - populate notification data and use correct language
  const translatedHighlights = digestWithoutNotifications.highlights?.map(highlight => {
    const notification = sortedNotifications.find(n => 
      n._id && highlight.notificationId && 
      n._id.toString() === highlight.notificationId.toString()
    );
    
    if (notification) {
      const notifObj = notification.toObject ? notification.toObject() : notification;
      let headline = highlight.headline;
      
      // Use language-specific message if available, otherwise fall back to default message
      if (normalizedLang === 'ar' && notifObj.messageAr) {
        headline = notifObj.messageAr.substring(0, 100);
      } else if (normalizedLang === 'en' && notifObj.messageEn) {
        headline = notifObj.messageEn.substring(0, 100);
      } else if (notifObj.message) {
        headline = notifObj.message.substring(0, 100);
      } else if (notifObj.messageAr) {
        headline = notifObj.messageAr.substring(0, 100);
      } else if (notifObj.messageEn) {
        headline = notifObj.messageEn.substring(0, 100);
      }
      
      return {
        ...highlight,
        headline: headline || highlight.headline
      };
    }
    
    return highlight;
  }) || [];

  // Translate summary labels if needed (create a translated summary object)
  const translatedSummary = {
    ...digestWithoutNotifications.summary,
    // Convert Map to Object for JSON serialization if needed
    byType: digestWithoutNotifications.summary?.byType instanceof Map 
      ? Object.fromEntries(digestWithoutNotifications.summary.byType) 
      : digestWithoutNotifications.summary?.byType || {},
    byCategory: digestWithoutNotifications.summary?.byCategory instanceof Map 
      ? Object.fromEntries(digestWithoutNotifications.summary.byCategory) 
      : digestWithoutNotifications.summary?.byCategory || {},
    bySeverity: digestWithoutNotifications.summary?.bySeverity instanceof Map 
      ? Object.fromEntries(digestWithoutNotifications.summary.bySeverity) 
      : digestWithoutNotifications.summary?.bySeverity || {}
  };

  res.json({
    status: httpstatustext.SUCCESS,
    data: { 
      digest: {
        ...digestWithoutNotifications,
        summary: translatedSummary,
        highlights: translatedHighlights,
        notifications: paginatedNotifications,
        // Add translated labels for frontend
        labels: {
          totalNotifications: i18n.__('TOTAL_NOTIFICATIONS'),
          unread: i18n.__('UNREAD'),
          critical: i18n.__('CRITICAL'),
          high: i18n.__('HIGH'),
          medium: i18n.__('MEDIUM'),
          low: i18n.__('LOW'),
          week: i18n.__('WEEK'),
          of: i18n.__('OF'),
          weeklyDigest: i18n.__('WEEKLY_DIGEST')
        }
      },
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalDocuments: totalNotifications,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null
      }
    }
  });
});

// Get user alert preferences
const getUserPreferences = asyncwrapper(async (req, res) => {
  const userId = req.user.id;

  let preferences = await UserAlertPreference.findOne({ user: userId });

  if (!preferences) {
    // Create default preferences
    preferences = await UserAlertPreference.create({
      user: userId,
      ...UserAlertPreference.getDefaults()
    });
  }

  res.json({
    status: httpstatustext.SUCCESS,
    data: { preferences }
  });
});

// Update user alert preferences
const updateUserPreferences = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const updates = req.body;

  let preferences = await UserAlertPreference.findOne({ user: userId });

  if (!preferences) {
    preferences = await UserAlertPreference.create({
      user: userId,
      ...UserAlertPreference.getDefaults(),
      ...updates
    });
  } else {
    Object.assign(preferences, updates);
    preferences.version = (preferences.version || 0) + 1;
    preferences.lastPreferenceUpdate = new Date();
    await preferences.save();
  }

  res.json({
    status: httpstatustext.SUCCESS,
    data: { preferences },
    message: i18n.__('PREFERENCES_UPDATED')
  });
});

// Clean up old notifications
const cleanupNotifications = asyncwrapper(async (req, res) => {
  const userId = req.user.id;

  const result = await NotificationService.cleanupOldNotifications(userId);

  res.json({
    status: httpstatustext.SUCCESS,
    data: result,
    message: i18n.__('NOTIFICATIONS_CLEANED_UP')
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  checkNotifications,
  getNotificationStats,
  getUnreadNotifications,
  getWeeklyDigest,
  getUserPreferences,
  updateUserPreferences,
  cleanupNotifications
};
