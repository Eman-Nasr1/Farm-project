const Treatment = require("../Models/treatment.model");
const httpstatustext = require("../utilits/httpstatustext");
const asyncwrapper = require("../middleware/asyncwrapper");
const AppError = require("../utilits/AppError");
const User = require("../Models/user.model");
const LocationShed = require('../Models/locationsed.model');
const Animal = require("../Models/animal.model");
const TreatmentEntry = require("../Models/treatmentEntry.model");
const AnimalCost = require("../Models/animalCost.model");
const Supplier = require('../Models/supplier.model');
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
    .sort({ createdAt: -1 })
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
    expireDate,
    supplierId // <-- الجديد
  } = req.body;

  // Validate inputs (نفس فحوصاتك الأصلية)
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

  // التحقق من الـ supplier (خليه إجباريًا؛ لو عايزاه اختياري شيل الشرطين دول)
  if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
    return res.status(400).json({
      status: httpstatustext.FAIL,
      message: "Valid supplierId is required."
    });
  }
  const supplier = await Supplier.findOne({ _id: supplierId, owner: userId });
  if (!supplier) {
    return res.status(404).json({
      status: httpstatustext.FAIL,
      message: "Supplier not found or unauthorized."
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

  // استخدم ترانزاكشن عشان نضيف التريتمنت ونحدّث المورد مع بعض
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [newTreatment] = await Treatment.create([{
      name,
      type,
      stock: {
        bottles,
        volumePerBottle,
        unitOfMeasure,
        totalVolume
      },
      pricing: { bottlePrice },
      pricePerMl,
      expireDate: expiry,
      supplier: supplier._id,  // <-- ربط المورد هنا
      owner: userId
    }], { session });

    // لو عندك في Supplier مصفوفة treatments فحدّثها
    await Supplier.updateOne(
      { _id: supplier._id },
      { $addToSet: { treatments: newTreatment._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: httpstatustext.SUCCESS,
      data: { treatment: newTreatment }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return next(new AppError(err.message, 500));
  }
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
  const {
    treatments,
    locationShed,
    date,
    diagnosis = "",
  } = req.body;

  // Validate input
  if (!Array.isArray(treatments) || treatments.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "Treatments must be a non-empty array.",
    });
  }

  if (!locationShed || !date) {
    return res.status(400).json({
      status: "FAILURE",
      message: "locationShed and date are required fields.",
    });
  }

  // Validate date format
  if (isNaN(new Date(date).getTime())) {
    return res.status(400).json({
      status: "FAILURE",
      message: "Invalid date format. Please use ISO 8601 format.",
    });
  }

  // Find the shed and animals
  const [shed, animals] = await Promise.all([
    LocationShed.findById(locationShed),
    Animal.find({ locationShed, owner: userId })
  ]);

  if (!shed) {
    return res.status(404).json({
      status: "FAILURE",
      message: `Location shed with ID "${locationShed}" not found.`,
    });
  }

  if (animals.length === 0) {
    return res.status(404).json({
      status: "FAILURE",
      message: `No animals found in shed "${shed.locationShedName}".`,
    });
  }

  let totalTreatmentCost = 0;
  const createdTreatments = [];
  const treatmentDate = new Date(date);

  // Process treatments
  for (const treatmentItem of treatments) {
    const {
      treatmentId,
      volumePerAnimal,
      numberOfDoses,
      doses = []
    } = treatmentItem;

    // Validate treatment fields
    if (!treatmentId) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each treatment must have a valid treatmentId.",
      });
    }

    if (typeof volumePerAnimal !== 'number' || volumePerAnimal <= 0) {
      return res.status(400).json({
        status: "FAILURE",
        message: "volumePerAnimal must be a positive number.",
      });
    }

    // Validate doses configuration
    if (doses.length === 0 && (!numberOfDoses || numberOfDoses < 1)) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each treatment must specify either numberOfDoses (≥1) or a non-empty doses array.",
      });
    }

    // Find the treatment
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) {
      return res.status(404).json({
        status: "FAILURE",
        message: `Treatment with ID "${treatmentId}" not found.`,
      });
    }

    // Check authorization and expiration
    if (treatment.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "FAILURE",
        message: "You are not authorized to use this treatment.",
      });
    }

    if (treatment.expireDate && new Date(treatment.expireDate) <= new Date()) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Treatment "${treatment.name}" expired on ${treatment.expireDate.toISOString().split('T')[0]}.`,
      });
    }

    // Calculate required volume
    const actualDoseCount = doses.length > 0 ? doses.length : numberOfDoses;
    const requiredTotalVolume = animals.length * volumePerAnimal * actualDoseCount;

    // Check stock availability
    if (!treatment.stock || treatment.stock.totalVolume < requiredTotalVolume) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Insufficient stock for "${treatment.name}". Required: ${requiredTotalVolume} mL, Available: ${treatment.stock?.totalVolume || 0} mL.`,
      });
    }

    // Process doses - handle both ISO and date-only formats
    const processedDoses = doses.length > 0
      ? doses.map(dose => {
        const doseDate = dose.date.includes('T')
          ? new Date(dose.date)
          : new Date(`${dose.date}T00:00:00Z`);

        if (isNaN(doseDate.getTime())) {
          throw new Error(`Invalid dose date: ${dose.date}`);
        }

        return {
          date: doseDate,
          taken: dose.taken === true // Ensure boolean
        };
      })
      : Array.from({ length: numberOfDoses }, (_, i) => ({
        date: new Date(treatmentDate.getTime() + (i * 24 * 60 * 60 * 1000)),
        taken: false
      }));

    // Update treatment stock
    treatment.stock.totalVolume -= requiredTotalVolume;
    treatment.stock.bottles = Math.ceil(treatment.stock.totalVolume / treatment.stock.volumePerBottle);
    await treatment.save();

    // Calculate cost
    const treatmentCost = requiredTotalVolume * treatment.pricePerMl;
    totalTreatmentCost += treatmentCost;

    // Prepare bulk operations for performance
    const treatmentEntries = [];
    const animalCostUpdates = [];

    for (const animal of animals) {
      const treatmentPlan = {
        treatmentId,
        volumePerAnimal,
        numberOfDoses: actualDoseCount,
        doses: processedDoses,
      };

      treatmentEntries.push({
        treatments: [treatmentPlan],
        tagId: animal.tagId,
        locationShed: shed._id,
        date: treatmentDate,
        owner: userId,
        diagnosis,
      });

      const costPerAnimal = volumePerAnimal * actualDoseCount * treatment.pricePerMl;
      animalCostUpdates.push({
        updateOne: {
          filter: { animalTagId: animal.tagId },
          update: {
            $inc: { treatmentCost: costPerAnimal },
            $set: { date: treatmentDate },
            $setOnInsert: {
              animalTagId: animal.tagId,
              feedCost: 0,
              owner: userId
            }
          },
          upsert: true
        }
      });
    }

    // Bulk insert treatments
    const insertedTreatments = await TreatmentEntry.insertMany(treatmentEntries);
    createdTreatments.push(...insertedTreatments);

    // Bulk update animal costs
    if (animalCostUpdates.length > 0) {
      await AnimalCost.bulkWrite(animalCostUpdates);
    }
  }

  res.status(201).json({
    status: "SUCCESS",
    data: {
      treatments: createdTreatments,
      totalTreatmentCost,
      animalsTreated: animals.length,
      locationShed: {
        id: shed._id,
        name: shed.locationShedName
      }
    },
  });
});
const addTreatmentForAnimal = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const {
    treatments,
    tagId,
    date,
    eyeCheck = "",
    rectalCheck = "",
    respiratoryCheck = "",
    rumenCheck = "",
    diagnosis = "",
    temperature = null,
  } = req.body;

  // Basic validation
  if (!Array.isArray(treatments) || treatments.length === 0) {
    return res.status(400).json({
      status: "FAILURE",
      message: "Treatments must be a non-empty array.",
    });
  }

  if (!tagId || !date) {
    return res.status(400).json({
      status: "FAILURE",
      message: "tagId and date are required fields.",
    });
  }

  // Find the animal
  const animal = await Animal.findOne({ tagId, owner: userId });
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
    const {
      treatmentId,
      volumePerAnimal,
      numberOfDoses,
      doses = []
    } = treatmentItem;

    // Validate treatment fields
    if (!treatmentId || typeof volumePerAnimal !== 'number') {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each treatment must have a valid treatmentId and volumePerAnimal.",
      });
    }

    // Validate doses configuration
    if ((!numberOfDoses || numberOfDoses < 1) && (!Array.isArray(doses) || doses.length === 0)) {
      return res.status(400).json({
        status: "FAILURE",
        message: "Each treatment must specify either numberOfDoses (≥1) or a non-empty doses array.",
      });
    }

    // Find the treatment
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) {
      return res.status(404).json({
        status: "FAILURE",
        message: `Treatment with ID "${treatmentId}" not found.`,
      });
    }

    // Check treatment ownership
    if (treatment.owner.toString() !== userId.toString()) {
      return res.status(403).json({
        status: "FAILURE",
        message: "You are not authorized to use this treatment.",
      });
    }

    // Check expiration
    if (treatment.expireDate && new Date(treatment.expireDate) < new Date()) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Treatment "${treatment.name}" expired on ${treatment.expireDate.toISOString().split('T')[0]}.`,
      });
    }

    // Calculate required volume
    const actualDoseCount = doses.length > 0 ? doses.length : numberOfDoses;
    const requiredVolume = volumePerAnimal * actualDoseCount;

    // Check stock availability
    if (!treatment.stock || treatment.stock.totalVolume < requiredVolume) {
      return res.status(400).json({
        status: "FAILURE",
        message: `Insufficient stock for "${treatment.name}". Required: ${requiredVolume} mL, Available: ${treatment.stock?.totalVolume || 0} mL.`,
      });
    }

    // Process doses - handle both ISO and date-only formats
    const processedDoses = doses.length > 0
      ? doses.map(dose => {
        const doseDate = dose.date.includes('T')
          ? new Date(dose.date)
          : new Date(`${dose.date}T00:00:00Z`);

        return {
          date: doseDate,
          taken: dose.taken === true // Ensure boolean
        };
      })
      : Array.from({ length: numberOfDoses }, (_, i) => ({
        date: new Date(new Date(date).getTime() + (i * 24 * 60 * 60 * 1000)),
        taken: false
      }));

    // Update treatment stock
    treatment.stock.totalVolume -= requiredVolume;
    treatment.stock.bottles = Math.ceil(treatment.stock.totalVolume / treatment.stock.volumePerBottle);
    await treatment.save();

    // Calculate cost
    const treatmentCost = requiredVolume * treatment.pricePerMl;
    totalTreatmentCost += treatmentCost;

    // Create treatment entry
    const treatmentPlan = {
      treatmentId,
      volumePerAnimal,
      numberOfDoses: actualDoseCount,
      doses: processedDoses,
    };

    const newTreatmentEntry = new TreatmentEntry({
      treatments: [treatmentPlan],
      tagId: animal.tagId,
      locationShed: animal.locationShed || null,
      date: new Date(date),
      owner: userId,
      eyeCheck,
      rectalCheck,
      respiratoryCheck,
      rumenCheck,
      diagnosis,
      temperature,
    });

    await newTreatmentEntry.save();
    createdTreatments.push(newTreatmentEntry);

    // Update animal costs
    await AnimalCost.findOneAndUpdate(
      { animalTagId: animal.tagId },
      {
        $inc: { treatmentCost },
        $set: { date: new Date(date) },
        $setOnInsert: {
          animalTagId: animal.tagId,
          feedCost: 0,
          owner: userId
        }
      },
      { upsert: true, new: true }
    );
  }

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
    const treatmentEntry = await TreatmentEntry.findById(req.params.treatmentShedId)
      .populate({
        path: "treatments.treatmentId",
        select: "name pricePerMl stock expireDate owner"
      })
      .populate({
        path: "locationShed",
        select: "_id locationShedName"
      })
      .populate({
        path: "owner",
        select: "_id"
      });

    if (!treatmentEntry) {
      return res.status(404).json({
        status: "fail",
        message: "Treatment entry not found",
        code: 404,
        data: null
      });
    }

    // Calculate total treatment cost
    let totalTreatmentCost = 0;
    treatmentEntry.treatments.forEach(treatment => {
      if (treatment.treatmentId && treatment.treatmentId.pricePerMl) {
        const treatmentCost = treatment.volumePerAnimal *
          treatment.numberOfDoses *
          treatment.treatmentId.pricePerMl;
        totalTreatmentCost += treatmentCost;
      }
    });

    const response = {
      status: "SUCCESS",
      data: {
        treatments: [{
          locationShed: treatmentEntry.locationShed?._id.toString() || null,
          owner: treatmentEntry.owner?._id.toString() || null,
          tagId: treatmentEntry.tagId,
          date: treatmentEntry.date,
          eyeCheck: treatmentEntry.eyeCheck || "",
          rectalCheck: treatmentEntry.rectalCheck || "",
          respiratoryCheck: treatmentEntry.respiratoryCheck || "",
          rumenCheck: treatmentEntry.rumenCheck || "",
          diagnosis: treatmentEntry.diagnosis || "",
          temperature: treatmentEntry.temperature || null,
          treatments: treatmentEntry.treatments.map(treatment => ({
            treatmentId: treatment.treatmentId?._id.toString(),
            volumePerAnimal: treatment.volumePerAnimal,
            numberOfDoses: treatment.numberOfDoses,
            doses: treatment.doses.map(dose => ({
              date: dose.date,
              taken: dose.taken,
              _id: dose._id.toString()
            })),
            _id: treatment._id.toString()
          })),
          _id: treatmentEntry._id.toString(),
          createdAt: treatmentEntry.createdAt,
          updatedAt: treatmentEntry.updatedAt,
          __v: treatmentEntry.__v
        }],
        totalTreatmentCost: totalTreatmentCost
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching treatment entry:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      code: 500,
      data: null
    });
  }
});

const updateTreatmentForAnimal = asyncwrapper(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const { treatmentEntryId } = req.params;
    const {
      treatments,
      tagId,
      date,
      eyeCheck,
      rectalCheck,
      respiratoryCheck,
      rumenCheck,
      diagnosis,
      temperature,
    } = req.body;

    // Validate required fields
    if (!Array.isArray(treatments) || treatments.length === 0) {
      throw new AppError(400, "Treatments must be a non-empty array.");
    }

    if (!tagId || !date) {
      throw new AppError(400, "tagId and date are required fields.");
    }

    // Validate date format
    if (isNaN(new Date(date).getTime())) {
      throw new AppError(400, "Invalid date format. Please use ISO 8601 format.");
    }

    // Find existing treatment entry
    const existingTreatmentEntry = await TreatmentEntry.findById(treatmentEntryId).session(session);
    if (!existingTreatmentEntry) {
      throw new AppError(404, `Treatment entry with ID "${treatmentEntryId}" not found.`);
    }

    // Verify ownership of the treatment entry
    if (existingTreatmentEntry.owner.toString() !== userId.toString()) {
      throw new AppError(403, "You are not authorized to update this treatment entry.");
    }

    // Verify animal exists and belongs to user
    const animal = await Animal.findOne({ tagId, owner: userId }).session(session);
    if (!animal) {
      throw new AppError(404, `Animal with tag ID "${tagId}" not found or doesn't belong to you.`);
    }

    // Get old treatment data (assuming single treatment per entry)
    const oldTreatmentData = existingTreatmentEntry.treatments[0];
    if (!oldTreatmentData) {
      throw new AppError(400, "Existing treatment data is invalid.");
    }

    const oldTreatmentId = oldTreatmentData.treatmentId;
    const oldVolume = oldTreatmentData.volumePerAnimal;
    const oldDoses = oldTreatmentData.numberOfDoses;

    // Get new treatment data
    const newTreatmentItem = treatments[0];
    const {
      treatmentId: newTreatmentId,
      volumePerAnimal: newVolume,
      numberOfDoses: newDoses,
      doses: newDosesArray = []
    } = newTreatmentItem;

    // Validate new treatment data
    if (!newTreatmentId || typeof newVolume !== 'number' || newVolume <= 0) {
      throw new AppError(400, "Each treatment must have valid treatmentId and positive volumePerAnimal.");
    }

    const actualNewDoses = newDosesArray.length > 0 ? newDosesArray.length : newDoses;
    if (!actualNewDoses || actualNewDoses <= 0) {
      throw new AppError(400, "Each treatment must have positive numberOfDoses or non-empty doses array.");
    }

    // Fetch both old and new treatments
    const [oldTreatment, newTreatment] = await Promise.all([
      Treatment.findById(oldTreatmentId).session(session),
      Treatment.findById(newTreatmentId).session(session)
    ]);

    if (!oldTreatment || !newTreatment) {
      throw new AppError(404, "One or both treatments not found.");
    }

    // Check new treatment authorization and expiration
    if (newTreatment.owner.toString() !== userId.toString()) {
      throw new AppError(403, "You are not authorized to use this treatment.");
    }

    if (newTreatment.expireDate && new Date(newTreatment.expireDate) <= new Date()) {
      throw new AppError(400, `Treatment "${newTreatment.name}" expired on ${newTreatment.expireDate.toISOString().split('T')[0]}.`);
    }

    // Calculate volume differences
    const oldTotalVolume = oldVolume * oldDoses;
    const newTotalVolume = newVolume * actualNewDoses;
    const volumeDiff = newTotalVolume - oldTotalVolume;

    // Handle stock adjustments
    if (oldTreatmentId.toString() !== newTreatmentId.toString()) {
      // Different treatments - restore old and deduct new
      oldTreatment.stock.totalVolume += oldTotalVolume;
      oldTreatment.stock.bottles = Math.ceil(oldTreatment.stock.totalVolume / oldTreatment.stock.volumePerBottle);

      if (newTreatment.stock.totalVolume < newTotalVolume) {
        throw new AppError(400, `Not enough stock for treatment "${newTreatment.name}". Available: ${newTreatment.stock.totalVolume}, Required: ${newTotalVolume}.`);
      }

      newTreatment.stock.totalVolume -= newTotalVolume;
      newTreatment.stock.bottles = Math.ceil(newTreatment.stock.totalVolume / newTreatment.stock.volumePerBottle);

      await Promise.all([
        oldTreatment.save({ session }),
        newTreatment.save({ session })
      ]);
    } else {
      // Same treatment - adjust by difference
      if (volumeDiff > 0 && newTreatment.stock.totalVolume < volumeDiff) {
        throw new AppError(400, `Not enough stock for treatment "${newTreatment.name}". Available: ${newTreatment.stock.totalVolume}, Required: ${volumeDiff}.`);
      }

      newTreatment.stock.totalVolume -= volumeDiff;
      newTreatment.stock.bottles = Math.ceil(newTreatment.stock.totalVolume / newTreatment.stock.volumePerBottle);
      await newTreatment.save({ session });
    }

    // Update animal cost
    const oldCost = oldTotalVolume * oldTreatment.pricePerMl;
    const newCost = newTotalVolume * newTreatment.pricePerMl;
    const costDifference = newCost - oldCost;

    await AnimalCost.findOneAndUpdate(
      { animalTagId: tagId },
      {
        $inc: { treatmentCost: costDifference },
        $set: { date: new Date(date) },
        $setOnInsert: {
          animalTagId: tagId,
          feedCost: 0,
          owner: userId
        }
      },
      { upsert: true, session }
    );

    // Process doses - handle both ISO and date-only formats
    const processedDoses = newDosesArray.length > 0
      ? newDosesArray.map(dose => {
        const doseDate = dose.date.includes('T')
          ? new Date(dose.date)
          : new Date(`${dose.date}T00:00:00Z`);

        if (isNaN(doseDate.getTime())) {
          throw new AppError(400, `Invalid dose date: ${dose.date}`);
        }

        return {
          date: doseDate,
          taken: dose.taken === true // Ensure boolean
        };
      })
      : Array.from({ length: actualNewDoses }, (_, i) => ({
        date: new Date(new Date(date).getTime() + (i * 24 * 60 * 60 * 1000)),
        taken: false
      }));

    // Update the treatment entry
    existingTreatmentEntry.set({
      treatments: [{
        treatmentId: newTreatmentId,
        volumePerAnimal: newVolume,
        numberOfDoses: actualNewDoses,
        doses: processedDoses,
      }],
      tagId,
      date: new Date(date),
      eyeCheck: eyeCheck ?? existingTreatmentEntry.eyeCheck ?? "",
      rectalCheck: rectalCheck ?? existingTreatmentEntry.rectalCheck ?? "",
      respiratoryCheck: respiratoryCheck ?? existingTreatmentEntry.respiratoryCheck ?? "",
      rumenCheck: rumenCheck ?? existingTreatmentEntry.rumenCheck ?? "",
      diagnosis: diagnosis ?? existingTreatmentEntry.diagnosis ?? "",
      temperature: temperature ?? existingTreatmentEntry.temperature
    });

    await existingTreatmentEntry.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "SUCCESS",
      message: "Treatment entry updated successfully.",
      data: {
        treatmentEntry: existingTreatmentEntry,
        costUpdate: {
          oldCost,
          newCost,
          difference: costDifference
        },
        stockUpdate: {
          treatmentId: newTreatmentId,
          newStockLevel: newTreatment.stock.totalVolume
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        status: "FAILURE",
        message: error.message
      });
    }

    console.error("Error updating treatment entry:", error);
    res.status(500).json({
      status: "FAILURE",
      message: "An unexpected error occurred while updating the treatment."
    });
  }
});



