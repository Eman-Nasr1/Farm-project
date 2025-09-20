const mongoose = require('mongoose');

const ImpersonationSessionSchema = new mongoose.Schema({
  jti: { type: String, unique: true, index: true }, // معرف فريد للسيشن
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  byAdmin:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// يمسح تلقائي بعد انتهاء الصلاحية
ImpersonationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ImpersonationSession', ImpersonationSessionSchema);
