const Breeding = require('../Models/breeding.model');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const Animal = require('../Models/animal.model');
const Mating = require('../Models/mating.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage(); // Use memory storage to get the file buffer
const upload = multer({ storage: storage }).single('file');
const i18n = require('../i18n');
const { filterNonExcludedAnimals, assertAnimalNotExcluded } = require('../helpers/excluded');
const Weight = require('../Models/weight.model');
const Excluded = require('../Models/excluded.model');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(d) {
    return d instanceof Date && !Number.isNaN(d.getTime());
}

function buildSchedule(birthDate, ageAtWeaningDays, weightIntervalDays) {
    if (!isValidDate(birthDate) || !ageAtWeaningDays || !weightIntervalDays) return [];
    const dates = [];

    for (let d = weightIntervalDays; d <= ageAtWeaningDays; d += weightIntervalDays) {
        dates.push(new Date(birthDate.getTime() + d * MS_PER_DAY));
    }

    const weaningDate = new Date(birthDate.getTime() + ageAtWeaningDays * MS_PER_DAY);
    // ضمّن يوم الفطام لو مش آخر عنصر
    if (dates.length === 0 || dates[dates.length - 1].getTime() !== weaningDate.getTime()) {
        dates.push(weaningDate);
    }
    return dates;
}
// أعلى ملف الكنترولر:
const toDateOrNull = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};



