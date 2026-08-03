const mongoose = require('mongoose');

const courseLectureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    lectureUrl: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: [
        'zoom',
        'google_meet',
        'microsoft_teams',
        'recorded_video',
        'google_drive',
        'other',
      ],
      default: 'other',
    },
    lectureDate: {
      type: Date,
      default: null,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

courseLectureSchema.index({ isPublished: 1, lectureDate: 1 });

module.exports = mongoose.model('CourseLecture', courseLectureSchema);
