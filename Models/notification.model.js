// Models/notification.model.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['Treatment','Vaccine','VaccineDose','Weight'], required: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  subtype: { type: String, enum: ['booster','annual'] },
  dueDate: { type: Date },
  message: { type: String, required: true },
  severity:{ type: String, enum:['low','medium','high'], default:'medium' },
  stage:   { type: String, enum:['month','week','expired'], default:'month' },
  isRead:  { type: Boolean, default:false },
  owner:   { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true }
},{ timestamps:true });

// ✅ وزن + جرعات: uniqueness حسب الموعد
NotificationSchema.index(
  { owner:1, type:1, itemId:1, dueDate:1 },
  { unique:true, partialFilterExpression:{ type:{ $in:['VaccineDose','Weight'] }, dueDate:{ $exists:true } }, name: 'owner_type_item_due_unique' }
);

// ✅ علاج/لقاح: واحد لكل عنصر
NotificationSchema.index(
  { owner:1, type:1, itemId:1 },
  { unique:true, partialFilterExpression:{ type:{ $in:['Treatment','Vaccine'] } }, name: 'owner_type_item_unique' }
);
// Models/notification.model.js
NotificationSchema.index({ owner: 1, type: 1, dueDate: 1, stage: 1, severity: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
