const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema({
  feedName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
});

const shedEntrySchema = new mongoose.Schema({
  locationShed: {
    type: String,
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  feeds: {
    type: [feedSchema],
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const ShedEntry = mongoose.model("ShedEntry", shedEntrySchema);

module.exports = ShedEntry;
