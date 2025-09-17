const mongoose = require('mongoose');

const AccountingSchema = new mongoose.Schema({
  owner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:    { type: String, enum: ['income','expense'], required: true, index: true }, // دخل/مصروف
  source:  { type: String, enum: ['feed','treatment','vaccine','purchase','sale','other'], required: true, index: true },
  amount:  { type: Number, required: true },          // القيمة بالجنيه
  category:{ type: String },                          // تصنيف اختياري (نوع العلف/اسم العلاج..)
  date:    { type: Date, default: Date.now, index: true },
  meta:    { type: Object },                          // أي بيانات إضافية (tagId, animalId..)
}, { timestamps: true });

// فهارس إضافية
AccountingSchema.index({ owner:1, date:1 });
AccountingSchema.index({ owner:1, source:1, date:1 });

module.exports = mongoose.model('Accounting', AccountingSchema);
