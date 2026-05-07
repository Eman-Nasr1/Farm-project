const mongoose = require('mongoose');

const SyncTombstoneSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  collectionName: {
    type: String,
    required: true,
    enum: ['animals', 'weights', 'vaccines'],
    index: true,
  },
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  deletedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  versionKey: false,
});

SyncTombstoneSchema.index({ owner: 1, collectionName: 1, deletedAt: -1 });

module.exports = mongoose.model('SyncTombstone', SyncTombstoneSchema);