const getAllTreatmentsByShed = asyncwrapper(async (req, res) => {
  try {
    const userId = req.user.id;
    const { locationShed, tagId, date, limit = 10, page = 1 } = req.query;

    // Build filter object
    const filter = { owner: userId };
    if (locationShed) filter.locationShed = locationShed;
    if (tagId) filter.tagId = { $regex: tagId, $options: 'i' }; // Case-insensitive search
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      filter.date = { $gte: startDate, $lt: endDate };
    }

    // Count total matching documents
    const totalCount = await TreatmentEntry.countDocuments(filter);

    // Calculate pagination
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const totalPages = Math.ceil(totalCount / parsedLimit);

    // Query with population
    const treatments = await TreatmentEntry.find(filter)
      .populate({
        path: "treatments.treatmentId",
        select: "name pricePerMl stock expireDate"
      })
      .populate({
        path: "locationShed",
        select: "locationShedName"
      })
      .sort({ date: -1 }) // Newest first
      .skip(skip)
      .limit(parsedLimit);

    // Format response
    const response = treatments.map(entry => {
      // Fix invalid dates
      const entryDate = isNaN(new Date(entry.date).getTime()) ?
        new Date() :
        new Date(entry.date);

      return {
        _id: entry._id,
        locationShed: entry.locationShed ? {
          _id: entry.locationShed._id,
          locationShedName: entry.locationShed.locationShedName
        } : null,
        tagId: entry.tagId,
        date: entryDate.toISOString(),
        eyeCheck: entry.eyeCheck || "",
        rectalCheck: entry.rectalCheck || "",
        respiratoryCheck: entry.respiratoryCheck || "",
        rumenCheck: entry.rumenCheck || "",
        diagnosis: entry.diagnosis || "",
        temperature: entry.temperature || null,
        treatments: entry.treatments.map(treatment => ({
          treatmentId: treatment.treatmentId?._id || null,
          treatmentName: treatment.treatmentId?.name || "",
          pricePerMl: treatment.treatmentId?.pricePerMl || 0,
          volumePerAnimal: treatment.volumePerAnimal || 0,
          numberOfDoses: treatment.numberOfDoses || 0,
          doses: treatment.doses?.map(dose => ({
            date: dose.date?.toISOString() || new Date().toISOString(),
            taken: dose.taken || false,
            _id: dose._id || new mongoose.Types.ObjectId()
          })) || []
        })),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    });

    res.status(200).json({
      status: "SUCCESS",
      data: {
        treatmentShed: response,
        pagination: {
          total: totalCount,
          page: parsedPage,
          limit: parsedLimit,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1
        }
      }
    });

  } catch (error) {
    console.error("Error fetching treatments by shed:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
      code: 500,
      data: null
    });
  }
});
const deleteTreatmentShed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { treatmentShedId } = req.params;

  // Start a transaction session
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the treatment entry with session
    const treatmentEntry = await TreatmentEntry.findById(treatmentShedId).session(session);
    if (!treatmentEntry) {
      await session.abortTransaction();
      return res.status(404).json({
        status: "FAILURE",
        message: "Treatment entry not found.",
      });
    }

    // Verify ownership
    if (treatmentEntry.owner.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        status: "FAILURE",
        message: "You are not authorized to delete this treatment entry.",
      });
    }

    let totalRestoredVolume = 0;
    let totalDeductedCost = 0;

    // Process each treatment in the entry
    for (const treatmentItem of treatmentEntry.treatments) {
      const treatment = await Treatment.findById(treatmentItem.treatmentId).session(session);
      if (!treatment) continue;

      // Calculate restored volume (using volumePerAnimal * doses count)
      const restoredVolume = treatmentItem.volumePerAnimal * treatmentItem.numberOfDoses;
      totalRestoredVolume += restoredVolume;

      // Restore stock
      treatment.stock.totalVolume += restoredVolume;
      treatment.stock.bottles = Math.ceil(treatment.stock.totalVolume / treatment.stock.volumePerBottle);
      await treatment.save({ session });

      // Calculate cost to deduct
      const treatmentCost = restoredVolume * treatment.pricePerMl;
      totalDeductedCost += treatmentCost;
    }

    // Update animal cost
    await AnimalCost.findOneAndUpdate(
      { animalTagId: treatmentEntry.tagId },
      {
        $inc: { treatmentCost: -totalDeductedCost },
        $set: { date: new Date() } // Update the modification date
      },
      { session }
    );

    // Delete the treatment entry
    await TreatmentEntry.findByIdAndDelete(treatmentShedId).session(session);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "SUCCESS",
      message: "Treatment entry deleted successfully.",
      data: {
        restoredVolume: totalRestoredVolume,
        deductedCost: totalDeductedCost,
        deletedEntryId: treatmentShedId
      }
    });

  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();

    console.error("Error deleting treatment entry:", error);
    res.status(500).json({
      status: "ERROR",
      message: "An error occurred while deleting the treatment entry.",
      error: error.message
    });
  }
});

