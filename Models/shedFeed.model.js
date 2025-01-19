const mongoose = require("mongoose");

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
  feeds: [
    {
      feedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feed", // Reference to the Feed model
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

const ShedEntry = mongoose.model("ShedEntry", shedEntrySchema);

module.exports = ShedEntry;
