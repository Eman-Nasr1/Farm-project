const Mating=require('../Models/mating.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const i18n = require('../i18n');
const excelOps = require('../utilits/excelOperations');


const getAllMating = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    const query = req.query;
    const limit = parseInt(query.limit) || 10;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;

    const filter = { owner: userId };

    if (query.tagId) {
        filter.tagId = query.tagId;
    }

    if (query.matingDate) {
        filter.matingDate = new Date(query.matingDate); // Convert to Date object
      }
    
      if (query.sonarDate) {
        filter.sonarDate = new Date(query.sonarDate); // Convert to Date object
      }

    if (query.sonarRsult) {
        filter.sonarRsult = query.sonarRsult;
    }

    // Get the total count of documents that match the filter
    const totalCount = await Mating.countDocuments(filter);

    // Find the paginated results
    const matingData = await Mating.find(filter, { "__v": false })
        .populate({
            path: 'animalId', // This is the field in the Mating schema that references Animal
            select: 'animalType' // Select only the animalType field from the Animal model
        })
        .limit(limit)
        .skip(skip);
      
    // If animalType is provided in the query, filter the results
    if (query.animalType) {
        const filteredMatingData = matingData.filter(mating => mating.animalId && mating.animalId.animalType === query.animalType);
        return res.json({
            status: httpstatustext.SUCCESS,
            data: {
                mating: filteredMatingData,
                pagination: {
                    total: filteredMatingData.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(filteredMatingData.length / limit)
                }
            }
        });
    }

    // If no animalType filter is applied, return all mating data with pagination metadata
    res.json({
        status: httpstatustext.SUCCESS,
        data: {
            mating: matingData,
            pagination: {
                total: totalCount,
                page: page,
                limit: limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        }
    });
}); 

// in this function getmatingforspacficanimal it will get animal data and mating data 

