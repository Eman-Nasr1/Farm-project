const Treatment = require("../Models/treatment.model");
const httpstatustext = require("../utilits/httpstatustext");
const asyncwrapper = require("../middleware/asyncwrapper");
const AppError = require("../utilits/AppError");
const User = require("../Models/user.model");
const LocationShed = require('../Models/locationsed.model');
const Animal = require("../Models/animal.model");
const TreatmentEntry = require("../Models/treatmentEntry.model");
const AnimalCost = require("../Models/animalCost.model");
const mongoose = require("mongoose");

const getallTreatments = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
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

  const treatments = await Treatment.find(filter, { __v: false })
    .limit(limit)
    .skip(skip);
  const total = await Treatment.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);
  res.json({
    status: httpstatustext.SUCCESS,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { treatments },
  });
});

const getTreatments = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const query = req.query;
  const filter = { owner: userId };
  const treatments = await Treatment.find(filter, { __v: false }).sort({
    createdAt: -1,
  });
  res.json({
    status: "success",
    data: treatments,
  });
});
const getsnigleTreatment = asyncwrapper(async (req, res, next) => {
  const treatment = await Treatment.findById(req.params.treatmentId);
  if (!treatment) {
    const error = AppError.create(
      "Treatment not found",
      404,
      httpstatustext.FAIL
    );
    return next(error);
  }
  return res.json({ status: httpstatustext.SUCCESS, data: { treatment } });
});

const addTreatment = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { name, type, volume, price, expireDate } = req.body;

  // Validate input
  if (
    !name ||
    !price ||
    isNaN(price) ||
    price <= 0 ||
    !volume ||
    isNaN(volume) ||
    volume <= 0
  ) {
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
  const userId = req.user.id;
  const treatmentId = req.params.treatmentId;
  const { price, volume, ...updatedData } = req.body; // Extract price & volume separately

  // Find the treatment owned by the user
  let treatment = await Treatment.findOne({ _id: treatmentId, owner: userId });

  if (!treatment) {
    const error = AppError.create(
      "Treatment information not found or unauthorized to update",
      404,
      httpstatustext.FAIL
    );
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

const deleteTreatment = asyncwrapper(async (req, res) => {
  await Treatment.deleteOne({ _id: req.params.treatmentId });
  res.status(200).json({ status: httpstatustext.SUCCESS, data: null });
});

//------------------------------------------treetment for animale-----------------------

const addTreatmentForAnimals = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { treatments, locationShed, date } = req.body;

  if (
    !Array.isArray(treatments) ||
    treatments.length === 0 ||
    !locationShed ||
    !date
  ) {
    return res.status(400).json({
      status: "FAILURE",
      message: "treatments (array), locationShed, and date are required.",
    });
  }

  // Find the locationShed document by its ID
  const shed = await LocationShed.findById(locationShed);
  if (!shed) {
    return res.status(404).json({
      status: "FAILURE",
      message: `Location shed with ID "${locationShed}" not found.`,
    });
  }

  // Find animals in the specified locationShed
  const animals = await Animal.find({ locationShed });
  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${shed.locationShedName}".`,
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
        message: `Treatment "${treatment.name}" is expired (Expired on ${
          treatment.expireDate.toISOString().split("T")[0]
        }).`,
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
        locationShed: shed._id, // Store the locationShed ID
        date: new Date(date),
        owner: userId,
      });

      await newTreatmentEntry.save();
      createdTreatments.push(newTreatmentEntry);

      // Update or create animal cost entry
      let animalCostEntry = await AnimalCost.findOne({
        animalTagId: animal.tagId,
      });

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
  const userId = req.user.id;
  const { treatments, tagId, date } = req.body;

  // Validate input data
  if (
    !Array.isArray(treatments) ||
    treatments.length === 0 ||
    !tagId ||
    !date
  ) {
    return res.status(400).json({
      status: "FAILURE",
      message: "treatments (array), tagId, and date are required.",
    });
  }

  // Find the animal using tagId
  const animal = await Animal.findOne({  
    tagId,  
    owner: userId, // Ensure the animal belongs to the user  
});
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
        message: `Treatment "${treatment.name}" is expired (Expired on ${
          treatment.expireDate.toISOString().split("T")[0]
        }).`,
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
      locationShed: animal.locationShed || "Unknown", // Default to 'Unknown' if not provided
      date: new Date(date), // Ensure the date is a valid Date object
      owner: userId, // Owner ID
    });

    await newTreatmentEntry.save(); // Save the treatment entry
    createdTreatments.push(newTreatmentEntry); // Add to created treatments list

    // Update or create an AnimalCost entry
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });
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
  try {
    // Fetch the treatment shed entry by ID and populate relevant fields
    const treatmentShed = await TreatmentEntry.findById(
      req.params.treatmentShedId
    )
      .populate({
        path: "treatments.treatmentId",
        select: "name pricePerMl volume",
      })
      .populate({
        path: "locationShed",
        select: "locationShedName", // Populate locationShedName
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
      locationShed: treatmentShed.locationShed ? {
        _id: treatmentShed.locationShed._id,
        locationShedName: treatmentShed.locationShed?.locationShedName,
      } : null,
      date: treatmentShed.date,
      treatments: treatmentShed.treatments.map((treatment) => ({
        treatmentId: treatment.treatmentId._id,
        treatmentName: treatment.treatmentId.name,
        pricePerMl: treatment.treatmentId.pricePerMl,
        volume: treatment.volume,
      })),
    };

    return res.json({
      status: httpstatustext.SUCCESS,
      data: { treatmentShed: response },
    });
  } catch (error) {
    console.error("Error fetching treatment shed:", error);
    next(error);
  }
});

