// Models/movementLocation.model.js
const mongoose = require('mongoose');
const MovementLocationSchema = new mongoose.Schema({
  animalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true },
  fromLocationShed: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationShed' },
  toLocationShed: { type: mongoose.Schema.Types.ObjectId, ref: 'LocationShed', required: true },
  movedAt: { type: Date, default: Date.now },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});
module.exports = mongoose.model('MovementLocation', MovementLocationSchema);