const getTreatmentsForSpecificAnimal = asyncwrapper(async (req, res, next) => {
  try {
    // Find the animal by ID with proper error handling
    const animal = await Animal.findById(req.params.animalId).select('tagId animalType locationShed');
    if (!animal) {
      return res.status(404).json({
        status: "fail",
        message: "Animal not found",
        code: 404,
        data: null
      });
    }

    // Find treatment entries with safe population
    const treatmentEntries = await TreatmentEntry.find({ tagId: animal.tagId })
      .populate({
        path: 'treatments.treatmentId',
        select: 'name pricePerMl stock expireDate',
        options: { retainNullValues: true } // Keep null if not found
      })
      .populate({
        path: 'locationShed',
        select: 'locationShedName',
        options: { retainNullValues: true }
      })
      .sort({ date: -1 });

    if (!treatmentEntries?.length) {
      return res.status(404).json({
        status: "fail",
        message: "No treatment records found for this animal",
        code: 404,
        data: null
      });
    }

    // Safely format treatments
    const formattedTreatments = treatmentEntries.map(entry => {
      // Safely handle locationShed
      const locationShed = entry.locationShed?._id
        ? {
          _id: entry.locationShed._id,
          name: entry.locationShed.locationShedName
        }
        : null;

      // Safely format treatments array
      const treatments = entry.treatments?.map(treatment => {
        const treatmentData = treatment.treatmentId ? {
          _id: treatment.treatmentId._id,
          name: treatment.treatmentId.name,
          pricePerMl: treatment.treatmentId.pricePerMl,
          expireDate: treatment.treatmentId.expireDate,
          stock: treatment.treatmentId.stock
        } : null;

        return {
          ...treatment.toObject(),
          treatmentId: treatmentData,
          doses: treatment.doses?.map(dose => ({
            date: dose?.date || null,
            taken: dose?.taken || false,
            _id: dose?._id || new mongoose.Types.ObjectId()
          })) || []
        };
      }) || [];

      return {
        _id: entry._id,
        locationShed,
        tagId: entry.tagId,
        date: entry.date,
        eyeCheck: entry.eyeCheck || "",
        rectalCheck: entry.rectalCheck || "",
        respiratoryCheck: entry.respiratoryCheck || "",
        rumenCheck: entry.rumenCheck || "",
        diagnosis: entry.diagnosis || "",
        temperature: entry.temperature ?? null,
        treatments,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    });

    // Calculate total cost safely
    const totalTreatmentCost = formattedTreatments.reduce((total, entry) => {
      const entryCost = entry.treatments?.reduce((sum, treatment) => {
        if (treatment?.treatmentId?.pricePerMl && treatment?.volumePerAnimal && treatment?.numberOfDoses) {
          return sum + (treatment.volumePerAnimal * treatment.numberOfDoses * treatment.treatmentId.pricePerMl);
        }
        return sum;
      }, 0) || 0;
      return total + entryCost;
    }, 0);

    return res.status(200).json({
      status: "SUCCESS",
      data: {
        animal: {
          _id: animal._id,
          tagId: animal.tagId,
          animalType: animal.animalType,
          locationShed: animal.locationShed
        },
        treatments: formattedTreatments,
        totalTreatmentCost
      }
    });

  } catch (error) {
    console.error("Error in getTreatmentsForSpecificAnimal:", {
      message: error.message,
      stack: error.stack,
      params: req.params
    });

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      code: 500,
      data: null
    });
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
