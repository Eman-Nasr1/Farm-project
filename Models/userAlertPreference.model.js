// Models/userAlertPreference.model.js
const mongoose = require('mongoose');

const ChannelPreferenceSchema = new mongoose.Schema({
  channel: { 
    type: String, 
    enum: ['app', 'email', 'sms', 'push'], 
    required: true 
  },
  enabled: { type: Boolean, default: true },
  
  // Email specific
  emailAddress: { 
    type: String,
    validate: {
      validator: function (v) {
        // لو القناة Email ومفعلة لازم إيميل صحيح
        return (
          !this.enabled ||
          !this.channel ||
          this.channel !== 'email' ||
          (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        );
      },
      message: 'Valid email is required when email channel is enabled'
    }
  },
  
  // SMS specific
  phoneNumber: { type: String },
  
  // Frequency control
  frequency: { 
    type: String, 
    enum: ['realtime', 'hourly', 'daily', 'weekly', 'never'], 
    default: 'realtime'
  },
  
  // Batching
  batchNotifications: { type: Boolean, default: false },
  batchSize: { type: Number, default: 10 },
  batchInterval: { type: Number, default: 3600 }, // seconds
}, { _id: false });

const DAYS_ENUM = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const QuietHoursSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  startTime: { type: String, default: '22:00' }, // Format: HH:mm
  endTime:   { type: String, default: '08:00' },
  timezone:  { type: String, default: 'UTC' },
  // نخلي days Array مظبوط + enum على العناصر + default على الحقل
  days: { 
    type: [String],
    enum: DAYS_ENUM,
    default: DAYS_ENUM
  },
  // Override quiet hours for critical notifications
  allowCritical: { type: Boolean, default: true }
}, { _id: false });

const SeverityPreferenceSchema = new mongoose.Schema({
  low: { type: Boolean, default: true },
  medium: { type: Boolean, default: true },
  high: { type: Boolean, default: true },
  critical: { type: Boolean, default: true }
}, { _id: false });

const CategoryPreferenceSchema = new mongoose.Schema({
  medical: { type: Boolean, default: true },
  routine: { type: Boolean, default: true },
  urgent: { type: Boolean, default: true },
  maintenance: { type: Boolean, default: true },
  health: { type: Boolean, default: true },
  administrative: { type: Boolean, default: true }
}, { _id: false });

const TypePreferenceSchema = new mongoose.Schema({
  Treatment:    { type: Boolean, default: true },
  Vaccine:      { type: Boolean, default: true },
  VaccineDose:  { type: Boolean, default: true },
  Weight:       { type: Boolean, default: true },
  Mating:       { type: Boolean, default: true },
  Breeding:     { type: Boolean, default: true },
  Weaning:      { type: Boolean, default: true },
  MedicalAlert: { type: Boolean, default: true },
  Feed:         { type: Boolean, default: true },
  General:      { type: Boolean, default: true }
}, { _id: false });

const DigestPreferenceSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  frequency: { 
    type: String, 
    enum: ['daily', 'weekly', 'never'], 
    default: 'weekly' 
  },
  digestDay: { 
    type: String, 
    enum: DAYS_ENUM,
    default: 'monday'
  },
  digestTime: { type: String, default: '09:00' }, // Format: HH:mm
  timezone: { type: String, default: 'UTC' },
  
  // What to include in digest
  includeBySeverity: SeverityPreferenceSchema,
  includeByCategory: CategoryPreferenceSchema,
  includeByType: TypePreferenceSchema,
  
  // Formatting
  groupByType: { type: Boolean, default: true },
  groupByPriority: { type: Boolean, default: true },
  maxItems: { type: Number, default: 20 },
  includeRead: { type: Boolean, default: false }
}, { _id: false });

const UserAlertPreferenceSchema = new mongoose.Schema({
  // One preference per user (one-to-one)
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true,
    index: true
  },
  
  // Channels configuration
  channels: [ChannelPreferenceSchema],
  
  // Default notification settings
  defaultEnabled: { type: Boolean, default: true },
  
  // Severity preferences
  severityPreferences: {
    type: SeverityPreferenceSchema,
    default: () => ({})
  },
  
  // Category preferences
  categoryPreferences: {
    type: CategoryPreferenceSchema,
    default: () => ({})
  },
  
  // Type preferences
  typePreferences: {
    type: TypePreferenceSchema,
    default: () => ({})
  },
  
  // Quiet hours
  quietHours: {
    type: QuietHoursSchema,
    default: () => ({ enabled: false })
  },
  
  // Digest preferences
  digestPreferences: {
    type: DigestPreferenceSchema,
    default: () => ({})
  },
  
  // Language preference
  language: { 
    type: String, 
    enum: ['en', 'ar'], 
    default: 'en',
    index: true
  },
  
  // Timezone
  timezone: { type: String, default: 'UTC' },
  
  // Notification limits
  limits: {
    maxPerDay: { type: Number, default: 50 },
    maxPerHour: { type: Number, default: 10 },
    suppressionWindow: { type: Number, default: 3600 } // seconds
  },
  
  // Advanced settings
  groupSimilar: { type: Boolean, default: true },
  deduplicate: { type: Boolean, default: true },
  autoMarkRead: { type: Boolean, default: false },
  autoMarkReadAfter: { type: Number, default: 2592000 }, // 30 days in seconds
  
  // Priority routing
  priorityRouting: {
    critical: { type: String, enum: ['app', 'email', 'sms', 'push', 'all'], default: 'all' },
    high:     { type: String, enum: ['app', 'email', 'push'],                default: 'app' },
    medium:   { type: String, enum: ['app', 'email'],                         default: 'app' },
    low:      { type: String, enum: ['app'],                                  default: 'app' }
  },
  
  // Notification history settings
  retentionDays: { type: Number, default: 90 },
  keepReadNotifications: { type: Boolean, default: true },
  
  // Custom filters
  customFilters: [{ 
    name: { type: String },
    enabled: { type: Boolean, default: true },
    conditions: { type: Object }
  }],
  
  // Idempotency for preference updates
  lastPreferenceUpdate: { type: Date },
  version: { type: Number, default: 1 },
  
  // Metadata
  metadata: { type: Object }
}, { 
  timestamps: true 
});

