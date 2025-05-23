const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Treatment', 'Vaccine'],
        required: true
    },
    message: {
        type: String,
        required: true
    },
    severity: {
        type: String,
        enum: ['medium', 'high'],
        default: 'medium'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index to improve query performance
NotificationSchema.index({ owner: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema); 