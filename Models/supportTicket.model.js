const mongoose = require('mongoose');

const SupportTicketSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['technical', 'billing', 'feature_request', 'bug_report', 'general', 'other'],
    default: 'general',
    required: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
    required: true,
    index: true,
  },
  replies: [{
    message: {
      type: String,
      required: true,
    },
    repliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    repliedByName: {
      type: String,
      required: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  closedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
SupportTicketSchema.index({ type: 1, status: 1 });

// Update updatedAt before saving
SupportTicketSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Auto-update resolvedAt/closedAt based on status
SupportTicketSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === 'resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
    if (this.status !== 'resolved' && this.status !== 'closed') {
      this.resolvedAt = null;
      this.closedAt = null;
    }
  }
  next();
});

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);

