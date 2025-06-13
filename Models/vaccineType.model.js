const mongoose = require('mongoose');

const vaccineTypeSchema = new mongoose.Schema({
  
    englishName: {
        type: String,
        required: true,
        trim: true
    },
    arabicName: {
        type: String,
        required: true,
        trim: true
    },
    arabicDiseaseType: {
        type: String,
        required: true,
        trim: true
    },
    englishDiseaseType: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,  // URL or path to the image
        default: null
    },
  
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('VaccineType', vaccineTypeSchema); 