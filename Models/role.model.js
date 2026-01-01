const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true, // Tenant ID (Owner)
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  key: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  permissionKeys: {
    type: [String],
    default: [],
    required: true,
  },
  isSystem: {
    type: Boolean,
    default: false, // System roles (Owner, Manager, Employee) cannot be deleted
  },
  description: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Compound unique index: role key must be unique per tenant
RoleSchema.index({ user: 1, key: 1 }, { unique: true });

// Index for faster queries
RoleSchema.index({ user: 1 });

module.exports = mongoose.model('Role', RoleSchema);
