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
const pdf = require('html-pdf');


const generatePDF = (data) => {  
    const htmlContent = `  
    <!DOCTYPE html>  
    <html lang="en">  
    <head>  
        <meta charset="UTF-8">  
        <meta name="viewport" content="width=device-width, initial-scale=1.0">  
        <title>Daily Report</title>  
        <style>  
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 14px; }   
            .report-title { text-align: center; font-size: 16px; margin-bottom: 20px; font-weight: bold; }  
            .table { width: 100%; margin: 0 auto; border-collapse: collapse; }  
            .table td, .table th { padding: 8px; text-align: left; border: 1px solid #000; }  
            .table th { background-color: #f2f2f2; font-weight: bold; }  
        </style>  
    </head>  
    <body>  
        <h2 class="report-title">Daily Report</h2>  
        <p><strong>Date:</strong> ${data.date || "N/A"}</p>  
        <p><strong>Animal Type:</strong> ${Array.isArray(data.animalType) ? data.animalType.join(', ') : data.animalType || "N/A"}</p>  
        
        <table class="table">  
            <thead>  
                <tr>  
                    <th>Metric</th>  
                    <th>Count</th>  
                </tr>  
            </thead>  
            <tbody>  
                <tr><td>Vaccine Log Count</td><td>${data.vaccineLogCount || 0}</td></tr>  
                <tr><td>Weight Count</td><td>${data.weightCount || 0}</td></tr>  
                <tr><td>Mating Count</td><td>${data.matingCount || 0}</td></tr>  
                <tr><td>Breeding Count</td><td>${data.breedingCount || 0}</td></tr>  
                <tr><td>Total Birth Entries</td><td>${data.totalBirthEntries || 0}</td></tr>  
                <tr><td>Total Males</td><td>${data.totalMales || 0}</td></tr>  
                <tr><td>Total Females</td><td>${data.totalFemales || 0}</td></tr>  
                <tr><td>Total Weanings</td><td>${data.totalWeanings || 0}</td></tr>  
            </tbody>  
        </table>  
    </body>  
    </html>  
    `;  

  //  console.log(htmlContent); // Debugging HTML output  

    const filePath = path.join(__dirname, 'report.pdf');  
    const options = { format: 'A4', orientation: 'portrait' };  

    return new Promise((resolve, reject) => {  
        pdf.create(htmlContent, options).toFile(filePath, (err, res) => {  
            if (err) reject(err);  
            else resolve(filePath);  
        });  
    });  
};

const generatePDFReport = async (req, res, next) => {  
    const userId = new mongoose.Types.ObjectId(req.user.id);  
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
        animalType: animalType.join(', '),
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
    const pdfPath = await generatePDF(reportData);  

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
    const userId = new mongoose.Types.ObjectId(req.user.id);   
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