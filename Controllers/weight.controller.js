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

const addweight = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { tagId, Date: rawDate, weight, ...rest } = req.body;

    const weightDate = new Date(rawDate);
    if (isNaN(weightDate)) {
        return next(AppError.create('Invalid date format', 400, httpstatustext.FAIL));
    }

    const animal = await Animal.findOne({ tagId, owner: userId });
    if (!animal) {
        return next(AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL));
    }

    // Get the first weight
    const firstWeight = await Weight.findOne({ 
        animalId: animal._id 
    }).sort({ Date: 1 });

    let ADG = null;
    let conversionEfficiency = null;

    if (firstWeight && firstWeight.Date.getTime() !== weightDate.getTime()) {
        const weightDiffKg = weight - firstWeight.weight;
        const daysDiff = Math.ceil((weightDate - firstWeight.Date) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 0 && weightDiffKg > 0) {
            // Calculate and limit to 2 decimal places
            ADG = parseFloat(((weightDiffKg * 1000) / daysDiff).toFixed(2));
            conversionEfficiency = parseFloat((ADG / (firstWeight.weight * 1000) * 100).toFixed(2));
        }
    }

    const newWeight = new Weight({
        tagId,
        Date: weightDate,
        weight,
        ...rest,
        owner: userId,
        animalId: animal._id,
        ADG,
        conversionEfficiency
    });

    await newWeight.save();

    res.json({
        status: httpstatustext.SUCCESS,
        data: { weight: newWeight }
    });
});
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

const updateweight = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const weightId = req.params.weightId;
    const updatedData = req.body;

    // 1. التأكد من وجود الوزن وأنه تابع للمستخدم
    const weight = await Weight.findOne({ _id: weightId, owner: userId });
    if (!weight) {
        return next(AppError.create('الوزن غير موجود أو غير مصرح بتعديله', 404, httpstatustext.FAIL));
    }

    // 2. التحقق من تنسيق التاريخ إذا تم تقديمه
    if (updatedData.Date) {
        const newDate = new Date(updatedData.Date);
        if (isNaN(newDate)) {
            return next(AppError.create('تنسيق التاريخ غير صحيح', 400, httpstatustext.FAIL));
        }
        updatedData.Date = newDate;
    }

    // 3. تحديث البيانات الأساسية أولًا
    const updatedWeight = await Weight.findOneAndUpdate(
        { _id: weightId },
        updatedData,
        { new: true }
    );

    // 4. جلب أول وزن وآخر وزن للحيوان
    const [firstWeight, lastWeight] = await Promise.all([
        Weight.findOne({ animalId: weight.animalId }).sort({ Date: 1 }), // أول وزن
        Weight.findOne({ animalId: weight.animalId }).sort({ Date: -1 }), // آخر وزن
    ]);

    // 5. حساب ADG وكفاءة التحويل (فقط بين أول وآخر وزن)
    let ADG = null;
    let conversionEfficiency = null;

    if (firstWeight && lastWeight && firstWeight._id.toString() !== lastWeight._id.toString()) {
        const totalWeightDiffKg = lastWeight.weight - firstWeight.weight;
        const totalDaysDiff = Math.ceil((lastWeight.Date - firstWeight.Date) / (1000 * 60 * 60 * 24));

        if (totalDaysDiff > 0) {
            ADG = (totalWeightDiffKg * 1000) / totalDaysDiff; // جرام/يوم
            conversionEfficiency = (ADG / (firstWeight.weight * 1000)) * 100; // النسبة المئوية
        }
    }

    // 6. تحديث ADG في آخر وزن فقط (لأنه يعتمد على أول وآخر وزن)
    if (lastWeight) {
        await Weight.updateOne(
            { _id: lastWeight._id },
            { ADG, conversionEfficiency }
        );
    }

    // 7. إرسال النتيجة
    res.json({
        status: httpstatustext.SUCCESS,
        data: { weight: updatedWeight },
    });
});

