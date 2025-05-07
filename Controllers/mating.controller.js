const Mating=require('../Models/mating.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');


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

    upload(req, res, async function (err) {
        if (err) {
            return next(AppError.create('File upload failed', 400, httpstatustext.FAIL));
        }

        const fileBuffer = req.file.buffer;
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON format (array of arrays)
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Iterate over the rows (skip header row at index 0)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) {
               // console.log(`Skipping empty row ${i}`);
                continue;
            }

            // Log the row for debugging
          //  console.log(`Processing row ${i}:`, row);

            // Validate essential fields
            const tagId = row[0]?.toString().trim();
            const maleTag_id = row[1]?.toString().trim();
            const matingType = row[2]?.toString().trim();
            const matingDate = new Date(row[3]?.toString().trim());
            const sonarDate = new Date(row[4]?.toString().trim());
            const sonarRsult = row[5]?.toString().trim();
           

            // Check if required fields are present
            if (!tagId || !maleTag_id || !matingType ) {
                return next(AppError.create(`Required fields are missing in row ${i + 1}`, 400, httpstatustext.FAIL));
            }

            // Check if dates are valid
            if (isNaN(matingDate.getTime()) || isNaN(sonarDate.getTime())) {
                return next(AppError.create(`Invalid date format in row ${i + 1}`, 400, httpstatustext.FAIL));
            }

            // Create new animal object
            
            const newMating = new Mating({
                tagId,
                maleTag_id,
                matingType,
                matingDate,
                sonarDate,
                sonarRsult,
               
              
            });

            // Save the new animal document
            await newMating.save();
        }

        // Return success response
        res.json({
            status: httpstatustext.SUCCESS,
            message: 'Mating imported successfully',
        });
    });
});


const exportMatingToExcel = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;

    // Fetch animals based on filter logic
    const query = req.query;
    const filter = { owner: userId };
    if (query.matingDate) filter.matingDate = query.matingDate;
    if (query.sonarDate) filter.sonarDate = query.sonarDate;
    if (query.sonarRsult) filter.sonarRsult = query.sonarRsult;
    if (query.tagId) filter.tagId = query.tagId;

    const mating = await Mating.find(filter);

    // Create a new workbook and sheet
    const workbook = xlsx.utils.book_new();
    const worksheetData = [
        ['Tag ID','Male tag Id', 'Mating Date',  'Mating Type', 'Sonar Date', 'Sonar Result' ,'Expected Delivery Date']
    ];

    mating.forEach(mating => {
        worksheetData.push([
            mating.tagId,
            mating.maleTag_id,
            mating.matingDate ? mating.matingDate.toISOString().split('T')[0] : '',
            mating.matingType,
            mating.sonarDate ? mating.sonarDate.toISOString().split('T')[0] : '',
            mating.sonarRsult || '',
            mating.expectedDeliveryDate ? mating.expectedDeliveryDate.toISOString().split('T')[0] : '',
        ]);
    });

    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Mating');

    // Write to buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set the proper headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename="Mating.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    // Send the file as a response
    res.send(buffer);
});

const getmatingforspacficanimal =asyncwrapper(async( req, res, next)=>{
 
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
    const mating = await Mating.find({ animalId: animal._id });

    if (!mating) {
        const error = AppError.create('Mating information not found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    return res.json({ status: httpstatustext.SUCCESS, data: { animal, mating } });

})


const addmating = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { tagId, checkDays, ...matingData } = req.body;

    // Validate checkDays if provided
    if (checkDays && ![45, 60, 90].includes(checkDays)) {
        const error = AppError.create(
            'checkDays must be one of: 45, 60, or 90', 
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

    // Calculate sonarDate if checkDays is provided and matingDate exists
    if (checkDays && matingData.matingDate) {
        const matingDate = new Date(matingData.matingDate);
        if (!isNaN(matingDate.getTime())) {
            const sonarDate = new Date(matingDate);
            sonarDate.setDate(sonarDate.getDate() + checkDays);
            matingData.sonarDate = sonarDate;
        } else {
            const error = AppError.create(
                'Invalid matingDate provided', 
                400, 
                httpstatustext.FAIL
            );
            return next(error);
        }
    }

    const newMating = new Mating({ 
        ...matingData, 
        owner: userId, 
        tagId, 
        checkDays,
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
    const { locationShed, checkDays, ...matingData } = req.body; // Changed to locationShedId

    // Validate checkDays if provided
    if (checkDays && ![45, 60, 90].includes(checkDays)) {
        const error = AppError.create(
            'checkDays must be one of: 45, 60, or 90', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    const femaleAnimals = await Animal.find({ 
        locationShed: locationShed, // Using the ObjectId directly
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

    // Calculate sonarDate if checkDays and matingDate are provided
    if (checkDays && matingData.matingDate) {
        const matingDate = new Date(matingData.matingDate);
        if (!isNaN(matingDate.getTime())) {
            const sonarDate = new Date(matingDate);
            sonarDate.setDate(sonarDate.getDate() + checkDays);
            matingData.sonarDate = sonarDate;
        } else {
            const error = AppError.create(
                'Invalid matingDate provided', 
                400, 
                httpstatustext.FAIL
            );
            return next(error);
        }
    }

    // Create mating records for each female animal
    const newMatings = await Promise.all(
        femaleAnimals.map(async (animal) => {
            const newMating = new Mating({
                ...matingData,
                checkDays,
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
    const updatedData = req.body;

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

    // If checkDays is being updated but matingDate isn't, we need the existing matingDate
    if (updatedData.checkDays && !updatedData.matingDate) {
        updatedData.matingDate = existingMating.matingDate;
    }

    // If checkDays is provided without matingDate, and there isn't an existing matingDate
    if (updatedData.checkDays && !updatedData.matingDate) {
        const error = AppError.create(
            'Cannot calculate sonarDate: matingDate is required when providing checkDays', 
            400, 
            httpstatustext.FAIL
        );
        return next(error);
    }

    // If matingDate is being updated and checkDays exists (either in update or existing)
    if (updatedData.matingDate) {
        const checkDaysToUse = updatedData.checkDays || existingMating.checkDays;
        if (checkDaysToUse) {
            const matingDate = new Date(updatedData.matingDate);
            if (!isNaN(matingDate.getTime())) {
                const sonarDate = new Date(matingDate);
                sonarDate.setDate(sonarDate.getDate() + checkDaysToUse);
                updatedData.sonarDate = sonarDate;
            } else {
                const error = AppError.create(
                    'Invalid matingDate provided', 
                    400, 
                    httpstatustext.FAIL
                );
                return next(error);
            }
        }
    }

    // Perform the update
    const updatedMating = await Mating.findOneAndUpdate(
        { _id: matingId, owner: userId }, // Ensure we only update if owner matches
        updatedData, 
        { 
            new: true, // Return the updated document
            runValidators: true // Ensure schema validations run
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
    
}
