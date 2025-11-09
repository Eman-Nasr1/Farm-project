// Models/notification.model.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  // Basic notification info
  type: { 
    type: String, 
    enum: ['Treatment', 'Vaccine', 'VaccineDose', 'Weight', 'Mating', 'Breeding', 'Weaning', 'MedicalAlert', 'Feed', 'General'], 
    required: true,
    index: true
  },
  subtype: { 
    type: String, 
    enum: ['booster', 'annual', 'due', 'overdue', 'reminder'],
    index: true
  },
  
  // Item reference
  itemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true
  },
  itemTagId: { type: String }, // Display tag ID for quick reference
  itemName: { type: String }, // Item name for display
  
  // Timing
  dueDate: { 
    type: Date,
    index: true
  },
  remindedAt: { type: Date }, // Last time notification was sent
  expiresAt: { type: Date }, // When notification should no longer be shown
  
  // Content
  message: { 
    type: String, 
    required: true 
  },
  messageAr: { type: String }, // Arabic translation
  messageEn: { type: String }, // English translation
  title: { type: String },
  details: { type: Object }, // Additional context data
  
  // Priority & categorization
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'medium',
    index: true
  },
  stage: { 
    type: String, 
    enum: ['month', 'week', 'day', 'expired', 'completed'], 
    default: 'month',
    index: true
  },
  category: { 
    type: String, 
    enum: ['medical', 'routine', 'urgent', 'maintenance', 'health', 'administrative'],
    default: 'routine',
    index: true
  },
  
  // Status & delivery
  isRead: { 
    type: Boolean, 
    default: false,
    index: true
  },
  isDelivered: { 
    type: Boolean, 
    default: false 
  },
  deliveredAt: { type: Date },
  deliveryChannels: [{ 
    type: String, 
    enum: ['app', 'email', 'sms', 'push', 'digest']
  }],
  
  // Owner & linking
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  // Digest grouping
  digestId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'NotificationDigest'
  },
  includeInDigest: { 
    type: Boolean, 
    default: true 
  },
  
  // Idempotency & deduplication
  idempotencyKey: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true 
  },
  sourceEvent: { type: String }, // What triggered this notification
  relatedNotifications: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Notification' 
  }],
  
  // Action tracking
  actionTaken: { type: Boolean, default: false },
  actionTakenAt: { type: Date },
  actionNote: { type: String },
  
  // Analytics
  viewCount: { type: Number, default: 0 },
  lastViewedAt: { type: Date },
  
  // Metadata
  metadata: { type: Object },
  tags: [{ type: String }]
}, { 
  timestamps: true 
});

// ✅ Compound indexes for efficient queries

// For unread notifications per user
NotificationSchema.index({ owner: 1, isRead: 1, createdAt: -1 });

// For notifications due soon
NotificationSchema.index({ owner: 1, dueDate: 1, stage: 1, severity: 1 });

// For severity-based queries
NotificationSchema.index({ owner: 1, severity: 1, isRead: 1 });

// For type-based filtering
NotificationSchema.index({ owner: 1, type: 1, category: 1 });

// For delivery status
NotificationSchema.index({ owner: 1, isDelivered: 1, deliveredAt: -1 });

// For digest grouping
NotificationSchema.index({ digestId: 1, createdAt: -1 });

// For active notifications (not expired)
NotificationSchema.index({ owner: 1, expiresAt: 1, isRead: 1 });

// ✅ Deduplication indexes
// For vaccine doses and weights with due dates
// For vaccine doses and weights with due dates (include subtype to avoid collisions)
NotificationSchema.index(
  { owner: 1, type: 1, itemId: 1, subtype: 1, dueDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: { $in: ['VaccineDose', 'Weight'] },
      dueDate: { $exists: true }
    },
    name: 'owner_type_item_subtype_due_unique'
  }
);


// For treatments and vaccines (one per item)
NotificationSchema.index(
  { owner: 1, type: 1, itemId: 1 },
  { 
    unique: true, 
    partialFilterExpression: { 
      type: { $in: ['Treatment', 'Vaccine'] } 
    }, 
    name: 'owner_type_item_unique' 
  }
);

// For idempotency
NotificationSchema.index(
  { owner: 1, idempotencyKey: 1 },
  { 
    unique: true, 
    partialFilterExpression: { idempotencyKey: { $exists: true } },
    name: 'owner_idempotency_unique'
  }
);

// Static method for creating idempotency key
NotificationSchema.statics.generateIdempotencyKey = function(type, ownerId, itemId, dueDate, subtype) {
  const parts = [type, ownerId, itemId];
  if (dueDate) parts.push(dueDate.toISOString().split('T')[0]);
  if (subtype) parts.push(subtype);
  return parts.join('::');
};

module.exports = mongoose.model('Notification', NotificationSchema);
