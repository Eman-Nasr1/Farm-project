const mongoose = require('mongoose');
const User = require('../Models/user.model');
const Breeding = require('../Models/breeding.model');
const Mating = require('../Models/mating.model');
const Weight = require('../Models/weight.model');
const Vaccine=require('../Models/vaccine.model');
const Animalschema = new mongoose.Schema({
    tagId: {
        type: String,
        required: true
    },
    breed: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Breed'
    },
    animalType: {
        type: String,
        enum: ["goat", "sheep"],
        required: true
    },
    birthDate: {
        type: Date
    },
    ageInDays: {
        type: Number
    },
    purchaseDate: {
        type: Date
    },
    purchasePrice: {
        type: Number
    },
    traderName: {
        type: String
    },
    motherId: {
        type: String
    },
    fatherId: {
        type: String
    },
    locationShed: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'LocationShed'
    },
    marketValue: {
        type: Number,
        default: 0
    },
    gender: {
        type: String,
        enum: ['male', 'female'],
        required: true
    },
    female_Condition: {
        type: String
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
       
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Compound index to ensure unique tagId per user  
Animalschema.index({ owner: 1, tagId: 1 }, { unique: true });  

// Calculate age in days on save
Animalschema.pre('save', function (next) {
    if (this.birthDate) {
        const birthDate = new Date(this.birthDate);
        const currentDate = new Date();
        const ageInMilliseconds = currentDate - birthDate;
        this.ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
    }
    next();
});


Animalschema.virtual('age').get(function () {
    if (!this.birthDate) return null;

    const now = new Date();
    const ageInMilliseconds = now - new Date(this.birthDate);
    const ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));

    const years = Math.floor(ageInDays / 365);
    const months = Math.floor((ageInDays % 365) / 30);
    const days = ageInDays % 30;

    return { years, months, days };
});

// Pre-update hook to update ageInDays when birthDate is updated
Animalschema.pre('findOneAndUpdate', function (next) {
    const update = this.getUpdate();

    // Check if birthDate is being updated
    if (update.$set && update.$set.birthDate) {
        const birthDate = new Date(update.$set.birthDate);
        const currentDate = new Date();
        const ageInMilliseconds = currentDate - birthDate;
        update.$set.ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
    }

    next();
});

// Cascade delete related documents in other collections
// Animalschema.pre('remove', async function (next) {
//     try {
//         // Delete related records in other collections (Breeding, Mating, Weight, etc.)
//         await Breeding.deleteMany({ animalId: this._id });
//         await Mating.deleteMany({ animalId: this._id });
//         await Weight.deleteMany({ animalId: this._id });
//         await Vaccine.deleteMany({ animalId: this._id });

//         // If you want to delete records from any other related collections, add them here

//         next();
//     } catch (err) {
//         next(err);
//     }
// });
Animalschema.pre('deleteOne', { document: true, query: false }, async function(next) {
    const animalId = this._id;
  
    try {
      // Delete all related data in other collections
      await mongoose.model('Breeding').deleteMany({ animalId: animalId });
      await mongoose.model('Mating').deleteMany({ animalId: animalId });
      await mongoose.model('Vaccine').deleteMany({ animalId: animalId });
      await mongoose.model('Weight').deleteMany({ animalId: animalId });
      await mongoose.model('Treatment').deleteMany({ animalId: animalId });
      // Add more related models as needed
      
      next();
    } catch (err) {
      next(err);
    }
  });



module.exports = mongoose.model('Animal', Animalschema);
