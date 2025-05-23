const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const Weight=require('../Models/weight.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage(); // Use memory storage to get the file buffer
const i18n = require('../i18n');
const setLocale = require('../middleware/localeMiddleware');
const upload = multer({ storage: storage }).single('file');
const excelOps = require('../utilits/excelOperations');

const exportWeightsToExcel = asyncwrapper(async (req, res, next) => {
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
        if (req.query.weightType) filter.weightType = req.query.weightType;
        
        // Date range filtering
        if (req.query.startDate || req.query.endDate) {
            filter.Date = {};
            if (req.query.startDate) filter.Date.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.Date.$lte = new Date(req.query.endDate);
        }

        const weights = await Weight.find(filter)
            .sort({ Date: 1 })
            .populate('animalId', 'tagId');

        if (weights.length === 0) {
            return res.status(404).json({
                status: httpstatustext.FAIL,
                message: isArabic ? 'لم يتم العثور على سجلات الوزن' : 'No weight records found'
            });
        }

        const headers = excelOps.headers.weight[lang].export;
        const sheetName = excelOps.sheetNames.weight.export[lang];

        const data = weights.map(weight => [
            weight.tagId,
            weight.Date.toISOString().split('T')[0],
            weight.weight,
            weight.height || '',
            weight.weightType,
            weight.createdAt.toISOString().split('T')[0]
        ]);

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths
        const columnWidths = [15, 12, 12, 12, 15, 12];
        excelOps.setColumnWidths(worksheet, columnWidths);

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `weight_records_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export error:', error);
        return next(AppError.create(i18n.__('EXPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const importWeightsFromExcel = asyncwrapper(async (req, res, next) => {
    const userId = req.user?.id || req.userId;
    if (!userId) {
        return next(AppError.create(i18n.__('UNAUTHORIZED'), 401, httpstatustext.FAIL));
    }

    upload(req, res, async function (err) {
        if (err) {
            return next(AppError.create('File upload failed', 400, httpstatustext.FAIL));
        }

        try {
            if (!req.file || !req.file.buffer) {
                return next(AppError.create(i18n.__('NO_FILE_UPLOADED'), 400, httpstatustext.FAIL));
            }

            const data = excelOps.readExcelFile(req.file.buffer);

            // Skip header row
            for (let i = 1; i < data.length; i++) {
                const row = data[i];

                // Skip empty rows
                if (!row || row.length === 0 || row.every(cell => !cell)) continue;

                // Extract and validate data
                const [
                    tagId,
                    dateStr,
                    weightStr,
                    heightStr,
                    weightType
                ] = row.map(cell => cell?.toString().trim());

                // Validate required fields
                if (!tagId || !dateStr || !weightStr || !weightType) {
                    return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

                // Validate weight type
                if (!['birth', 'Weaning', 'regular'].includes(weightType)) {
                    return next(AppError.create(i18n.__('INVALID_WEIGHT_TYPE', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

                // Parse dates
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

                // Parse numeric values
                const weight = parseFloat(weightStr);
                if (isNaN(weight)) {
                    return next(AppError.create(i18n.__('INVALID_WEIGHT_VALUE', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

                let height;
                if (heightStr) {
                    height = parseFloat(heightStr);
                    if (isNaN(height)) {
                        return next(AppError.create(i18n.__('INVALID_HEIGHT_VALUE', { row: i + 1 }), 400, httpstatustext.FAIL));
                    }
                }

                // Verify animal exists
                const animal = await Animal.findOne({ tagId, owner: userId });
                if (!animal) {
                    return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId, row: i + 1 }), 404, httpstatustext.FAIL));
                }

                // Create weight record
                const newWeight = new Weight({
                    tagId,
                    Date: date,
                    weight,
                    height,
                    weightType,
                    owner: userId,
                    animalId: animal._id
                });

                await newWeight.save();
            }

            res.json({
                status: httpstatustext.SUCCESS,
                message: i18n.__('WEIGHTS_IMPORTED_SUCCESSFULLY')
            });
        } catch (error) {
            console.error('Import error:', error);
            return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
        }
    });
});

const getallweight =asyncwrapper(async(req,res)=>{

    const userId = req.user.id;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const filter = { owner: userId };

    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }

    const weight= await Weight.find(filter,{"__v":false}).limit(limit).skip(skip);
    const total = await Weight.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    res.json({
        status:httpstatustext.SUCCESS,
        pagination: {
            page:page,
            limit: limit,
            total: total,
            totalPages:totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
            },
        data:{weight}});
})

const getWeightforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const weight = await Weight.find({ animalId: animal._id });

    if (!weight) {
        const error = AppError.create('Weight information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, weight } });

})

const getsingleWeight = asyncwrapper(async (req, res, next) => {
    const weightId = req.params.weightId;

    // Find the Weight document by its ID
    const weight = await Weight.findById(weightId);
    if (!weight) {
        const error = AppError.create('Weight information not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Return the single Weight record
    return res.json({ status: httpstatustext.SUCCESS, data: { weight } });
});

const addweight = asyncwrapper(async (req, res,next) => {
    const userId = req.user.id;

    // Extract tagId from the request body along with the mating data
    const { tagId, ...weightData } = req.body;

    // Find the animal with the provided tagId
    const animal = await Animal.findOne({  
        tagId,  
        owner: userId, // Ensure the animal belongs to the user  
    });
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }
    const newWeight = new Weight({ ...weightData, owner: userId, tagId, animalId: animal._id });

    await newWeight.save();

    res.json({ status: httpstatustext.SUCCESS, data: { weight: newWeight } });
})

const deleteweight= asyncwrapper(async(req,res,next)=>{
    const userId = req.user.id;
    const weightId = req.params.weightId;

    // Find the Mating document by its ID
    const weight = await Weight.findOne({ _id: weightId, owner: userId });
    if (!weight) {
        const error = AppError.create('Weight information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Weight.deleteOne({ _id: weightId });

    res.json({ status: httpstatustext.SUCCESS, message: 'Weight information deleted successfully' });

})

const updateweight = asyncwrapper(async (req,res,next)=>{
    const userId = req.user.id;
    const weightId = req.params.weightId;
    const updatedData = req.body;

    let weight = await Weight.findOne({ _id: weightId, owner: userId });
        if (!weight) {
            const error = AppError.create('weight information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        weight = await Weight.findOneAndUpdate({ _id: weightId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { weight } });
})

const downloadWeightTemplate = asyncwrapper(async (req, res, next) => {
    try {
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        const headers = excelOps.headers.weight[lang].template;
        const exampleRow = excelOps.templateExamples.weight[lang];
        const sheetName = excelOps.sheetNames.weight.template[lang];

        const workbook = excelOps.createExcelFile([exampleRow], headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];
        excelOps.setColumnWidths(worksheet, headers.map(() => 20));

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `weight_template_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Template Download Error:', error);
        next(AppError.create(i18n.__('TEMPLATE_GENERATION_FAILED'), 500, httpstatustext.ERROR));
    }
});

module.exports={
    updateweight,
    deleteweight,
    addweight,
    getsingleWeight,
    getWeightforspacficanimal,
    getallweight,
    exportWeightsToExcel,
    importWeightsFromExcel,
    downloadWeightTemplate
}