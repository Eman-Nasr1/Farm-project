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

//------------------------------------------treetment for animale-----------------------

const addTreatmentForAnimals = asyncwrapper(async (req, res, next) => {  
  const userId = req.userId;  
  const { treatmentName, locationShed, volume, date } = req.body;  

  // Validate input  
  if (!treatmentName || !locationShed || !volume || !date) {  
      const error = AppError.create('treatmentName, locationShed, volume, and date must be provided', 400, httpstatustext.FAIL);  
      return next(error);  
  }  

  // Find the treatment by name  
  const treatment = await Treatment.findOne({ name: treatmentName });  

  if (!treatment) {  
      const error = AppError.create('Treatment not found for the provided treatment name', 404, httpstatustext.FAIL);  
      return next(error);  
  }  

  // Find all animals in the specified location shed  
  const animals = await Animal.find({ locationShed });  

  if (animals.length === 0) {  
      const error = AppError.create('No animals found for the provided locationShed', 404, httpstatustext.FAIL);  
      return next(error);  
  }  

  const createdTreatments = [];  

  // Calculate the volume per animal  
  const volumePerAnimal = volume / animals.length;  

  // Calculate the price per ml  
  const pricePerMl = treatment.price / treatment.volume;  

  for (const animal of animals) {  
      // Calculate treatment cost for the animal based on the volume per animal  
      const treatmentCost = pricePerMl * volumePerAnimal;  

      // Create a treatment entry for the animal  
      const newTreatmentEntry = new TreatmentEntry({  
          treatment: treatment._id,  
          tagId: animal.tagId,  
          locationShed,  
          volume: volumePerAnimal, // Save the volume per animal  
          date,  
          owner: userId,  
      });  

      await newTreatmentEntry.save();  
      createdTreatments.push(newTreatmentEntry);  

      // Check if an AnimalCost entry exists for the animal  
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

  // Respond with created treatment entries  
  res.json({ status: httpstatustext.SUCCESS, data: { treatments: createdTreatments } });  
});


const addTreatmentForAnimal = asyncwrapper(async (req, res, next) => {
    const userId = req.userId;
    const { treatmentName, tagId, volume, date } = req.body; // Expecting treatmentName, tagId, volume, and date in the request body

    // Check if treatmentName, tagId, volume, and date are provided
    if (!treatmentName || !tagId || !volume || !date) {
        const error = AppError.create(
            'treatmentName, tagId, volume, and date must be provided',
            400,
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Find the treatment by name
    const treatment = await Treatment.findOne({ name: treatmentName });

    // If the treatment is not found, return an error
    if (!treatment) {
        const error = AppError.create(
            'Treatment not found for the provided treatment name',
            404,
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Find the animal by tag ID
    const animal = await Animal.findOne({ tagId });

    // If the animal is not found, return an error
    if (!animal) {
        const error = AppError.create(
            'Animal not found for the provided tagId',
            404,
            httpstatustext.FAIL
        );
        return next(error);
    }

    // Calculate the price per milliliter (ml)
    const pricePerMl = treatment.price / treatment.volume;

    // Calculate the treatment cost based on the provided volume
    const treatmentCost = pricePerMl * volume;

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

    // Check if an AnimalCost entry exists for the animal
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

const getsingleTreatmentShed = asyncwrapper(async (req, res, next) => {
    // Fetch the treatment shed entry by ID and populate relevant fields
    const treatmentShed = await TreatmentEntry.findById(req.params.treatmentShedId).populate({
      path: "treatment", // Populate the treatment field
      select: "name price volume", // Select only the name, price, and volume fields
    });
  
    if (!treatmentShed) {
      const error = AppError.create(
        "Treatment shed entry not found",
        404,
        httpstatustext.FAIL
      );
      return next(error);
    }
  
    // Format the response to include treatment details
    const response = {
      _id: treatmentShed._id,
      tagId: treatmentShed.tagId,
      locationShed: treatmentShed.locationShed,
      volume: treatmentShed.volume,
      date: treatmentShed.date,
      treatmentName: treatmentShed.treatment?.name, // Treatment name from populated data
     
    };
  
    return res.json({
      status: httpstatustext.SUCCESS,
      data: { treatmentShed: response },
    });
  });
  

const updateTreatmentForAnimal = asyncWrapper(async (req, res, next) => {  
    const userId = req.userId; // User ID from token  
    const treatmentEntryId = req.params.treatmentEntryId; // ID of the TreatmentEntry to update  
    const updatedData = req.body; // Updated data from the request body  

    // Find the existing treatment entry document  
    let treatmentEntry = await TreatmentEntry.findOne({  
        _id: treatmentEntryId,  
        owner: userId,  
    });  

    if (!treatmentEntry) {  
        const error = AppError.create(  
            "Treatment entry not found or unauthorized to update",  
            404,  
            httpstatustext.FAIL  
        );  
        return next(error);  
    }  

    // Check if treatment name is provided and replace it with the corresponding treatment ID  
    if (updatedData.treatmentName) {  
        const treatment = await Treatment.findOne({ name: updatedData.treatmentName });  
        if (!treatment) {  
            const error = AppError.create(  
                `Treatment with name "${updatedData.treatmentName}" not found`,  
                404,  
                httpstatustext.FAIL  
            );  
            return next(error);  
        }  
        updatedData.treatment = treatment._id; // Replace treatmentName with treatment ID  
        treatmentEntry.treatment = treatment._id; // Update the treatment in the TreatmentEntry document  
    }  

    // Validate and process the date  
    if (updatedData.date) {  
        const parsedDate = new Date(updatedData.date);  
        if (isNaN(parsedDate.getTime())) {  
            return next(AppError.create('Invalid date format', 400, httpstatustext.FAIL));  
        }  
        treatmentEntry.date = parsedDate; // Assign the validated date  
    }  

    // Update top-level fields in the treatment entry  
    Object.assign(treatmentEntry, updatedData);  

    // If `volume` or `treatment` is updated, recalculate costs  
    if (updatedData.volume || updatedData.treatment) {  
        const treatment = await Treatment.findById(treatmentEntry.treatment);  
        if (!treatment) {  
            const error = AppError.create(  
                `Treatment with ID "${treatmentEntry.treatment}" not found`,  
                404,  
                httpstatustext.FAIL  
            );  
            return next(error);  
        }  

        treatmentEntry.volume = updatedData.volume || treatmentEntry.volume;  
        const pricePerMl = treatment.price / treatment.volume;  
        const treatmentCost = pricePerMl * treatmentEntry.volume;  
        treatmentEntry.treatmentCost = treatmentCost; // Store treatment cost inside entry if needed  
    }  

    // Save the updated treatment entry document  
    await treatmentEntry.save();  

    // Find all animals in the same shed as this treatment entry  
    const animals = await Animal.find({ locationShed: treatmentEntry.locationShed });  

    // Update or create AnimalCost entries for each animal  
    for (const animal of animals) {  
        let animalCostEntry = await AnimalCost.findOne({  
            animalTagId: animal.tagId,  
        });  

        const treatmentCostPerAnimal = treatmentEntry.volume * (treatment.price / treatment.volume);  

        if (animalCostEntry) {  
            animalCostEntry.treatmentCost += treatmentCostPerAnimal;  
        } else {  
            animalCostEntry = new AnimalCost({  
                animalTagId: animal.tagId,  
                feedCost: 0, // Default feed cost if none recorded yet  
                treatmentCost: treatmentCostPerAnimal,  
                date: treatmentEntry.date,  
                owner: userId,  
            });  
        }  

        await animalCostEntry.save();  
    }  

    // Populate the response to include treatment name and price  
    const updatedTreatmentEntry = await TreatmentEntry.findById(treatmentEntry._id).populate({  
        path: "treatment",  
        select: "name price volume",  
    });  

    res.json({  
        status: httpstatustext.SUCCESS,  
        data: { treatmentEntry: updatedTreatmentEntry },  
    });  
});

  const getAllTreatmentsByShed = asyncwrapper(async (req, res) => {
    const userId = req.userId;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
  
    const filter = { owner: userId };
  
    if (query.locationShed) {
      filter.locationShed = query.locationShed;
    }
  
    if (query.date) {
      filter.date = query.date;
    }
  
    const treatmentShed = await TreatmentEntry.find(filter, { __v: false })
      .populate({
        path: "treatment", // Populate the treatment field
        select: "name price volume", // Select only relevant fields
      })
      .limit(limit)
      .skip(skip);
  
    // Map the populated data for a cleaner response
    const response = treatmentShed.map((entry) => ({
      _id: entry._id,
      locationShed: entry.locationShed,
      tagId: entry.tagId,
      volume: entry.volume,
      date: entry.date,
      treatmentName: entry.treatment?.name, // Treatment name from the populated data
  
    }));
  
    res.json({
      status: httpstatustext.SUCCESS,
      data: { treatmentShed: response },
    });
  });
  
  const deleteTreatmentShed = asyncwrapper(async (req, res, next) => {
    const userId = req.userId; // Get the user ID from the token
  
    // Delete the TreatmentEntry
    const deletedEntry = await TreatmentEntry.findByIdAndDelete(req.params.treatmentShedId);
    if (!deletedEntry) {
      const error = AppError.create(
        "Treatment entry not found or unauthorized to delete",
        404,
        httpstatustext.FAIL
      );
      return next(error);
    }
  
    // If the entry was deleted successfully, recalculate total treatment cost
    const animals = await Animal.find({
      locationShed: deletedEntry.locationShed,
    });
    const treatmentEntries = await TreatmentEntry.find({
      locationShed: deletedEntry.locationShed,
      owner: userId,
    });
  
    // Fetch all treatments associated with remaining entries
    const treatmentIds = treatmentEntries.map((entry) => entry.treatment);
    const treatments = await Treatment.find({ _id: { $in: treatmentIds } }).select("price _id");
  
    const treatmentMap = treatments.reduce((map, treatment) => {
      map[treatment._id] = treatment.price; // Create a mapping of treatment ID to its price
      return map;
    }, {});
  
    // Recalculate total treatment cost based on remaining treatment entries
    const totalTreatmentCost = treatmentEntries.reduce((sum, entry) => {
      const treatmentPrice = treatmentMap[entry.treatment]; // Get the price of the current treatment
      const cost = (treatmentPrice || 0) * entry.volume; // Calculate the cost for this entry
      return sum + cost; // Add to total
    }, 0);
  
    // Calculate per animal treatment cost
    const perAnimalTreatmentCost = totalTreatmentCost / (animals.length || 1);
  
    // Update AnimalCost for each animal
    for (const animal of animals) {
      let animalCostEntry = await AnimalCost.findOne({
        animalTagId: animal.tagId,
      });
  
      if (animalCostEntry) {
        animalCostEntry.treatmentCost = perAnimalTreatmentCost; // Update existing treatment cost
      } else {
        animalCostEntry = new AnimalCost({
          animalTagId: animal.tagId,
          feedCost: 0, // Keep feed cost as 0 if not already present
          treatmentCost: perAnimalTreatmentCost,
          date: new Date(), // Use the current date or appropriate date
          owner: userId,
        });
      }
  
      await animalCostEntry.save();
    }
  
    // Respond with a success message
    res.status(200).json({ status: httpstatustext.SUCCESS, data: null });
  });
  
  


module.exports={
    getallTreatments,
    getsnigleTreatment,
    addTreatment,
    updateTreatment,
    deleteTreatment,
    addTreatmentForAnimal, 
    addTreatmentForAnimals,
    getsingleTreatmentShed,
    getAllTreatmentsByShed, 
    deleteTreatmentShed,
    updateTreatmentForAnimal,  
}
