const Breeding = require('../Models/breeding.model');
const Vaccine = require('../Models/vaccine.model');
const Weight = require('../Models/weight.model');
const Mating = require('../Models/mating.model');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');  
const fs = require('fs');  
const path = require('path');  



const generatePDF = (data) => {  
    const doc = new PDFDocument();  
    const filePath = path.join(__dirname, 'report.pdf'); // Specify the path where you want to save the PDF  

    // Pipe the PDF into a file  
    doc.pipe(fs.createWriteStream(filePath));  

    // Add content to the PDF  
    doc.fontSize(25).text('Daily Report', { align: 'center' });  
    doc.moveDown();  

    doc.fontSize(12).text(`Date: ${data.date}`);  
    doc.moveDown();  
    
    doc.text(`Vaccine Log Count: ${data.vaccineLogCount}`);  
    doc.text(`Weight Count: ${data.weightCount}`);  
    doc.text(`Mating Count: ${data.matingCount}`);  
    doc.text(`Breeding Count: ${data.breedingCount}`);  
    doc.text(`Total Birth Entries: ${data.totalBirthEntries}`);  
    doc.text(`Total Males: ${data.totalMales}`);  
    doc.text(`Total Females: ${data.totalFemales}`);  
    doc.text(`Total Weanings: ${data.totalWeanings}`);  

    // Finalize the PDF and end the stream  
    doc.end();  

    return filePath; // Return the file path for further use  
};  

const generatePDFReport = async (req, res, next) => {  
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
            { $match: { 'animal.animalType': { $in: animalType } } },  
            { $count: 'totalBreedingCount' }  
        ]),  
        Vaccine.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } },  
            { $count: 'totalVaccineCount' }  
        ]),  
        Weight.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } },  
            { $count: 'totalWeightCount' }  
        ]),  
        Mating.aggregate([  
            { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },  
            { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },  
            { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },  
            { $match: { 'animal.animalType': { $in: animalType } } },  
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

    // Prepare data for the PDF  
    const reportData = {  
        date: today.toISOString().split('T')[0],  
        animalType,
        vaccineLogCount: vaccineLogCount[0]?.totalVaccineCount || 0,  
        weightCount: weightCount[0]?.totalWeightCount || 0,  
        matingCount: matingCount[0]?.totalMatingCount || 0,  
        breedingCount: breedingCount[0]?.totalBreedingCount || 0,  
        totalBirthEntries,  
        totalMales,  
        totalFemales,  
        totalWeanings  
    };  

    // Generate the PDF report  
    const pdfPath = generatePDF(reportData);  

    // Send the PDF file as a response  
    res.download(pdfPath, 'daily_report.pdf', (err) => {  
        if (err) {  
            console.error("Error downloading the PDF: ", err);  
            res.status(err.status).end();  
        } else {  
            // Optionally, you can delete the PDF after sending it  
            fs.unlink(pdfPath, (err) => {  
                if (err) console.error("Error deleting the PDF file: ", err);  
            });  
        }  
    });  
};  


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
    generateDailyyyCounts,
    generatePDFReport
};  