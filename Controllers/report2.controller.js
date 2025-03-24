const Animal = require('../Models/animal.model');
const Excluded = require('../Models/excluded.model');
const Mating = require('../Models/mating.model');
const Breeding = require('../Models/breeding.model');
const Feed = require('../Models/feed.model'); // Path to the Feed model  
const ShedEntry = require('../Models/shedFeed.model'); // Path to the ShedEntry model  
const Treatment = require('../Models/treatment.model'); // Path to the Treatment model  
const TreatmentEntry = require('../Models/treatmentEntry.model'); 
const asyncwrapper = require('../middleware/asyncwrapper');
const mongoose = require('mongoose');
const PdfPrinter = require('pdfmake');
const pdf = require('html-pdf');
const path = require('path');

const generateCombinedReport = asyncwrapper(async (req, res, next) => {
    const userId = new mongoose.Types.ObjectId(req.user.id);
   
    const { animalType, dateFrom, dateTo } = req.query;

    const fromDate = new Date(dateFrom);
    fromDate.setUTCHours(0, 0, 0, 0);
    const toDate = new Date(dateTo);
    toDate.setUTCHours(23, 59, 59, 999);

     // Calculate feed consumption  
     const feedConsumption = await ShedEntry.aggregate([  
        {  
            $match: {  
                owner: userId,  
                date: { $gte: fromDate, $lte: toDate }  
            }  
        },  
        {  
            $unwind: '$feeds' // Unwind the feeds array  
        },  
        {  
            $lookup: {  
                from: 'feeds',  
                localField: 'feeds.feedId',  
                foreignField: '_id',  
                as: 'feedDetails'  
            }  
        },  
        {  
            $unwind: '$feedDetails' // Unwind feed details  
        },  
        {  
            $group: {  
                _id: '$feedDetails.name', // Group by feed name  
                totalConsumed: { $sum: '$feeds.quantity' } // Sum the quantities consumed  
            }  
        },  
        {  
            $project: {  
                _id: 0,  
                feedName: '$_id',  
                totalConsumed: 1  
            }  
        }  
    ]);  

    // Fetch remaining stock for feeds  
    const remainingFeedStock = await Feed.aggregate([  
        {  
            $match: {  
                owner: userId  
            }  
        }  
    ]);  

    // Calculate treatment consumption  
    const treatmentConsumption = await TreatmentEntry.aggregate([  
        {  
            $match: {  
                owner: userId,  
                date: { $gte: fromDate, $lte: toDate }  
            }  
        },  
        {  
            $unwind: '$treatments' // Unwind the treatments array  
        },  
        {  
            $lookup: {  
                from: 'treatments',  
                localField: 'treatments.treatmentId',  
                foreignField: '_id',  
                as: 'treatmentDetails'  
            }  
        },  
        {  
            $unwind: '$treatmentDetails' // Unwind treatment details  
        },  
        {  
            $group: {  
                _id: '$treatmentDetails.name', // Group by treatment name  
                totalConsumed: { $sum: '$treatments.volume' } // Sum the volumes consumed  
            }  
        },  
        {  
            $project: {  
                _id: 0,  
                treatmentName: '$_id',  
                totalConsumed: 1  
            }  
        }  
    ]);  

    // Fetch remaining stock for treatments  
    const remainingTreatmentStock = await Treatment.aggregate([  
        {  
            $match: {  
                owner: userId  
            }  
        }  
    ]);  

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
   
const positiveSonarCount = await Mating.aggregate([  
    {  
        $match: {  
            owner: userId,  
            sonarRsult: 'positive',  
            matingDate: { $gte: fromDate, $lte: toDate },  
            expectedDeliveryDate: { $gt: new Date() } // Check if expectedDeliveryDate is greater than today  
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

    return {
        status: 'success',
        data: {
            animalReport,
            excludedReport,
            pregnantAnimal: positiveSonarCount[0]?.positiveSonarCount || 0,
            birthEntries: {
                totalBirthEntries,
                totalMales,
                totalFemales
            },
            feedConsumption,  
            remainingFeedStock,  
            treatmentConsumption,  
            remainingTreatmentStock 
        }
    };
});

const generateCombinedPDFReport = async (req, res, next) => {  
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const { animalType, dateFrom, dateTo } = req.query;

        const fromDate = new Date(dateFrom);
        fromDate.setUTCHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setUTCHours(23, 59, 59, 999);

        // Fetch feed consumption  
        const feedConsumption = await ShedEntry.aggregate([  
            {  
                $match: {  
                    owner: userId,  
                    date: { $gte: fromDate, $lte: toDate }  
                }  
            },  
            {  
                $unwind: '$feeds' // Unwind the feeds array  
            },  
            {  
                $lookup: {  
                    from: 'feeds',  
                    localField: 'feeds.feedId',  
                    foreignField: '_id',  
                    as: 'feedDetails'  
                }  
            },  
            {  
                $unwind: '$feedDetails' // Unwind feed details  
            },  
            {  
                $group: {  
                    _id: '$feedDetails.name', // Group by feed name  
                    totalConsumed: { $sum: '$feeds.quantity' } // Sum the quantities consumed  
                }  
            },  
            {  
                $project: {  
                    _id: 0,  
                    feedName: '$_id',  
                    totalConsumed: 1  
                }  
            }  
        ]);  

        // Fetch remaining stock for feeds  
        const remainingFeedStock = await Feed.aggregate([  
            {  
                $match: {  
                    owner: userId  
                }  
            }  
        ]);  

        // Fetch treatment consumption  
        const treatmentConsumption = await TreatmentEntry.aggregate([  
            {  
                $match: {  
                    owner: userId,  
                    date: { $gte: fromDate, $lte: toDate }  
                }  
            },  
            {  
                $unwind: '$treatments' // Unwind the treatments array  
            },  
            {  
                $lookup: {  
                    from: 'treatments',  
                    localField: 'treatments.treatmentId',  
                    foreignField: '_id',  
                    as: 'treatmentDetails'  
                }  
            },  
            {  
                $unwind: '$treatmentDetails' // Unwind treatment details  
            },  
            {  
                $group: {  
                    _id: '$treatmentDetails.name', // Group by treatment name  
                    totalConsumed: { $sum: '$treatments.volume' } // Sum the volumes consumed  
                }  
            },  
            {  
                $project: {  
                    _id: 0,  
                    treatmentName: '$_id',  
                    totalConsumed: 1  
                }  
            }  
        ]);  

        // Fetch remaining stock for treatments  
        const remainingTreatmentStock = await Treatment.aggregate([  
            {  
                $match: {  
                    owner: userId  
                }  
            }  
        ]);  

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

        // Calculate positive sonar count
        const positiveSonarCount = await Mating.aggregate([  
            {  
                $match: {  
                    owner: userId,  
                    sonarRsult: 'positive',  
                    matingDate: { $gte: fromDate, $lte: toDate },  
                    expectedDeliveryDate: { $gt: new Date() } // Check if expectedDeliveryDate is greater than today  
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

        // Generate birth entries report
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

        // Prepare data for the PDF
        const reportData = {
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            animalType: req.query.animalType,
            animalReport,
            excludedReport,
            feedConsumption,  
            remainingFeedStock,  
            treatmentConsumption,  
            remainingTreatmentStock,
            birthEntries: {
                totalBirthEntries,
                totalMales,
                totalFemales
            },
            pregnantAnimal: positiveSonarCount[0]?.positiveSonarCount || 0
        };

        // Generate the PDF report
        const pdfPath = await generatePDF(reportData);

        // Send the PDF file as a response
        res.download(pdfPath, 'combined_report.pdf', (err) => {  
            if (err) {  
                console.error("Error downloading the PDF: ", err);  
                res.status(500).json({ status: 'error', message: 'Failed to download PDF.' });  
            } else {  
                // Optionally, delete the PDF after sending it  
                fs.unlink(pdfPath, (err) => {  
                    if (err) console.error("Error deleting the PDF file: ", err);  
                });  
            }  
        });  
    } catch (error) {
        console.error("Error in generateCombinedPDFReport: ", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
// Function to generate the PDF
const generatePDF = (data) => {  
    const htmlContent = `  
    <!DOCTYPE html>  
    <html lang="en">  
    <head>  
        <meta charset="UTF-8">  
        <meta name="viewport" content="width=device-width, initial-scale=1.0">  
        <title>Combined Report</title>  
        <style>  
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 14px; }   
            .report-title { text-align: center; font-size: 16px; margin-bottom: 20px; font-weight: bold; }  
            .table { width: 100%; margin: 0 auto; border-collapse: collapse; }  
            .table td, .table th { padding: 8px; text-align: left; border: 1px solid #000; }  
            .table th { background-color: #f2f2f2; font-weight: bold; }  
            .container { width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; }  
        </style>  
    </head>  
    <body>  
    <div class="container">
        <h2 class="report-title">Combined Report</h2>  
        <p><strong>Date From:</strong> ${data.dateFrom || "N/A"}</p>  
        <p><strong>Date To:</strong> ${data.dateTo || "N/A"}</p>  
        <p><strong>Animal Type:</strong> ${data.animalType || "N/A"}</p>  
        
        <h3>Animal Report</h3>
        <table class="table">  
            <thead>  
                <tr>  
                    <th>Gender</th>  
                    <th>Animal Type</th>  
                    <th>Count</th>  
                </tr>  
            </thead>  
            <tbody>  
                ${data.animalReport.map(animal => `
                    <tr>
                        <td>${animal.gender || "N/A"}</td>
                        <td>${animal.animalType || "N/A"}</td>
                        <td>${animal.count || 0}</td>
                    </tr>
                `).join('')}
            </tbody>  
        </table>  

        <h3>Excluded Report</h3>
        <table class="table">  
            <thead>  
                <tr>  
                    <th>Excluded Type</th>  
                    <th>Animal Type</th>  
                    <th>Gender</th>  
                    <th>Count</th>  
                </tr>  
            </thead>  
            <tbody>  
                ${data.excludedReport.map(excluded => `
                    <tr>
                        <td>${excluded.excludedType || "N/A"}</td>
                        <td>${excluded.animalType || "N/A"}</td>
                        <td>${excluded.gender || "N/A"}</td>
                        <td>${excluded.count || 0}</td>
                    </tr>
                `).join('')}
            </tbody>  
        </table>  

        <h3>Feed Consumption</h3>
        <table class="table">  
            <thead>  
                <tr>  
                    <th>Feed Name</th>  
                    <th>Total Consumed</th>  
                </tr>  
            </thead>  
            <tbody>  
                ${data.feedConsumption.map(feed => `
                    <tr>
                        <td>${feed.feedName || "N/A"}</td>
                        <td>${feed.totalConsumed || 0}</td>
                    </tr>
                `).join('')}
            </tbody>  
        </table>  

        <h3>Treatment Consumption</h3>
        <table class="table">  
            <thead>  
                <tr>  
                    <th>Treatment Name</th>  
                    <th>Total Consumed</th>  
                </tr>  
            </thead>  
            <tbody>  
                ${data.treatmentConsumption.map(treatment => `
                    <tr>
                        <td>${treatment.treatmentName || "N/A"}</td>
                        <td>${treatment.totalConsumed || 0}</td>
                    </tr>
                `).join('')}
            </tbody>  
        </table>  

        <h3>Birth Entries</h3>
        <table class="table">  
            <thead>  
                <tr>  
                    <th>Total Birth Entries</th>  
                    <th>Total Males</th>  
                    <th>Total Females</th>  
                </tr>  
            </thead>  
            <tbody>  
                <tr>
                    <td>${data.birthEntries.totalBirthEntries || 0}</td>
                    <td>${data.birthEntries.totalMales || 0}</td>
                    <td>${data.birthEntries.totalFemales || 0}</td>
                </tr>
            </tbody>  
        </table>  

        <h3>Pregnant Animals</h3>
        <p>Total Pregnant Animals: ${data.pregnantAnimal || 0}</p>
        </div>
    </body>  
    </html>  
    `;  

    const filePath = path.join(__dirname, 'combined_report.pdf');  
    const options = { format: 'A4', orientation: 'portrait' };  

    return new Promise((resolve, reject) => {  
        pdf.create(htmlContent, options).toFile(filePath, (err, res) => {  
            if (err) reject(err);  
            else resolve(filePath);  
        });  
    });  
};
module.exports = {
    generateCombinedReport,
    generateCombinedPDFReport 
};
