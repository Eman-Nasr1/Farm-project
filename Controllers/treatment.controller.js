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
    const total = await Treatment.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    res.json({
        status: httpstatustext.SUCCESS,
        pagination: {
          page:page,
          limit: limit,
          total: total,
          totalPages:totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
          },
        data: { treatments }
    });
});

const getTreatments=asyncwrapper(async (req, res)=>{
  const userId = req.userId;
  const query = req.query;
  const filter = { owner: userId };
  const treatments = await Treatment.find(filter, { "__v": false }).sort({ createdAt: -1 });
  res.json({
      status: 'success',
      data: treatments
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

const addTreatment = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { name, type, volume, price, expireDate } = req.body;

  // Validate input
  if (!name || !price || isNaN(price) || price <= 0 || !volume || isNaN(volume) || volume <= 0) {
      return res.status(400).json({
          status: httpstatustext.FAIL,
          message: "Valid name, price, and volume are required.",
      });
  }

  // Calculate price per ml
  const pricePerMl = price / volume;

  // Create new treatment
  const newTreatment = new Treatment({
      name,
      price,
      type,
      volume,
      pricePerMl,
      expireDate,
      owner: userId, // Ensure owner is assigned properly
  });

  await newTreatment.save();

  res.json({
      status: httpstatustext.SUCCESS,
      data: { treatment: newTreatment },
  });
});

const updateTreatment = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const treatmentId = req.params.treatmentId;
  const { price, volume, ...updatedData } = req.body; // Extract price & volume separately

  // Find the treatment owned by the user
  let treatment = await Treatment.findOne({ _id: treatmentId, owner: userId });

  if (!treatment) {
      const error = AppError.create('Treatment information not found or unauthorized to update', 404, httpstatustext.FAIL);
      return next(error);
  }

  // Update treatment fields if provided
  if (price) treatment.price = price;
  if (volume) treatment.volume = volume;

  // Recalculate pricePerMl if price or volume is updated
  if (price || volume) {
      treatment.pricePerMl = treatment.price / treatment.volume;
  }

  // Apply other updates
  Object.assign(treatment, updatedData);

  // Save the updated treatment
  await treatment.save();

  res.json({ status: httpstatustext.SUCCESS, data: { treatment } });
});

const deleteTreatment= asyncwrapper(async(req,res)=>{
    await Treatment.deleteOne({_id:req.params.treatmentId});
   res.status(200).json({status:httpstatustext.SUCCESS,data:null});

})

//------------------------------------------treetment for animale-----------------------

// const addTreatmentForAnimals = asyncwrapper(async (req, res, next) => {
//   const userId = req.userId;
//   const { treatments, locationShed, date } = req.body;

//   if (!Array.isArray(treatments) || treatments.length === 0 || !locationShed || !date) {
//     return res.status(400).json({
//       status: "FAILURE",
//       message: "treatments (array), locationShed, and date are required.",
//     });
//   }

//   const animals = await Animal.find({ locationShed });

//   if (animals.length === 0) {
//     return res.status(404).json({
//       status: "FAILURE",
//       message: `No animals found in shed "${locationShed}".`,
//     });
//   }

//   let totalTreatmentCost = 0;
//   const createdTreatments = [];

//   for (const treatmentItem of treatments) {
//     const { treatmentId, volume } = treatmentItem;
  
//     if (!treatmentId || !volume || isNaN(volume) || volume <= 0) {
//       return res.status(400).json({
//         status: "FAILURE",
//         message: "Each treatment must have a valid treatmentId and volume.",
//       });
//     }

//     const treatment = await Treatment.findById(treatmentId);
//     if (!treatment) {
//       return res.status(404).json({
//         status: "FAILURE",
//         message: `Treatment with ID "${treatmentId}" not found.`,
//       });
//     }

//     if (treatment.owner.toString() !== userId.toString()) {
//       return res.status(403).json({
//         status: "FAILURE",
//         message: "You are not authorized to use this treatment.",
//       });
//     }

//     if (treatment.volume < volume) {
//       return res.status(400).json({
//         status: "FAILURE",
//         message: `Not enough stock for treatment "${treatment.name}". Available: ${treatment.volume}, Requested: ${volume}.`,
//       });
//     }
   
//     // Deduct volume from treatment stock
//     treatment.volume -= volume;
//     await treatment.save();