const updateTreatmentForAnimal = asyncwrapper(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { treatmentEntryId } = req.params;
    const { treatments, tagId, date } = req.body;

    if (!Array.isArray(treatments) || treatments.length === 0 || !tagId || !date) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        status: "FAILURE",
        message: "treatments (array), tagId, and date are required.",
      });
    }

    // Fetch the existing treatment entry
    const existingTreatmentEntry = await TreatmentEntry.findById(
      treatmentEntryId
    ).session(session);
    if (!existingTreatmentEntry) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: "FAILURE",
        message: `Treatment entry with ID "${treatmentEntryId}" not found.`,
      });
    }

    // Fetch the animal associated with the tagId
    const animal = await Animal.findOne({ tagId }).session(session);
    if (!animal) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        status: "FAILURE",
        message: `Animal with tag ID "${tagId}" not found.`,
      });
    }

    // Process each treatment in the treatments array
    for (const treatmentItem of treatments) {
      const { treatmentId: newTreatmentId, volume: newVolume } = treatmentItem;

      if (!newTreatmentId || !newVolume || isNaN(newVolume) || newVolume <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: "Each treatment must have a valid treatmentId and volume.",
        });
      }

      // Fetch the old treatment from the existing treatment entry
      const oldTreatmentId = existingTreatmentEntry.treatments[0].treatmentId;
      const oldVolume = existingTreatmentEntry.treatments[0].volume;
      const oldTreatment = await Treatment.findById(oldTreatmentId).session(
        session
      );

      if (!oldTreatment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Old treatment with ID "${oldTreatmentId}" not found.`,
        });
      }

      // Fetch the new treatment
      const newTreatment = await Treatment.findById(newTreatmentId).session(
        session
      );
      if (!newTreatment) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Treatment with ID "${newTreatmentId}" not found.`,
        });
      }

      // Check if the new treatment is expired
      if (
        newTreatment.expireDate &&
        new Date(newTreatment.expireDate) < new Date()
      ) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: `Treatment "${newTreatment.name}" is expired (Expired on ${
            newTreatment.expireDate.toISOString().split("T")[0]
          }).`,
        });
      }

      // Check authorization for the new treatment
      if (newTreatment.owner.toString() !== userId.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          status: "FAILURE",
          message: "You are not authorized to use this treatment.",
        });
      }

      // Calculate the difference in volume
      const volumeDifference = newVolume - oldVolume;

      // If the treatment ID is changed
      if (oldTreatmentId.toString() !== newTreatmentId.toString()) {
        // Return the old volume to the old treatment stock
        oldTreatment.volume += oldVolume;
        await oldTreatment.save({ session });

        // Deduct the new volume from the new treatment stock
        if (newTreatment.volume < newVolume) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "FAILURE",
            message: `Not enough stock for treatment "${newTreatment.name}". Available: ${newTreatment.volume}, Requested: ${newVolume}.`,
          });
        }
        newTreatment.volume -= newVolume;
        await newTreatment.save({ session });
      } else {
        // If the treatment ID is the same, adjust the stock based on the volume difference
        if (volumeDifference > 0) {
          // If the new volume is greater, deduct the difference
          if (newTreatment.volume < volumeDifference) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              status: "FAILURE",
              message: `Not enough stock for treatment "${newTreatment.name}". Available: ${newTreatment.volume}, Required: ${volumeDifference}.`,
            });
          }
          newTreatment.volume -= volumeDifference;
        } else if (volumeDifference < 0) {
          // If the new volume is less, return the difference
          newTreatment.volume += Math.abs(volumeDifference);
        }
        await newTreatment.save({ session });
      }

      // Fetch the associated animal cost entry
      let animalCostEntry = await AnimalCost.findOne({
        animalTagId: tagId,
      }).session(session);

      if (!animalCostEntry) {
        animalCostEntry = new AnimalCost({
          animalTagId: tagId,
          treatmentCost: 0,
          feedCost: 0,
          date,
          owner: userId,
        });
      }

      // Recalculate the treatment cost
      const oldTreatmentCost = oldTreatment.pricePerMl * oldVolume;
      const newTreatmentCost = newTreatment.pricePerMl * newVolume;

      // Adjust the animal cost entry
      animalCostEntry.treatmentCost -= oldTreatmentCost; // Remove the old cost
      animalCostEntry.treatmentCost += newTreatmentCost; // Add the new cost
      await animalCostEntry.save({ session });
    }

    // Update the treatment entry
    existingTreatmentEntry.treatments = treatments;
    existingTreatmentEntry.date = new Date(date);
    await existingTreatmentEntry.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Send response
    res.status(200).json({
      status: "SUCCESS",
      message: "Treatment entry updated successfully.",
      data: {
        treatmentEntry: existingTreatmentEntry,
      },
    });
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating treatment entry:", error);
    next(error);
  }
});

