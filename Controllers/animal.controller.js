const Animal = require('../Models/animal.model');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const User = require('../Models/user.model');
const LocationShed = require('../Models/locationsed.model');
const Breed = require('../Models/breed.model');
const AnimalCost = require('../Models/animalCost.model');
const Excluded = require('../Models/excluded.model');
const { afterCreateAnimal,afterUpdateAnimalPurchase} = require('../utilits/animalAccounting');
const mongoose = require('mongoose');
const i18n = require('../i18n');
const excelOps = require('../utilits/excelOperations');
const MovementLocation = require('../Models/movementLocation.model');

async function findShed({ id, name, owner }) {
    const q = {};
    if (id) q._id = id;
    if (name) q.locationShedName = name;
    q.owner = owner;
    const shed = await LocationShed.findOne(q);
    return shed;
}
const getAnimalStatistics = asyncwrapper(async (req, res, next) => {
    try {
        // First ensure we have a valid userId from the request
        const userId = req.userId || req.user?.id;
        if (!userId) {
            return next(AppError.create(i18n.__('USER_NOT_AUTHENTICATED'), 401, httpstatustext.FAIL));
        }

        // Get all excluded animal IDs for this user
        const excludedAnimals = await Excluded.find({ owner: userId }).select('animalId');
        const excludedAnimalIds = excludedAnimals.map(ex => ex.animalId);

        // Get total count of animals for the user excluding the excluded ones
        const totalAnimals = await Animal.countDocuments({
            owner: userId,
            _id: { $nin: excludedAnimalIds }
        });

        // Get counts by animal type (sheep/goat) excluding excluded animals
        const animalsByType = await Animal.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId),
                    _id: { $nin: excludedAnimalIds }
                }
            },
            {
                $group: {
                    _id: "$animalType",
                    count: { $sum: 1 },
                    males: { $sum: { $cond: [{ $eq: ["$gender", "male"] }, 1, 0] } },
                    females: { $sum: { $cond: [{ $eq: ["$gender", "female"] }, 1, 0] } }
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

        // Get counts by gender excluding excluded animals
        const animalsByGender = await Animal.aggregate([
            {
                $match: {
                    owner: new mongoose.Types.ObjectId(userId),
                    _id: { $nin: excludedAnimalIds }
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

        // Initialize gender stats
        const genderStats = { male: 0, female: 0 };

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
        // Get user's registration type
        const user = await User.findById(userId).select('registerationType');
        const isFattening = user?.registerationType === 'fattening';

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

            // Parse dates - skip birthDate if fattening
            let birthDate = undefined;
            let purchaseDate = undefined;
            if (!isFattening && birthDateStr) {
                birthDate = new Date(birthDateStr);
                if (isNaN(birthDate.getTime())) {
                    return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
                }
            }
            if (purchaseDateStr) {
                purchaseDate = new Date(purchaseDateStr);
                if (isNaN(purchaseDate.getTime())) {
                    return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
                }
            }

            // Find LocationShed and Breed
            const locationShed = locationShedName ? await LocationShed.findOne({ locationShedName, owner: userId }) : null;
            const breed = await Breed.findOne({ breedName, owner: userId });

            if (!breed) {
                throw new Error(i18n.__('BREED_NOT_FOUND', { breed: breedName, row: i + 1 }));
            }

            // Prepare animal data - skip birthDate, motherId, fatherId if fattening
            const animalData = {
                tagId,
                breed: breed._id,
                animalType,
                purchaseDate,
                purchasePrice,
                traderName,
                locationShed: locationShed?._id,
                gender,
                female_Condition,
                owner: userId
            };

            // Only add birthDate, motherId, fatherId if NOT fattening
            if (!isFattening) {
                if (birthDate) animalData.birthDate = birthDate;
                if (motherId) animalData.motherId = motherId;
                if (fatherId) animalData.fatherId = fatherId;
            }

            // Create and save new animal
            const newAnimal = new Animal(animalData);
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
        const userId = req.user?.id || req.userId;
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        // Get user's registration type
        const user = userId ? await User.findById(userId).select('registerationType') : null;
        const isFattening = user?.registerationType === 'fattening';

        // Get base headers and example row
        let headers = excelOps.headers.animal[lang].template;
        let exampleRow = excelOps.templateExamples.animal[lang];

        // If fattening, exclude birthDate (index 3), motherId (index 7), fatherId (index 8)
        if (isFattening) {
            headers = headers.filter((_, index) => ![3, 7, 8].includes(index));
            exampleRow = exampleRow.filter((_, index) => ![3, 7, 8].includes(index));
        }

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

        // Get user's registration type
        const user = await User.findById(userId).select('registerationType');
        const isFattening = user?.registerationType === 'fattening';

        // Get base headers
        let headers = excelOps.headers.animal[lang].export;
        const sheetName = excelOps.sheetNames.animal.export[lang];

        // Map animals to data rows
        let data = animals.map(animal => [
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
            animal.female_Condition || ''
        ]);

        // If fattening, exclude birthDate (index 3), ageInDays (index 4), motherId (index 8), fatherId (index 9)
        if (isFattening) {
            headers = headers.filter((_, index) => ![3, 4, 8, 9].includes(index));
            data = data.map(row => row.filter((_, index) => ![3, 4, 8, 9].includes(index)));
        }

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths based on filtered headers (removed teething - last column)
        const baseColumnWidths = [15, 15, 15, 12, 12, 12, 12, 15, 15, 15, 15, 10, 15];
        const columnWidths = isFattening 
            ? baseColumnWidths.filter((_, index) => ![3, 4, 8, 9].includes(index))
            : baseColumnWidths;
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
    const limit = parseInt(query.limit, 10) || 10;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = { owner: userId };

    if (query.animalType) filter.animalType = query.animalType;
    if (query.gender) filter.gender = query.gender;
    if (query.locationShed) filter.locationShed = query.locationShed;
    if (query.breed) filter.breed = query.breed;
    if (query.tagId) filter.tagId = query.tagId;

    const animals = await Animal.find(filter, { "__v": false })
        .populate({ path: 'locationShed', select: 'locationShedName' })
        .populate({ path: 'breed', select: 'breedName' })
        .sort({ createdAt: -1 }) // ← always newest first
        .skip(skip)
        .limit(limit);

    const total = await Animal.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
        status: i18n.__('SUCCESS'),
        pagination: {
            page,
            limit,
            total,
            totalPages,
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
        }).populate({
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
    //const { locationShedName, breed, birthDate, age, ...animalData } = req.body;
    const { locationShedName, breed, birthDate, age, marketValue, ...animalData } = req.body;


    // Validate input: either birthDate or age must be provided
    if (!birthDate && !age) {
        return next(AppError.create('Either birthDate or age must be provided', 400, httpstatustext.FAIL));
    }

    // Find LocationShed by name
    const locationShed = await LocationShed.findOne({ locationShedName, owner: userId });
    if (!locationShed) {
        return next(AppError.create('Location shed not found for the provided name', 404, httpstatustext.FAIL));
    }

    // Find Breed by name
    const breedDoc = await Breed.findOne({ breedName: breed, owner: userId });
    if (!breedDoc) {
        return next(AppError.create('Breed not found for the provided name', 404, httpstatustext.FAIL));
    }

    // Calculate birthDate if not provided but age is
    let finalBirthDate = null;
    if (birthDate) {
        finalBirthDate = new Date(birthDate);
    } else if (age && (age.years || age.months || age.days)) {
        const now = new Date();
        finalBirthDate = new Date(
            now.getFullYear() - (age.years || 0),
            now.getMonth() - (age.months || 0),
            now.getDate() - (age.days || 0)
        );
    }

    // Create the animal

    const newanimal = new Animal({
        ...animalData,
        birthDate: finalBirthDate,
        locationShed: locationShed._id,
        breed: breedDoc._id,
        owner: userId,
        marketValue // include this line
    });

    await newanimal.save();
    await afterCreateAnimal(newanimal);
    if (newanimal.purchasePrice > 0 || newanimal.marketValue > 0) {
        await AnimalCost.create({
            animalTagId: newanimal.tagId,
            purchasePrice: newanimal.purchasePrice || 0,
            marketValue: newanimal.marketValue || 0,
            owner: userId
        });
    }
    const populatedAnimal = await Animal.findById(newanimal._id)
        .populate('locationShed', 'locationShedName')
        .populate('breed', 'breedName');

    res.json({ status: httpstatustext.SUCCESS, data: { animal: populatedAnimal } });
});

const updateanimal = asyncwrapper(async (req, res, next) => {
    const animalId = req.params.tagId; // تأكد إن ده هو الـ _id فعلاً وليس tagId
    const { locationShedName, breedName, birthDate, age, ...updateData } = req.body;

    // تحديث المكان لو الاسم موجود
    if (locationShedName) {
        const locationShed = await LocationShed.findOne({ locationShedName, owner: req.user.id });
        if (!locationShed) {
            return next(AppError.create('Location shed not found for the provided name', 404, httpstatustext.FAIL));
        }
        updateData.locationShed = locationShed._id;
    }

    // تحديث السلالة لو الاسم موجود
    if (breedName) {
        const breed = await Breed.findOne({ breedName, owner: req.user.id });
        if (!breed) {
            return next(AppError.create('Breed not found for the provided name', 404, httpstatustext.FAIL));
        }
        updateData.breed = breed._id;
    }

    // تاريخ الميلاد أو السن
    if (birthDate) {
        updateData.birthDate = new Date(birthDate);
    } else if (age && (age.years || age.months || age.days)) {
        const now = new Date();
        const calculatedDate = new Date(
            now.getFullYear() - (age.years || 0),
            now.getMonth() - (age.months || 0),
            now.getDate() - (age.days || 0)
        );
        updateData.birthDate = calculatedDate;
    }
    const beforeAnimal = await Animal.findOne({ _id: animalId, owner: req.user.id }).lean();
    // تنفيذ التحديث
    const updatedanimal = await Animal.findOneAndUpdate(
        { _id: animalId, owner: req.user.id },
        { $set: updateData },
        { new: true, runValidators: true }
    );

    if (!updatedanimal) {
        return next(AppError.create('Animal not found or unauthorized to update', 404, httpstatustext.FAIL));
    }
     // ✅ لو اتغير purchasePrice نسجّل فرق محاسبي (زيادة مصروف/ردّ)
     if (beforeAnimal && Object.prototype.hasOwnProperty.call(updateData, 'purchasePrice')) {
       await afterUpdateAnimalPurchase(beforeAnimal, updatedanimal);
     }
    // === تحديث AnimalCost لو اتغير marketValue أو purchasePrice ===
    const hasMarketValue = Object.prototype.hasOwnProperty.call(updateData, 'marketValue');
    const hasPurchasePrice = Object.prototype.hasOwnProperty.call(updateData, 'purchasePrice');

    if (hasMarketValue || hasPurchasePrice) {
        const incomingMarketValue = updateData.marketValue;      // ممكن تكون 0 — مسموح
        const incomingPurchasePrice = updateData.purchasePrice;  // ممكن تكون 0 — مسموح

        const existingCost = await AnimalCost.findOne({
            animalTagId: updatedanimal.tagId,
            owner: req.user.id
        });

        const updateCostData = {};
        if (hasMarketValue) updateCostData.marketValue = incomingMarketValue;
        if (hasPurchasePrice) updateCostData.purchasePrice = incomingPurchasePrice;

        if (hasPurchasePrice) {
            const feedCost = existingCost?.feedCost ?? 0;
            const treatmentCost = existingCost?.treatmentCost ?? 0;
            const vaccineCost = existingCost?.vaccineCost ?? 0;
            const otherCost = existingCost?.otherCost ?? 0;
            updateCostData.totalCost = Number(incomingPurchasePrice) + feedCost + treatmentCost + vaccineCost + otherCost;
        }

        await AnimalCost.findOneAndUpdate(
            { animalTagId: updatedanimal.tagId, owner: req.user.id },
            { $set: updateCostData },
            { new: true, runValidators: true, upsert: true } // upsert لو مفيش سجل قبل كده
        );
    }

    // إرجاع الحيوان بعد الـ populate
    const populatedAnimal = await Animal.findById(updatedanimal._id)
        .populate('locationShed', 'locationShedName')
        .populate('breed', 'breedName');

    return res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { animal: populatedAnimal }
    });
});

const deleteanimal = asyncwrapper(async (req, res, next) => {
    const animalId = req.params.tagId; // Use consistent parameter name

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

const getAllMaleAnimalTagIds = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;

    if (!userId) {
        return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }

    const animals = await Animal.find({
        owner: userId,
        gender: 'male'
    }).select('tagId -_id');

    const tagIds = animals.map(animal => animal.tagId); // extract only tagId

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        count: tagIds.length,
        data: tagIds
    });
});
const moveAnimals = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;

    const {
        toLocationShed,
        toLocationShedName,
        fromLocationShed,
        fromLocationShedName,
        animalIds,
        tagIds,
        filter = {},
        enforceFromShed = true
    } = req.body;

    if (!toLocationShed && !toLocationShedName) {
        return next(AppError.create('toLocationShed (id) أو toLocationShedName مطلوب', 400, httpstatustext.FAIL));
    }

    const toShed = await findShed({ id: toLocationShed, name: toLocationShedName, owner: userId });
    if (!toShed) return next(AppError.create('العنبر الوجهة غير موجود لهذا المستخدم', 404, httpstatustext.FAIL));

    let fromShed = null;
    if (fromLocationShed || fromLocationShedName) {
        fromShed = await findShed({ id: fromLocationShed, name: fromLocationShedName, owner: userId });
        if (!fromShed) return next(AppError.create('العنبر المصدر غير موجود لهذا المستخدم', 404, httpstatustext.FAIL));
        if (String(fromShed._id) === String(toShed._id)) {
            return next(AppError.create('العنبر المصدر والوجهة لا يجب أن يكونا نفس العنبر', 400, httpstatustext.FAIL));
        }
    }

    // ---- فلتر الحيوانات ----
    const animalFilter = { owner: userId };

    if (enforceFromShed && fromShed) animalFilter.locationShed = fromShed._id;

    if (Array.isArray(animalIds) && animalIds.length) {
        animalFilter._id = { $in: animalIds.filter(Boolean).map(id => new mongoose.Types.ObjectId(id)) };
    } else if (Array.isArray(tagIds) && tagIds.length) {
        animalFilter.tagId = { $in: tagIds.filter(Boolean) };
    }

    if (filter.gender) animalFilter.gender = filter.gender;
    if (filter.animalType) animalFilter.animalType = filter.animalType;
    if (filter.breed) animalFilter.breed = filter.breed; // _id للسلالة

    // مهم: لا ننقل من هم بالفعل في عنبر الوجهة
    animalFilter.locationShed = enforceFromShed && fromShed
        ? fromShed._id
        : { $ne: toShed._id };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // نجيب المرشحين للنقل (قبل التحديث)
        const toMove = await Animal.find(animalFilter)
            .session(session)
            .select('_id tagId locationShed');

        if (toMove.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(200).json({
                status: httpstatustext.SUCCESS,
                moved: 0,
                message: 'لا توجد حيوانات مطابقة للفلتر/الاختيار.',
                data: { toShed: { id: toShed._id, name: toShed.locationShedName } }
            });
        }

        // (1) نسجل الحركة قبل الـ commit (ما زلنا داخل الترانزاكشن)
        const movementDocs = toMove.map(a => ({
            animalId: a._id,
            fromLocationShed: a.locationShed || (fromShed?._id || null),
            toLocationShed: toShed._id,
            owner: userId,
            movedBy: req.user.id,
            movedAt: new Date()
        }));

        await MovementLocation.insertMany(movementDocs, { session, ordered: false });

        // (2) ننفذ النقل فعليًا
        const result = await Animal.updateMany(
            { _id: { $in: toMove.map(a => a._id) }, owner: userId },
            { $set: { locationShed: toShed._id } },
            { session }
        );

        // إنهاء الترانزاكشن
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({
            status: httpstatustext.SUCCESS,
            moved: result.modifiedCount || 0,
            logged: movementDocs.length,
            from: fromShed ? { id: fromShed._id, name: fromShed.locationShedName } : null,
            to: { id: toShed._id, name: toShed.locationShedName },
            animals: toMove.map(a => a.tagId)
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        return next(err);
    }
});

module.exports = {
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
    getAllMaleAnimalTagIds,
    moveAnimals,
}