//     // Get price per ml from treatment stock
//     const volumePerAnimal = volume / animals.length;
//     const treatmentCost = treatment.pricePerMl * volume;
//     totalTreatmentCost += treatmentCost;

//     for (const animal of animals) {
//       const newTreatmentEntry = new TreatmentEntry({
//         treatments: [{ treatmentId: treatment._id, volumePerAnimal }],
//         tagId: animal.tagId,
//         locationShed,
//         date,
//         owner: userId,
//       });

//       await newTreatmentEntry.save();
//       createdTreatments.push(newTreatmentEntry);

//       let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });

//       if (animalCostEntry) {
//         animalCostEntry.treatmentCost += treatmentCost / animals.length;
//       } else {
//         animalCostEntry = new AnimalCost({
//           animalTagId: animal.tagId,
//           treatmentCost: treatmentCost / animals.length,
//           feedCost: 0,
//           date,
//           owner: userId,
//         });
//       }

//       await animalCostEntry.save();
//     }
//   }
 
//   res.status(201).json({
//     status: "SUCCESS",
//     data: {
//       treatments: createdTreatments,
//       totalTreatmentCost,
//     },
//   });
// });
const addTreatmentForAnimals = asyncwrapper(async (req, res, next) => {  
  const userId = req.userId;  
  const { treatments, locationShed, date } = req.body;  

  if (!Array.isArray(treatments) || treatments.length === 0 || !locationShed || !date) {  
    return res.status(400).json({  
      status: "FAILURE",  
      message: "treatments (array), locationShed, and date are required.",  
    });  
  }  

  const animals = await Animal.find({ locationShed });  

  if (animals.length === 0) {  
    return res.status(404).json({  
      status: "FAILURE",  
      message: `No animals found in shed "${locationShed}".`,  
    });  
  }  

  let totalTreatmentCost = 0;  
  const createdTreatments = [];  

  for (const treatmentItem of treatments) {  
    const { treatmentId, volume } = treatmentItem;  

    if (!treatmentId || !volume || isNaN(volume) || volume <= 0) {  
      return res.status(400).json({  
        status: "FAILURE",  
        message: "Each treatment must have a valid treatmentId and volume.",  
      });  
    }  

    const treatment = await Treatment.findById(treatmentId);  
    if (!treatment) {  
      return res.status(404).json({  
        status: "FAILURE",  
        message: `Treatment with ID "${treatmentId}" not found.`,  
      });  
    }  

    // Check if treatment is expired 
    if (treatment.expireDate && new Date(treatment.expireDate) < new Date()) {  
      return res.status(400).json({  
        status: "FAILURE",  
        message: `Treatment "${treatment.name}" is expired (Expired on ${treatment.expireDate.toISOString().split('T')[0]}).`,  
      });  
    }
    // Check authorization  
    if (treatment.owner.toString() !== userId.toString()) {  
      return res.status(403).json({  
        status: "FAILURE",  
        message: "You are not authorized to use this treatment.",  
      });  
    }  

    // Check stock availability  
    if (treatment.volume < volume) {  
      return res.status(400).json({  
        status: "FAILURE",  
        message: `Not enough stock for treatment "${treatment.name}". Available: ${treatment.volume}, Requested: ${volume}.`,  
      });  
    }  
   
    // Deduct volume from treatment stock  
    treatment.volume -= volume;  
    await treatment.save();  

    // Calculate total treatment cost  
    const treatmentCost = treatment.pricePerMl * volume;  
    totalTreatmentCost += treatmentCost;  

    // Calculate volume per animal  
    const volumePerAnimal = volume / animals.length;  

    // Create treatment entry for each animal  
    for (const animal of animals) {  
      const newTreatmentEntry = new TreatmentEntry({  
        treatments: [{ treatmentId: treatment._id, volume: volumePerAnimal }], // Store volumePerAnimal  
        tagId: animal.tagId,  
        locationShed,  
        date: new Date(date),  
        owner: userId,  
      });  

      await newTreatmentEntry.save();  
      createdTreatments.push(newTreatmentEntry);  

      // Update or create animal cost entry  
      let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });  

      if (animalCostEntry) {  
        animalCostEntry.treatmentCost += treatmentCost / animals.length; // Add cost per animal  
      } else {  
        animalCostEntry = new AnimalCost({  
          animalTagId: animal.tagId,  
          treatmentCost: treatmentCost / animals.length,  
          feedCost: 0,  
          date,  
          owner: userId,  
        });  
      }  

      await animalCostEntry.save();  
    }  
  }  
   
  res.status(201).json({  
    status: "SUCCESS",  
    data: {  
      treatments: createdTreatments,  
      totalTreatmentCost,  
    },  
  });  
});

