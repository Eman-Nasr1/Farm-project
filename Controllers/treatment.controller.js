const Treatment=require('../Models/treatment.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const User=require('../Models/user.model');
const Animal=require('../Models/animal.model');
const TreatmentEntry=require('../Models/treatmentEntry.model');

const getallTreatments = asyncwrapper(async (req, res) => {
    const userId = req.userId;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const filter = { owner: userId };

    if (query.name) {
        filter.name = query.name;
    }

    if (query.type) {
        filter.type = query.type; 
    }

    const treatments = await Treatment.find(filter, { "__v": false })
        .limit(limit)
        .skip(skip);

    res.json({
        status: httpstatustext.SUCCESS,
        data: { treatments }
    });
});


const getsnigleTreatment =asyncwrapper(async( req, res, next)=>{

    const treatment=await Treatment.findById(req.params.treatmentId);
    if (!treatment) {
      const error=AppError.create('Treatment not found', 404, httpstatustext.FAIL)
      return next(error);
  }
     return res.json({status:httpstatustext.SUCCESS,data:{treatment}});
})

const addTreatment = asyncwrapper(async (req, res,next) => {
    
    const userId = req.userId;
 
    const newTreatment = new Treatment({ ...req.body, owner: userId });
    await newTreatment .save();
    res.json({status:httpstatustext.SUCCESS,data:{treatment:newTreatment }});
})

const updateTreatment = asyncwrapper(async (req,res)=>{
    const userId = req.userId;
    const treatmentId = req.params.treatmentId;
    const updatedData = req.body;

    let treatment = await Treatment.findOne({ _id: treatmentId, owner: userId });
        if (!treatment) {
            const error = AppError.create('treatment information not found or unauthorized to update', 404, httpstatustext.FAIL);
            return next(error);
        }
        treatment = await Treatment.findOneAndUpdate({ _id: treatmentId }, updatedData, { new: true });

        res.json({ status: httpstatustext.SUCCESS, data: { treatment } });
})

const deleteTreatment= asyncwrapper(async(req,res)=>{
    await Treatment.deleteOne({_id:req.params.treatmentId});
   res.status(200).json({status:httpstatustext.SUCCESS,data:null});

})

const addTreatmentForAnimals = asyncwrapper(async (req, res, next) => {  
    const userId = req.userId;  
    const { treatmentName, locationShed, volume, date } = req.body; // Expecting treatmentName, locationShed, volume, and date in the request body  
    const createdTreatments = []; // Array to keep track of created treatment entries  

    // Check if treatmentName, locationShed, volume, and date are provided  
    if (!treatmentName || !locationShed || !volume || !date) {  
        return next(new AppError('treatmentName, locationShed, volume, and date must be provided', 400, httpstatustext.FAIL));  
    }  

    // Find the treatment by name  
    const treatment = await Treatment.findOne({ name: treatmentName });  

    // If the treatment is not found, return an error  
    if (!treatment) {  
        return next(new AppError('Treatment not found for the provided treatment name', 404, httpstatustext.FAIL));  
    }  

    // Find all animals in the specified location shed  
    const animals = await Animal.find({ locationShed });  

    // If no animals are found for the provided locationShed  
    if (animals.length === 0) {  
        return next(new AppError('No animals found for the provided locationShed', 404, httpstatustext.FAIL));  
    }  

    // Create and save a new treatment entry for each found animal  
    for (const animal of animals) {  
        const newTreatmentEntry = new TreatmentEntry({  
            treatment: treatment._id, // Use the found treatment's ID  
            tagId: animal.tagId, // Adding the tagId from the animal  
            locationShed: locationShed, // Using the location shed from the request  
            volume: volume, // Volume provided in the request  
            date: date, // Date provided in the request  
            owner: userId // The user who is adding the treatment  
        });  

        await newTreatmentEntry.save(); // Save the new treatment entry  
        createdTreatments.push(newTreatmentEntry); // Store the created treatment in the array  
    }  

    // Send back the array of created treatment entries  
    res.json({ status: httpstatustext.SUCCESS, data: { treatments: createdTreatments } });  
});

const addTreatmentForAnimal = asyncwrapper(async (req, res, next) => {  
    const userId = req.userId;  
    const { treatmentName, tagId, volume, date } = req.body; // Expecting treatmentName, tagId, volume, and date in the request body  

    // Check if treatmentName, tagId, volume, and date are provided  
    if (!treatmentName || !tagId || !volume || !date) {  
        return next(new AppError('treatmentName, tagId, volume, and date must be provided', 400, httpstatustext.FAIL));  
    }  

    // Find the treatment by name  
    const treatment = await Treatment.findOne({ name: treatmentName });  

    // If the treatment is not found, return an error  
    if (!treatment) {  
        return next(new AppError('Treatment not found for the provided treatment name', 404, httpstatustext.FAIL));  
    }  

    // Find the animal by tag ID  
    const animal = await Animal.findOne({ tagId });  

    // If the animal is not found, return an error  
    if (!animal) {  
        return next(new AppError('Animal not found for the provided tagId', 404, httpstatustext.FAIL));  
    }  

    // Create a new treatment entry for the single animal  
    const newTreatmentEntry = new TreatmentEntry({  
        treatment: treatment._id, // Use the found treatment's ID  
        tagId: animal.tagId, // The tagId of the animal  
        locationShed: animal.locationShed, // Taking locationShed from the animal record  
        volume: volume, // Volume provided in the request  
        date: date, // Date provided in the request  
        owner: userId // The user who is adding the treatment  
    });  

    await newTreatmentEntry.save(); // Save the new treatment entry  

    // Send back the created treatment entry  
    res.json({ status: httpstatustext.SUCCESS, data: { treatment: newTreatmentEntry } });  
});

module.exports={
    getallTreatments,
    getsnigleTreatment,
    addTreatment,
    updateTreatment,
    deleteTreatment,
    addTreatmentForAnimal, 
    addTreatmentForAnimals,   
}
