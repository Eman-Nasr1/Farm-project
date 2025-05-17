const Breeding=require('../Models/breeding.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const Mating=require('../Models/mating.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage(); // Use memory storage to get the file buffer
const upload = multer({ storage: storage }).single('file');
const i18n = require('../utilits/i18n');


const getAllBreeding = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    const query = req.query;
    const limit = parseInt(query.limit) || 10;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;

    const filter = { owner: userId };

    if (query.tagId) {
        filter.tagId = query.tagId;
    }

    if (query.deliveryDate) {
        filter.deliveryDate = query.deliveryDate;
    }

    // Get the total count of documents that match the filter
    const totalCount = await Breeding.countDocuments(filter);

    // Find the paginated results
    const breeding = await Breeding.find(filter, { "__v": false })
        .populate({
            path: 'animalId', // This is the field in the Mating schema that references Animal  
            select: 'animalType' // Select only the animalType field from the Animal model  
        })
        .limit(limit)
        .skip(skip);

    // Filter by animalType if the query parameter is provided
    if (query.animalType) {
        const filteredBreedingData = breeding.filter(breeding => breeding.animalId && breeding.animalId.animalType === query.animalType);
        return res.json({
            status: httpstatustext.SUCCESS,
            data: {
                breeding: filteredBreedingData,
                pagination: {
                    total: filteredBreedingData.length,
                    page: page,
                    limit: limit,
                    totalPages: Math.ceil(filteredBreedingData.length / limit)
                }
            }
        });
    }

    // Return the paginated results along with pagination metadata
    res.json({
        status: httpstatustext.SUCCESS,
        data: {
            breeding,
            pagination: {
                total: totalCount,
                page: page,
                limit: limit,
                totalPages: Math.ceil(totalCount / limit)
            }
        }
    });
});

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
                deliveryStates: ['normal', 'difficult', 'assisted', 'caesarean','طبيعية','طبيعيه ب مساعده','متعسرة','قيصرية'],
                motheringAbilities: ['good', 'bad','medium','متوسطة','جيدة','غير جيدة'],
                milkingStatuses: ['no milk', 'one teat','two teat','واحد حلمة','اثنين حلمة',' لا يوجد حليب']
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

                if (!['male', 'female','ذكر','أنثى'].includes(gender)) {
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
                owner: req.user.id
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
        const userId = req.user?.id || req.userId;
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

const getbreedingforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const breeding = await Breeding.find({ animalId: animal._id });

    if (!breeding) {
        const error = AppError.create('breeding information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, breeding} });

})

const getsinglebreeding = asyncwrapper(async (req, res, next) => {
    const breedingId = req.params.breedingId;

    // Find the Breeding document by its ID
    const breeding = await Breeding.findById(breedingId);
    if (!breeding) {
        const error = AppError.create('Breeding information not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Return the single Breeding record
    return res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
});




// const addBreeding = asyncwrapper(async (req, res, next) => {  
//     const userId = req.user.id  

//     // Extract tagId from the request body along with the breeding data  
//     const { tagId, birthEntries, ...breedingData } = req.body;  

//     // Find the animal with the provided tagId  
//     const motherAnimal = await Animal.findOne({  
//         tagId,  
//         owner: userId, // Ensure the animal belongs to the user  
//     });  
 
//     if (!motherAnimal) {  
//         const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);  
//         return next(error);  
//     }  

//     if (motherAnimal.gender !== 'female') {  
//         const error = AppError.create(  
//             'Selected animal is not female (cannot be a mother)',  
//             400,  
//             httpstatustext.FAIL  
//         );  
//         return next(error);  
//     } 

//     // Fetch the last mating record for the mother animal  
//     const lastMating = await Mating.findOne({ animalId: motherAnimal._id }).sort({ createdAt: -1 });  
//     const fatherId = lastMating ? lastMating.maleTag_id : null; // Get the father's tagId from the last mating record  

//     // Create the new Breeding document with birthEntries included  
//     const newBreeding = new Breeding({   
//         ...breedingData,   
//         owner: userId,   
//         tagId,   
//         animalId: motherAnimal._id,   
//         birthEntries // Include birthEntries here  
//     });  
//     await newBreeding.save();  

//     // Insert each birth entry as a new Animal  
//     if (birthEntries && birthEntries.length > 0) {  
//         for (const entry of birthEntries) {  
//             const newAnimal = new Animal({  
//                 tagId: entry.tagId,  
//                 breed: motherAnimal.breed, // Mother's breed  
//                 animalType: motherAnimal.animalType, // Assuming this is provided in each birth entry  
//                 birthDate: newBreeding.deliveryDate, // Set birth date to current date or entry birth date  
//                 gender: entry.gender,  
//                 owner: userId,  
//                 motherId: motherAnimal.tagId,  // Set the motherId  
//                 fatherId: fatherId, // Set the fatherId from the last mating record  
//                 locationShed: motherAnimal.locationShed,
//             });  

//             // Save the new animal document  
//             await newAnimal.save();  
//         }  
//     }  

//     res.json({ status: httpstatustext.SUCCESS, data: { breeding: newBreeding } });  
// });

const addBreeding = asyncwrapper(async (req, res, next) => {  
    const userId = req.user.id;  
    
    // Extract tagId and birthEntries from the request body  
    const { tagId, birthEntries, ...breedingData } = req.body;  

    // Find the mother animal (must belong to the current user)  
    const motherAnimal = await Animal.findOne({  
        tagId,  
        owner: userId, // Ensure the animal belongs to the user  
    });  

    if (!motherAnimal) {  
        const error = AppError.create(  
            'Animal not found or does not belong to you',  
            404,  
            httpstatustext.FAIL  
        );  
        return next(error);  
    }  

    // Check if the mother is female (logical validation)  
    if (motherAnimal.gender !== 'female') {  
        const error = AppError.create(  
            'Selected animal is not female (cannot be a mother)',  
            400,  
            httpstatustext.FAIL  
        );  
        return next(error);  
    }  

    // Fetch the last mating record for the mother to determine the father  
    const lastMating = await Mating.findOne({  
        animalId: motherAnimal._id,  
    }).sort({ createdAt: -1 });  

    const fatherTagId = lastMating ? lastMating.maleTag_id : null;  

    // Create the new Breeding record  
    const newBreeding = new Breeding({  
        ...breedingData,  
        owner: userId,  
        tagId,  
        animalId: motherAnimal._id,  
        birthEntries,  
    });  

    await newBreeding.save();  

    // Process birth entries (create new animals)  
    if (birthEntries && birthEntries.length > 0) {  
        for (const entry of birthEntries) {  
            // Validate required fields for each birth entry  
            if (!entry.tagId || !entry.gender) {  
                console.warn('Skipping invalid birth entry:', entry);  
                continue; // Skip malformed entries (or throw an error)  
            }  

            // Check if the tagId is already used by the user  
            const existingAnimal = await Animal.findOne({  
                tagId: entry.tagId,  
                owner: userId,  
            });  

            if (existingAnimal) {  
                const error = AppError.create(  
                    `Tag ID ${entry.tagId} already exists.`,  
                    400,  
                    httpstatustext.FAIL  
                );
                return next(error);  
            }  

            // Create the new offspring  
            const newAnimal = new Animal({  
                tagId: entry.tagId,  
                breed: motherAnimal.breed, // Inherits mother's breed  
                animalType: motherAnimal.animalType, // e.g., "goat" or "sheep"  
                birthDate: newBreeding.deliveryDate, // Defaults to breeding's delivery date  
                gender: entry.gender,  
                owner: userId,  
                motherId: motherAnimal.tagId,  
                fatherId: fatherTagId, // From last mating record (if available)  
                locationShed: motherAnimal.locationShed, // Inherits mother's shed  
            });  

            await newAnimal.save();  
        }  
    }  

    res.json({  
        status: httpstatustext.SUCCESS,  
        data: { breeding: newBreeding },  
    });  
}); 

const deletebreeding= asyncwrapper(async(req,res,next)=>{
    const userId = req.user.id;
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


// const updatebreeding = asyncwrapper(async (req,res,next)=>{
//     const userId = req.userId;
//     const breedingId = req.params.breedingId;
//     const updatedData = req.body;

//     let breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
//         if (!breeding) {
//             const error = AppError.create('breeding information not found or unauthorized to update', 404, httpstatustext.FAIL);
//             return next(error);
//         }
//         breeding = await Breeding.findOneAndUpdate({ _id: breedingId }, updatedData, { new: true });

//         res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
// })

const updatebreeding = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const breedingId = req.params.breedingId;
    const updatedData = req.body;

    // Find the existing breeding document
    let breeding = await Breeding.findOne({ _id: breedingId, owner: userId });
    if (!breeding) {
        const error = AppError.create('Breeding information not found or unauthorized to update', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Update top-level fields (excluding birthEntries)
    Object.assign(breeding, updatedData);

    // If the deliveryDate is being updated, adjust the weaning dates for birth entries
    if (updatedData.deliveryDate && breeding.birthEntries.length > 0) {
        const newDeliveryDate = new Date(updatedData.deliveryDate);
        const weaningDate = new Date(newDeliveryDate);
        weaningDate.setMonth(weaningDate.getMonth() + 2);

        breeding.birthEntries = breeding.birthEntries.map(entry => {
            entry.expectedWeaningDate = weaningDate;
            return entry;
        });
    }

    // Save the updated breeding document
    await breeding.save();

    res.json({ status: httpstatustext.SUCCESS, data: { breeding } });
});




module.exports={
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