
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
    // Use multer to handle the uploaded file
    upload(req, res, async function (err) {
        if (err) {
            return next(AppError.create('File upload failed', 400, httpstatustext.FAIL));
        }

        // Get the file buffer from multer
        const fileBuffer = req.file.buffer;

        // Read the Excel file using xlsx
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });

        // Assuming the data is in the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to JSON format
        const data = xlsx.utils.sheet_to_json(worksheet);

        // Iterate over the JSON data and insert into Animal collection
        for (let row of data) {
            // You can adjust this based on the column names in your Excel
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
                owner: req.userId // assuming the user is authenticated and userId is available
            });

            await newAnimal.save(); // Save each animal to the database
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: 'Animals imported successfully'
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