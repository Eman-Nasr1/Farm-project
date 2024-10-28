const Mating=require('../Models/mating.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage();



const getallamating = asyncwrapper(async (req, res) => {
    const userId = req.userId;
    const query = req.query;
    const limit = parseInt(query.limit, 10) || 10;
    const page = parseInt(query.page, 10) || 1;
    const skip = (page - 1) * limit;

    // Initialize the filter with owner ID
    const filter = { owner: userId };

    // Add tag ID, dates, and sonar result if present in query
    if (query.tagId) filter.tagId = query.tagId;
    if (query.matingDate) filter.matingDate = new Date(query.matingDate);
    if (query.sonarDate) filter.sonarDate = new Date(query.sonarDate);
    if (query.sonarRsult) filter.sonarRsult = query.sonarRsult;

    console.log("Filter object for getallamating:", filter);

    // Aggregate pipeline to filter by animal type
    const mating = await Mating.aggregate([
        { $match: filter },
        {
            $lookup: {
                from: 'animals',
                localField: 'animalId',
                foreignField: '_id',
                as: 'animalInfo'
            }
        },
        { $unwind: '$animalInfo' },
        query.animalType ? { $match: { 'animalInfo.animalType': query.animalType } } : { $match: {} },
        { $project: { "__v": 0, "animalInfo.__v": 0 } },
        { $skip: skip },
        { $limit: limit }
    ]);

    res.json({ status: httpstatustext.SUCCESS, data: { mating } });
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
            if (isNaN(birthDate.getTime()) || isNaN(purchaseData.getTime())) {
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
    const userId = req.userId;
    const query = req.query;
    const filter = { owner: userId };

    if (query.tagId) filter.tagId = query.tagId;
    if (query.matingDate) filter.matingDate = new Date(query.matingDate);
    if (query.sonarDate) filter.sonarDate = new Date(query.sonarDate);
    if (query.sonarRsult) filter.sonarRsult = query.sonarRsult;

    console.log("Filter object for exportMatingToExcel:", filter);

    const mating = await Mating.aggregate([
        { $match: filter },
        {
            $lookup: {
                from: 'animals',
                localField: 'animalId',
                foreignField: '_id',
                as: 'animalInfo'
            }
        },
        { $unwind: '$animalInfo' },
        query.animalType ? { $match: { 'animalInfo.animalType': query.animalType } } : { $match: {} },
        { $project: { "__v": 0, "animalInfo.__v": 0 } }
    ]);

    // Create the Excel workbook and sheet
    const workbook = xlsx.utils.book_new();
    const worksheetData = [
        ['Tag ID', 'Male tag Id', 'Mating Date', 'Mating Type', 'Sonar Date', 'Sonar Result', 'Expected Delivery Date']
    ];

    mating.forEach(m => {
        worksheetData.push([
            m.tagId,
            m.maleTag_id,
            m.matingDate ? m.matingDate.toISOString().split('T')[0] : '',
            m.matingType,
            m.sonarDate ? m.sonarDate.toISOString().split('T')[0] : '',
            m.sonarRsult || '',
            m.expectedDeliveryDate ? m.expectedDeliveryDate.toISOString().split('T')[0] : '',
        ]);
    });

    const worksheet = xlsx.utils.aoa_to_sheet(worksheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Mating');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Mating.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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


const addmating = asyncwrapper(async (req, res,next) => {
    const userId = req.userId;

    // Extract tagId from the request body along with the mating data
    const { tagId, ...matingData } = req.body;

    // Find the animal with the provided tagId
    const animal = await Animal.findOne({ tagId });
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }
    const newMating = new Mating({ ...matingData, owner: userId, tagId, animalId: animal._id });

    await newMating.save();

    res.json({ status: httpstatustext.SUCCESS, data: { mating: newMating } });
})


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
    const userId = req.userId;
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

const updatemating = asyncwrapper(async (req,res,next)=>{
    const userId = req.userId;
    const matingId = req.params.matingId;
    const updatedData = req.body;

    let mating = await Mating.findOne({ _id: matingId, owner: userId });
        if (!mating) {
            const error = AppError.create('Mating information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        mating = await Mating.findOneAndUpdate({ _id: matingId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { mating } });
})

module.exports={
    getallamating,
    updatemating,
    deletemating,
    addmating,
    getsinglemating,
    getmatingforspacficanimal,
    importMatingFromExcel,
    exportMatingToExcel

}