const getAllBreeding = asyncwrapper(async (req, res) => {
    // Use tenantId for tenant isolation (works for both owner and employee)
    const userId = req.user?.tenantId || req.user?.id;
    if (!userId) {
      return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }
    const q = req.query;
    const limit = parseInt(q.limit, 10) || 10;
    const page = parseInt(q.page, 10) || 1;
    const skip = (page - 1) * limit;

    const filter = { owner: userId };

    // فلتر tagId للأم
    if (q.tagId) filter.tagId = q.tagId;

    // فلتر deliveryDate (مدى)
    const from = toDateOrNull(q.deliveryDateFrom || q.deliveryDate);
    const to = toDateOrNull(q.deliveryDateTo);
    if (from || to) {
        filter.deliveryDate = {};
        if (from) filter.deliveryDate.$gte = from;
        if (to) filter.deliveryDate.$lte = to;
    }

    // فلتر على مواليد محددين (داخل birthEntries)
    if (q.newbornTagId) {
        filter['birthEntries.tagId'] = q.newbornTagId;
    }

    // فلتر animalType بشكل صحيح (بدون تصفية بعد الجلب)
    if (q.animalType) {
        const animalIds = await Animal.find(
            { owner: userId, animalType: q.animalType },
            { _id: 1 }
        ).lean();
        filter.animalId = { $in: animalIds.map(a => a._id) };
    }

    const totalCount = await Breeding.countDocuments(filter);

    const breeding = await Breeding.find(filter, { __v: 0 })
        .populate({ path: 'animalId', select: 'animalType' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(); // أداء أفضل في قراءة فقط

    return res.json({
        status: httpstatustext.SUCCESS,
        data: {
            breeding,
            pagination: {
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        }
    });
});


const getbreedingforspacficanimal = asyncwrapper(async (req, res, next) => {
    // Use tenantId for tenant isolation (works for both owner and employee)
    const userId = req.user?.tenantId || req.user?.id;
    if (!userId) {
      return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }
    const animalId = req.params.animalId;

    const animal = await Animal.findOne({ _id: animalId, owner: userId }).lean();
    if (!animal) {
        return next(AppError.create('Animal not found', 404, httpstatustext.FAIL));
    }

    const breeding = await Breeding.find(
        { animalId: animal._id, owner: userId },
        { __v: 0 }
    )
        .sort({ createdAt: -1 })
        .lean();

    // ملاحظة: find بترجع [] لو مفيش سجلات، فشيك بالطول
    if (!breeding || breeding.length === 0) {
        return next(AppError.create('Breeding information not found for this animal', 404, httpstatustext.FAIL));
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, breeding } });
});


const getsinglebreeding = asyncwrapper(async (req, res, next) => {
    // Use tenantId for tenant isolation (works for both owner and employee)
    const userId = req.user?.tenantId || req.user?.id;
    if (!userId) {
      return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }
    const breedingId = req.params.breedingId;

    const breeding = await Breeding.findOne(
        { _id: breedingId, owner: userId },
        { __v: 0 }
    )
        .populate({ path: 'animalId', select: 'animalType' });

    if (!breeding) {
        return next(AppError.create('Breeding information not found', 404, httpstatustext.FAIL));
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
});

const addBreeding = asyncwrapper(async (req, res, next) => {
    // Use tenantId for tenant isolation (works for both owner and employee)
    const userId = req.user?.tenantId || req.user?.id;
    if (!userId) {
      return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }
    const { tagId, birthEntries = [], ...breedingData } = req.body;

    // 1) الأم
    const motherAnimal = await Animal.findOne({ tagId, owner: userId });
    if (!motherAnimal) {
        return next(AppError.create('Animal not found or does not belong to you', 404, httpstatustext.FAIL));
    }

    const excludedMother = await Excluded.findOne({ animalId: motherAnimal._id, owner: userId });
    if (excludedMother) {
        return next(AppError.create(
            `The selected mother (tagId ${motherAnimal.tagId}) is excluded from the farm (${excludedMother.excludedType}).`,
            400, httpstatustext.FAIL
        ));
    }

    if (motherAnimal.gender !== 'female') {
        return next(AppError.create('Selected animal is not female (cannot be a mother)', 400, httpstatustext.FAIL));
    }

    // 2) الأب من آخر تلقيح
    const lastMating = await Mating.findOne({ animalId: motherAnimal._id }).sort({ createdAt: -1 });
    const fatherTagId = lastMating ? lastMating.maleTag_id : null;

    // 3) ڤاليديشن عام
    if (!breedingData.deliveryDate) {
        return next(AppError.create('deliveryDate is required', 400, httpstatustext.FAIL));
    }
    const deliveryDate = new Date(breedingData.deliveryDate);
    if (!isValidDate(deliveryDate)) {
        return next(AppError.create('Invalid deliveryDate', 400, httpstatustext.FAIL));
    }

    // 4) جهّزي المواليد + plannedWeights
    //    وادعمي birthWeight (من الفرونت) → التخزين في birthweight (في الداتابيز)
    const processedEntries = [];

    // تأكد عدم تكرار tagId داخل نفس الطلب
    const seen = new Set();
    for (const raw of birthEntries) {
        if (!raw?.tagId || !raw?.gender) {
            return next(AppError.create('Each birth entry must include tagId and gender', 400, httpstatustext.FAIL));
        }
        if (seen.has(raw.tagId)) {
            return next(AppError.create(`Duplicate newborn tagId in payload: ${raw.tagId}`, 400, httpstatustext.FAIL));
        }
        seen.add(raw.tagId);

        // حدود
        if (raw.ageAtWeaningDays != null) {
            if (typeof raw.ageAtWeaningDays !== 'number' || raw.ageAtWeaningDays < 1 || raw.ageAtWeaningDays > 90) {
                return next(AppError.create(`ageAtWeaningDays must be 1–90 for ${raw.tagId}`, 400, httpstatustext.FAIL));
            }
        }
        if (raw.weightIntervalDays != null) {
            if (typeof raw.weightIntervalDays !== 'number' || raw.weightIntervalDays < 1) {
                return next(AppError.create(`weightIntervalDays must be ≥ 1 for ${raw.tagId}`, 400, httpstatustext.FAIL));
            }
        }

        const birthweight =
            typeof raw.birthWeight === 'number' ? raw.birthWeight :
                (typeof raw.birthweight === 'number' ? raw.birthweight : undefined);

        const plannedWeights = (raw.ageAtWeaningDays && raw.weightIntervalDays)
            ? buildSchedule(deliveryDate, raw.ageAtWeaningDays, raw.weightIntervalDays)
            : [];

        processedEntries.push({
            tagId: raw.tagId,
            gender: raw.gender,
            birthweight,
            ageAtWeaningDays: raw.ageAtWeaningDays,
            weightIntervalDays: raw.weightIntervalDays,
            plannedWeights,
            owner: userId
        });
    }

    // 5) أنشئ سجل الولادة
    const breeding = new Breeding({
        ...breedingData,
        tagId,
        owner: userId,
        animalId: motherAnimal._id,
        numberOfBirths: processedEntries.length,
        birthEntries: processedEntries
    });
    await breeding.save();

    // 6) أنشئ حيوانات المواليد + وزن الميلاد (اختياري)
    const frontendUrl = process.env.FRONTEND_URL || 'https://mazraaonline.com';
    const createdAnimals = [];

    for (const entry of processedEntries) {
        const exists = await Animal.findOne({ tagId: entry.tagId, owner: userId });
        if (exists) {
            return next(AppError.create(`Tag ID ${entry.tagId} already exists.`, 400, httpstatustext.FAIL));
        }

        const newAnimal = new Animal({
            tagId: entry.tagId,
            breed: motherAnimal.breed,
            animalType: motherAnimal.animalType,
            birthDate: deliveryDate,
            gender: entry.gender,
            owner: userId,
            motherId: motherAnimal.tagId,
            fatherId: fatherTagId,
            locationShed: motherAnimal.locationShed
        });
        await newAnimal.save();
        // qrToken is automatically generated by pre('save') hook in Animal model

        // Generate QR link for the new animal
        const qrLink = `${frontendUrl}/scan/${newAnimal.qrToken}`;
        createdAnimals.push({
            tagId: newAnimal.tagId,
            animalId: newAnimal._id,
            qrToken: newAnimal.qrToken,
            qrLink
        });

        if (typeof entry.birthweight === 'number') {
            await Weight.create({
                tagId: entry.tagId,
                Date: deliveryDate,
                weight: entry.birthweight,
                weightType: 'birth',
                owner: userId,
                animalId: newAnimal._id
            });
        }
    }

    // 7) ريسبونس مختصر لخطط الأوزان
    const plans = breeding.birthEntries.map(e => ({
        tagId: e.tagId,
        plannedWeightsCount: e.plannedWeights?.length || 0,
        plannedWeightsDates: e.plannedWeights || []
    }));

    res.json({
        status: httpstatustext.SUCCESS,
        data: { 
            breeding, 
            plans,
            createdAnimals // Include animals with qrToken and qrLink
        }
    });
});


const updatebreeding = asyncwrapper(async (req, res, next) => {
    // Use tenantId for tenant isolation (works for both owner and employee)
    const userId = req.user?.tenantId || req.user?.id;
    if (!userId) {
      return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }
    const breedingId = req.params.breedingId;
    const payload = req.body;

    // 1) هات السجل
    const breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
    if (!breeding) {
        return next(AppError.create('Breeding information not found or unauthorized to update', 404, httpstatustext.FAIL));
    }

    // 2) فصل حقول المستوى الأعلى عن المواليد
    const { birthEntries: incomingEntries, ...topLevel } = payload;

    // ڤاليديشن deliveryDate لو موجودة
    let deliveryDateChanged = false;
    if (Object.prototype.hasOwnProperty.call(topLevel, 'deliveryDate')) {
        const newDeliveryDate = new Date(topLevel.deliveryDate);
        if (!isValidDate(newDeliveryDate)) {
            return next(AppError.create('Invalid deliveryDate', 400, httpstatustext.FAIL));
        }
        if (!breeding.deliveryDate || newDeliveryDate.getTime() !== new Date(breeding.deliveryDate).getTime()) {
            deliveryDateChanged = true;
            breeding.deliveryDate = newDeliveryDate;
        }
        delete topLevel.deliveryDate;
    }

    // طبّق باقي حقول المستوى الأعلى ببساطة
    if (Object.keys(topLevel).length > 0) {
        Object.assign(breeding, topLevel);
    }

    const deliveryDate = new Date(breeding.deliveryDate);

    // 3) معالجة المواليد لو وصلوا
    if (Array.isArray(incomingEntries) && incomingEntries.length > 0) {
        // منع تكرار tagId في نفس الـ payload
        const seen = new Set();
        for (const raw of incomingEntries) {
            if (!raw?.tagId) {
                return next(AppError.create('Each birth entry must include tagId', 400, httpstatustext.FAIL));
            }
            if (seen.has(raw.tagId)) {
                return next(AppError.create(`Duplicate newborn tagId in payload: ${raw.tagId}`, 400, httpstatustext.FAIL));
            }
            seen.add(raw.tagId);
        }

        for (const raw of incomingEntries) {
            const idx = breeding.birthEntries.findIndex(e => e.tagId === raw.tagId);
            const birthweight =
                typeof raw.birthWeight === 'number' ? raw.birthWeight :
                    (typeof raw.birthweight === 'number' ? raw.birthweight : undefined);

            // ڤاليديشن الحدود
            if (raw.ageAtWeaningDays != null) {
                if (typeof raw.ageAtWeaningDays !== 'number' || raw.ageAtWeaningDays < 1 || raw.ageAtWeaningDays > 90) {
                    return next(AppError.create(`ageAtWeaningDays must be 1–90 for ${raw.tagId}`, 400, httpstatustext.FAIL));
                }
            }
            if (raw.weightIntervalDays != null) {
                if (typeof raw.weightIntervalDays !== 'number' || raw.weightIntervalDays < 1) {
                    return next(AppError.create(`weightIntervalDays must be ≥ 1 for ${raw.tagId}`, 400, httpstatustext.FAIL));
                }
            }

            // تحديث موجود أو إضافة جديد
            if (idx >= 0) {
                const entry = breeding.birthEntries[idx];

                // حقول قابلة للتحديث
                if (raw.gender) entry.gender = raw.gender; // لو حابة تمنعي تغيير الجنس احذفي السطر
                if (birthweight != null) entry.birthweight = birthweight;
                if (raw.ageAtWeaningDays != null) entry.ageAtWeaningDays = raw.ageAtWeaningDays;
                if (raw.weightIntervalDays != null) entry.weightIntervalDays = raw.weightIntervalDays;

                // إعادة بناء الجدول لو لزم الأمر
                if (
                    deliveryDateChanged ||
                    raw.ageAtWeaningDays != null ||
                    raw.weightIntervalDays != null
                ) {
                    if (entry.ageAtWeaningDays && entry.weightIntervalDays) {
                        entry.plannedWeights = buildSchedule(deliveryDate, entry.ageAtWeaningDays, entry.weightIntervalDays);
                    } else {
                        entry.plannedWeights = [];
                    }
                }
            } else {
                // إضافة مولود جديد
                const newEntry = {
                    tagId: raw.tagId,
                    gender: raw.gender || 'male', // default بسيط لو مش مرسل
                    birthweight: birthweight,
                    ageAtWeaningDays: raw.ageAtWeaningDays,
                    weightIntervalDays: raw.weightIntervalDays,
                    plannedWeights: (raw.ageAtWeaningDays && raw.weightIntervalDays)
                        ? buildSchedule(deliveryDate, raw.ageAtWeaningDays, raw.weightIntervalDays)
                        : [],
                    owner: userId
                };
                breeding.birthEntries.push(newEntry);

                // إنشاء Animal للحالة الجديدة لو مش موجود
                const exists = await Animal.findOne({ tagId: newEntry.tagId, owner: userId });
                if (!exists) {
                    // حاول توريث خصائص من الأم
                    const mother = await Animal.findOne({ _id: breeding.animalId, owner: userId });
                    const fatherTagId = (await Mating.findOne({ animalId: breeding.animalId }).sort({ createdAt: -1 }))?.maleTag_id || null;

                    const newAnimal = new Animal({
                        tagId: newEntry.tagId,
                        breed: mother?.breed,
                        animalType: mother?.animalType,
                        birthDate: deliveryDate,
                        gender: newEntry.gender,
                        owner: userId,
                        motherId: mother?.tagId,
                        fatherId: fatherTagId,
                        locationShed: mother?.locationShed
                    });
                    await newAnimal.save();

                    if (typeof newEntry.birthweight === 'number') {
                        await Weight.create({
                            tagId: newEntry.tagId,
                            Date: deliveryDate,
                            weight: newEntry.birthweight,
                            weightType: 'birth',
                            owner: userId,
                            animalId: newAnimal._id
                        });
                    }
                }
            }
        }

        // عدّلي عدد المواليد
        breeding.numberOfBirths = breeding.birthEntries.length;
    }

    // 4) احفظ التعديلات
    await breeding.save();

    // 5) ريسبونس مختصر
    const plans = breeding.birthEntries.map(e => ({
        tagId: e.tagId,
        plannedWeightsCount: e.plannedWeights?.length || 0,
        plannedWeightsDates: e.plannedWeights || []
    }));

    res.json({
        status: httpstatustext.SUCCESS,
        data: { breeding, plans }
    });
});

const deletebreeding = asyncwrapper(async (req, res, next) => {
    // Use tenantId for tenant isolation (works for both owner and employee)
    const userId = req.user?.tenantId || req.user?.id;
    if (!userId) {
      return next(AppError.create('Unauthorized', 401, httpstatustext.FAIL));
    }
    const breedingId = req.params.breedingId;

    // Find the breeding document by its ID
    const breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
    if (!breeding) {
        const error = AppError.create('breeding information not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }
    await Breeding.deleteOne({ _id: breedingId });

    res.json({ status: httpstatustext.SUCCESS, message: 'breedinginformation deleted successfully' });

})
const downloadBreedingTemplate = asyncwrapper(async (req, res, next) => {
    try {
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        const headersEn = [
            'Mother Tag ID',
            'Delivery Date (YYYY-MM-DD)',
            'Delivery State (normal, difficult, assisted, caesarean)',
            'Mothering Ability (good, bad, medium)',
            'Milking Status (no milk, one teat, two teat)',
            'Total Births',
            'Birth 1 Tag ID',
            'Birth 1 Gender (male, female)',
            'Birth 1 Weight (kg)',
            'Birth 2 Tag ID',
            'Birth 2 Gender (male, female)',
            'Birth 2 Weight (kg)',
            // You can add more birth entries if needed
        ];

        const headersAr = [
            'رقم تعريف الأم',
            'تاريخ الولادة (YYYY-MM-DD)',
            'حالة الولادة (طبيعية، متعسرة، طبيعيه ب مساعده، قيصرية)',
            'قدرة الأمومة (جيدة، غير جيدة، متوسطة)',
            'حالة الحلب ( لا يوجد حليب، واحد حلمة، اثنين حلمة)',
            'عدد الولادات',
            'رقم 1 للمولود',
            'جنس المولود 1 (ذكر، أنثى)',
            'وزن المولود 1 (كجم)',
            'رقم 2 للمولود',
            'جنس المولود 2 (ذكر، أنثى)',
            'وزن المولود 2 (كجم)',
        ];

        const headers = isArabic ? headersAr : headersEn;

        const exampleRow = isArabic
            ? ['123', '2024-01-01', 'طبيعية', 'جيدة', 'واحد حلمة', 2, 'B1', 'ذكر', 3.2, 'B2', 'أنثى', 2.8]
            : ['123', '2024-01-01', 'normal', 'good', 'one teat', 2, 'B1', 'male', 3.2, 'B2', 'female', 2.8];

        const worksheetData = [headers, exampleRow];

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

        worksheet['!cols'] = headers.map(() => ({ wch: 22 }));

        xlsx.utils.book_append_sheet(workbook, worksheet, isArabic ? 'نموذج الاستيراد' : 'Import Template');

        const buffer = xlsx.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
        });

        res.setHeader('Content-Disposition', `attachment; filename="breeding_template_${lang}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Template Download Error:', error);
        next(AppError.create(i18n.__('TEMPLATE_GENERATION_FAILED'), 500, httpstatustext.ERROR));
    }
});

const importBreedingFromExcel = asyncwrapper(async (req, res, next) => {
    upload(req, res, async function (err) {
        if (err) {
            return next(AppError.create('File upload failed', 400, httpstatustext.FAIL));
        }

        const fileBuffer = req.file.buffer;
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows  
            if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) {
                continue;
            }

            // Parse main fields with new column indexes
            const motherTagId = row[0]?.toString().trim();
            const deliveryState = row[2]?.toString().trim();
            const deliveryDate = new Date(row[1]?.toString().trim());
            const motheringAbility = row[3]?.toString().trim();
            const milkingStatus = row[4]?.toString().trim();
            const numberOfBirths = parseInt(row[5]);

            // Validate essential fields  
            if (!motherTagId ||
                !deliveryState ||
                isNaN(deliveryDate.getTime()) ||
                !motheringAbility ||
                !milkingStatus ||
                isNaN(numberOfBirths)) {
                return next(AppError.create(`Required fields are missing or invalid in row ${i + 1}`, 400, httpstatustext.FAIL));
            }

            // Validate enum values
            const validEnums = {
                deliveryStates: ['normal', 'difficult', 'assisted', 'caesarean', 'طبيعية', 'طبيعيه ب مساعده', 'متعسرة', 'قيصرية'],
                motheringAbilities: ['good', 'bad', 'medium', 'متوسطة', 'جيدة', 'غير جيدة'],
                milkingStatuses: ['no milk', 'one teat', 'two teat', 'واحد حلمة', 'اثنين حلمة', ' لا يوجد حليب']
            };

            if (!validEnums.deliveryStates.includes(deliveryState)) {
                return next(AppError.create(i18n.__('INVALID_DELIVERY_STATE', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            if (!validEnums.motheringAbilities.includes(motheringAbility)) {
                return next(AppError.create(i18n.__('INVALID_MOTHERING_ABILITY', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            if (!validEnums.milkingStatuses.includes(milkingStatus)) {
                return next(AppError.create(i18n.__('INVALID_MILKING_STATUS', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            const birthEntries = [];

            // Process birth entries with new column indexes
            for (let j = 0; j < numberOfBirths; j++) {
                const baseIndex = 6 + (j * 3);
                const tagId = row[baseIndex]?.toString().trim();
                const gender = row[baseIndex + 1]?.toString().trim().toLowerCase();
                const weight = row[baseIndex + 2];

                // Validate birth entry
                if (!tagId || !gender) {
                    return next(AppError.create(`Missing required birth fields in row ${i + 1}, entry ${j + 1}`, 400, httpstatustext.FAIL));
                }

                if (!['male', 'female', 'ذكر', 'أنثى'].includes(gender)) {
                    return next(AppError.create(`Invalid gender in row ${i + 1}, entry ${j + 1}`, 400, httpstatustext.FAIL));
                }

                birthEntries.push({
                    tagId,
                    gender,
                    birthweight: weight ? parseFloat(weight) : null
                });
            }

            // Create new breeding object with all fields
            const newBreeding = new Breeding({
                tagId: motherTagId,
                deliveryState,
                deliveryDate,
                motheringAbility,
                milking: milkingStatus,
                numberOfBirths,
                birthEntries,
                owner: userId
            });

            await newBreeding.save();
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: 'Breeding data imported successfully',
        });
    });
});

const exportBreedingToExcel = asyncwrapper(async (req, res, next) => {
    try {
        // Use tenantId for tenant isolation (works for both owner and employee)
        const userId = req.user?.tenantId || req.user?.id || req.userId;
        if (!userId) {
            return next(AppError.create('Unauthorized access', 401, httpstatustext.FAIL));
        }

        const { startDate, endDate, deliveryState, lang = 'en' } = req.query;
        const isArabic = lang === 'ar';

        const filter = { owner: userId };

        if (startDate || endDate) {
            filter.deliveryDate = {};
            if (startDate) filter.deliveryDate.$gte = new Date(startDate);
            if (endDate) filter.deliveryDate.$lte = new Date(endDate);
        }

        if (deliveryState) filter.deliveryState = deliveryState;

        const records = await Breeding.find(filter)
            .populate({
                path: 'animalId',
                select: 'tagId animalType'
            })
            .sort({ deliveryDate: -1 });

        if (!records.length) {
            return next(AppError.create('No breeding records found', 404, httpstatustext.FAIL));
        }

        const headersEn = [
            'Mother Tag ID',
            'Delivery Date',
            'Delivery State',
            'Mothering Ability',
            'Milking Status',
            'Total Births',
        ];

        const headersAr = [
            'رقم تعريف الأم',
            'تاريخ الولادة',
            'حالة الولادة',
            'قدرة الأمومة',
            'حالة الحلب',
            'إجمالي الولادات',
        ];

        const headers = isArabic ? [...headersAr] : [...headersEn];

        const maxBirths = Math.max(...records.map(r => r.birthEntries?.length || 0));

        for (let i = 1; i <= maxBirths; i++) {
            if (isArabic) {
                headers.push(`رقم ${i} للمولود`, `جنس المولود ${i}`, `وزن المولود ${i} (كجم)`);
            } else {
                headers.push(`Birth ${i} Tag ID`, `Birth ${i} Gender`, `Birth ${i} Weight (kg)`);
            }
        }

        const worksheetData = [headers];

        for (const record of records) {

            const row = [
                record.animalId?.tagId || 'N/A',
                record.deliveryDate?.toISOString().split('T')[0] || (isArabic ? 'تاريخ غير صالح' : 'Invalid Date'),

                record.deliveryState,
                record.motheringAbility || (isArabic ? 'غير مصنفة' : 'Not Rated'),
                record.milking || (isArabic ? 'غير معروف' : 'Unknown'),
                record.numberOfBirths ?? record.birthEntries?.length ?? 0
            ];

            if (record.birthEntries?.length > 0) {
                record.birthEntries.forEach(entry => {
                    const genderTranslated = isArabic
                        ? (entry.gender?.toLowerCase() === 'male' ? 'ذكر' : 'أنثى')
                        : (entry.gender?.toLowerCase() === 'male' ? 'Male' : 'Female');

                    row.push(
                        entry.tagId || 'N/A',
                        genderTranslated,
                        entry.birthweight?.toFixed(2) || '0.00'
                    );
                });
            }

            while (row.length < headers.length) {
                row.push('');
            }

            worksheetData.push(row);
        }

        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);

        const colWidths = [
            { wch: 18 }, // Mother Tag ID
            { wch: 15 }, // Delivery Date
            { wch: 20 }, // Delivery State
            { wch: 20 }, // Mothering Ability
            { wch: 18 }, // Milking Status
            { wch: 14 }, // Total Births
            ...Array(maxBirths * 3).fill({ wch: 18 }) // Birth entry fields
        ];
        worksheet['!cols'] = colWidths;

        xlsx.utils.book_append_sheet(workbook, worksheet, isArabic ? 'سجلات الولادة' : 'Breeding Records');

        const buffer = xlsx.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx'
        });

        res.setHeader('Content-Disposition', `attachment; filename="breeding_records_${lang}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Export Error:', error);
        next(AppError.create(`Export failed: ${error.message}`, 500, httpstatustext.ERROR));
    }
});


module.exports = {
    updatebreeding,
    deletebreeding,
    addBreeding,
    getbreedingforspacficanimal,
    getsinglebreeding,
    getAllBreeding,
    importBreedingFromExcel,
    exportBreedingToExcel,
    downloadBreedingTemplate,

}