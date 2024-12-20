const Treatment=require('../Models/treatment.model');
const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const User=require('../Models/user.model');
const Animal=require('../Models/animal.model');
const TreatmentEntry=require('../Models/treatmentEntry.model');
const AnimalCost=require('../Models/animalCost.model');

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
    const { treatmentName, locationShed, volume, date } = req.body;

    if (!treatmentName || !locationShed || !volume || !date) {
        const error = AppError.create('treatmentName, locationShed, volume, and date must be provided', 400, httpstatustext.FAIL);
        return next(error);
    }

    const treatment = await Treatment.findOne({ name: treatmentName });

    if (!treatment) {
        const error = AppError.create('Treatment not found for the provided treatment name', 404, httpstatustext.FAIL);
        return next(error);
    }

    const animals = await Animal.find({ locationShed });

    if (animals.length === 0) {
        const error = AppError.create('No animals found for the provided locationShed', 404, httpstatustext.FAIL);
        return next(error);
    }

    const createdTreatments = [];

    for (const animal of animals) {
        const treatmentCost = treatment.price * volume;

        const newTreatmentEntry = new TreatmentEntry({
            treatment: treatment._id,
            tagId: animal.tagId,
            locationShed,
            volume,
            date,
            owner: userId,
        });

        await newTreatmentEntry.save();
        createdTreatments.push(newTreatmentEntry);

        // Check if AnimalCost entry exists for the animal
        let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });

        if (animalCostEntry) {
            // Update treatment cost
            animalCostEntry.treatmentCost += treatmentCost;
        } else {
            // Create a new AnimalCost entry
            animalCostEntry = new AnimalCost({
                animalTagId: animal.tagId,
                treatmentCost: treatmentCost,
                feedCost: 0, // Default feed cost
                date: date,
                owner: userId,
            });
        }

        await animalCostEntry.save();
    }

    res.json({ status: httpstatustext.SUCCESS, data: { treatments: createdTreatments } });
});


const addTreatmentForAnimal = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;
    const { treatmentName, tagId, volume, date } = req.body; // Expecting treatmentName, tagId, volume, and date in the request body

    // Check if treatmentName, tagId, volume, and date are provided
    if (!treatmentName || !tagId || !volume || !date) {
        const error = AppError.create('treatmentName, tagId, volume, and date must be provided', 400, httpstatustext.FAIL);
        return next(error);
    }

    // Find the treatment by name
    const treatment = await Treatment.findOne({ name: treatmentName });

    // If the treatment is not found, return an error
    if (!treatment) {
        const error = AppError.create('Treatment not found for the provided treatment name', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Find the animal by tag ID
    const animal = await Animal.findOne({ tagId });

    // If the animal is not found, return an error
    if (!animal) {
        const error = AppError.create('Animal not found for the provided tagId', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Calculate the treatment cost
    const treatmentCost = treatment.price * volume;

    // Create a new treatment entry for the single animal
    const newTreatmentEntry = new TreatmentEntry({
        treatment: treatment._id, // Use the found treatment's ID
        tagId: animal.tagId, // The tagId of the animal
        locationShed: animal.locationShed, // Taking locationShed from the animal record
        volume: volume, // Volume provided in the request
        date: date, // Date provided in the request
        owner: userId, // The user who is adding the treatment
    });

    await newTreatmentEntry.save(); // Save the new treatment entry

    // Update or create the animal cost entry
    let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });

    if (animalCostEntry) {
        // If an entry exists, update the treatment cost
        animalCostEntry.treatmentCost += treatmentCost;
    } else {
        // If no entry exists, create a new one
        animalCostEntry = new AnimalCost({
            animalTagId: animal.tagId,
            treatmentCost: treatmentCost,
            feedCost: 0, // Default feed cost if none is recorded yet
            date: date,
            owner: userId,
        });
    }

    // Save the updated or new AnimalCost entry
    await animalCostEntry.save();

    // Send back the created treatment entry and updated cost details
    res.json({
        status: httpstatustext.SUCCESS,
        data: {
            treatment: newTreatmentEntry,
            animalCost: animalCostEntry,
        },
    });
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