const addTreatmentForAnimal = asyncwrapper(async (req, res, next) => {  
  const userId = req.userId;  
  const { treatments, tagId, date } = req.body;  

  // Validate input data  
  if (!Array.isArray(treatments) || treatments.length === 0 || !tagId || !date) {  
      return res.status(400).json({  
          status: "FAILURE",  
          message: "treatments (array), tagId, and date are required.",  
      });  
  }  

  // Find the animal using tagId  
  const animal = await Animal.findOne({ tagId });  
  if (!animal) {  
      return res.status(404).json({  
          status: "FAILURE",  
          message: `Animal with tag ID "${tagId}" not found.`,  
      });  
  }  

  let totalTreatmentCost = 0; // Initialize total treatment cost  
  const createdTreatments = []; // Array to store created treatment entries  

  // Process each treatment  
  for (const treatmentItem of treatments) {  
      const { treatmentId, volume } = treatmentItem; // Extract treatmentId and volume  

      // Validate treatmentId and volume  
      if (!treatmentId || !volume || isNaN(volume) || volume <= 0) {  
          return res.status(400).json({  
              status: "FAILURE",  
              message: "Each treatment must have a valid treatmentId and volume.",  
          });  
      }  

      // Find treatment by ID  
      const treatment = await Treatment.findById(treatmentId);  
      if (!treatment) {  
          return res.status(404).json({  
              status: "FAILURE",  
              message: `Treatment with ID "${treatmentId}" not found.`,  
          });  
      }  
        // Check if treatment is expired 
      if (treatment.expireDate && new Date(treatment.expireDate) < new Date()) {  
          return res.status(400).json({  
           status: "FAILURE",  
           message: `Treatment "${treatment.name}" is expired (Expired on ${treatment.expireDate.toISOString().split('T')[0]}).`,  
        });  
      }
      // Check if the user is authorized to use the treatment  
      if (treatment.owner.toString() !== userId.toString()) {  
          return res.status(403).json({  
              status: "FAILURE",  
              message: "You are not authorized to use this treatment.",  
          });  
      }  

      // Check if there is enough stock available  
      if (treatment.volume < volume) {  
          return res.status(400).json({  
              status: "FAILURE",  
              message: `Not enough stock for treatment "${treatment.name}". Available: ${treatment.volume}, Requested: ${volume}.`,  
          });  
      }  

      // Deduct volume from treatment stock  
      treatment.volume -= volume;  
      await treatment.save();  

      // Calculate the cost for this treatment  
      const treatmentCost = treatment.pricePerMl * volume;  
      totalTreatmentCost += treatmentCost;  

      // Create a new TreatmentEntry for the animal  
      const newTreatmentEntry = new TreatmentEntry({  
          treatments: [{ treatmentId: treatment._id, volume }], // Array format for treatments  
          tagId: animal.tagId, // Associate with the animal's tag ID  
          locationShed: animal.locationShed || 'Unknown', // Default to 'Unknown' if not provided  
          date: new Date(date), // Ensure the date is a valid Date object  
          owner: userId, // Owner ID  
      });  

      await newTreatmentEntry.save(); // Save the treatment entry  
      createdTreatments.push(newTreatmentEntry); // Add to created treatments list  

      // Update or create an AnimalCost entry  
      let animalCostEntry = await AnimalCost.findOne({ animalTagId: animal.tagId });  
      if (animalCostEntry) {  
          animalCostEntry.treatmentCost += treatmentCost; // Update existing entry  
      } else {  
          animalCostEntry = new AnimalCost({  
              animalTagId: animal.tagId,  
              treatmentCost, // Set the treatment cost  
              feedCost: 0,  
              date: new Date(date), // Ensure the date is valid  
              owner: userId, // Owner ID  
          });  
      }  

      await animalCostEntry.save(); // Save or update animal cost entry  
  }  

  // Respond with the created treatments and total treatment cost  
  res.status(201).json({  
      status: "SUCCESS",  
      data: {  
          treatments: createdTreatments,  
          totalTreatmentCost,  
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
  

  const updateTreatmentForAnimal = asyncwrapper(async (req, res, next) => {
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

    let treatment; // Declare treatment globally for the function

    // Check if treatment name is provided and replace it with the corresponding treatment ID
    if (updatedData.treatmentName) {
        treatment = await Treatment.findOne({ name: updatedData.treatmentName });
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
            return next(AppError.create("Invalid date format", 400, httpstatustext.FAIL));
        }
        treatmentEntry.date = parsedDate; // Assign the validated date
    }

    // Update top-level fields in the treatment entry
    Object.assign(treatmentEntry, updatedData);

    // If `volume` or `treatment` is updated, recalculate costs
    if (updatedData.volume || updatedData.treatment) {
        treatment = treatment || (await Treatment.findById(treatmentEntry.treatment)); // Fetch treatment if not already fetched
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
    const pricePerMl = treatment.price / treatment.volume; // Calculate outside loop for efficiency
    for (const animal of animals) {
        let animalCostEntry = await AnimalCost.findOne({
            animalTagId: animal.tagId,
        });

        const treatmentCostPerAnimal = treatmentEntry.volume * pricePerMl;

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
  const limit = parseInt(query.limit, 10) || 10;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const filter = { owner: userId };

  if (query.locationShed) {
    filter.locationShed = query.locationShed;
  }

  if (query.tagId) {
    filter.tagId = query.tagId;
  }

  if (query.date) {
    filter.date = query.date;
  }

  // Get the total count of documents that match the filter
  const totalCount = await TreatmentEntry.countDocuments(filter);

  // Find treatment entries with pagination
  const treatmentShed = await TreatmentEntry.find(filter, { __v: false })
    .populate({
      path: "treatments.treatmentId", // Correct path to populate
      select: "name price volume", // Select only relevant fields
    })
    .limit(limit)
    .skip(skip);

  // Map the populated data for a cleaner response
  const response = treatmentShed.map((entry) => ({
    _id: entry._id,
    locationShed: entry.locationShed,
    tagId: entry.tagId,
    date: entry.date,
    treatments: entry.treatments.map((treatment) => ({
      treatmentId: treatment.treatmentId?._id, // Treatment ID
      treatmentName: treatment.treatmentId?.name, // Treatment name from the populated data
      treatmentPrice: treatment.treatmentId?.price, // Treatment price from the populated data
      treatmentVolume: treatment.treatmentId?.volume, // Treatment volume from the populated data
      volume: treatment.volume, // Volume specific to this treatment entry
    })),
  }));

  res.json({
    status: httpstatustext.SUCCESS,
    data: {
      treatmentShed: response,
      pagination: {
        total: totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
  });
});
  
const  deleteTreatmentShed = asyncwrapper(async (req, res, next) => {
  const userId = req.userId;
  const { treatmentShedId } = req.params; // ID of the treatment entry to delete
  
  // Find the treatment entry
  const treatmentEntry = await TreatmentEntry.findById(treatmentShedId);
  if (!treatmentEntry) {
      return res.status(404).json({
          status: "FAILURE",
          message: "Treatment entry not found.",
      });
  }

  // Ensure the user is authorized to delete the treatment entry
  if (treatmentEntry.owner.toString() !== userId.toString()) {
      return res.status(403).json({
          status: "FAILURE",
          message: "You are not authorized to delete this treatment entry.",
      });
  }

  // Iterate through each treatment in the entry and restore stock
  for (const treatmentItem of treatmentEntry.treatments) {
      const treatment = await Treatment.findById(treatmentItem.treatmentId);
      if (treatment) {
          treatment.volume += treatmentItem.volume; // Restore deducted volume
          await treatment.save();
      }
  }

  // Delete the treatment entry
  await TreatmentEntry.findByIdAndDelete(treatmentShedId);

  // Update the treatment cost for the animal
  let animalCostEntry = await AnimalCost.findOne({ animalTagId: treatmentEntry.tagId });

  if (animalCostEntry) {
      // Deduct the treatment cost from the total treatment cost
      const deductedCost = treatmentEntry.treatments.reduce((sum, item) => {
          return sum + (item.volume * (treatmentEntry.pricePerMl || 0));
      }, 0);

      animalCostEntry.treatmentCost = Math.max(0, animalCostEntry.treatmentCost - deductedCost);
      await animalCostEntry.save();
  }

  // Respond with success message
  res.status(200).json({
      status: "SUCCESS",
      message: "Treatment entry deleted successfully.",
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
    getsingleTreatmentShed,
    getAllTreatmentsByShed, 
    deleteTreatmentShed,
    updateTreatmentForAnimal, 
    getTreatments 
}