const getAllTreatmentsByShed = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
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
      path: "treatments.treatmentId",
      select: "name pricePerMl volume",
    })
    .populate({
      path: "locationShed",
      select: "locationShedName", // Populate locationShedName
    })
    .limit(limit)
    .skip(skip);

  // Map the populated data for a cleaner response
  const response = treatmentShed.map((entry) => ({
    _id: entry._id,
    locationShed: entry.locationShed ? {
      _id: entry.locationShed._id,
      locationShedName: entry.locationShed.locationShedName,
    } : null,
    tagId: entry.tagId,
    date: entry.date,
    treatments: entry.treatments.map((treatment) => ({
      treatmentId: treatment.treatmentId?._id,
      treatmentName: treatment.treatmentId?.name,
      treatmentPrice: treatment.treatmentId?.pricePerMl,
      treatmentVolume: treatment.treatmentId?.volume,
      volume: treatment.volume,
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

const deleteTreatmentShed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
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
  let animalCostEntry = await AnimalCost.findOne({
    animalTagId: treatmentEntry.tagId,
  });

  if (animalCostEntry) {
    // Deduct the treatment cost from the total treatment cost
    const deductedCost = treatmentEntry.treatments.reduce((sum, item) => {
      return sum + item.volume * (treatmentEntry.pricePerMl || 0);
    }, 0);

    animalCostEntry.treatmentCost = Math.max(
      0,
      animalCostEntry.treatmentCost - deductedCost
    );
    await animalCostEntry.save();
  }

  // Respond with success message
  res.status(200).json({
    status: "SUCCESS",
    message: "Treatment entry deleted successfully.",
  });
});


const getTreatmentsForSpecificAnimal = asyncwrapper(async (req, res, next) => {
  try {
      // 1. Find the animal
      const animal = await Animal.findById(req.params.animalId).lean();
      if (!animal) {
         // console.log(`Animal not found with ID: ${req.params.animalId}`);
          return next(AppError.create('Animal not found', 404, httpstatustext.FAIL));
      }

      //console.log(`Searching treatments for animal: ${animal._id}, tag: ${animal.tagId}`);

      // 2. Find treatment entries using tagId
      const treatmentEntries = await TreatmentEntry.find({ 
          tagId: animal.tagId 
      })
      .populate({
          path: 'treatments.treatmentId',
          select: 'name pricePerMl volume',
          options: { 
              lean: true,
              // This makes population not fail if treatment is missing
              transform: (doc) => doc || { name: 'Deleted Treatment' }
          }
      })
      .populate({
          path: 'locationShed',
          select: 'locationShedName',
          options: { lean: true }
      })
      .sort({ date: -1 })
      .lean();

      console.log(`Found ${treatmentEntries.length} treatment entries`);

      // 3. Filter out any entries that might have invalid treatments
      const validTreatmentEntries = treatmentEntries.filter(entry => 
          entry.treatments && entry.treatments.length > 0
      );

      // 4. Format the response
      const responseData = {
          animal: {
              _id: animal._id,
              tagId: animal.tagId,
              animalType: animal.animalType,
              gender: animal.gender
          },
          treatments: validTreatmentEntries.map(entry => ({
              _id: entry._id,
              date: entry.date,
              location: entry.locationShed ? {
                  _id: entry.locationShed._id,
                  name: entry.locationShed.locationShedName
              } : null,
              medications: entry.treatments.map(t => ({
                  _id: t.treatmentId?._id || null,
                  name: t.treatmentId?.name || 'Unknown Treatment',
                  dosage: t.volume,
                  unitPrice: t.treatmentId?.pricePerMl || 0,
                  totalCost: t.volume * (t.treatmentId?.pricePerMl || 0)
              }))
          }))
      };

      // Return success even if no treatments found, but with empty array
      return res.json({ 
          status: httpstatustext.SUCCESS, 
          data: responseData 
      });

  } catch (error) {
      console.error('Error fetching treatments:', error);
      return next(AppError.create('Error fetching treatment data', 500, httpstatustext.ERROR));
  }
});
module.exports = {
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
  getTreatments,
  getTreatmentsForSpecificAnimal
};
