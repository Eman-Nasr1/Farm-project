const Animal = require('../Models/animal.model');
const Excluded = require('../Models/excluded.model');
const Mating = require('../Models/mating.model');
const Breeding = require('../Models/breeding.model');
const Feed = require('../Models/feed.model'); // Path to the Feed model  
const ShedEntry = require('../Models/shedFeed.model'); // Path to the ShedEntry model  
const Treatment = require('../Models/treatment.model'); // Path to the Treatment model  
const TreatmentEntry = require('../Models/treatmentEntry.model');
const Vaccine=require('../Models/vaccine.model');
const VaccineEntry=require('../Models/vaccineEntry.model'); 
const User = require('../Models/user.model'); // Add User model
const asyncwrapper = require('../middleware/asyncwrapper');
const mongoose = require('mongoose');
const PdfPrinter = require('pdfmake');
const pdf = require('html-pdf');
const path = require('path');
const fs = require('fs');

const generateCombinedReport = asyncwrapper(async (req, res, next) => {
    try {
        // Validate user and parameters
        if (!req.user?.id) {
            return res.status(401).json({
                status: 'error',
                message: 'Unauthorized - User not authenticated'
            });
        }

        const userId = new mongoose.Types.ObjectId(req.user.id);
        const { animalType, dateFrom, dateTo } = req.query;

        // Get user's registration type
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        // Validate required parameters
        if (!animalType || !dateFrom || !dateTo) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters: animalType, dateFrom, and dateTo are required'
            });
        }

        // Validate and parse dates
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid date format. Please use YYYY-MM-DD format'
            });
        }

        fromDate.setUTCHours(0, 0, 0, 0);
        toDate.setUTCHours(23, 59, 59, 999);

        // Base queries that are always executed
        const baseQueries = [
            // Feed Consumption
            ShedEntry.aggregate([  
                {  
                    $match: {  
                        owner: userId,  
                        date: { $gte: fromDate, $lte: toDate }  
                    }  
                },  
                {  
                    $unwind: '$feeds' 
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
                    $unwind: '$feedDetails' 
                },  
                {  
                    $group: {  
                        _id: '$feedDetails.name',
                        totalConsumed: { $sum: '$feeds.quantity' } 
                    }  
                },  
                {  
                    $project: {  
                        _id: 0,  
                        feedName: '$_id',  
                        totalConsumed: 1  
                    }  
                }  
            ]),
            
            // Remaining Feed Stock
            Feed.aggregate([  
                {  
                    $match: {  
                        owner: userId  
                    }  
                }  
            ]),
            
            // Treatment Consumption
            TreatmentEntry.aggregate([  
                {  
                    $match: {  
                        owner: userId,  
                        date: { $gte: fromDate, $lte: toDate }  
                    }  
                },  
                {  
                    $unwind: '$treatments'
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
                    $unwind: '$treatmentDetails'
                },  
                {  
                    $group: {  
                        _id: '$treatmentDetails.name',
                        totalConsumed: { $sum: '$treatments.volume' } 
                    }  
                },  
                {  
                    $project: {  
                        _id: 0,  
                        treatmentName: '$_id',  
                        totalConsumed: 1  
                    }  
                }  
            ]),
            
            // Remaining Treatment Stock
            Treatment.aggregate([  
                {  
                    $match: {  
                        owner: userId  
                    }  
                }  
            ]),
            
            // Vaccine Consumption - FIXED: Corrected method name to aggregate()
            VaccineEntry.aggregate([
                {
                    $match: {
                        owner: userId,
                        date: { $gte: fromDate, $lte: toDate }
                    }
                },
                {
                    $lookup: {
                        from: 'vaccines',
                        localField: 'Vaccine',  // Changed from 'vaccine' to match your schema
                        foreignField: '_id',
                        as: 'vaccineDetails'
                    }
                },
                {
                    $unwind: '$vaccineDetails'
                },
                {
                    $group: {
                        _id: '$vaccineDetails.vaccineName',
                        totalConsumed: { $sum: 1 } // Count each vaccine entry as one dose
                    }
                },
                {
                    $project: {
                        _id: 0,
                        vaccineName: '$_id',
                        totalConsumed: 1
                    }
                }
            ]),
            
            // Remaining Vaccine Stock - FIXED: Corrected method name to aggregate()
            Vaccine.aggregate([
                {
                    $match: {
                        owner: userId
                    }
                },
                {
                    $project: {
                        vaccineName: 1,
                        'stock.bottles': 1,
                        'stock.dosesPerBottle': 1,
                        'stock.totalDoses': 1,
                        'pricing.bottlePrice': 1,
                        'pricing.dosePrice': 1
                    }
                }
            ]),
            
            // Animal Report
            Animal.aggregate([
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
            ]),
            
            // Excluded Report
            Excluded.aggregate([
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
            ])
        ];

        // Breeding-related queries that are only executed for breeding type
        const breedingQueries = user.registerationType === 'breeding' ? [
            // Positive Sonar Count
            Mating.aggregate([  
                {  
                    $match: {  
                        owner: userId,  
                        sonarRsult: 'positive',  
                        matingDate: { $gte: fromDate, $lte: toDate },  
                        expectedDeliveryDate: { $gt: new Date() }
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
            ]),
            
            // Birth Entries Report
            Breeding.aggregate([
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
            ])
        ] : [
            // Placeholder values for breeding-type data when user is fattening type
            Promise.resolve([]), // Empty array for positiveSonarCount
            Promise.resolve([])  // Empty array for birthEntriesReport
        ];

        // Execute all queries
        const [
            feedConsumption,
            remainingFeedStock,
            treatmentConsumption,
            remainingTreatmentStock,
            vaccineConsumption,
            remainingVaccineStock,
            animalReport,
            excludedReport,
            positiveSonarCount,
            birthEntriesReport
        ] = await Promise.all([...baseQueries, ...breedingQueries]);

        // Process birth entries data based on registration type
        const birthEntriesData = user.registerationType === 'breeding' ? 
            (birthEntriesReport[0] || {
                totalBirthEntries: 0,
                totalMales: 0,
                totalFemales: 0
            }) : {
                totalBirthEntries: 0,
                totalMales: 0,
                totalFemales: 0
            };

        // Calculate financial totals
        const totalFeedCost = feedConsumption.reduce((sum, feed) => sum + (feed.totalCost || 0), 0);
        const totalTreatmentCost = treatmentConsumption.reduce((sum, t) => sum + (t.totalCost || 0), 0);
        const totalVaccineCost = vaccineConsumption.reduce((sum, v) => sum + (v.totalCost || 0), 0);

        // Send successful response
        res.status(200).json({
            status: 'success',
            data: {
                animalReport,
                excludedReport,
                ...(user.registerationType === 'breeding' && {
                    pregnantAnimal: positiveSonarCount[0]?.positiveSonarCount || 0,
                    birthEntries: birthEntriesData
                }),
                feedConsumption,
                remainingFeedStock,
                treatmentConsumption,
                remainingTreatmentStock,
                vaccineConsumption,
                remainingVaccineStock,
                totalFeedCost,
                totalTreatmentCost,
                totalVaccineCost
            },
            meta: {
                dateFrom: dateFrom,
                dateTo: dateTo,
                animalType: animalType,
                registrationType: user.registerationType,
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error("Error generating combined report:", error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

const generateCombinedPDFReport = asyncwrapper(async (req, res, next) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const { animalType, dateFrom, dateTo, lang = 'en' } = req.query;

        // Get user's registration type and country
        const user = await User.findById(userId).select('registerationType country');
        if (!user) {
            return res.status(404).json({
                status: 'error',
                message: 'User not found'
            });
        }

        const fromDate = new Date(dateFrom);
        fromDate.setUTCHours(0, 0, 0, 0);
        const toDate = new Date(dateTo);
        toDate.setUTCHours(23, 59, 59, 999);

        // Execute all queries
        const [
            animalReport,
            excludedReport,
            feedConsumption,
            remainingFeedStock,
            treatmentConsumption,
            remainingTreatmentStock,
            vaccineConsumption,
            remainingVaccineStock,
            positiveSonarCount,
            birthEntriesReport
        ] = await Promise.all([
            // Animal Report
            Animal.aggregate([
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
            ]),
            // Excluded Report with financial data
            Excluded.aggregate([
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
                        count: { $sum: 1 },
                        value: { $sum: '$price' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        excludedType: '$_id.excludedType',
                        animalType: '$_id.animalType',
                        gender: '$_id.gender',
                        count: 1,
                        value: 1
                    }
                }
            ]),
            // Feed consumption with costs
            ShedEntry.aggregate([
                {
                    $match: {
                        owner: userId,
                        date: { $gte: fromDate, $lte: toDate }
                    }
                },
                {
                    $unwind: '$feeds'
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
                    $unwind: '$feedDetails'
                },
                {
                    $group: {
                        _id: '$feedDetails.name',
                        totalConsumed: { $sum: '$feeds.quantity' },
                        totalCost: { $sum: { $multiply: ['$feeds.quantity', '$feedDetails.price'] } }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        feedName: '$_id',
                        totalConsumed: 1,
                        totalCost: 1
                    }
                }
            ]),
            // Remaining feed stock
            Feed.aggregate([
                {
                    $match: {
                        owner: userId
                    }
                },
                {
                    $project: {
                        name: 1,
                        quantity: 1,
                        price: 1
                    }
                }
            ]),
            // Treatment consumption with costs
            TreatmentEntry.aggregate([
                {
                    $match: {
                        owner: userId,
                        date: { $gte: fromDate, $lte: toDate }
                    }
                },
                {
                    $unwind: '$treatments'
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
                    $unwind: '$treatmentDetails'
                },
                {
                    $group: {
                        _id: '$treatmentDetails.name',
                        totalConsumed: { $sum: '$treatments.volume' },
                        totalCost: { $sum: { $multiply: ['$treatments.volume', '$treatmentDetails.pricePerMl'] } }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        treatmentName: '$_id',
                        totalConsumed: 1,
                        totalCost: 1
                    }
                }
            ]),
            // Remaining treatment stock
            Treatment.aggregate([
                {
                    $match: {
                        owner: userId
                    }
                },
                {
                    $project: {
                        name: 1,
                        volume: 1,
                        pricePerMl: 1
                    }
                }
            ]),
            // Vaccine consumption with costs
            VaccineEntry.aggregate([
                {
                    $match: {
                        owner: userId,
                        date: { $gte: fromDate, $lte: toDate }
                    }
                },
                {
                    $lookup: {
                        from: 'vaccines',
                        localField: 'Vaccine',
                        foreignField: '_id',
                        as: 'vaccineDetails'
                    }
                },
                {
                    $unwind: '$vaccineDetails'
                },
                {
                    $group: {
                        _id: '$vaccineDetails.vaccineName',
                        totalConsumed: { $sum: 1 },
                        totalCost: { $sum: '$vaccineDetails.pricing.dosePrice' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        vaccineName: '$_id',
                        totalConsumed: 1,
                        totalCost: 1
                    }
                }
            ]),
            // Remaining vaccine stock
            Vaccine.aggregate([
                {
                    $match: {
                        owner: userId
                    }
                },
                {
                    $project: {
                        vaccineName: 1,
                        'stock.bottles': 1,
                        'stock.dosesPerBottle': 1,
                        'stock.totalDoses': 1,
                        'pricing.bottlePrice': 1,
                        'pricing.dosePrice': 1
                    }
                }
            ]),
            // Breeding specific queries
            ...(user.registerationType === 'breeding' ? [
                // Positive Sonar Count
                Mating.aggregate([
                    {
                        $match: {
                            owner: userId,
                            sonarRsult: 'positive',
                            matingDate: { $gte: fromDate, $lte: toDate },
                            expectedDeliveryDate: { $gt: new Date() }
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
                ]),
                // Birth Entries Report
                Breeding.aggregate([
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
                ])
            ] : [Promise.resolve([]), Promise.resolve([])])
        ]);

        // Process birth entries data based on registration type
        const birthEntriesData = user.registerationType === 'breeding' ? 
            (birthEntriesReport[0] || {
                totalBirthEntries: 0,
                totalMales: 0,
                totalFemales: 0
            }) : {
                totalBirthEntries: 0,
                totalMales: 0,
                totalFemales: 0
            };

        // Calculate financial totals
        const totalFeedCost = feedConsumption.reduce((sum, feed) => sum + (feed.totalCost || 0), 0);
        const totalTreatmentCost = treatmentConsumption.reduce((sum, t) => sum + (t.totalCost || 0), 0);
        const totalVaccineCost = vaccineConsumption.reduce((sum, v) => sum + (v.totalCost || 0), 0);

        // Prepare data for the PDF
        const reportData = {
            dateFrom: dateFrom,
            dateTo: dateTo,
            animalType: animalType,
            lang: lang,
            country: user.country || 'SA', // Default to Saudi Arabia if not specified
            registrationType: user.registerationType,
            animalReport,
            excludedReport,
            feedConsumption,
            remainingFeedStock,
            treatmentConsumption,
            remainingTreatmentStock,
            vaccineConsumption,
            remainingVaccineStock,
            totalFeedCost,
            totalTreatmentCost,
            totalVaccineCost,
            ...(user.registerationType === 'breeding' && {
                pregnantAnimal: positiveSonarCount[0]?.positiveSonarCount || 0,
                birthEntries: birthEntriesData
            })
        };

        // Generate the PDF report
        const pdfPath = await generatePDF(reportData);

        // Send the PDF file as a response
        res.download(pdfPath, `farm_report_${lang}.pdf`, (err) => {
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
        console.error("Error generating combined PDF report:", error);
        res.status(500).json({
            status: 'error',
            message: 'An error occurred while generating the report',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Function to generate the PDF
const generatePDF = (data) => {  
    const lang = data.lang || 'en';
    const isArabic = lang === 'ar';
    const isBreedingType = data.registrationType === 'breeding';
    
    // Translations object
    const translations = {
        en: {
            title: 'Farm Management Report',
            period: 'Period',
            animalType: 'Animal Type',
            stats: {
                overview: 'Overview Statistics',
                totalAnimals: 'Total Animals',
                pregnantAnimals: 'Pregnant Animals',
                totalBirths: 'Total Births',
                totalExcluded: 'Total Excluded'
            },
            distribution: {
                title: 'Animal Distribution',
                gender: 'Gender',
                type: 'Animal Type',
                count: 'Count'
            },
            births: {
                title: 'Birth Records',
                category: 'Category',
                totalMales: 'Total Males Born',
                totalFemales: 'Total Females Born'
            },
            excluded: {
                title: 'Excluded Animals',
                reason: 'Reason',
                gender: 'Gender',
                count: 'Count'
            },
            feed: {
                title: 'Feed Management',
                type: 'Feed Type',
                consumed: 'Consumed Amount',
                remaining: 'Remaining Stock'
            },
            treatment: {
                title: 'Treatment Records',
                name: 'Treatment',
                used: 'Used Amount',
                remaining: 'Remaining Stock'
            },
            vaccine: {
                title: 'Vaccination Records',
                name: 'Vaccine Name',
                dosesUsed: 'Doses Used',
                remaining: 'Remaining Doses',
                costPerDose: 'Cost per Dose',
                totalCost: 'Total Cost',
                totalVaccinations: 'Total Vaccinations',
                remainingDoses: 'Total Remaining Doses',
                vaccinationCost: 'Total Vaccination Cost'
            },
            financial: {
                title: 'Financial Summary',
                feedCost: 'Total Feed Cost',
                treatmentCost: 'Total Treatment Cost',
                vaccineCost: 'Total Vaccine Cost'
            },
            health: {
                title: 'Health and Performance Metrics',
                vaccinationCoverage: 'Vaccination Coverage',
                mortalityRate: 'Mortality Rate',
                pregnancyRate: 'Pregnancy Rate'
            },
            footer: {
                generated: 'Generated on',
                system: 'Farm Management System',
                period: 'Report Period'
            }
        },
        ar: {
            title: 'تقرير إدارة المزرعة',
            period: 'الفترة',
            animalType: 'نوع الحيوان',
            stats: {
                overview: 'نظرة عامة على الإحصائيات',
                totalAnimals: 'إجمالي الحيوانات',
                pregnantAnimals: 'الحيوانات الحوامل',
                totalBirths: 'إجمالي الولادات',
                totalExcluded: 'إجمالي المستبعد'
            },
            distribution: {
                title: 'توزيع الحيوانات',
                gender: 'الجنس',
                type: 'نوع الحيوان',
                count: 'العدد'
            },
            births: {
                title: 'سجلات الولادة',
                category: 'الفئة',
                totalMales: 'إجمالي الذكور المولودة',
                totalFemales: 'إجمالي الإناث المولودة'
            },
            excluded: {
                title: 'الحيوانات المستبعدة',
                reason: 'السبب',
                gender: 'الجنس',
                count: 'العدد'
            },
            feed: {
                title: 'إدارة التغذية',
                type: 'نوع العلف',
                consumed: 'الكمية المستهلكة',
                remaining: 'المخزون المتبقي'
            },
            treatment: {
                title: 'سجلات العلاج',
                name: 'العلاج',
                used: 'الكمية المستخدمة',
                remaining: 'المخزون المتبقي'
            },
            vaccine: {
                title: 'سجلات التطعيم',
                name: 'اسم اللقاح',
                dosesUsed: 'الجرعات المستخدمة',
                remaining: 'الجرعات المتبقية',
                costPerDose: 'تكلفة الجرعة',
                totalCost: 'التكلفة الإجمالية',
                totalVaccinations: 'إجمالي التطعيمات',
                remainingDoses: 'إجمالي الجرعات المتبقية',
                vaccinationCost: 'إجمالي تكلفة التطعيم'
            },
            financial: {
                title: 'الملخص المالي',
                feedCost: 'إجمالي تكلفة العلف',
                treatmentCost: 'إجمالي تكلفة العلاج',
                vaccineCost: 'إجمالي تكلفة التطعيم'
            },
            health: {
                title: 'مؤشرات الصحة والأداء',
                vaccinationCoverage: 'تغطية التطعيم',
                mortalityRate: 'معدل النفوق',
                pregnancyRate: 'معدل الحمل'
            },
            footer: {
                generated: 'تم الإنشاء في',
                system: 'نظام إدارة المزرعة',
                period: 'فترة التقرير'
            }
        }
    };

    const t = translations[lang];

    const htmlContent = `  
    <!DOCTYPE html>  
    <html lang="${lang}" dir="${isArabic ? 'rtl' : 'ltr'}">  
    <head>  
        <meta charset="UTF-8">  
        <meta name="viewport" content="width=device-width, initial-scale=1.0">  
        <title>${t.title}</title>  
        <style>  
            body { 
                font-family: ${isArabic ? 'Arial, sans-serif' : 'Arial, sans-serif'}; 
                margin: 20px; 
                font-size: 14px; 
                color: #333;
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
                border-bottom: 2px solidrgb(70, 174, 101);
            }  
            .report-subtitle {
                text-align: center;
                font-size: 16px;
                color: #7f8c8d;
                margin-bottom: 30px;
            }
            .section {
                margin-bottom: 30px;
                background: #fff;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .section-title {
                color: #2c3e50;
                font-size: 18px;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
            }
            .table { 
                width: 100%; 
                margin: 0 auto; 
                border-collapse: collapse;
                margin-bottom: 20px;
            }  
            .table th, .table td {
                vertical-align: middle;
            }
            .table td, .table th { 
                padding: 12px; 
                text-align: left; 
                border: 1px solid #ddd;
            }  
            .table th { 
                background-color: #14532d !important;
                color: #fff !important;
                font-weight: bold;
                font-size: 16px;
                letter-spacing: 0.5px;
                font-family: Arial, Helvetica, sans-serif;
                padding: 14px 8px;
            }
            .table td {
                font-size: 15px;
                font-family: Arial, Helvetica, sans-serif;
                vertical-align: middle;
            }
            .table tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            .table tr:hover {
                background-color: #f5f5f5;
            }
            .stats-container {
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                margin-bottom: 20px;
            }
            .stat-box {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                text-align: center;
                margin: 10px;
                flex: 1;
                min-width: 200px;
                border: 1px solid #dee2e6;
            }
            .stat-number {
                font-size: 24px;
                font-weight: bold;
                color:  #21763e;
                margin: 10px 0;
            }
            .stat-label {
                color: #666;
                font-size: 14px;
            }
            .container { 
                width: 100%; 
                max-width: 1000px; 
                margin: 0 auto; 
                padding: 20px;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #7f8c8d;
                font-size: 12px;
            }
        </style>  
    </head>  
    <body>  
    <div class="container">
        <h1 class="report-title">${t.title}</h1>
        <div class="report-subtitle">
            <p>${t.period}: ${data.dateFrom} - ${data.dateTo}</p>
            <p>${t.animalType}: ${data.animalType}</p>
        </div>

        <div class="section">
            <h2 class="section-title">${t.stats.overview}</h2>
            <div class="stats-container">
                <div class="stat-box">
                    <div class="stat-number">${(data.animalReport || []).reduce((sum, animal) => sum + (animal.count || 0), 0)}</div>
                    <div class="stat-label">${t.stats.totalAnimals}</div>
                </div>
                ${isBreedingType ? `
                <div class="stat-box">
                    <div class="stat-number">${data.pregnantAnimal || 0}</div>
                    <div class="stat-label">${t.stats.pregnantAnimals}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${data.birthEntries?.totalBirthEntries || 0}</div>
                    <div class="stat-label">${t.stats.totalBirths}</div>
                </div>
                ` : ''}
                <div class="stat-box">
                    <div class="stat-number">${(data.excludedReport || []).reduce((sum, excluded) => sum + (excluded.count || 0), 0)}</div>
                    <div class="stat-label">${t.stats.totalExcluded}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">${t.distribution.title}</h2>
            <table class="table">  
                <thead>  
                    <tr>  
                        <th>${t.distribution.gender}</th>  
                        <th>${t.distribution.type}</th>  
                        <th>${t.distribution.count}</th>  
                    </tr>  
                </thead>  
                <tbody>  
                    ${(data.animalReport || []).map(animal => `
                        <tr>
                            <td>${animal.gender || "N/A"}</td>
                            <td>${animal.animalType || "N/A"}</td>
                            <td>${animal.count || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>  
            </table>
        </div>

        ${isBreedingType ? `
        <div class="section">
            <h2 class="section-title">${t.births.title}</h2>
            <table class="table">  
                <thead>  
                    <tr>  
                        <th>${t.births.category}</th>  
                        <th>${t.births.count}</th>  
                    </tr>  
                </thead>  
                <tbody>  
                    <tr>
                        <td>${t.births.totalMales}</td>
                        <td>${data.birthEntries?.totalMales || 0}</td>
                    </tr>
                    <tr>
                        <td>${t.births.totalFemales}</td>
                        <td>${data.birthEntries?.totalFemales || 0}</td>
                    </tr>
                </tbody>  
            </table>
        </div>
        ` : ''}

        <div class="section">
            <h2 class="section-title">${t.excluded.title}</h2>
            <table class="table">  
                <thead>  
                    <tr>  
                        <th>${t.excluded.reason}</th>  
                        <th>${t.excluded.gender}</th>  
                        <th>${t.excluded.count}</th>  
                    </tr>  
                </thead>  
                <tbody>  
                    ${(data.excludedReport || []).map(excluded => `
                        <tr>
                            <td>${excluded.excludedType || "N/A"}</td>
                            <td>${excluded.gender || "N/A"}</td>
                            <td>${excluded.count || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>  
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">${t.feed.title}</h2>
            <table class="table">  
                <thead>  
                    <tr>  
                        <th>${t.feed.type}</th>  
                        <th>${t.feed.consumed}</th>  
                        <th>${t.feed.remaining}</th>  
                    </tr>  
                </thead>  
                <tbody>  
                    ${(data.feedConsumption || []).map(feed => {
                        const remainingStock = (data.remainingFeedStock || []).find(stock => stock.name === feed.feedName);
                        return `
                            <tr>
                                <td>${feed.feedName || "N/A"}</td>
                                <td>${feed.totalConsumed || 0} kg</td>
                                <td>${remainingStock ? remainingStock.quantity : 0} kg</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>  
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">${t.treatment.title}</h2>
            <table class="table">  
                <thead>  
                    <tr>  
                        <th>${t.treatment.name}</th>  
                        <th>${t.treatment.used}</th>  
                        <th>${t.treatment.remaining}</th>  
                    </tr>  
                </thead>  
                <tbody>  
                    ${(data.treatmentConsumption || []).map(treatment => {
                        const remainingStock = (data.remainingTreatmentStock || []).find(stock => stock.name === treatment.treatmentName);
                        return `
                            <tr>
                                <td>${treatment.treatmentName || "N/A"}</td>
                                <td>${treatment.totalConsumed || 0} ml</td>
                                <td>${remainingStock ? remainingStock.volume : 0} ml</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>  
            </table>
        </div>

        ${isBreedingType ? `
        <div class="section">
            <h2 class="section-title">${t.health.title}</h2>
            <div class="stats-container">
                <div class="stat-box">
                    <div class="stat-number">${(((data.vaccineConsumption || []).reduce((sum, v) => sum + (v.totalConsumed || 0), 0) / 
                        Math.max((data.animalReport || []).reduce((sum, animal) => sum + (animal.count || 0), 0), 1)) * 100).toFixed(1)}%</div>
                    <div class="stat-label">${t.health.vaccinationCoverage}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${((((data.excludedReport || []).filter(e => e.excludedType === 'death').reduce((sum, e) => sum + (e.count || 0), 0)) /
                        Math.max((data.animalReport || []).reduce((sum, animal) => sum + (animal.count || 0), 0), 1)) * 100).toFixed(1)}%</div>
                    <div class="stat-label">${t.health.mortalityRate}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${((data.pregnantAnimal || 0) /
                        Math.max((data.animalReport || []).filter(a => a.gender === 'female').reduce((sum, animal) => sum + (animal.count || 0), 0), 1) * 100).toFixed(1)}%</div>
                    <div class="stat-label">${t.health.pregnancyRate}</div>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="section">
            <h2 class="section-title">${t.financial.title}</h2>
            <table class="table">
                <tbody>
                    <tr>
                        <td>${t.financial.feedCost}</td>
                        <td>${data.totalFeedCost || 0}</td>
                    </tr>
                    <tr>
                        <td>${t.financial.treatmentCost}</td>
                        <td>${data.totalTreatmentCost || 0}</td>
                    </tr>
                    <tr>
                        <td>${t.financial.vaccineCost}</td>
                        <td>${data.totalVaccineCost || 0}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="footer">
            <p>${t.footer.generated}: ${new Date().toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}</p>
            <p>${t.footer.system}</p>
            <p>${t.footer.period}: ${data.dateFrom} - ${data.dateTo}</p>
        </div>
    </div>
    </body>  
    </html>  
    `;

    const filePath = path.join(__dirname, `combined_report_${lang}.pdf`);  
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
module.exports = {
    generateCombinedReport,
    generateCombinedPDFReport ,
    
};