const getAnimalWithGrowthData = asyncwrapper(async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { animalId } = req.params;  // Changed from tagId to animalId

        // 1. Find the animal by ID
        const animal = await Animal.findOne({ _id: animalId, owner: userId });
        if (!animal) {
            return next(AppError.create('Animal not found', 404, httpstatustext.FAIL));
        }

        // 2. Get first and last weight records
        const [firstWeight, lastWeight] = await Promise.all([
            Weight.findOne({ animalId: animal._id }).sort({ Date: 1 }),
            Weight.findOne({ animalId: animal._id }).sort({ Date: -1 })
        ]);

        // 3. Calculate overall ADG and conversion efficiency
        let ADG = null;
        let conversionEfficiency = null;
        let growthPeriodDays = null;

        if (firstWeight && lastWeight && firstWeight._id.toString() !== lastWeight._id.toString()) {
            const weightDiffKg = lastWeight.weight - firstWeight.weight;
            growthPeriodDays = Math.ceil((lastWeight.Date - firstWeight.Date) / (1000 * 60 * 60 * 24));

            if (growthPeriodDays > 0 && weightDiffKg > 0) {
                ADG = parseFloat(((weightDiffKg * 1000) / growthPeriodDays).toFixed(2));
                conversionEfficiency = parseFloat(((ADG / (firstWeight.weight * 1000)) * 100).toFixed(2));
            }
        }

        // 4. Prepare response
        const response = {
            status: httpstatustext.SUCCESS,
            data: {
                animal: {
                    _id: animal._id,
                    tagId: animal.tagId,
                    name: animal.name,
                    // include other animal fields as needed
                },
                growthData: {
                    firstWeight: firstWeight ? {
                        date: firstWeight.Date,
                        weight: firstWeight.weight,
                        weightType: firstWeight.weightType
                    } : null,
                    lastWeight: lastWeight ? {
                        date: lastWeight.Date,
                        weight: lastWeight.weight,
                        weightType: lastWeight.weightType,
                        ADG: lastWeight.ADG,
                        conversionEfficiency: lastWeight.conversionEfficiency
                    } : null,
                    overallGrowth: {
                        ADG,
                        conversionEfficiency,
                        growthPeriodDays,
                        totalWeightGain: firstWeight && lastWeight ? lastWeight.weight - firstWeight.weight : null
                    }
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error fetching animal growth data:', error);
        return next(AppError.create('Failed to fetch animal growth data', 500, httpstatustext.ERROR));
    }
});
const getAllAnimalsWithGrowthData = asyncwrapper(async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { tagId = '', page = 1, limit = 10 } = req.query;

        const currentPage = parseInt(page);
        const perPage = parseInt(limit);

        const filter = { owner: userId };
        if (tagId) {
            filter.tagId = { $regex: tagId, $options: 'i' };
        }

        // جلب كل الحيوانات (بدون pagination هنا)
        const animals = await Animal.find(filter);

        const animalsWithGrowthData = await Promise.all(
            animals.map(async (animal) => {
                const [firstWeight, lastWeight] = await Promise.all([
                    Weight.findOne({ animalId: animal._id }).sort({ Date: 1 }),
                    Weight.findOne({ animalId: animal._id }).sort({ Date: -1 })
                ]);

                let ADG = null;
                let conversionEfficiency = null;
                let growthPeriodDays = null;

                if (firstWeight && lastWeight && firstWeight._id.toString() !== lastWeight._id.toString()) {
                    const weightDiffKg = lastWeight.weight - firstWeight.weight;
                    growthPeriodDays = Math.ceil((lastWeight.Date - firstWeight.Date) / (1000 * 60 * 60 * 24));

                    if (growthPeriodDays > 0 && weightDiffKg > 0) {
                        ADG = parseFloat(((weightDiffKg * 1000) / growthPeriodDays).toFixed(2));
                        conversionEfficiency = parseFloat(((ADG / (firstWeight.weight * 1000)) * 100).toFixed(2));
                    }
                }

                return {
                    _id: animal._id,
                    tagId: animal.tagId,
                    name: animal.name,
                    growthData: {
                        firstWeight: firstWeight ? {
                            date: firstWeight.Date,
                            weight: firstWeight.weight,
                            weightType: firstWeight.weightType
                        } : null,
                        lastWeight: lastWeight ? {
                            date: lastWeight.Date,
                            weight: lastWeight.weight,
                            weightType: lastWeight.weightType,
                            ADG: lastWeight.ADG,
                            conversionEfficiency: lastWeight.conversionEfficiency
                        } : null,
                        overallGrowth: {
                            ADG,
                            conversionEfficiency,
                            growthPeriodDays,
                            totalWeightGain: firstWeight && lastWeight ? lastWeight.weight - firstWeight.weight : null
                        }
                    }
                };
            })
        );

        // فلترة اللي ليهم بيانات نمو فقط
        const validAnimals = animalsWithGrowthData.filter(animal =>
            animal.growthData.overallGrowth.ADG !== null &&
            animal.growthData.overallGrowth.conversionEfficiency !== null
        );

        const total = validAnimals.length;
        const totalPages = Math.ceil(total / perPage);

        // Apply pagination بعد الفلترة
        const paginatedData = validAnimals.slice((currentPage - 1) * perPage, currentPage * perPage);

        res.json({
            status: httpstatustext.SUCCESS,
            data: paginatedData,
            pagination: {
                total,
                page: currentPage,
                limit: perPage,
                totalPages
            }
        });

    } catch (error) {
        console.error('Error fetching animals growth data:', error);
        return next(AppError.create('Failed to fetch animals growth data', 500, httpstatustext.ERROR));
    }
});



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
            const weightsToImport = [];
            const animalsCache = new Map(); // Cache for animal lookups

            // Phase 1: Data validation and preparation
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0 || row.every(cell => !cell)) continue;

                const [tagId, dateStr, weightStr, heightStr, weightType] = row.map(cell => cell?.toString().trim());

                // Validation checks
                if (!tagId || !dateStr || !weightStr || !weightType) {
                    return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

                if (!['birth', 'Weaning', 'regular'].includes(weightType)) {
                    return next(AppError.create(i18n.__('INVALID_WEIGHT_TYPE', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
                }

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

                // Check animal cache first
                let animal;
                if (animalsCache.has(tagId)) {
                    animal = animalsCache.get(tagId);
                } else {
                    animal = await Animal.findOne({ tagId, owner: userId });
                    if (animal) animalsCache.set(tagId, animal);
                }

                if (!animal) {
                    return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId, row: i + 1 }), 404, httpstatustext.FAIL));
                }

                weightsToImport.push({
                    tagId,
                    date,
                    weight,
                    height,
                    weightType,
                    animalId: animal._id
                });
            }

            // Phase 2: Process imports with calculations
            const importResults = [];
            const animalFirstWeights = new Map();

            // First pass: Get first weights for all animals
            for (const weightData of weightsToImport) {
                if (!animalFirstWeights.has(weightData.animalId.toString())) {
                    const firstWeight = await Weight.findOne({
                        animalId: weightData.animalId
                    }).sort({ Date: 1 });
                    animalFirstWeights.set(weightData.animalId.toString(), firstWeight);
                }
            }

            // Second pass: Process imports
            for (const weightData of weightsToImport) {
                const firstWeight = animalFirstWeights.get(weightData.animalId.toString());
                
                let ADG = null;
                let conversionEfficiency = null;

                if (firstWeight && firstWeight.Date.getTime() !== weightData.date.getTime()) {
                    const weightDiffKg = weightData.weight - firstWeight.weight;
                    const daysDiff = Math.ceil((weightData.date - firstWeight.Date) / (1000 * 60 * 60 * 24));

                    if (daysDiff > 0 && weightDiffKg > 0) {
                        // Calculate with 2 decimal places
                        ADG = parseFloat(((weightDiffKg * 1000) / daysDiff).toFixed(2));
                        conversionEfficiency = parseFloat(((ADG / (firstWeight.weight * 1000)) * 100).toFixed(2));
                    }
                }

                const newWeight = new Weight({
                    tagId: weightData.tagId,
                    Date: weightData.date,
                    weight: weightData.weight,
                    height: weightData.height,
                    weightType: weightData.weightType,
                    owner: userId,
                    animalId: weightData.animalId,
                    ADG,
                    conversionEfficiency
                });

                await newWeight.save();
                importResults.push(newWeight);
            }

            res.json({
                status: httpstatustext.SUCCESS,
                message: i18n.__('WEIGHTS_IMPORTED_SUCCESSFULLY'),
                data: {
                    importedCount: importResults.length,
                    firstWeightCalculations: animalFirstWeights.size
                }
            });

        } catch (error) {
            console.error('Import error:', error);
            return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
        }
    });
});

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
    downloadWeightTemplate,
    getAnimalWithGrowthData,
    getAllAnimalsWithGrowthData,
}