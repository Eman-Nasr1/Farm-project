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

            const breedingTagId = row[0]?.toString().trim(); // Main tag ID for the breeding  
            const deliveryState = row[1]?.toString().trim();  
            const deliveryDate = new Date(row[2]?.toString().trim());  
            const numberOfBirths = parseInt(row[3]); // Number of births  

            // Validate essential fields  
            if (!breedingTagId || !deliveryDate || isNaN(numberOfBirths)) {  
                return next(AppError.create(`Required fields are missing or invalid in row ${i + 1}`, 400, httpstatustext.FAIL));  
            }  

            // Validate delivery date  
            if (isNaN(deliveryDate.getTime())) {  
                return next(AppError.create(`Invalid date format in row ${i + 1}`, 400, httpstatustext.FAIL));  
            }  

            const birthEntries = []; // Array to hold birth entry objects  

            // Process birth entries based on the number of births  
            for (let j = 0; j < numberOfBirths; j++) {  
                const tagIdColumnIndex = 4 + (j * 3);
                const weightColumnIndex = 5 + (j * 3); // Assuming weight is in columns 5, 7, 9, etc.  
                const genderColumnIndex = 6 + (j * 3); // Assuming gender is in columns 6, 8, 10, etc.

                const birthID = row[tagIdColumnIndex]; 
                const birthWeight = row[weightColumnIndex];  
                const birthGender = row[genderColumnIndex];  

                // Ensure birth entries are valid  
                if ( birthID||birthWeight || birthGender) { // Only add valid entries  
                    // Generate a unique tag ID for each birth (i.e., concatenate breeding tag with entry index)  
                    //const birthTagId = `${breedingTagId}-B${j + 1}`;  

                    birthEntries.push({  
                        tagId: birthID, // Assigning unique tag ID for each birth  
                        birthweight: birthWeight ? parseFloat(birthWeight) : null,  
                        gender: birthGender || null, // Default to null if gender is not provided  
                    });  
                }  
            }  

            // Create new breeding object  
            const newBreeding = new Breeding({  
                tagId: breedingTagId, // Main tag ID for the breeding  
                deliveryState,  
                deliveryDate,  
                numberOfBirths,  
                birthEntries,  
                owner: req.user.id// Assuming the owner is set from the request  
            });  

            // Save the new breeding document  
            await newBreeding.save();  
        }  

        // Return success response  
        res.json({  
            status: httpstatustext.SUCCESS,  
            message: 'Breeding data imported successfully',  
        });  
    });  
});

const exportBreedingToExcel = asyncwrapper(async (req, res, next) => {  
    const userId = req.user.id;  

    // Fetch filters from query  
    const query = req.query;  
    const filter = { owner: userId };  

    // Apply filter conditions based on query parameters  
    if (query.deliveryState) filter.deliveryState = query.deliveryState;  
    if (query.deliveryDate) filter.deliveryDate = query.deliveryDate;  
    if (query.tagId) filter.tagId = query.tagId;  

    // Fetch breeding records based on filters  
    const breedingRecords = await Breeding.find(filter)  
        .populate({  
            path: 'animalId',  
            select: 'animalType', // Select only the animalType field from the Animal model  
        });  

    if (!breedingRecords || breedingRecords.length === 0) {  
        const error = AppError.create('No breeding information found for the specified filters.', 404, httpstatustext.FAIL);  
        return next(error);  
    }  

    // Create a new workbook and worksheet data  
    const workbook = xlsx.utils.book_new();  
    const worksheetData = [  
        ['Tag ID', 'Delivery State', 'Delivery Date', 'Number of Births', 'Birth 1 Tag ID', 'Birth 1 Weight', 'Birth 1 Gender', 'Birth 2 Tag ID', 'Birth 2 Weight', 'Birth 2 Gender', 'Birth 3 Tag ID', 'Birth 3 Weight', 'Birth 3 Gender']  
    ];  

    // Populate worksheet data with breeding records  
    breedingRecords.forEach(breeding => {  
        const row = [  
            breeding.tagId, // Include tagId from the breeding record, assuming this field exists  
            breeding.deliveryState,  
            breeding.deliveryDate ? breeding.deliveryDate.toISOString().split('T')[0] : '',  
            breeding.numberOfBirths || 0  
        ];  

        // Add birth entries (up to 3 for this example)  
        breeding.birthEntries.slice(0, 3).forEach((birth) => {  
            row.push(  
                birth.tagId || '',  
                birth.birthweight || '',  
                birth.gender || ''  
            );  
        });  

        // Fill empty cells if there are less than 3 birth entries  
        for (let i = breeding.birthEntries.length; i < 3; i++) {  
            row.push('', '', '');  
        }  

        worksheetData.push(row);  
    });  

    // Create worksheet and add it to the workbook  
    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);  
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Breeding');  

    // Write to buffer  
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });  

    // Set the proper headers for file download  
    res.setHeader('Content-Disposition', 'attachment; filename="Breeding.xlsx"');  
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');  

    // Send the file as a response  
    res.send(buffer);  
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
                console.warn(`Tag ID ${entry.tagId} already exists. Skipping.`);  
                continue;  
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

}