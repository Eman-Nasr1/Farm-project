const Animal = require('../Models/animal.model');
const Excluded = require('../Models/excluded.model');
const Mating = require('../Models/mating.model');
const Breeding = require('../Models/breeding.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const mongoose = require('mongoose');

const generateCombinedReport = asyncwrapper(async (req, res, next) => {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { animalType, dateFrom, dateTo } = req.body;

    const fromDate = new Date(dateFrom);
    fromDate.setUTCHours(0, 0, 0, 0);
    const toDate = new Date(dateTo);
    toDate.setUTCHours(23, 59, 59, 999);

    // Generate animal report
    const animalReport = await Animal.aggregate([
        {
            $match: {
                owner: userId,
                animalType: animalType,
                createdAt: { $gte: fromDate, $lte: toDate }
            }
        },
        {
            $group: {
                _id: { gender: '$gender', animalType: '$animalType' },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                gender: '$_id.gender',
                animalType: '$_id.animalType',
                count: 1
            }
        }
    ]);
    
   

    // Generate excluded animal report
    const excludedReport = await Excluded.aggregate([
        {
            $match: {
                owner: userId,
                excludedType: { $in: ["death", "sweep", "sale"] },
                Date: { $gte: fromDate, $lte: toDate }
            }
        },
        {
            $lookup: {
                from: 'animals',
                localField: 'animalId',
                foreignField: '_id',
                as: 'animal'
            }
        },
        {
            $unwind: { path: '$animal', preserveNullAndEmptyArrays: true }
        },
        {
            $match: { 'animal.animalType': animalType }
        },
        {
            $group: {
                _id: { excludedType: '$excludedType', animalType: '$animal.animalType', gender: '$animal.gender' },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                _id: 0,
                excludedType: '$_id.excludedType',
                animalType: '$_id.animalType',
                gender: '$_id.gender',
                count: 1
            }
        }
    ]);

    // Generate mating report for positive sonar results
    const positiveSonarCount = await Mating.aggregate([
        {
            $match: {
                owner: userId,
                sonarRsult: 'positive',
                matingDate: { $gte: fromDate, $lte: toDate }
            }
        },
        {
            $lookup: {
                from: 'animals',
                localField: 'animalId',
                foreignField: '_id',
                as: 'animal'
            }
        },
        {
            $unwind: { path: '$animal', preserveNullAndEmptyArrays: true }
        },
        {
            $match: { 'animal.animalType': animalType }
        },
        {
            $count: 'positiveSonarCount'
        }
    ]);

    // Generate birth entries report from Breeding model
    const birthEntriesReport = await Breeding.aggregate([
        {
            $match: {
                owner: userId,
                createdAt: { $gte: fromDate, $lte: toDate }
            }
        },
        {
            $lookup: {
                from: 'animals',
                localField: 'animalId',
                foreignField: '_id',
                as: 'animal'
            }
        },
        {
            $unwind: { path: '$animal', preserveNullAndEmptyArrays: true }
        },
        {
            $match: { 'animal.animalType': animalType }
        },
        {
            $unwind: '$birthEntries'
        },
        {
            $match: { 'birthEntries.createdAt': { $gte: fromDate, $lte: toDate } }
        },
        {
            $group: {
                _id: null,
                totalBirthEntries: { $sum: 1 },
                totalMales: { $sum: { $cond: [{ $eq: ['$birthEntries.gender', 'male'] }, 1, 0] } },
                totalFemales: { $sum: { $cond: [{ $eq: ['$birthEntries.gender', 'female'] }, 1, 0] } }
            }
        }
    ]);

    // Extract values from birthEntriesReport
    const { totalBirthEntries = 0, totalMales = 0, totalFemales = 0 } = birthEntriesReport[0] || {};

    return res.json({
        status: 'success',
        data: {
            animalReport,
            excludedReport,
            pregnantAnimal: positiveSonarCount[0]?.positiveSonarCount || 0,
            birthEntries: {
                totalBirthEntries,
                totalMales,
                totalFemales
            }
        }
    });
});

module.exports = {
    generateCombinedReport
};
