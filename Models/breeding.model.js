const mongoose = require('mongoose');

const birthEntrySchema = new mongoose.Schema({
    tagId: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: true
    },
    birthweight: {
        type: Number
    },
    ageAtWeaningDays: { type: Number, min: 1, max: 90 },

    // جديد: كل كام يوم هيوزن لحد الفطام
    weightIntervalDays: { type: Number, min: 1 },
  
    // جديد: هنخزن فيه جدول الأوزان الدورية
    plannedWeights: [{ type: Date }],
    isEmailSent: { type: Boolean, default: false },

    createdAt: {  
        type: Date,  
        default: Date.now  // Automatically set to the current date/time when created  
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const breedingSchema = new mongoose.Schema({
    tagId: {
        type: String,
        required: true
    },
    deliveryState: {
        type: String,
        enum: ['normal', 'difficult', 'assisted', 'caesarean','طبيعية','طبيعيه ب مساعده','متعسرة','قيصرية'],
    },
    deliveryDate: {
        type: Date,
        required: true
    },
    motheringAbility: {
        type: String,
        enum: ['good', 'bad','medium','متوسطة','جيدة','غير جيدة'],
        required: true
    },
    milking :{
        type: String,
        enum: ['no milk', 'one teat','two teat','واحد حلمة','اثنين حلمة',' لا يوجد حليب'],
        required: true
    },
    numberOfBirths: {
        type: Number
    },
    birthEntries: [birthEntrySchema],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    animalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Animal'
    },
    createdAt: {  
        type: Date,  
        default: Date.now  // Automatically set to the current date/time when created  
    }
});


module.exports = mongoose.model('Breeding', breedingSchema);