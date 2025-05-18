const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Excluded=require('../Models/excluded.model');
const Animal=require('../Models/animal.model');
const excelOps = require('../utilits/excelOperations');
const i18n = require('../i18n');

const getallexcluded =asyncwrapper(async(req,res)=>{

    const userId = req.user.id;
    const query=req.query;
    const limit=query.limit||10;
    const page=query.page||1;
    const skip=(page-1)*limit;

    const filter = { owner: userId };

    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }
    
    if (query.excludedType) {
        filter.excludedType = query.excludedType; // e.g., 
    }


    const excluded = await Excluded.find(filter, { "__v": false })  
    .populate({  
        path: 'animalId', // This is the field in the Mating schema that references Animal  
        select: 'animalType' // Select only the animalType field from the Animal model  
    })  
    .limit(limit)  
    .skip(skip);  
    const total = await Excluded.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
// If animalType is provided in the query, filter the results  
if (query.animalType) {  
    const filteredexcludedData = excluded.filter(excluded => excluded.animalId && excluded.animalId.animalType === query.animalType);  
    return res.json({ status: httpstatustext.SUCCESS, data: { excluded: filteredexcludedData } });  
}  

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
        data:{excluded}});
})

const getSingleExcluded = asyncwrapper(async (req, res, next) => {
    const excludedId = req.params.excludedId;
    const excluded = await Excluded.findById(excludedId);
    if (!excluded) {
        const error = AppError.create('Excluded information not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    return res.json({ status: httpstatustext.SUCCESS, data: { excluded } });
});

const addexcluded = asyncwrapper(async (req, res,next) => {

    const userId = req.user.id;
    const { tagId, ...excludedData } = req.body;
    const animal = await Animal.findOne({  
        tagId,  
        owner: userId, // Ensure the animal belongs to the user  
    });
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }
    const newExcluded = new Excluded({ ...excludedData, owner: userId, tagId, animalId: animal._id });

    await newExcluded.save();

    res.json({ status: httpstatustext.SUCCESS, data: { excluded: newExcluded } });
})

const updateExcluded = asyncwrapper(async (req,res)=>{
    const userId = req.user.id;
    const excludedId = req.params.excludedId;
    const updatedData = req.body;

    let excluded = await Excluded.findOne({ _id: excludedId, owner: userId });
        if (!excluded) {
            const error = AppError.create('Excluded information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        excluded = await Excluded.findOneAndUpdate({ _id: excludedId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { excluded } });
})

const deleteExcluded= asyncwrapper(async(req,res,next)=>{
    const userId = req.user.id;
    const excludedId = req.params.excludedId;

    const excluded = await Excluded.findOne({ _id: excludedId, owner: userId });
    if (!excluded) {
        const error = AppError.create(i18n.__('EXCLUDED_NOT_FOUND'), 404, httpstatustext.FAIL);
        return next(error);
    }
    await Excluded.deleteOne({ _id: excludedId });

    res.json({ status: httpstatustext.SUCCESS, message: i18n.__('EXCLUDED_DELETED') });
})

const downloadExcludedTemplate = asyncwrapper(async (req, res, next) => {
    const lang = req.query.lang || 'en';
    const headers = excelOps.headers.excluded[lang].template;
    const exampleRow = excelOps.templateExamples.excluded[lang];
    const sheetName = excelOps.sheetNames.excluded.template[lang];

    const workbook = excelOps.createExcelFile([exampleRow], headers, sheetName);
    const worksheet = workbook.Sheets[sheetName];
    excelOps.setColumnWidths(worksheet, headers.map(() => 20));

    const buffer = excelOps.writeExcelBuffer(workbook);
    excelOps.setExcelResponseHeaders(res, `excluded_template_${lang}.xlsx`);
    res.send(buffer);
});

const importExcludedFromExcel = asyncwrapper(async (req, res, next) => {
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
                excludedDateStr,
                excludedType,
                priceStr,
                cause,
                notes
            ] = row.map(cell => cell?.toString().trim());

            // Validate required fields
            if (!tagId || !excludedDateStr || !excludedType) {
                return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Validate excluded type
            if (!['death', 'sale'].includes(excludedType)) {
                return next(AppError.create(i18n.__('INVALID_EXCLUDED_TYPE', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse date
            const excludedDate = new Date(excludedDateStr);
            if (isNaN(excludedDate.getTime())) {
                return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse price if provided
            let price;
            if (priceStr) {
                price = parseFloat(priceStr);
                if (isNaN(price)) {
                    return next(AppError.create(i18n.__('INVALID_PRICE_VALUE', { row: i + 1 }), 400, httpstatustext.FAIL));
                }
            }

            // Verify animal exists
            const animal = await Animal.findOne({ tagId, owner: userId });
            if (!animal) {
                return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Create excluded record
            const newExcluded = new Excluded({
                tagId,
                excludedDate,
                excludedType,
                price,
                cause,
                notes,
                owner: userId,
                animalId: animal._id
            });

            await newExcluded.save();
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: i18n.__('EXCLUDED_IMPORTED_SUCCESSFULLY')
        });
    } catch (error) {
        console.error('Import error:', error);
        return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const exportExcludedToExcel = asyncwrapper(async (req, res, next) => {
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
        if (req.query.excludedType) filter.excludedType = req.query.excludedType;

        const excluded = await Excluded.find(filter)
            .sort({ excludedDate: -1 })
            .populate('animalId', 'animalType');

        if (excluded.length === 0) {
            return res.status(404).json({
                status: httpstatustext.FAIL,
                message: isArabic ? 'لم يتم العثور على سجلات استبعاد' : 'No excluded records found'
            });
        }

        const headers = excelOps.headers.excluded[lang].export;
        const sheetName = excelOps.sheetNames.excluded.export[lang];

        const data = excluded.map(record => [
            record.tagId,
            record.animalId?.animalType || '',
            record.excludedDate?.toISOString().split('T')[0] || '',
            record.excludedType,
            record.price || '',
            record.cause || '',
            record.notes || '',
            record.createdAt?.toISOString().split('T')[0] || ''
        ]);

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths
        const columnWidths = [15, 15, 12, 15, 12, 25, 25, 12];
        excelOps.setColumnWidths(worksheet, columnWidths);

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `excluded_records_${lang}.xlsx`);
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

module.exports={
    deleteExcluded,
    updateExcluded,
    addexcluded ,
    getallexcluded ,
    getSingleExcluded,
    downloadExcludedTemplate,
    importExcludedFromExcel,
    exportExcludedToExcel
}