// ✅ Compound indexes

// For user preferences lookup
UserAlertPreferenceSchema.index({ user: 1, lastPreferenceUpdate: -1 });

// Static method for getting default preferences
UserAlertPreferenceSchema.statics.getDefaults = function () {
  return {
    defaultEnabled: true,
    severityPreferences: {
      low: true,
      medium: true,
      high: true,
      critical: true
    },
    categoryPreferences: {
      medical: true,
      routine: true,
      urgent: true,
      maintenance: true,
      health: true,
      administrative: true
    },
    typePreferences: {
      Treatment: true,
      Vaccine: true,
      VaccineDose: true,
      Weight: true,
      Mating: true,
      Breeding: true,
      Weaning: true,
      MedicalAlert: true,
      Feed: true,
      General: true
    },
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      days: DAYS_ENUM,
      allowCritical: true,
      timezone: 'UTC'
    },
    digestPreferences: {
      enabled: true,
      frequency: 'weekly',
      digestDay: 'monday',
      digestTime: '09:00',
      timezone: 'UTC',
      includeBySeverity: {
        low: true,
        medium: true,
        high: true,
        critical: true
      },
      includeByCategory: {
        medical: true,
        routine: true,
        urgent: true,
        maintenance: true,
        health: true,
        administrative: true
      },
      includeByType: {
        Treatment: true,
        Vaccine: true,
        VaccineDose: true,
        Weight: true,
        Mating: true,
        Breeding: true,
        Weaning: true,
        MedicalAlert: true,
        Feed: true,
        General: true
      },
      groupByType: true,
      groupByPriority: true,
      maxItems: 20,
      includeRead: false
    },
    channels: [
      { channel: 'app', enabled: true, frequency: 'realtime' }
    ],
    language: 'en',
    timezone: 'UTC'
  };
};

// Instance method to check if notification should be sent
UserAlertPreferenceSchema.methods.shouldSendNotification = function (severity, type, category, channel) {
  // Check if notifications are enabled
  if (!this.defaultEnabled) return false;
  
  // Check severity preference
  if (this.severityPreferences && this.severityPreferences[severity] === false) return false;
  
  // Check type preference
  if (this.typePreferences && this.typePreferences[type] === false) return false;
  
  // Check category preference
  if (category && this.categoryPreferences && this.categoryPreferences[category] === false) return false;
  
  // Check channel preference
  const channelPref = Array.isArray(this.channels)
    ? this.channels.find(c => c.channel === channel)
    : null;
  if (!channelPref || !channelPref.enabled) return false;
  
  // Check quiet hours
  if (this.quietHours && this.quietHours.enabled) {
    const now = new Date();
    const isInQuietHours = this.isInQuietHours(now, severity === 'critical');
    if (isInQuietHours) return false;
  }
  
  return true;
};

// Instance method to check quiet hours (timezone-aware + overnight support)
UserAlertPreferenceSchema.methods.isInQuietHours = function (date, isCritical) {
  if (!this.quietHours || !this.quietHours.enabled) return false;
  if (isCritical && this.quietHours.allowCritical) return false;

  const tz = this.quietHours.timezone || this.timezone || 'UTC';

  // Helpers
  const parseHHmm = (s) => {
    if (!s || !/^\d{2}:\d{2}$/.test(s)) return null;
    const [H, M] = s.split(':').map(Number);
    return H * 60 + M;
  };

  // نجيب الساعة/الدقيقة واليوم في التايمزون
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour12: false,
    weekday: 'long', hour: '2-digit', minute: '2-digit'
  }).formatToParts(date);

  const get = (type) => parts.find(p => p.type === type)?.value;

  const weekdayLong = (get('weekday') || '').toLowerCase(); // monday..sunday
  const hourStr = get('hour') || '00';
  const minuteStr = get('minute') || '00';
  const nowMin = Number(hourStr) * 60 + Number(minuteStr);

  // قائمة الأيام المفعّلة
  const days = Array.isArray(this.quietHours.days) && this.quietHours.days.length
    ? this.quietHours.days
    : DAYS_ENUM;

  if (!days.includes(weekdayLong)) return false;

  const startMin = parseHHmm(this.quietHours.startTime ?? '22:00');
  const endMin   = parseHHmm(this.quietHours.endTime   ?? '08:00');

  if (startMin == null || endMin == null) return false;

  if (startMin <= endMin) {
    // نافذة داخل نفس اليوم (مثال: 20:00 -> 23:00)
    return nowMin >= startMin && nowMin < endMin;
  } else {
    // نافذة ليلية تعبر منتصف الليل (مثال: 22:00 -> 08:00)
    return (nowMin >= startMin) || (nowMin < endMin);
  }
};

module.exports = mongoose.model('UserAlertPreference', UserAlertPreferenceSchema);
