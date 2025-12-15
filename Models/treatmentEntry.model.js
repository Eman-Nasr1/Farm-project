const mongoose = require("mongoose");

const doseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  taken: { type: Boolean, default: false }
});

const treatmentPlanSchema = new mongoose.Schema({
  treatmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Treatment",
    required: true,
  },
  volumePerAnimal: {
    type: Number,
    required: true, //volume per dose
  },
  numberOfDoses: {
    type: Number,
    required: true,
  },
  doses: [doseSchema]  // detailed tracking
});

const treatmentEntrySchema = new mongoose.Schema({
  locationShed: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LocationShed',
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tagId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
  },

  // First examination
  eyeCheck:  { type: String },
  rectalCheck:  { type: String },
  respiratoryCheck: { type: String },
  rumenCheck:  { type: String },
  // Diagnosis
  diagnosis: { type: String },
  temperature: { type: Number },

  // Treatments
  treatments: [treatmentPlanSchema],

}, { timestamps: true });

const TreatmentEntry = mongoose.model("TreatmentEntry", treatmentEntrySchema);

module.exports = TreatmentEntry;
