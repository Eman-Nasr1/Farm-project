const Animal=require('../Models/animal.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const User=require('../Models/user.model');
const LocationShed=require('../Models/locationsed.model');
const Breed=require('../Models/breed.model');
const mongoose = require('mongoose');
const i18n = require('../i18n');
const excelOps = require('../utilits/excelOperations');

const getAnimalStatistics = asyncwrapper(async (req, res, next) => {
    try {
        // First ensure we have a valid userId from the request
        const userId = req.userId || req.user?.id;
        if (!userId) {
           // console.error('User ID is missing in request');
            return next(AppError.create(i18n.__('USER_NOT_AUTHENTICATED'), 401, httpstatustext.FAIL));
        }

       // console.log(`[DEBUG] Processing statistics for user ${userId}`);

        // Get total count of animals for the user
        const totalAnimals = await Animal.countDocuments({ owner: userId });
       // console.log(`[DEBUG] Total animals: ${totalAnimals}`);

        // Get counts by animal type (sheep/goat)
        const animalsByType = await Animal.aggregate([
            { 
                $match: { 
                    owner: new mongoose.Types.ObjectId(userId) // Fixed ObjectId construction
                }
            },
            { 
                $group: { 
                    _id: "$animalType", 
                    count: { $sum: 1 },
                    males: { 
                        $sum: { 
                            $cond: [{ $eq: ["$gender", "male"] }, 1, 0] 
                        } 
                    },
                    females: { 
                        $sum: { 
                            $cond: [{ $eq: ["$gender", "female"] }, 1, 0] 
                        } 
                    }
                }
            },
            { 
                $project: {
                    animalType: "$_id",
                    count: 1,
                    males: 1,
                    females: 1,
                    _id: 0
                }
            }
        ]);

      //  console.log('[DEBUG] Animals by type:', animalsByType);

        // Initialize with all possible types
        const typeStats = {
            sheep: { total: 0, males: 0, females: 0 },
            goat: { total: 0, males: 0, females: 0 }
        };

        // Update with actual data
        animalsByType.forEach(stat => {
            if (stat.animalType && typeStats[stat.animalType]) {
                typeStats[stat.animalType] = {
                    total: stat.count,
                    males: stat.males,
                    females: stat.females
                };
            }
        });

        // Get counts by gender
        const animalsByGender = await Animal.aggregate([
            { 
                $match: { 
                    owner: new mongoose.Types.ObjectId(userId) 
                }
            },
            { 
                $group: { 
                    _id: "$gender", 
                    count: { $sum: 1 }
                }
            },
            { 
                $project: {
                    gender: "$_id",
                    count: 1,
                    _id: 0
                }
            }
        ]);

       // console.log('[DEBUG] Animals by gender:', animalsByGender);

        // Initialize gender stats
        const genderStats = {
            male: 0,
            female: 0
        };

        // Update with actual data
        animalsByGender.forEach(stat => {
            if (stat.gender && genderStats.hasOwnProperty(stat.gender)) {
                genderStats[stat.gender] = stat.count;
            }
        });

        // Return the statistics
        res.json({
            status: httpstatustext.SUCCESS,
            data: {
                totalAnimals,
                byType: typeStats,
                byGender: genderStats
            }
        });

    } catch (error) {
        console.error('[ERROR] in getAnimalStatistics:', error);
        return next(AppError.create(i18n.__('STATISTICS_ERROR'), 500, httpstatustext.ERROR));
    }
});

const importAnimalsFromExcel = asyncwrapper(async (req, res, next) => {
    const userId = req.user?.id || req.userId;
    if (!userId) {
        return next(AppError.create(i18n.__('UNAUTHORIZED'), 401, httpstatustext.FAIL));
    }

    try {
        const data = excelOps.readExcelFile(req.file.buffer);

        // Skip header row
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => !cell)) continue;

            // Extract and validate data
            const [
                tagId,
                breedName,
                animalType,
                birthDateStr,
                purchaseDateStr,
                purchasePrice,
                traderName,
                motherId,
                fatherId,
                locationShedName,
                gender,
                female_Condition,
                teething
            ] = row.map(cell => cell?.toString().trim());

            // Validate required fields
            if (!tagId || !breedName || !animalType || !gender) {
                return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse dates
            const birthDate = new Date(birthDateStr);
            const purchaseDate = new Date(purchaseDateStr);
            if (isNaN(birthDate.getTime()) || isNaN(purchaseDate.getTime())) {
                return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Find LocationShed and Breed
            const locationShed = locationShedName ? await LocationShed.findOne({ locationShedName, owner: userId }) : null;
            const breed = await Breed.findOne({ breedName, owner: userId });

            if (!breed) {
                throw new Error(i18n.__('BREED_NOT_FOUND', { breed: breedName, row: i+1 }));
            }

            // Create and save new animal
            const newAnimal = new Animal({
                tagId,
                breed: breed._id,
                animalType,
                birthDate,
                purchaseDate,
                purchasePrice,
                traderName,
                motherId,
                fatherId,
                locationShed: locationShed?._id,
                gender,
                female_Condition,
                Teething: teething,
                owner: userId
            });

            await newAnimal.save();
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: i18n.__('ANIMALS_IMPORTED_SUCCESSFULLY')
        });
    } catch (error) {
        console.error('Import error:', error);
        return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const downloadAnimalTemplate = asyncwrapper(async (req, res, next) => {
    try {
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        const headers = excelOps.headers.animal[lang].template;
        const exampleRow = excelOps.templateExamples.animal[lang];
        const sheetName = excelOps.sheetNames.animal.template[lang];

        const workbook = excelOps.createExcelFile([exampleRow], headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];
        excelOps.setColumnWidths(worksheet, headers.map(() => 20));

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `animals_template_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Template Download Error:', error);
        next(AppError.create(i18n.__('TEMPLATE_GENERATION_FAILED'), 500, httpstatustext.ERROR));
    }
});

const exportAnimalsToExcel = asyncwrapper(async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';
        
        if (!userId) {
            return next(AppError.create(isArabic ? 'المستخدم غير مصرح' : 'User not authenticated', 401, httpstatustext.FAIL));
        }
        
        // Build filter
        const filter = { owner: userId };
        ['animalType', 'gender', 'locationShed', 'breed', 'tagId'].forEach(field => {
            if (req.query[field]) filter[field] = req.query[field];
        });

        const animals = await Animal.find(filter)
            .populate('locationShed', 'locationShedName')
            .populate('breed', 'breedName');

        if (animals.length === 0) {
            return res.status(404).json({
                status: httpstatustext.FAIL,
                message: isArabic ? 'لم يتم العثور على حيوانات لهذا المستخدم' : 'No animals found for this user'
            });
        }

        const headers = excelOps.headers.animal[lang].export;
        const sheetName = excelOps.sheetNames.animal.export[lang];

        const data = animals.map(animal => [
            animal.tagId,
            animal.breed?.breedName || '',
            animal.animalType,
            animal.birthDate?.toISOString().split('T')[0] || '',
            animal.ageInDays || '',
            animal.purchaseDate?.toISOString().split('T')[0] || '',
            animal.purchasePrice || '',
            animal.traderName || '',
            animal.motherId || '',
            animal.fatherId || '',
            animal.locationShed?.locationShedName || '',
            animal.gender,
            animal.female_Condition || '',
            animal.Teething || ''
        ]);

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths
        const columnWidths = [15, 15, 15, 12, 12, 12, 12, 15, 15, 15, 15, 10, 15, 10];
        excelOps.setColumnWidths(worksheet, columnWidths);

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `animals_export_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export error:', error);
        return next(AppError.create(
            isArabic ? 'فشل التصدير: ' + error.message : 'Export failed: ' + error.message,
            500,
            httpstatustext.ERROR
        ));
    }
});


const getallanimals = asyncwrapper(async (req, res, next) => {
    if (req.role === 'employee' && !req.permissions.includes('view_animals')) {
        return next(AppError.create(i18n.__('PERMISSION_DENIED'), 403, httpstatustext.FAIL));
    }

    const userId = req.user.id;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    // Create filter object
    const filter = { owner: userId };

    // Add filters based on query parameters
    if (query.animalType) {
        filter.animalType = query.animalType; // e.g., "goat" or "sheep"
    }

    if (query.gender) {
        filter.gender = query.gender; // e.g., "male" or "female"
    }

    if (query.locationShed) {
        filter.locationShed = query.locationShed; // e.g., "Shed A"
    }

    if (query.breed) {
        filter.breed = query.breed; // e.g., "balady"
    }

    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }

    // Find animals with applied filters and populate locationShed
    const animals = await Animal.find(filter, { "__v": false })
        .populate({
            path: 'locationShed',
            select: 'locationShedName' // Only include the locationShedName field
        })
         .populate({
            path: 'breed',
            select: 'breedName' // Only include the breedName field
        })
        .limit(limit)
        .skip(skip);

    const total = await Animal.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Return response
    res.json({
        status: i18n.__('SUCCESS'),
        pagination: {
            page: page,
            limit: limit,
            total: total,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        data: { animals }
    });
});


const getsingleanimal = asyncwrapper(async (req, res, next) => {
    const animal = await Animal.findById(req.params.tagId)
        .populate({
            path: 'locationShed',
            select: 'locationShedName' // Only include the locationShedName field
        }) .populate({
            path: 'breed',
            select: 'breedName' // Only include the breedName field
        });

    if (!animal) {
        const error = AppError.create(i18n.__('ANIMAL_NOT_FOUND'), 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal } });
});


const addanimal = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { locationShedName, breed, ...animalData } = req.body;

    // Find LocationShed by name
    const locationShed = await LocationShed.findOne({ locationShedName, owner: userId });
    if (!locationShed) {
        const error = AppError.create('Location shed not found for the provided name', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Find Breed by name (changed from _id to breedName)
    const breedDoc = await Breed.findOne({ breedName: breed, owner: userId });
    if (!breedDoc) {
        const error = AppError.create('Breed not found for the provided name', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Create new animal
    const newanimal = new Animal({
        ...animalData,
        locationShed: locationShed._id,
        breed: breedDoc._id,
        owner: userId
    });

    await newanimal.save();

    const populatedAnimal = await Animal.findById(newanimal._id)
        .populate('locationShed', 'locationShedName')
        .populate('breed', 'breedName');

    res.json({ status: httpstatustext.SUCCESS, data: { animal: populatedAnimal } });
});


const updateanimal = asyncwrapper(async (req, res, next) => {
    const animalId = req.params.tagId;
    const { locationShedName, breedName, ...updateData } = req.body; // Extract locationShedName and breedName from the request body

    // If locationShedName is provided, find the corresponding LocationShed document
    if (locationShedName) {
        const locationShed = await LocationShed.findOne({ locationShedName, owner: req.user.id });

        if (!locationShed) {
            const error = AppError.create('Location shed not found for the provided name', 404, httpstatustext.FAIL);
            return next(error);
        }

        // Add the locationShed ID to the update data
        updateData.locationShed = locationShed._id;
    }

    // If breedName is provided, find the corresponding Breed document
    if (breedName) {
        const breed = await Breed.findOne({ breedName, owner: req.user.id });

        if (!breed) {
            const error = AppError.create('Breed not found for the provided name', 404, httpstatustext.FAIL);
            return next(error);
        }

        // Add the breed ID to the update data
        updateData.breed = breed._id;
    }

    // Update the animal document
    const updatedanimal = await Animal.findOneAndUpdate(
        { _id: animalId, owner: req.user.id }, // Ensure the user owns the animal
        { $set: updateData },
        { new: true, runValidators: true }
    );

    if (!updatedanimal) {
        const error = AppError.create('Animal not found or unauthorized to update', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Populate the locationShed and breed fields in the response
    const populatedAnimal = await Animal.findById(updatedanimal._id)
        .populate({
            path: 'locationShed',
            select: 'locationShedName' // Only include the locationShedName field
        })
        .populate({
            path: 'breed',
            select: 'breedName' // Only include the breedName field
        });

    return res.status(200).json({ status: httpstatustext.SUCCESS, data: { animal: populatedAnimal } });
});


// const deleteanimal= asyncwrapper(async(req,res)=>{
//     await Animal.deleteOne({_id:req.params.tagId});
    
//    res.status(200).json({status:httpstatustext.SUCCESS,data:null});

// })
const deleteanimal = asyncwrapper(async (req, res, next) => {
    const animalId =req.params.tagId; // Use consistent parameter name
    
    // 1. Find the animal first to check existence
    const animal = await Animal.findById(animalId);
    
    if (!animal) {
        return next(AppError.create('Animal not found', 404, httpstatustext.FAIL));
    }

    // 2. Perform cascading delete using the pre-delete hook
    await animal.deleteOne(); // This triggers your schema's pre-delete hook
    
    // 3. Proper success response
    res.status(204).json({
        status: httpstatustext.SUCCESS,
        data: null
    });
});
const getAllLocationSheds = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request (assuming it's added by authentication middleware)

    // Use MongoDB aggregation to get distinct location sheds for the user
    const locationSheds = await Animal.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(userId) } // Use 'new' to instantiate ObjectId
        },
        {
            $group: {
                _id: "$locationShed" // Group by locationShed to get distinct values
            }
        },
        {
            $project: {
                _id: 0, // Exclude the default _id field
                locationShed: "$_id" // Rename _id to locationShed
            }
        }
    ]);

    // If no location sheds are found, return an empty array
    if (locationSheds.length === 0) {
        return res.json({ status: httpstatustext.SUCCESS, data: { locationSheds: [] } });
    }

    // Return the list of unique location sheds
    res.json({ status: httpstatustext.SUCCESS, data: { locationSheds } });
});


module.exports={
    getallanimals,
    getsingleanimal,
    addanimal,
    updateanimal,
    deleteanimal,
    importAnimalsFromExcel,
    exportAnimalsToExcel,
    getAllLocationSheds,
    getAnimalStatistics,
    downloadAnimalTemplate,
}