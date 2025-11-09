// Models/notificationDigest.model.js
const mongoose = require('mongoose');

const NotificationDigestSchema = new mongoose.Schema({
  // Owner reference
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  
  // Digest period
  digestPeriod: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    weekNumber: { type: Number }, // Week of year 1-53
    year: { type: Number }
  },
  
  // Digest summary
  summary: {
    totalNotifications: { type: Number, default: 0 },
    unreadCount: { type: Number, default: 0 },
    highPriorityCount: { type: Number, default: 0 },
    criticalCount: { type: Number, default: 0 },
    byType: { type: Map, of: Number }, // { Treatment: 5, Vaccine: 3, ... }
    byCategory: { type: Map, of: Number }, // { medical: 8, routine: 2, ... }
    bySeverity: { type: Map, of: Number } // { low: 3, medium: 4, high: 2, critical: 1 }
  },
  
  // Email content
  emailSubject: { type: String },
  emailBody: { type: String },
  emailHtmlBody: { type: String },
  
  // Delivery status
  deliveryStatus: { 
    type: String, 
    enum: ['pending', 'scheduled', 'sent', 'failed', 'cancelled'], 
    default: 'pending'
  },
  scheduledFor: { type: Date }, // When to send
  sentAt: { type: Date },
  deliveryMethod: { 
    type: String, 
    enum: ['email', 'sms', 'push', 'app'],
    default: 'email'
  },
  deliveryAttempts: { type: Number, default: 0 },
  lastDeliveryAttempt: { type: Date },
  deliveryError: { type: String },
  
  // Email metadata
  recipientEmail: { type: String },
  recipientName: { type: String },
  
  // Notification references
  notifications: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Notification'
  }],
  
  // Highlights (most important notifications)
  highlights: [{ 
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
    headline: { type: String },
    priority: { type: String, enum: ['critical', 'high', 'medium'] },
    actionRequired: { type: Boolean, default: false }
  }],
  
  // Grouping
  groupedByType: { type: Boolean, default: true },
  groupedByPriority: { type: Boolean, default: true },
  sortedBy: { 
    type: String, 
    enum: ['date', 'priority', 'type', 'category'], 
    default: 'priority'
  },
  
  // Idempotency
  idempotencyKey: { 
    type: String, 
    unique: true, 
    required: true,
    index: true 
  },
  
  // User preferences applied
  preferencesSnapshot: {
    digestFrequency: { type: String, enum: ['daily', 'weekly', 'never'] },
    digestDay: { type: String }, // 'monday', 'tuesday', etc.
    digestTime: { type: String }, // '09:00'
    includeLow: { type: Boolean },
    includeMedium: { type: Boolean },
    includeHigh: { type: Boolean },
    includeCritical: { type: Boolean }
  },
  
  // Engagement tracking
  opened: { type: Boolean, default: false },
  openedAt: { type: Date },
  clickedItems: [{ 
    notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
    clickedAt: { type: Date }
  }],
  
  // Expiration
  isExpired: { type: Boolean, default: false },
  expiresAt: { type: Date },
  
  // Metadata
  locale: { type: String, default: 'en' },
  metadata: { type: Object }
}, { 
  timestamps: true 
});

// ✅ Compound indexes for efficient queries

// For weekly digest retrieval
NotificationDigestSchema.index({ 
  owner: 1, 
  'digestPeriod.year': 1, 
  'digestPeriod.weekNumber': 1
}, { unique: true, name: 'owner_year_week_unique' });

// For pending digests
NotificationDigestSchema.index({ 
  deliveryStatus: 1, 
  scheduledFor: 1,
  owner: 1
});

// For user digest history
NotificationDigestSchema.index({ 
  owner: 1, 
  createdAt: -1,
  deliveryStatus: 1
});

// Static method for generating idempotency key
NotificationDigestSchema.statics.generateIdempotencyKey = function(ownerId, year, weekNumber) {
  return `${ownerId}::${year}::W${weekNumber}`;
};

// Static method for getting week number
NotificationDigestSchema.statics.getWeekNumber = function(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

module.exports = mongoose.model('NotificationDigest', NotificationDigestSchema);

