const Breeding = require('../Models/breeding.model');
const Vaccine = require('../Models/vaccine.model');
const Weight = require('../Models/weight.model');
const Mating = require('../Models/mating.model');
const User = require('../Models/user.model');
const Feed = require('../Models/feed.model');
const ShedEntry = require('../Models/shedFeed.model');
const Treatment = require('../Models/treatment.model');
const TreatmentEntry = require('../Models/treatmentEntry.model');
const Excluded = require('../Models/excluded.model');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');  
const fs = require('fs');  
const path = require('path');  
const pdf = require('html-pdf');


const generatePDF = (data) => {
    const lang = data.lang || 'en';
    const isArabic = lang === 'ar';
    const isBreedingType = data.registrationType === 'breeding';

    // Currency configuration based on country
    const currencyConfig = {
        'SA': { code: 'SAR', symbol: 'ريال', locale: 'ar-SA' },
        'AE': { code: 'AED', symbol: 'درهم', locale: 'ar-AE' },
        'EG': { code: 'EGP', symbol: 'جنيه', locale: 'ar-EG' },
        'KW': { code: 'KWD', symbol: 'دينار', locale: 'ar-KW' },
        'QA': { code: 'QAR', symbol: 'ريال', locale: 'ar-QA' },
        'OM': { code: 'OMR', symbol: 'ريال', locale: 'ar-OM' },
        'BH': { code: 'BHD', symbol: 'دينار', locale: 'ar-BH' },
        'US': { code: 'USD', symbol: '$', locale: 'en-US' }
    };

    const defaultCurrency = currencyConfig['SA']; // Default to Saudi Riyal
    const currency = currencyConfig[data.country] || defaultCurrency;

    // Format currency function
    const formatCurrency = (amount) => {
        if (!amount) return '0';
        return new Intl.NumberFormat(currency.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Format number function (for non-currency numbers)
    const formatNumber = (number) => {
        if (!number) return '0';
        return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(number);
    };

    // Translations object
    const translations = {
        en: {
            title: 'Daily Report',
            date: 'Date',
            animalType: 'Animal Type',
            currency: currency.code,
            metrics: {
                vaccineCount: 'Vaccine Log Count',
                weightCount: 'Weight Count',
                matingCount: 'Mating Count',
                breedingCount: 'Breeding Count',
                birthEntries: 'Total Birth Entries',
                males: 'Total Males',
                females: 'Total Females',
                weanings: 'Total Weanings',
                feedCount: 'Feed Entries',
                feedConsumption: 'Feed Consumption (kg)',
                feedCost: 'Feed Cost',
                treatmentCount: 'Treatment Entries',
                treatmentConsumption: 'Treatment Usage (ml)',
                treatmentCost: 'Treatment Cost',
                excludedCount: 'Excluded Animals',
                excludedByType: {
                    death: 'Deaths',
                    sale: 'Sales',
                    sweep: 'Sweeps'
                },
                totalSales: 'Total Sales Value',
                totalCosts: 'Total Costs'
            }
        },
        ar: {
            title: 'التقرير اليومي',
            date: 'التاريخ',
            animalType: 'نوع الحيوان',
            currency: isArabic ? currency.symbol : currency.code,
            metrics: {
                vaccineCount: 'عدد سجلات التطعيم',
                weightCount: 'عدد سجلات الوزن',
                matingCount: 'عدد التزاوج',
                breedingCount: 'عدد التربية',
                birthEntries: 'إجمالي المواليد',
                males: 'إجمالي الذكور',
                females: 'إجمالي الإناث',
                weanings: 'إجمالي الفطام',
                feedCount: 'عدد سجلات التغذية',
                feedConsumption: 'استهلاك العلف (كجم)',
                feedCost: 'تكلفة العلف',
                treatmentCount: 'عدد سجلات العلاج',
                treatmentConsumption: 'استخدام العلاج (مل)',
                treatmentCost: 'تكلفة العلاج',
                excludedCount: 'الحيوانات المستبعدة',
                excludedByType: {
                    death: 'النفوق',
                    sale: 'البيع',
                    sweep: 'الكنس'
                },
                totalSales: 'إجمالي قيمة المبيعات',
                totalCosts: 'إجمالي التكاليف'
            }
        }
    };

    const t = translations[lang];

    // Helper function to format currency display
    const displayCurrency = (amount) => {
        const formattedAmount = formatCurrency(amount);
        return isArabic ? `${formattedAmount} ${t.currency}` : `${t.currency} ${formattedAmount}`;
    };

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="${lang}" dir="${isArabic ? 'rtl' : 'ltr'}">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t.title}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                font-size: 14px;
                direction: ${isArabic ? 'rtl' : 'ltr'};
                text-align: ${isArabic ? 'right' : 'left'};
            }
            .report-title {
                text-align: center;
                font-size: 24px;
                margin-bottom: 20px;
                font-weight: bold;
                color: #2c3e50;
                padding: 10px;
                border-bottom: 2px solid #21763e;
            }
            .report-subtitle {
                text-align: center;
                font-size: 16px;
                color: #7f8c8d;
                margin-bottom: 30px;
            }
            .section {
                margin-bottom: 20px;
            }
            .section-title {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 10px;
                padding-bottom: 5px;
                border-bottom: 1px solid #eee;
            }
            .table {
                width: 100%;
                margin: 0 auto;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .table td, .table th {
                padding: 12px;
                text-align: ${isArabic ? 'right' : 'left'};
                border: 1px solid #ddd;
            }
            .table th {
                background-color: #21763e;
                color: white;
                font-weight: bold;
            }
            .table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .table tr:hover {
                background-color: #f5f5f5;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #7f8c8d;
                font-size: 12px;
            }
            .currency {
                font-family: ${isArabic ? 'Arial, sans-serif' : 'monospace'};
                white-space: nowrap;
            }
        </style>
    </head>
    <body>
        <h1 class="report-title">${t.title}</h1>
        <div class="report-subtitle">
            <p><strong>${t.date}:</strong> ${data.date || "N/A"}</p>
            <p><strong>${t.animalType}:</strong> ${Array.isArray(data.animalType) ? data.animalType.join(', ') : data.animalType || "N/A"}</p>
        </div>

        <div class="section">
            <table class="table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t.metrics.vaccineCount}</td>
                        <td>${formatNumber(data.vaccineLogCount)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.weightCount}</td>
                        <td>${formatNumber(data.weightCount)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.feedCount}</td>
                        <td>${formatNumber(data.feedCount)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.feedConsumption}</td>
                        <td>${formatNumber(data.feedConsumption)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.feedCost}</td>
                        <td class="currency">${displayCurrency(data.feedCost)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.treatmentCount}</td>
                        <td>${formatNumber(data.treatmentCount)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.treatmentConsumption}</td>
                        <td>${formatNumber(data.treatmentConsumption)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.treatmentCost}</td>
                        <td class="currency">${displayCurrency(data.treatmentCost)}</td>
                    </tr>
                    ${isBreedingType ? `
                    <tr>
                        <td>${t.metrics.matingCount}</td>
                        <td>${formatNumber(data.matingCount)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.breedingCount}</td>
                        <td>${formatNumber(data.breedingCount)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.birthEntries}</td>
                        <td>${formatNumber(data.totalBirthEntries)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.males}</td>
                        <td>${formatNumber(data.totalMales)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.females}</td>
                        <td>${formatNumber(data.totalFemales)}</td>
                    </tr>
                    <tr>
                        <td>${t.metrics.weanings}</td>
                        <td>${formatNumber(data.totalWeanings)}</td>
                    </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">${t.metrics.excludedCount}</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Count</th>
                        ${data.excludedFinancials ? '<th>Value</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${t.metrics.excludedByType.death}</td>
                        <td>${formatNumber(data.excludedByType?.death)}</td>
                        ${data.excludedFinancials ? `<td class="currency">${displayCurrency(data.excludedFinancials?.death)}</td>` : ''}
                    </tr>
                    <tr>
                        <td>${t.metrics.excludedByType.sale}</td>
                        <td>${formatNumber(data.excludedByType?.sale)}</td>
                        ${data.excludedFinancials ? `<td class="currency">${displayCurrency(data.excludedFinancials?.sale)}</td>` : ''}
                    </tr>
                    <tr>
                        <td>${t.metrics.excludedByType.sweep}</td>
                        <td>${formatNumber(data.excludedByType?.sweep)}</td>
                        ${data.excludedFinancials ? `<td class="currency">${displayCurrency(data.excludedFinancials?.sweep)}</td>` : ''}
                    </tr>
                    ${data.excludedFinancials ? `
                    <tr>
                        <td colspan="2"><strong>${t.metrics.totalSales}</strong></td>
                        <td class="currency"><strong>${displayCurrency(data.totalSalesValue)}</strong></td>
                    </tr>
                    ` : ''}
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>${t.date}: ${new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}</p>
        </div>
    </body>
    </html>
    `;

    const filePath = path.join(__dirname, `daily_report_${lang}.pdf`);
    const options = {
        format: 'A4',
        orientation: 'portrait',
        border: {
            top: "20px",
            right: "20px",
            bottom: "20px",
            left: "20px"
        }
    };

    return new Promise((resolve, reject) => {
        pdf.create(htmlContent, options).toFile(filePath, (err, res) => {
            if (err) reject(err);
            else resolve(filePath);
        });
    });
};

const generatePDFReport = asyncwrapper(async (req, res, next) => {
    try {
        // Use tenantId for tenant isolation (works for both owner and employee)
        const tenantId = req.user?.tenantId || req.user?.id;
        if (!tenantId) {
          return res.status(401).json({ status: 'fail', message: 'Unauthorized' });
        }
        const userId = new mongoose.Types.ObjectId(tenantId);
        let animalType = req.query.animalType;
        const lang = req.query.lang || 'en';

        // Get user's registration type and country
        const user = await User.findById(userId).select('registerationType country');
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Ensure animalType is an array
        if (!Array.isArray(animalType)) {
            animalType = [animalType];
        }

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(today.getUTCDate() + 1);

        // Base queries that are always executed
        const baseQueries = [
            // Vaccine logs
            Vaccine.aggregate([
                { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
                { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType } } },
                { $count: 'totalVaccineCount' }
            ]),
            // Weight logs
            Weight.aggregate([
                { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
                { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType } } },
                { $count: 'totalWeightCount' }
            ]),
            // Feed entries
            ShedEntry.aggregate([
                { $match: { owner: userId, date: { $gte: today, $lt: tomorrow } } },
                { $count: 'totalFeedCount' }
            ]),
            // Feed consumption
            ShedEntry.aggregate([
                { $match: { owner: userId, date: { $gte: today, $lt: tomorrow } } },
                { $unwind: '$feeds' },
                { $group: { _id: null, totalConsumption: { $sum: '$feeds.quantity' } } }
            ]),
            // Treatment entries
            TreatmentEntry.aggregate([
                { $match: { owner: userId, date: { $gte: today, $lt: tomorrow } } },
                { $count: 'totalTreatmentCount' }
            ]),
            // Treatment consumption
            TreatmentEntry.aggregate([
                { $match: { owner: userId, date: { $gte: today, $lt: tomorrow } } },
                { $unwind: '$treatments' },
                { $group: { _id: null, totalConsumption: { $sum: '$treatments.volume' } } }
            ]),
            // Excluded animals
            Excluded.aggregate([
                { $match: { owner: userId, Date: { $gte: today, $lt: tomorrow } } },
                { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType } } },
                { 
                    $group: { 
                        _id: '$excludedType',
                        count: { $sum: 1 }
                    }
                }
            ])
        ];

        // Breeding-related queries that are only executed for breeding type
        const breedingQueries = user.registerationType === 'breeding' ? [
            // Breeding count
            Breeding.aggregate([
                { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
                { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType } } },
                { $count: 'totalBreedingCount' }
            ]),
            // Mating count
            Mating.aggregate([
                { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
                { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType } } },
                { $count: 'totalMatingCount' }
            ]),
            // Birth entries
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
            // Weaning count
            Breeding.aggregate([
                { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
                { $unwind: '$birthEntries' },
                { $lookup: { from: 'animals', localField: 'birthEntries.animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType }, 'birthEntries.expectedWeaningDate': { $gte: today, $lt: tomorrow } } },
                { $count: 'totalWeanings' }
            ])
        ] : [
            // Empty placeholders for breeding data when user is fattening type
            Promise.resolve([]),
            Promise.resolve([]),
            Promise.resolve([]),
            Promise.resolve([])
        ];

        // Execute all queries
        const [
            vaccineLogCount,
            weightCount,
            feedCount,
            feedConsumption,
            treatmentCount,
            treatmentConsumption,
            excludedCounts,
            breedingCount,
            matingCount,
            birthEntriesCount,
            weaningCount
        ] = await Promise.all([...baseQueries, ...breedingQueries]);

        // Process excluded animals data
        const excludedByType = {
            death: 0,
            sale: 0,
            sweep: 0
        };
        excludedCounts.forEach(item => {
            if (excludedByType.hasOwnProperty(item._id)) {
                excludedByType[item._id] = item.count;
            }
        });

        // Process birth entries data based on registration type
        const {
            totalBirthEntries = 0,
            totalMales = 0,
            totalFemales = 0
        } = user.registerationType === 'breeding' ? (birthEntriesCount[0] || {}) : {};

        const totalWeanings = user.registerationType === 'breeding' ? (weaningCount[0]?.totalWeanings || 0) : 0;

        // Prepare data for the PDF
        const reportData = {
            date: today.toISOString().split('T')[0],
            animalType: animalType,
            lang: lang,
            country: user.country || 'SA', // Default to Saudi Arabia if not specified
            registrationType: user.registerationType,
            vaccineLogCount: vaccineLogCount[0]?.totalVaccineCount || 0,
            weightCount: weightCount[0]?.totalWeightCount || 0,
            feedCount: feedCount[0]?.totalFeedCount || 0,
            feedConsumption: feedConsumption[0]?.totalConsumption || 0,
            feedCost: feedConsumption[0]?.totalCost || 0,
            treatmentCount: treatmentCount[0]?.totalTreatmentCount || 0,
            treatmentConsumption: treatmentConsumption[0]?.totalConsumption || 0,
            treatmentCost: treatmentConsumption[0]?.totalCost || 0,
            excludedByType,
            excludedFinancials: {
                death: excludedFinancials[0]?.deathValue || 0,
                sale: excludedFinancials[0]?.saleValue || 0,
                sweep: excludedFinancials[0]?.sweepValue || 0
            },
            totalSalesValue: excludedFinancials[0]?.totalSalesValue || 0,
            ...(user.registerationType === 'breeding' && {
                matingCount: matingCount[0]?.totalMatingCount || 0,
                breedingCount: breedingCount[0]?.totalBreedingCount || 0,
                totalBirthEntries,
                totalMales,
                totalFemales,
                totalWeanings
            })
        };

        // Generate the PDF report
        const pdfPath = await generatePDF(reportData);

        // Send the PDF file as a response
        res.download(pdfPath, `daily_report_${lang}.pdf`, (err) => {
            if (err) {
                console.error("Error downloading the PDF: ", err);
                res.status(500).json({ status: 'error', message: 'Failed to download PDF.' });
            } else {
                fs.unlink(pdfPath, (err) => {
                    if (err) console.error("Error deleting the PDF file: ", err);
                });
            }
        });
    } catch (error) {
        console.error("Error in generatePDFReport: ", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});


const generateDailyyyCounts = asyncwrapper(async (req, res, next) => {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    let animalType = req.query.animalType;

    // Get user's registration type
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({
            status: 'error',
            message: 'User not found'
        });
    }

    // Ensure animalType is an array
    if (!Array.isArray(animalType)) {
        animalType = [animalType];
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);

    // Base queries
    const [vaccineLogCount, weightCount] = await Promise.all([
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
        ])
    ]);

    // Breeding-specific queries
    let breedingData = {};
    if (user.registerationType === 'breeding') {
        const [breedingCount, matingCount, birthEntriesCount, weaningCount] = await Promise.all([
            Breeding.aggregate([
                { $match: { owner: userId, createdAt: { $gte: today, $lt: tomorrow } } },
                { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
                { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
                { $match: { 'animal.animalType': { $in: animalType } } },
                { $count: 'totalBreedingCount' }
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

        breedingData = {
            matingCount: matingCount[0]?.totalMatingCount || 0,
            breedingCount: breedingCount[0]?.totalBreedingCount || 0,
            totalBirthEntries,
            totalMales,
            totalFemales,
            totalWeanings: weaningCount[0]?.totalWeanings || 0
        };
    }

    return res.json({
        status: httpstatustext.SUCCESS,
        data: {
            date: today.toISOString().split('T')[0],
            vaccineLogCount: vaccineLogCount[0]?.totalVaccineCount || 0,
            weightCount: weightCount[0]?.totalWeightCount || 0,
            registrationType: user.registerationType,
            ...breedingData
        }
    });
});

module.exports = {  
    generateDailyyyCounts,
    generatePDFReport
};  