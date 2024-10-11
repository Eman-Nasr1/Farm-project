
const Animal=require('../Models/animal.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const User=require('../Models/user.model');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage(); // Use memory storage to get the file buffer


const upload = multer({ storage: storage }).single('file');

const importAnimalsFromExcel = asyncwrapper(async (req, res, next) => {
    console.log(`Owner ID: ${req.userId}`);
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
            const breed = row[1]?.toString().trim();
            const animalType = row[2]?.toString().trim();
            const birthDate = new Date(row[3]?.toString().trim());
            const purchaseData = new Date(row[4]?.toString().trim());
            const purchasePrice = row[5]?.toString().trim();
            const traderName = row[6]?.toString().trim();
            const motherId = row[7]?.toString().trim();
            const fatherId = row[8]?.toString().trim();
            const locationShed = row[9]?.toString().trim();
            const gender = row[10]?.toString().trim();
            const female_Condition = row[11]?.toString().trim();
            const teething = row[12]?.toString().trim();

            // Check if required fields are present
            if (!tagId || !breed || !animalType || !gender) {
                return next(AppError.create(`Required fields are missing in row ${i + 1}`, 400, httpstatustext.FAIL));
            }

            // Check if dates are valid
            if (isNaN(birthDate.getTime()) || isNaN(purchaseData.getTime())) {
                return next(AppError.create(`Invalid date format in row ${i + 1}`, 400, httpstatustext.FAIL));
            }

            // Create new animal object
            
            const newAnimal = new Animal({
                tagId,
                breed,
                animalType,
                birthDate,
                purchaseData,
                purchasePrice,
                traderName,
                motherId,
                fatherId,
                locationShed,
                gender,
                female_Condition,
                Teething: teething,
                owner: req.userId
            });

            // Save the new animal document
            await newAnimal.save();
        }

        // Return success response
        res.json({
            status: httpstatustext.SUCCESS,
            message: 'Animals imported successfully',
        });
    });
});




// const getallanimals =asyncwrapper(async(req,res)=>{

//     const userId = req.userId;
//     const query=req.query;
//     const limit=query.limit||10;
//     const page=query.page||1;
//     const skip=(page-1)*limit;

//     const animals= await Animal.find({ owner: userId },{"__v":false}).limit(limit).skip(skip);
//     res.json({status:httpstatustext.SUCCESS,data:{animals}});
// })

const getallanimals = asyncwrapper(async (req, res) => {
    const userId = req.userId;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    // Create filter object
    const filter = { owner: userId };

    // Add filters based on query parameters
    if (query.animalType) {
        filter.animalType = query.animalType; // e.g., "goat" or "sheep"
    }

    if (query.gender) {
        filter.gender = query.gender; // e.g., "male" or "female"
    }

    if (query.locationShed) {
        filter.locationShed = query.locationShed; // e.g., "Shed A"
    }

    if (query.breed) {
        filter.breed = query.breed; // e.g., "balady"
    }

    if (query.tagId) {
        filter.tagId = query.tagId; // e.g., 
    }

    // Find animals with applied filters
    const animals = await Animal.find(filter, { "__v": false })
        .limit(limit)
        .skip(skip);

    // Return response
    res.json({
        status: httpstatustext.SUCCESS,
        data: { animals }
    });
});


const getsnigleanimal =asyncwrapper(async( req, res, next)=>{
    // console.log(req.params);
   
      const animal=await Animal.findById(req.params.tagId);
      if (!animal) {
        // ('Course not found', 404, httpstatustext.FAIL);
        const error=AppError.create('animal not found', 404, httpstatustext.FAIL)
        return next(error);
    }
       return res.json({status:httpstatustext.SUCCESS,data:{animal}});
})


const addanimal = asyncwrapper(async (req, res,next) => {
    const userId = req.userId;
   // console.log(userId);
   
    const newanimal = new Animal({ ...req.body, owner: userId }); // Assuming Course is a model for courses
    await newanimal.save();
    res.json({status:httpstatustext.SUCCESS,data:{animal:newanimal}});
})


const updateanimal = asyncwrapper(async (req,res)=>{
    const animalId=req.params.tagId;
      const updatedanimal= await Animal.updateOne({ _id: animalId },{$set: {...req.body}});
      return  res.status(200).json({status:httpstatustext.SUCCESS,data:{animal:updatedanimal}})
})


const deleteanimal= asyncwrapper(async(req,res)=>{
    await Animal.deleteOne({_id:req.params.tagId});
   res.status(200).json({status:httpstatustext.SUCCESS,data:null});

})




module.exports={
    getallanimals,
    getsnigleanimal,
    addanimal,
    updateanimal,
    deleteanimal,
    importAnimalsFromExcel,
    
}