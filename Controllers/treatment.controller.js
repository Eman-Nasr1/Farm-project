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
const excelOps = require('../utilits/excelOperations');
const i18n = require('../i18n');

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
  const {
    name,
    type,
    bottles,
    volumePerBottle,
    unitOfMeasure,
    bottlePrice,
    expireDate
  } = req.body;

  // Validate inputs
  if (
    !name ||
    !type ||
    bottles === undefined || isNaN(bottles) || bottles < 0 ||
    volumePerBottle === undefined || isNaN(volumePerBottle) || volumePerBottle <= 0 ||
    !unitOfMeasure || !['ml', 'cm³', 'ampoule'].includes(unitOfMeasure) ||
    bottlePrice === undefined || isNaN(bottlePrice) || bottlePrice < 0 ||
    !expireDate
  ) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: "Valid name, type, bottles, volume per bottle, unit, bottle price, and expiry date are required.",
    });
  }

  // Validate expiry date
  const expiry = new Date(expireDate);
  if (isNaN(expiry.getTime()) || expiry < new Date()) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: "Invalid or past expiry date.",
    });
  }

  // Derived calculations
  const totalVolume = bottles * volumePerBottle;
  let pricePerMl = null;
  if (['ml', 'cm³'].includes(unitOfMeasure)) {
    pricePerMl = bottlePrice / volumePerBottle;
  }

  const newTreatment = new Treatment({
    name,
    type,
    stock: {
      bottles,
      volumePerBottle,
      unitOfMeasure,
      totalVolume
    },
    pricing: {
      bottlePrice
    },
    pricePerMl,
    expireDate: expiry,
    owner: userId
  });

  await newTreatment.save();

  res.json({
    status: httpstatustext.SUCCESS,
    data: { treatment: newTreatment }
  });
});

