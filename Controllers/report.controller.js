const Breeding = require('../Models/breeding.model');
const Vaccine = require('../Models/vaccine.model');
const Weight = require('../Models/weight.model');
const Mating = require('../Models/mating.model');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const mongoose = require('mongoose');



const generateDailyyyCounts = asyncwrapper(async (req, res, next) => {  
    const userId = new mongoose.Types.ObjectId(req.userId);   
    let animalType = req.query.animalType;  
   
    // Ensure animalType is an array  
    if (!Array.isArray(animalType)) {  
        animalType = [animalType]; // Wrap it in an array if it's not already  
    }  
        
    const today = new Date();  
    today.setUTCHours(0, 0, 0, 0);  
    const tomorrow = new Date(today);  
    tomorrow.setUTCDate(today.getUTCDate() + 1);  

    const [breedingCount, vaccineLogCount, weightCount, matingCount, birthEntriesCount, weaningCount] = await Promise.all([  
        Breeding.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
             { $match: { 'animal.animalType': { $in: animalType } } }, // Use animalType as an array  
            { $count: 'totalBreedingCount' }  
        ]),  
        Vaccine.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } }, // Use animalType as an array  
            { $count: 'totalVaccineCount' }  
        ]),  
        Weight.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } }, // Use animalType as an array  
            { $count: 'totalWeightCount' }  
        ]),  
        Mating.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } }, // Use animalType as an array  
            { $count: 'totalMatingCount' }  
        ]),  
        Breeding.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } },  

            { $unwind: '$birthEntries' },  
              
             
            { $match: { 'birthEntries.createdAt': { $gte: today, $lt: tomorrow } } },  
            {  
                $group: {  
                    _id: null,  
                    totalBirthEntries: { $sum: 1 },  
                    totalMales: { $sum: { $cond: [{ $eq: ['$birthEntries.gender', 'male'] }, 1, 0] } },  
                    totalFemales: { $sum: { $cond: [{ $eq: ['$birthEntries.gender', 'female'] }, 1, 0] } }  
                }  
            }  
        ]),  
        Breeding.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $unwind: '$birthEntries' },  
            { $lookup: { from: 'animals', localField: 'birthEntries.animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType }, 'birthEntries.expectedWeaningDate': { $gte: today, $lt: tomorrow } } },  
            { $count: 'totalWeanings' }  
        ])  
    ]);  

    const {  
        totalBirthEntries = 0,  
        totalMales = 0,  
        totalFemales = 0  
    } = birthEntriesCount[0] || {};  

    const totalWeanings = weaningCount[0]?.totalWeanings || 0;  

    return res.json({  
        status: httpstatustext.SUCCESS,  
        data: {  
            date: today.toISOString().split('T')[0],  
            vaccineLogCount: vaccineLogCount[0]?.totalVaccineCount || 0,  
            weightCount: weightCount[0]?.totalWeightCount || 0,  
            matingCount: matingCount[0]?.totalMatingCount || 0, 
            breedingCount: breedingCount[0]?.totalBreedingCount || 0, 
            totalBirthEntries,  
            totalMales,  
            totalFemales,  
            totalWeanings  
        }  
    });  
});  

module.exports = {  
    generateDailyyyCounts  
};