// Models/notification.model.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Treatment', 'Vaccine'],
    required: true
  },
  // هيمسك الـ _id بتاع العنصر (علاج/لقاح) عشان نمنع التكرار
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['medium', 'high'], // لو عايزة تضيفي 'low' مافيش مانع
    default: 'medium'
  },
  // المرحلة حسب المدة المتبقية: month/week/expired
  stage: {
    type: String,
    enum: ['month', 'week', 'expired'],
    default: 'month'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, { timestamps: true });

// اندكس لمنع التكرار لنفس (المالك/النوع/العنصر)
NotificationSchema.index(
  { owner: 1, type: 1, itemId: 1 },
  { unique: true, partialFilterExpression: { itemId: { $exists: true } } }
);

module.exports = mongoose.model('Notification', NotificationSchema);