const updateTreatment = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const treatmentId = req.params.treatmentId;
  const {
    name,
    type,
    bottles,
    volumePerBottle,
    unitOfMeasure,
    bottlePrice,
    expireDate
  } = req.body;

  const treatment = await Treatment.findOne({ _id: treatmentId, owner: userId });
  if (!treatment) {
    const error = AppError.create(
      "Treatment not found or not authorized.",
      404,
      httpstatustext.FAIL
    );
    return next(error);
  }

  // Apply updates
  if (name) treatment.name = name;
  if (type) treatment.type = type;

  if (bottles !== undefined) treatment.stock.bottles = bottles;
  if (volumePerBottle !== undefined) treatment.stock.volumePerBottle = volumePerBottle;
  if (unitOfMeasure) treatment.stock.unitOfMeasure = unitOfMeasure;
  if (bottlePrice !== undefined) treatment.pricing.bottlePrice = bottlePrice;

  if (expireDate) {
    const expiry = new Date(expireDate);
    if (isNaN(expiry.getTime()) || expiry < new Date()) {
      return res.status(400).json({
        status: httpstatustext.FAIL,
        message: "Invalid or past expiry date.",
      });
    }
    treatment.expireDate = expiry;
  }

  // Recalculate pricePerMl if unit is ml or cm³
  if (['ml', 'cm³'].includes(treatment.stock.unitOfMeasure)) {
    treatment.pricePerMl = treatment.pricing.bottlePrice / treatment.stock.volumePerBottle;
  } else {
    treatment.pricePerMl = null;
  }

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
  const { treatments, locationShed, date, eyeCheck, rectalCheck, respiratoryCheck, rumenCheck } = req.body;

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

  const shed = await LocationShed.findById(locationShed);
  if (!shed) {
    return res.status(404).json({
      status: "FAILURE",
      message: `Location shed with ID "${locationShed}" not found.`,
    });
  }

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
    const { treatmentId } = treatmentItem;

    if (!treatmentId) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each treatment must have a valid treatmentId.",
      });
    }

    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) {
      return res.status(404).json({
        status: "FAILURE",
        message: `Treatment with ID "${treatmentId}" not found.`,
      });
    }

    if (treatment.expireDate && new Date(treatment.expireDate) < new Date()) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Treatment "${treatment.name}" is expired (Expired on ${
          treatment.expireDate.toISOString().split("T")[0]
        }).`,
      });
    }

    if (treatment.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "FAILURE",
        message: "You are not authorized to use this treatment.",
      });
    }

    const requiredDoses = animals.length;
    if (!treatment.stock || treatment.stock.totalDoses < requiredDoses) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Not enough stock for treatment "${treatment.name}". Available: ${
          treatment.stock ? treatment.stock.totalDoses : 0
        }, Required: ${requiredDoses}.`,
      });
    }

    // Deduct total required doses
    treatment.stock.totalDoses -= requiredDoses;

    // Adjust bottles if needed
    const expectedBottles = Math.ceil(treatment.stock.totalDoses / treatment.stock.dosesPerBottle);
    if (expectedBottles < treatment.stock.bottles) {
      treatment.stock.bottles = expectedBottles;
    }

    await treatment.save();

    const treatmentCost = treatment.pricing.dosePrice * requiredDoses;
    totalTreatmentCost += treatmentCost;

    for (const animal of animals) {
      const newTreatmentEntry = new TreatmentEntry({
        treatments: [{ treatmentId: treatment._id, doses: 1 }],
        tagId: animal.tagId,
        locationShed: shed._id,
        date: new Date(date),
        owner: userId,
        eyeCheck: eyeCheck || false,
        rectalCheck: rectalCheck || false,
        respiratoryCheck: respiratoryCheck || false,
        rumenCheck: rumenCheck || false,
      });

      await newTreatmentEntry.save();
      createdTreatments.push(newTreatmentEntry);

      let animalCostEntry = await AnimalCost.findOne({
        animalTagId: animal.tagId,
      });

      if (animalCostEntry) {
        animalCostEntry.treatmentCost += treatment.pricing.dosePrice;
      } else {
        animalCostEntry = new AnimalCost({
          animalTagId: animal.tagId,
          treatmentCost: treatment.pricing.dosePrice,
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
  const { treatments, tagId, date, eyeCheck, rectalCheck, respiratoryCheck, rumenCheck } = req.body;


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

  let totalTreatmentCost = 0;
  const createdTreatments = [];

  // Process each treatment
  for (const treatmentItem of treatments) {
    const { treatmentId, doses } = treatmentItem;

    // Validate treatmentId and doses
    if (!treatmentId || !doses || isNaN(doses) || doses <= 0) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each treatment must have a valid treatmentId and doses.",
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

    // Check if there is enough stock available (doses)
    if (!treatment.stock || treatment.stock.totalDoses < doses) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Not enough stock for treatment "${treatment.name}". Available: ${treatment.stock ? treatment.stock.totalDoses : 0}, Requested: ${doses}.`,
      });
    }

    // Deduct doses from treatment stock
    treatment.stock.totalDoses -= doses;
    // Update bottles if needed
    const expectedBottles = Math.ceil(treatment.stock.totalDoses / treatment.stock.dosesPerBottle);
    if (expectedBottles < treatment.stock.bottles) {
      treatment.stock.bottles = expectedBottles;
    }
    await treatment.save();

    // Calculate the cost for this treatment
    const treatmentCost = treatment.pricing.dosePrice * doses;
    totalTreatmentCost += treatmentCost;

    // Create a new TreatmentEntry for the animal
    const newTreatmentEntry = new TreatmentEntry({
      treatments: [{ treatmentId: treatment._id, doses }],
      tagId: animal.tagId,
      locationShed: animal.locationShed || "Unknown",
      date: new Date(date),
      owner: userId,
      eyeCheck: eyeCheck || false,
      rectalCheck: rectalCheck || false,
      respiratoryCheck: respiratoryCheck || false,
      rumenCheck: rumenCheck || false, // ✅ جديد
    });
    

    await newTreatmentEntry.save();
    createdTreatments.push(newTreatmentEntry);

    // Update or create an AnimalCost entry
    let animalCostEntry = await AnimalCost.findOne({
      animalTagId: animal.tagId,
    });
    if (animalCostEntry) {
      animalCostEntry.treatmentCost += treatmentCost;
    } else {
      animalCostEntry = new AnimalCost({
        animalTagId: animal.tagId,
        treatmentCost,
        feedCost: 0,
        date: new Date(date),
        owner: userId,
      });
    }

    await animalCostEntry.save();
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
      const { treatmentId: newTreatmentId, doses: newDoses } = treatmentItem;

      if (!newTreatmentId || !newDoses || isNaN(newDoses) || newDoses <= 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: "Each treatment must have a valid treatmentId and doses.",
        });
      }

      // Fetch the old treatment from the existing treatment entry
      const oldTreatmentId = existingTreatmentEntry.treatments[0].treatmentId;
      const oldDoses = existingTreatmentEntry.treatments[0].doses;
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

      // Calculate the difference in doses
      const dosesDifference = newDoses - oldDoses;

      // If the treatment ID is changed
      if (oldTreatmentId.toString() !== newTreatmentId.toString()) {
        // Return the old doses to the old treatment stock
        oldTreatment.stock.totalDoses += oldDoses;
        await oldTreatment.save({ session });

        // Deduct the new doses from the new treatment stock
        if (!newTreatment.stock || newTreatment.stock.totalDoses < newDoses) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "FAILURE",
            message: `Not enough stock for treatment "${newTreatment.name}". Available: ${newTreatment.stock ? newTreatment.stock.totalDoses : 0}, Requested: ${newDoses}.`,
          });
        }
        newTreatment.stock.totalDoses -= newDoses;
        // Update bottles if needed
        const expectedBottles = Math.ceil(newTreatment.stock.totalDoses / newTreatment.stock.dosesPerBottle);
        if (expectedBottles < newTreatment.stock.bottles) {
          newTreatment.stock.bottles = expectedBottles;
        }
        await newTreatment.save({ session });
      } else {
        // If the treatment ID is the same, adjust the stock based on the doses difference
        if (dosesDifference > 0) {
          // If the new doses is greater, deduct the difference
          if (!newTreatment.stock || newTreatment.stock.totalDoses < dosesDifference) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              status: "FAILURE",
              message: `Not enough stock for treatment "${newTreatment.name}". Available: ${newTreatment.stock ? newTreatment.stock.totalDoses : 0}, Required: ${dosesDifference}.`,
            });
          }
          newTreatment.stock.totalDoses -= dosesDifference;
        } else if (dosesDifference < 0) {
          // If the new doses is less, return the difference
          newTreatment.stock.totalDoses += Math.abs(dosesDifference);
        }
        // Update bottles if needed
        const expectedBottles = Math.ceil(newTreatment.stock.totalDoses / newTreatment.stock.dosesPerBottle);
        if (expectedBottles < newTreatment.stock.bottles) {
          newTreatment.stock.bottles = expectedBottles;
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
      const oldTreatmentCost = oldTreatment.pricing.dosePrice * oldDoses;
      const newTreatmentCost = newTreatment.pricing.dosePrice * newDoses;

      // Adjust the animal cost entry
      animalCostEntry.treatmentCost -= oldTreatmentCost;
      animalCostEntry.treatmentCost += newTreatmentCost;
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
      treatment.stock.totalDoses += treatmentItem.doses; // Restore deducted doses
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
      return sum + item.doses * (treatmentEntry.pricePerMl || 0);
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
      // Find the animal by ID
      const animal = await Animal.findById(req.params.animalId);
      if (!animal) {
          const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
          return next(error);
      }

      // Find all treatment entries for this animal's tagId
      const treatmentEntries = await TreatmentEntry.find({ tagId: animal.tagId })
          .populate({
              path: 'treatments.treatmentId',
              select: 'name pricePerMl volume expireDate' // Include relevant treatment details
          })
          .populate({
              path: 'locationShed',
              select: 'locationShedName' // Include shed name if needed
          })
          .sort({ date: -1 }); // Sort by date (newest first)

      if (!treatmentEntries || treatmentEntries.length === 0) {
          const error = AppError.create('No treatment records found for this animal', 404, httpstatustext.FAIL);
          return next(error);
      }

      // Format the response
      const formattedTreatments = treatmentEntries.map(entry => ({
          _id: entry._id,
          date: entry.date,
          locationShed: entry.locationShed ? {
              _id: entry.locationShed._id,
              name: entry.locationShed.locationShedName
          } : null,
          treatments: entry.treatments.map(treatment => ({
              treatmentId: treatment.treatmentId._id,
              name: treatment.treatmentId.name,
              volume: treatment.volume,
              pricePerMl: treatment.treatmentId.pricePerMl,
              expireDate: treatment.treatmentId.expireDate
          }))
      }));

      return res.json({ 
          status: httpstatustext.SUCCESS, 
          data: { 
              animal: {
                  _id: animal._id,
                  tagId: animal.tagId,
                  animalType: animal.animalType
              },
              treatments: formattedTreatments 
          } 
      });

  } catch (error) {
      console.error("Error fetching treatments for animal:", error);
      next(error);
  }
});

const importTreatmentsFromExcel = asyncwrapper(async (req, res, next) => {
    const userId = req.user?.id || req.userId;
    if (!userId) {
        return next(AppError.create(i18n.__('UNAUTHORIZED'), 401, httpstatustext.FAIL));
    }

    try {
        if (!req.file || !req.file.buffer) {
            return next(AppError.create(i18n.__('NO_FILE_UPLOADED'), 400, httpstatustext.FAIL));
        }

        const data = excelOps.readExcelFile(req.file.buffer);

        // Skip header row
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => !cell)) continue;

            // Extract and validate data
            const [
                tagId,
                treatmentName,
                volumeStr,
                dateStr
            ] = row.map(cell => cell?.toString().trim());

            // Validate required fields
            if (!tagId || !treatmentName || !volumeStr || !dateStr) {
                return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse volume
            const volume = parseFloat(volumeStr);
            if (isNaN(volume) || volume <= 0) {
                return next(AppError.create(i18n.__('INVALID_VOLUME', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse date
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Find animal
            const animal = await Animal.findOne({ tagId, owner: userId });
            if (!animal) {
                return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Find treatment
            const treatment = await Treatment.findOne({ 
                name: { $regex: new RegExp(`^${treatmentName}$`, 'i') },
                owner: userId 
            });
            if (!treatment) {
                return next(AppError.create(i18n.__('TREATMENT_NOT_FOUND', { name: treatmentName, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Check if treatment is expired
            if (treatment.expireDate && new Date(treatment.expireDate) < new Date()) {
                return next(AppError.create(i18n.__('TREATMENT_EXPIRED', { 
                    name: treatmentName, 
                    date: treatment.expireDate.toISOString().split('T')[0],
                    row: i + 1 
                }), 400, httpstatustext.FAIL));
            }

            // Check stock
            if (treatment.volume < volume) {
                return next(AppError.create(i18n.__('INSUFFICIENT_TREATMENT_VOLUME', { 
                    name: treatmentName,
                    available: treatment.volume,
                    requested: volume,
                    row: i + 1 
                }), 400, httpstatustext.FAIL));
            }

            // Calculate cost
            const treatmentCost = treatment.pricePerMl * volume;

            // Start transaction
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                // Update treatment stock
                treatment.volume -= volume;
                await treatment.save({ session });

                // Create treatment entry using animal's current location
                const newTreatmentEntry = await TreatmentEntry.create([{
                    treatments: [{ 
                        treatmentId: treatment._id,
                        volume 
                    }],
                    tagId,
                    locationShed: animal.locationShed,
                    date,
                    owner: userId
                }], { session });

                // Update animal cost
                await AnimalCost.findOneAndUpdate(
                    { animalTagId: tagId },
                    { 
                        $inc: { treatmentCost },
                        $setOnInsert: { 
                            feedCost: 0,
                            date,
                            owner: userId
                        }
                    },
                    { upsert: true, session }
                );

                await session.commitTransaction();
                session.endSession();
            } catch (error) {
                await session.abortTransaction();
                session.endSession();
                throw error;
            }
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: i18n.__('TREATMENT_ENTRIES_IMPORTED_SUCCESSFULLY')
        });
    } catch (error) {
        console.error('Import error:', error);
        return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const exportTreatmentsToExcel = asyncwrapper(async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        if (!userId) {
            return next(AppError.create(i18n.__('UNAUTHORIZED'), 401, httpstatustext.FAIL));
        }

        // Build filter
        const filter = { owner: userId };
        if (req.query.tagId) filter.tagId = req.query.tagId;
        
        // Date range filtering
        if (req.query.startDate || req.query.endDate) {
            filter.date = {};
            if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
        }

        const entries = await TreatmentEntry.find(filter)
            .sort({ date: 1 })
            .populate('treatments.treatmentId', 'name pricePerMl')
            .populate('locationShed', 'locationShedName');

        if (entries.length === 0) {
            return res.status(404).json({
                status: httpstatustext.FAIL,
                message: i18n.__('NO_TREATMENT_RECORDS')
            });
        }

        const headers = excelOps.headers.treatment[lang].export;
        const sheetName = excelOps.sheetNames.treatment.export[lang];

        const data = entries.map(entry => [
            entry.tagId,
            entry.treatments[0]?.treatmentId?.name || '',
            entry.treatments[0]?.volume || '',
            entry.date?.toISOString().split('T')[0] || '',
            entry.locationShed?.locationShedName || '',
            (entry.treatments[0]?.volume * (entry.treatments[0]?.treatmentId?.pricePerMl || 0)).toFixed(2),
            entry.createdAt?.toISOString().split('T')[0] || ''
        ]);

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths
        const columnWidths = [15, 25, 15, 12, 20, 12, 12];
        excelOps.setColumnWidths(worksheet, columnWidths);

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `treatment_entries_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export error:', error);
        return next(AppError.create(i18n.__('EXPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const downloadTreatmentTemplate = asyncwrapper(async (req, res, next) => {
    try {
        const lang = req.query.lang || 'en';

        const headers = excelOps.headers.treatment[lang].template;
        const exampleRow = excelOps.templateExamples.treatment[lang];
        const sheetName = excelOps.sheetNames.treatment.template[lang];

        const workbook = excelOps.createExcelFile([exampleRow], headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];
        excelOps.setColumnWidths(worksheet, headers.map(() => 20));

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `treatment_template_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Template Download Error:', error);
        next(AppError.create(i18n.__('TEMPLATE_GENERATION_FAILED'), 500, httpstatustext.ERROR));
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
  getTreatmentsForSpecificAnimal,
  importTreatmentsFromExcel,
  exportTreatmentsToExcel,
  downloadTreatmentTemplate
};
