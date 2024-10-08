
const Animal=require('../Models/animal.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const User=require('../Models/user.model');
const xlsx = require('xlsx');
const multer = require('multer');

const storage = multer.memoryStorage(); // Use memory storage to get the file buffer
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 10000000 }  // Limit to 10MB (adjust as needed)
}).single('file');

//const jwt = require('jsonwebtoken');

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


const uploadAnimalData = asyncwrapper(async (req, res, next) => {
    const file = req.file;

    if (!file) {
        return next(AppError.create('No file uploaded', 400, httpstatustext.FAIL));
    }

    // Parse the Excel file
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert Excel sheet to JSON
    const animalData = xlsx.utils.sheet_to_json(sheet);
    
    if (!animalData.length) {
        return next(AppError.create('No valid data in the uploaded file', 400, httpstatustext.FAIL));
    }

    // Loop through the data and create animal records
    const createdAnimals = [];
    for (const animal of animalData) {
        const newAnimal = new Animal({
            tagId: row[0],
            breed: row[1],
            animalType: row[2],
            birthDate: new Date(row[3]),
            purchaseData: new Date(row[4]),
            purchasePrice: row[5],
            traderName: row[6],
            motherId: row[7],
            fatherId: row[8],
            locationShed: row[9],
            gender: row[10],
            female_Condition: row[11],
            Teething: row[12],
            owner: req.userId // Ensure the owner is set to the authenticated user
        });

        await newAnimal.save();
        createdAnimals.push(newAnimal);
    }

    res.json({
        status: httpstatustext.SUCCESS,
        data: { animals: createdAnimals }
    });
});

module.exports={
    getallanimals,
    getsnigleanimal,
    addanimal,
    updateanimal,
    deleteanimal,
    uploadAnimalData,
    
}