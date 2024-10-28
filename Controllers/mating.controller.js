const Mating=require('../Models/mating.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Animal=require('../Models/animal.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage();

const getallamating = asyncWrapper(async (req, res) => {  
    const userId = req.userId;  
    const query = req.query;  
    const limit = query.limit || 10;  
    const page = query.page || 1;  
    const skip = (page - 1) * limit;  

    const filter = { owner: userId };  

    if (query.tagId) {  
        filter.tagId = query.tagId; // e.g.,   
    }  

    if (query.matingDate) {  
        filter.matingDate = query.matingDate; // e.g.,   
    }  

    if (query.sonarDate) {  
        filter.sonarDate = query.sonarDate; // e.g.,   
    }  

    if (query.sonarRsult) {  
        filter.sonarRsult = query.sonarRsult; // e.g.,   
    }  

    // Create a query for mating that includes animalType  
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
        return res.json({ status: httpstatustext.SUCCESS, data: { mating: filteredMatingData } });  
    }  

    // If no animalType filter is applied, return all mating data  
    res.json({ status: httpstatustext.SUCCESS, data: { mating: matingData } });  
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