const importMatingFromExcel = asyncwrapper(async (req, res, next) => {
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
                maleTag_id,
                matingType,
                matingDateStr,
                checkDaysStr,
                sonarDateStr,
                sonarRsult
            ] = row.map(cell => cell?.toString().trim());

            // Validate required fields
            if (!tagId || !maleTag_id || !matingType || !matingDateStr) {
                return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse mating date
            const matingDate = new Date(matingDateStr);
            if (isNaN(matingDate.getTime())) {
                return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { field: 'Mating Date', row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse sonar date if provided
            let sonarDate = undefined;
            if (sonarDateStr) {
                sonarDate = new Date(sonarDateStr);
                if (isNaN(sonarDate.getTime())) {
                    return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { field: 'Sonar Date', row: i + 1 }), 400, httpstatustext.FAIL));
                }
                if (sonarDate < matingDate) {
                    return next(AppError.create(i18n.__('SONAR_DATE_BEFORE_MATING', { row: i + 1 }), 400, httpstatustext.FAIL));
                }
            }

            // Parse and validate check days
            let checkDays = null;
            if (checkDaysStr) {
                checkDays = parseInt(checkDaysStr);
                if (![45, 60, 90].includes(checkDays)) {
                    return next(AppError.create(i18n.__('INVALID_CHECK_DAYS', { row: i + 1 }), 400, httpstatustext.FAIL));
                }
            }

            // Validate sonar result if provided
            if (sonarRsult && !['positive', 'negative'].includes(sonarRsult.toLowerCase())) {
                return next(AppError.create(i18n.__('INVALID_SONAR_RESULT', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Verify female animal exists
            const femaleAnimal = await Animal.findOne({ tagId, owner: userId });
            if (!femaleAnimal) {
                return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Verify female animal's gender
            if (femaleAnimal.gender !== 'female') {
                return next(AppError.create(i18n.__('ANIMAL_NOT_FEMALE', { tagId, row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Verify male animal exists
            const maleAnimal = await Animal.findOne({ tagId: maleTag_id, owner: userId });
            if (!maleAnimal) {
                return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId: maleTag_id, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Verify male animal's gender
            if (maleAnimal.gender !== 'male') {
                return next(AppError.create(i18n.__('ANIMAL_NOT_MALE', { tagId: maleTag_id, row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Calculate expected delivery date (if mating is successful)
            const expectedDeliveryDate = sonarRsult?.toLowerCase() === 'positive' ? 
                new Date(matingDate.getTime() + (150 * 24 * 60 * 60 * 1000)) : undefined;

            // Create mating record
            const newMating = new Mating({
                tagId,
                maleTag_id,
                matingType,
                matingDate,
                checkDays,
                sonarDate,
                sonarRsult: sonarRsult?.toLowerCase(),
                expectedDeliveryDate,
                owner: userId,
                animalId: femaleAnimal._id
            });

            await newMating.save();
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: i18n.__('MATING_IMPORTED_SUCCESSFULLY')
        });
    } catch (error) {
        console.error('Import error:', error);
        return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const exportMatingToExcel = asyncwrapper(async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        if (!userId) {
            return next(AppError.create(isArabic ? 'المستخدم غير مصرح' : 'User not authenticated', 401, httpstatustext.FAIL));
        }

        // Build filter
        const filter = { owner: userId };
        if (req.query.tagId) filter.tagId = req.query.tagId;
        if (req.query.matingType) filter.matingType = req.query.matingType;
        if (req.query.sonarRsult) filter.sonarRsult = req.query.sonarRsult;
        
        // Date range filtering
        if (req.query.startDate || req.query.endDate) {
            filter.matingDate = {};
            if (req.query.startDate) filter.matingDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.matingDate.$lte = new Date(req.query.endDate);
        }

        const matings = await Mating.find(filter)
            .sort({ matingDate: 1 })
            .populate('animalId', 'tagId');

        if (matings.length === 0) {
            return res.status(404).json({
                status: httpstatustext.FAIL,
                message: isArabic ? 'لم يتم العثور على سجلات التلقيح' : 'No mating records found'
            });
        }

        const headers = excelOps.headers.mating[lang].export;
        const sheetName = excelOps.sheetNames.mating.export[lang];

        const data = matings.map(mating => [
            mating.tagId,
            mating.maleTag_id,
            mating.matingType,
            mating.matingDate?.toISOString().split('T')[0] || '',
            mating.checkDays || '',
            mating.sonarDate?.toISOString().split('T')[0] || '',
            mating.sonarRsult || '',
            mating.expectedDeliveryDate?.toISOString().split('T')[0] || '',
            mating.createdAt?.toISOString().split('T')[0] || ''
        ]);

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths
        const columnWidths = [15, 15, 15, 12, 12, 12, 15, 12, 12];
        excelOps.setColumnWidths(worksheet, columnWidths);

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `mating_records_${lang}.xlsx`);
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

const downloadMatingTemplate = asyncwrapper(async (req, res, next) => {
    try {
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        const headers = excelOps.headers.mating[lang].template;
        const exampleRow = excelOps.templateExamples.mating[lang];
        const sheetName = excelOps.sheetNames.mating.template[lang];

        const workbook = excelOps.createExcelFile([exampleRow], headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];
        excelOps.setColumnWidths(worksheet, headers.map(() => 20));

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `mating_template_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Template Download Error:', error);
        next(AppError.create(i18n.__('TEMPLATE_GENERATION_FAILED'), 500, httpstatustext.ERROR));
    }
});

const getmatingforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create(i18n.__('ANIMAL_NOT_FOUND'), 404, httpstatustext.FAIL);
        return next(error);
    }
    const mating = await Mating.find({ animalId: animal._id });

    if (!mating) {
        const error = AppError.create(i18n.__('MATING_NOT_FOUND'), 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, mating } });

})


const addmating = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { tagId, checkDays, pregnancyAge, ...matingData } = req.body;

    // Validate checkDays if provided
    if (checkDays && ![45, 60, 90].includes(checkDays)) {
        const error = AppError.create(
            'checkDays must be one of: 45, 60, or 90', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Validate pregnancyAge if provided
    if (pregnancyAge && (pregnancyAge < 0 || pregnancyAge > 147)) {
        const error = AppError.create(
            'pregnancyAge must be between 0 and 147 days', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Find the animal with the provided tagId AND owned by the current user
    const animal = await Animal.findOne({ 
        tagId, 
        owner: userId 
    });

    if (!animal) {
        const error = AppError.create(
            'Animal not found for the provided tagId or it does not belong to you', 
            404, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Calculate dates based on provided data
    if (matingData.matingDate) {
        const matingDate = new Date(matingData.matingDate);
        if (isNaN(matingDate.getTime())) {
            const error = AppError.create(
                'Invalid matingDate provided', 
                400, 
                httpstatustext.FAIL
            );
            return next(error);
        }

        // Calculate sonarDate if checkDays is provided
        if (checkDays) {
            const sonarDate = new Date(matingDate);
            sonarDate.setDate(sonarDate.getDate() + checkDays);
            matingData.sonarDate = sonarDate;
        }

        // Calculate expectedDeliveryDate based on pregnancyAge if provided
        if (pregnancyAge) {
            const remainingDays = 147 - pregnancyAge;
            matingData.expectedDeliveryDate = new Date(matingDate.getTime() + remainingDays * 24 * 60 * 60 * 1000);
        } 
        // Otherwise calculate normally if sonarResult is positive
        else if (matingData.sonarRsult === 'positive') {
            const daysToAdd = 147;
            matingData.expectedDeliveryDate = new Date(matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
    }

    const newMating = new Mating({ 
        ...matingData, 
        owner: userId, 
        tagId, 
        checkDays,
        pregnancyAge,
        animalId: animal._id 
    });

    await newMating.save();

    res.json({ 
        status: httpstatustext.SUCCESS, 
        data: { mating: newMating } 
    });
});

const addMatingByLocation = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { locationShed, checkDays, pregnancyAge, ...matingData } = req.body;

    // Validate checkDays if provided
    if (checkDays && ![45, 60, 90].includes(checkDays)) {
        const error = AppError.create(
            'checkDays must be one of: 45, 60, or 90', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Validate pregnancyAge if provided
    if (pregnancyAge && (pregnancyAge < 0 || pregnancyAge > 147)) {
        const error = AppError.create(
            'pregnancyAge must be between 0 and 147 days', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    const femaleAnimals = await Animal.find({ 
        locationShed: locationShed,
        gender: 'female',
        owner: userId
    });

    if (femaleAnimals.length === 0) {
        const error = AppError.create(
            'No female animals found in the specified location or they do not belong to you', 
            404, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Calculate dates based on provided data
    if (matingData.matingDate) {
        const matingDate = new Date(matingData.matingDate);
        if (isNaN(matingDate.getTime())) {
            const error = AppError.create(
                'Invalid matingDate provided', 
                400, 
                httpstatustext.FAIL
            );
            return next(error);
        }

        // Calculate sonarDate if checkDays is provided
        if (checkDays) {
            const sonarDate = new Date(matingDate);
            sonarDate.setDate(sonarDate.getDate() + checkDays);
            matingData.sonarDate = sonarDate;
        }

        // Calculate expectedDeliveryDate based on pregnancyAge if provided
        if (pregnancyAge) {
            const remainingDays = 147 - pregnancyAge;
            matingData.expectedDeliveryDate = new Date(matingDate.getTime() + remainingDays * 24 * 60 * 60 * 1000);
        } 
        // Otherwise calculate normally if sonarResult is positive
        else if (matingData.sonarRsult === 'positive') {
            const daysToAdd = 147;
            matingData.expectedDeliveryDate = new Date(matingDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
    }

    // Create mating records for each female animal
    const newMatings = await Promise.all(
        femaleAnimals.map(async (animal) => {
            const newMating = new Mating({
                ...matingData,
                checkDays,
                pregnancyAge,
                owner: userId,
                tagId: animal.tagId,
                animalId: animal._id,
            });
            await newMating.save();
            return newMating;
        })
    );

    res.json({ 
        status: httpstatustext.SUCCESS, 
        data: { matings: newMatings } 
    });
});

const getsinglemating = asyncwrapper(async (req, res, next) => {
    const matingId = req.params.matingId;

    // Find the Mating document by its ID
    const mating = await Mating.findById(matingId);
    if (!mating) {
        const error = AppError.create('Mating information not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Return the single mating record
    return res.json({ status: httpstatustext.SUCCESS, data: { mating } });
});

const deletemating= asyncwrapper(async(req,res,next)=>{
    const userId = req.user.id;
    const matingId = req.params.matingId;

    // Find the Mating document by its ID
    const mating = await Mating.findOne({ _id: matingId, owner: userId });
    if (!mating) {
        const error = AppError.create('Mating information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Mating.deleteOne({ _id: matingId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Mating information deleted successfully' });

})

const updatemating = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const matingId = req.params.matingId;
    const {pregnancyAge, ...updatedData } = req.body;

    // First verify the mating exists and belongs to the user
    const existingMating = await Mating.findOne({ _id: matingId, owner: userId });
    if (!existingMating) {
        const error = AppError.create(
            'Mating information not found or unauthorized to update', 
            404, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Validate pregnancyAge if provided
    if (pregnancyAge !== undefined && (pregnancyAge < 0 || pregnancyAge > 147)) {
        const error = AppError.create(
            'pregnancyAge must be between 0 and 147 days', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Handle checkDays and sonarDate calculations
    if (updatedData.checkDays && !updatedData.matingDate) {
        updatedData.matingDate = existingMating.matingDate;
    }

    if (updatedData.checkDays && !updatedData.matingDate) {
        const error = AppError.create(
            'Cannot calculate sonarDate: matingDate is required when providing checkDays', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Handle date calculations
    let matingDateToUse;
    if (updatedData.matingDate) {
        matingDateToUse = new Date(updatedData.matingDate);
        if (isNaN(matingDateToUse.getTime())) {
            const error = AppError.create(
                'Invalid matingDate provided', 
                400, 
                httpstatustext.FAIL
            );
            return next(error);
        }

        // Calculate sonarDate if checkDays is provided
        const checkDaysToUse = updatedData.checkDays || existingMating.checkDays;
        if (checkDaysToUse) {
            const sonarDate = new Date(matingDateToUse);
            sonarDate.setDate(sonarDate.getDate() + checkDaysToUse);
            updatedData.sonarDate = sonarDate;
        }
    } else if (existingMating.matingDate) {
        matingDateToUse = new Date(existingMating.matingDate);
    }

    // Handle pregnancyAge and expectedDeliveryDate calculations
    if (pregnancyAge !== undefined && matingDateToUse) {
        const remainingDays = 147 - pregnancyAge;
        updatedData.expectedDeliveryDate = new Date(matingDateToUse.getTime() + remainingDays * 24 * 60 * 60 * 1000);
    } 
    // If sonarResult is being updated to positive and we have matingDate
    else if (updatedData.sonarRsult === 'positive' && matingDateToUse) {
        const daysToAdd = 147;
        updatedData.expectedDeliveryDate = new Date(matingDateToUse.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    } 
    // If sonarResult is being updated to negative
    else if (updatedData.sonarRsult === 'negative') {
        updatedData.expectedDeliveryDate = null;
        updatedData.pregnancyAge = null;
        updatedData.fetusCount = null;
    }

    // Perform the update
    const updatedMating = await Mating.findOneAndUpdate(
        { _id: matingId, owner: userId },
        { ...updatedData, ...(pregnancyAge !== undefined && { pregnancyAge }) },
        { 
            new: true,
            runValidators: true
        }
    );

    res.json({ 
        status: httpstatustext.SUCCESS, 
        data: { mating: updatedMating } 
    });
});

module.exports={
    getAllMating,
    updatemating,
    deletemating,
    addmating,
    getsinglemating,
    getmatingforspacficanimal,
    importMatingFromExcel,
    exportMatingToExcel,
    addMatingByLocation,
    downloadMatingTemplate
}