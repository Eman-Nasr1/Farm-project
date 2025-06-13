const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const Vaccine = require('../Models/vaccine.model');
const VaccineType = require('../Models/vaccineType.model');
const Animal = require('../Models/animal.model');
const AnimalCost = require("../Models/animalCost.model");
const LocationShed = require('../Models/locationsed.model');
const VaccineEntry = require('../Models/vaccineEntry.model');
const mongoose = require("mongoose");
const i18n = require('../i18n');
const multer = require('multer');
const xlsx = require('xlsx');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');
const excelOps = require('../utilits/excelOperations');

const addVaccine = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { 
      vaccineTypeId,
      bottles,
      dosesPerBottle,
      bottlePrice,
      expiryDate
    } = req.body;
  
    // Validate input
    if (
      !vaccineTypeId ||
      bottles === undefined || isNaN(bottles) || bottles < 0 ||
      dosesPerBottle === undefined || isNaN(dosesPerBottle) || dosesPerBottle < 1 ||
      bottlePrice === undefined || isNaN(bottlePrice) || bottlePrice < 0 ||
      !expiryDate
    ) {
      return res.status(400).json({
        status: httpstatustext.FAIL,
        message: "Valid vaccine type, bottles, doses per bottle, bottle price, and expiry date are required.",
      });
    }

    // Validate expiry date
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) {
      return res.status(400).json({
        status: httpstatustext.FAIL,
        message: "Invalid expiry date format. Please use YYYY-MM-DD format.",
      });
    }

    if (expiry < new Date()) {
      return res.status(400).json({
        status: httpstatustext.FAIL,
        message: "Expiry date cannot be in the past.",
      });
    }

    // Verify vaccine type exists
    const selectedVaccineType = await VaccineType.findById(vaccineTypeId);
    if (!selectedVaccineType) {
      return res.status(404).json({
        status: httpstatustext.FAIL,
        message: "Vaccine type not found.",
      });
    }
  
    // Calculate derived values
    const totalDoses = bottles * dosesPerBottle;
    const dosePrice = bottlePrice / dosesPerBottle;
  
    // Create new vaccine
    const newVaccine = new Vaccine({
      vaccineType: vaccineTypeId,
      stock: {
        bottles,
        dosesPerBottle,
        totalDoses
      },
      pricing: {
        bottlePrice,
        dosePrice
      },
      expiryDate: expiry,
      owner: userId
    });
  
    await newVaccine.save();
  
    res.json({
      status: httpstatustext.SUCCESS,
      data: { vaccine: newVaccine }
    });
});

// Get all vaccines (without pagination)
const getVaccines = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    const vaccines = await Vaccine.find({ owner: userId }, { __v: false })
      .populate('vaccineType')
      .sort({ createdAt: -1 });
    res.json({
      status: httpstatustext.SUCCESS,
      data: { vaccines },
    });
  });
  
  // Get single vaccine
  const getVaccine = asyncwrapper(async (req, res, next) => {
    const vaccine = await Vaccine.findById(req.params.vaccineId)
      .populate('vaccineType');
    if (!vaccine) {
      const error = AppError.create(
        "Vaccine not found",
        404,
        httpstatustext.FAIL
      );
      return next(error);
    }
    return res.json({ status: httpstatustext.SUCCESS, data: { vaccine } });
  });
  
  // Get all vaccines with pagination
  const getAllVaccines = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    const query = req.query;
    const limit = query.limit || 10;
    const page = query.page || 1;
    const skip = (page - 1) * limit;
    const filter = { owner: userId };
  
    if (query.search) {
      const vaccineTypes = await VaccineType.find({
        $or: [
          { englishName: { $regex: query.search, $options: 'i' } },
          { arabicName: { $regex: query.search, $options: 'i' } }
        ]
      });
      
      filter.vaccineType = { $in: vaccineTypes.map(vt => vt._id) };
    }
  
    const vaccines = await Vaccine.find(filter, { __v: false })
      .populate('vaccineType')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });
  
    const total = await Vaccine.countDocuments(filter);
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
      data: { vaccines },
    });
  });
  
  // Update vaccine
  const updateVaccine = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const vaccineId = req.params.vaccineId;
    const { 
      vaccineTypeId,
      bottles,
      dosesPerBottle,
      bottlePrice,
      ...updatedData 
    } = req.body;
  
    // Find the vaccine owned by the user
    let vaccine = await Vaccine.findOne({ _id: vaccineId, owner: userId });
  
    if (!vaccine) {
      const error = AppError.create(
        "Vaccine not found or unauthorized to update",
        404,
        httpstatustext.FAIL
      );
      return next(error);
    }

    // If vaccine type is being updated, verify it exists
    if (vaccineTypeId) {
      const vaccineType = await VaccineType.findById(vaccineTypeId);
      if (!vaccineType) {
        return res.status(404).json({
          status: httpstatustext.FAIL,
          message: "Vaccine type not found.",
        });
      }
      vaccine.vaccineType = vaccineTypeId;
    }
  
    // Update stock and pricing if provided
    if (bottles !== undefined) vaccine.stock.bottles = bottles;
    if (dosesPerBottle !== undefined) vaccine.stock.dosesPerBottle = dosesPerBottle;
    if (bottlePrice !== undefined) vaccine.pricing.bottlePrice = bottlePrice;
  
    // Recalculate derived values if any stock/pricing fields changed
    if (bottles !== undefined || dosesPerBottle !== undefined || bottlePrice !== undefined) {
      vaccine.stock.totalDoses = vaccine.stock.bottles * vaccine.stock.dosesPerBottle;
      vaccine.pricing.dosePrice = vaccine.pricing.bottlePrice / vaccine.stock.dosesPerBottle;
    }
  
    // Apply other updates
    Object.assign(vaccine, updatedData);
  
    await vaccine.save();
  
    res.json({ status: httpstatustext.SUCCESS, data: { vaccine } });
  });
  
  // Delete vaccine
  const deleteVaccine = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const vaccineId = req.params.vaccineId;
  
    const vaccine = await Vaccine.findOneAndDelete({ 
      _id: vaccineId, 
      owner: userId 
    });
  
    if (!vaccine) {
      const error = AppError.create(
        "Vaccine not found or unauthorized to delete",
        404,
        httpstatustext.FAIL
      );
      return next(error);
    }
  
    res.status(200).json({ 
      status: httpstatustext.SUCCESS, 
      data: null,
      message: "Vaccine deleted successfully" 
    });
  });
  //--------------------------------vaccine entry----------------------------------------

  const addVaccineForAnimals = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { vaccineId, locationShed, date, entryType } = req.body;
  
    if (!vaccineId || !locationShed || !date || !entryType) {
      return res.status(400).json({
        status: "FAILURE",
        message: "vaccineId, locationShed, date, and entryType are required.",
      });
    }
  
    // Start a Mongoose session for transactions
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // Find the locationShed document by its ID
      const shed = await LocationShed.findById(locationShed).session(session);
      if (!shed) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Location shed with ID "${locationShed}" not found.`,
        });
      }
  
      // Find animals in the specified locationShed
      const animals = await Animal.find({ locationShed }).session(session);
      if (animals.length === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `No animals found in shed "${shed.locationShedName}".`,
        });
      }
  
      // Find the vaccine
      const vaccine = await Vaccine.findById(vaccineId).session(session);
      if (!vaccine) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Vaccine with ID "${vaccineId}" not found.`,
        });
      }
  
      // Check authorization
      if (vaccine.owner.toString() !== userId.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          status: "FAILURE",
          message: "You are not authorized to use this vaccine.",
        });
      }
  
      // Check stock availability (1 dose per animal)
      if (vaccine.stock.totalDoses < animals.length) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: `Not enough vaccine doses available. Required: ${animals.length}, Available: ${vaccine.stock.totalDoses}.`,
        });
      }
  
      // Check if vaccine is expired
      if (vaccine.isExpired()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: `Vaccine "${vaccine.vaccineName}" is expired (Expired on ${vaccine.expiryDate.toISOString().split('T')[0]}).`
        });
      }
  
      // Calculate vaccine cost per animal
      const vaccineCostPerAnimal = vaccine.pricing.dosePrice || 
                                 (vaccine.pricing.bottlePrice / vaccine.stock.dosesPerBottle);
      const totalVaccineCost = vaccineCostPerAnimal * animals.length;
  
      // Deduct doses from vaccine stock
      vaccine.stock.totalDoses -= animals.length;
      if (vaccine.stock.totalDoses % vaccine.stock.dosesPerBottle === 0) {
        vaccine.stock.bottles = Math.floor(vaccine.stock.totalDoses / vaccine.stock.dosesPerBottle);
      } else {
        vaccine.stock.bottles = Math.floor(vaccine.stock.totalDoses / vaccine.stock.dosesPerBottle) + 1;
      }
      await vaccine.save({ session });
  
      const createdVaccineEntries = [];
  
      // Create vaccine entry for each animal
      for (const animal of animals) {
        const newVaccineEntry = new VaccineEntry({
          Vaccine: vaccine._id,
          tagId: animal.tagId,
          locationShed: shed._id,
          date: new Date(date),
          entryType,
          owner: userId,
        });
  
        await newVaccineEntry.save({ session });
        createdVaccineEntries.push(newVaccineEntry);
  
        // Update or create animal cost entry - now using vaccineCost field
        let animalCostEntry = await AnimalCost.findOne({
          animalTagId: animal.tagId,
        }).session(session);
  
        if (animalCostEntry) {
          animalCostEntry.vaccineCost += vaccineCostPerAnimal;
        } else {
          animalCostEntry = new AnimalCost({
            animalTagId: animal.tagId,
            vaccineCost: vaccineCostPerAnimal,
            treatmentCost: 0,
            feedCost: 0,
            date: new Date(date),
            owner: userId,
          });
        }
  
        await animalCostEntry.save({ session });
      }
  
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
  
      res.status(201).json({
        status: "SUCCESS",
        data: {
          vaccineEntries: createdVaccineEntries,
          totalVaccineCost,
          dosesUsed: animals.length,
          remainingDoses: vaccine.stock.totalDoses,
          remainingBottles: vaccine.stock.bottles,
        },
      });
  
    } catch (error) {
      // If any error occurs, abort the transaction
      await session.abortTransaction();
      session.endSession();
      console.error("Error in addVaccineForAnimals:", error);
      next(error);
    }
  });

  const addVaccineForAnimal = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { vaccineId, tagId, date, entryType } = req.body;
  
    // Validate input
    if (!vaccineId || !tagId || !date || !entryType) {
      return res.status(400).json({
        status: "FAILURE",
        message: "vaccineId, tagId, date, and entryType are required."
      });
    }
  
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // Find animal
      const animal = await Animal.findOne({  
        tagId,  
        owner: userId, // Ensure the animal belongs to the user  
    }).session(session);
      if (!animal) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: `Animal with tag ID "${tagId}" not found.`
        });
      }
  
      // Find vaccine
      const vaccine = await Vaccine.findOne({
        _id: vaccineId,
        owner: userId
      }).session(session);
  
      if (!vaccine) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: "Vaccine not found or unauthorized."
        });
      }
  
      // Check if vaccine is expired
      if (vaccine.isExpired()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: `Vaccine "${vaccine.vaccineName}" is expired (Expired on ${vaccine.expiryDate.toISOString().split('T')[0]}).`
        });
      }
  
      // Check stock
      if (vaccine.stock.totalDoses < 1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: "No vaccine doses available."
        });
      }
  
      // Calculate cost
      const dosePrice = vaccine.pricing.dosePrice || 
                       (vaccine.pricing.bottlePrice / vaccine.stock.dosesPerBottle);
  
      // Update stock
      vaccine.stock.totalDoses -= 1;
      vaccine.stock.bottles = Math.ceil(vaccine.stock.totalDoses / vaccine.stock.dosesPerBottle);
      await vaccine.save({ session });
  
      // Create vaccine entry
      const newVaccineEntry = await VaccineEntry.create([{
        Vaccine: vaccine._id,
        tagId: animal.tagId,
        locationShed: animal.locationShed,
        date: new Date(date),
        entryType,
        owner: userId
      }], { session });
  
      // Update animal cost
      await AnimalCost.findOneAndUpdate(
        { animalTagId: tagId },
        { 
          $inc: { vaccineCost: dosePrice },
          $setOnInsert: { 
            feedCost: 0,
            treatmentCost: 0,
            date: new Date(date),
            owner: userId
          }
        },
        { upsert: true, session }
      );
  
      await session.commitTransaction();
      session.endSession();
  
      res.status(201).json({
        status: "SUCCESS",
        data: {
          vaccineEntry: newVaccineEntry[0],
          vaccineCost: dosePrice,
          remainingDoses: vaccine.stock.totalDoses
        }
      });
  
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Vaccination error:", error);
      next(error);
    }
  });
  const getSingleVaccineEntry = asyncwrapper(async (req, res, next) => {
    try {
      const vaccineEntry = await VaccineEntry.findById(req.params.vaccineEntryId)
        .populate('Vaccine', 'vaccineName BoosterDose AnnualDose pricing.dosePrice')
        .populate('locationShed', 'locationShedName');

      if (!vaccineEntry) {
        return res.status(404).json({
          status: "FAILURE",
          message: "Vaccine entry not found."
        });
      }
  
      const response = {
        _id: vaccineEntry._id,
        tagId: vaccineEntry.tagId,
        locationShed: vaccineEntry.locationShed ? {
          _id: vaccineEntry.locationShed._id,
          locationShedName: vaccineEntry.locationShed.locationShedName
        } : null,
        date: vaccineEntry.date,
        entryType: vaccineEntry.entryType,
        vaccine: vaccineEntry.Vaccine ? {  // Changed from vaccineEntry.vaccine to vaccineEntry.Vaccine
          _id: vaccineEntry.Vaccine._id,
          name: vaccineEntry.Vaccine.vaccineName,  // Fixed typo from vaccineName
          dosePrice: vaccineEntry.Vaccine.pricing?.dosePrice  // Optional chaining
        } : null
      };
  
      res.json({
        status: "SUCCESS",
        data: { vaccineEntry: response }
      });
  
    } catch (error) {
      console.error("Error fetching vaccine entry:", error);
      next(error);
    }
  });
  const updateVaccineEntry = asyncwrapper(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const userId = req.user.id;
      const { vaccineEntryId } = req.params;
      const { vaccineId, tagId, date, entryType } = req.body;
  
      // Validate input
      if (!vaccineId || !tagId || !date || !entryType) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: "All fields are required."
        });
      }
  
      // Find existing entry
      const existingEntry = await VaccineEntry.findById(vaccineEntryId).session(session);
      if (!existingEntry) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: "Vaccine entry not found."
        });
      }
  
      // Find animal
      const animal = await Animal.findOne({ tagId }).session(session);
      if (!animal) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: "Animal not found."
        });
      }
  
      // Find new vaccine
      const newVaccine = await Vaccine.findOne({
        _id: vaccineId,
        owner: userId
      }).session(session);
  
      if (!newVaccine) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: "New vaccine not found or unauthorized."
        });
      }
  
      // Check if new vaccine is expired
      if (newVaccine.isExpired()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          status: "FAILURE",
          message: `Vaccine "${newVaccine.vaccineName}" is expired (Expired on ${newVaccine.expiryDate.toISOString().split('T')[0]}).`
        });
      }
  
      // Calculate new dose price
      const newDosePrice = newVaccine.pricing?.dosePrice || 
                         (newVaccine.pricing?.bottlePrice / newVaccine.stock?.dosesPerBottle) || 0;
  
      // Initialize old dose price
      let oldDosePrice = 0;
      let oldVaccine = null;
  
      // Only check old vaccine if reference exists
      if (existingEntry.Vaccine) {
        oldVaccine = await Vaccine.findById(existingEntry.Vaccine).session(session);
        if (oldVaccine) {
          oldDosePrice = oldVaccine.pricing?.dosePrice || 
                        (oldVaccine.pricing?.bottlePrice / oldVaccine.stock?.dosesPerBottle) || 0;
        }
      }
  
      // If changing vaccine and old vaccine exists
      if (existingEntry.Vaccine && existingEntry.Vaccine.toString() !== vaccineId && oldVaccine) {
        // Return dose to old vaccine
        oldVaccine.stock.totalDoses += 1;
        oldVaccine.stock.bottles = Math.ceil(oldVaccine.stock.totalDoses / oldVaccine.stock.dosesPerBottle);
        await oldVaccine.save({ session });
  
        // Deduct from new vaccine
        if (newVaccine.stock.totalDoses < 1) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "FAILURE",
            message: "Not enough doses in new vaccine."
          });
        }
        newVaccine.stock.totalDoses -= 1;
        newVaccine.stock.bottles = Math.ceil(newVaccine.stock.totalDoses / newVaccine.stock.dosesPerBottle);
        await newVaccine.save({ session });
      } else if (!existingEntry.Vaccine) {
        // If no previous vaccine, just deduct from new one
        if (newVaccine.stock.totalDoses < 1) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            status: "FAILURE",
            message: "Not enough doses in new vaccine."
          });
        }
        newVaccine.stock.totalDoses -= 1;
        newVaccine.stock.bottles = Math.ceil(newVaccine.stock.totalDoses / newVaccine.stock.dosesPerBottle);
        await newVaccine.save({ session });
      }
  
      // Update cost record if animalTagId exists
      if (tagId) {
        await AnimalCost.findOneAndUpdate(
          { animalTagId: tagId },
          { $inc: { vaccineCost: (newDosePrice - oldDosePrice) } },
          { session, upsert: true }
        );
      }
  
      // Update entry
      existingEntry.Vaccine = newVaccine._id;
      existingEntry.tagId = tagId;
      existingEntry.date = new Date(date);
      existingEntry.entryType = entryType;
      existingEntry.locationShed = animal.locationShed;
      await existingEntry.save({ session });
  
      await session.commitTransaction();
      session.endSession();
  
      res.status(200).json({
        status: "SUCCESS",
        data: {
          vaccineEntry: existingEntry,
          costDifference: (newDosePrice - oldDosePrice)
        }
      });
  
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Update error:", {
        message: error.message,
        stack: error.stack,
        params: req.params,
        body: req.body
      });
      next(error);
    }
  });
  const getAllVaccineEntries = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { limit = 10, page = 1, tagId, locationShed, entryType } = req.query;

    const filter = { owner: userId };
    if (tagId) filter.tagId = tagId;
    if (entryType) filter.entryType = entryType;

    // If locationShed is provided, find its ObjectId first
    if (locationShed) {
        const shed = await LocationShed.findOne({ locationShedName: locationShed });
        if (!shed) {
            return res.status(404).json({
                status: "FAIL",
                message: "Location shed not found",
                data: null,
            });
        }
        filter.locationShed = shed._id; // Now using ObjectId
    }

    const entries = await VaccineEntry.find(filter)
        .populate('Vaccine', 'vaccineName pricing.dosePrice')
        .populate('locationShed', 'locationShedName')
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .sort({ date: -1 });

    const total = await VaccineEntry.countDocuments(filter);

    res.json({
        status: "SUCCESS",
        data: {
            entries,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        },
    });
});
  const deleteVaccineEntry = asyncwrapper(async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const userId = req.user.id;
      const { vaccineEntryId } = req.params;
  
      // Find entry
      const entry = await VaccineEntry.findById(vaccineEntryId).session(session);
      if (!entry) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          status: "FAILURE",
          message: "Entry not found."
        });
      }
  
      // Verify ownership
      if (entry.owner.toString() !== userId.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          status: "FAILURE",
          message: "Unauthorized."
        });
      }
  
      // Find vaccine and restore dose
      const vaccine = await Vaccine.findById(entry.vaccine).session(session);
      if (vaccine) {
        vaccine.stock.totalDoses += 1;
        vaccine.stock.bottles = Math.ceil(vaccine.stock.totalDoses / vaccine.stock.dosesPerBottle);
        await vaccine.save({ session });
      }
  
      // Update cost record
      const dosePrice = vaccine?.pricing.dosePrice || 
                       (vaccine?.pricing.bottlePrice / vaccine?.stock.dosesPerBottle) || 0;
      
      await AnimalCost.findOneAndUpdate(
        { animalTagId: entry.tagId },
        { $inc: { vaccineCost: -dosePrice } },
        { session }
      );
  
      // Delete entry
      await VaccineEntry.deleteOne({ _id: vaccineEntryId }).session(session);
  
      await session.commitTransaction();
      session.endSession();
  
      res.status(200).json({
        status: "SUCCESS",
        message: "Vaccine entry deleted successfully.",
        data: {
          restoredDoses: vaccine?.stock.totalDoses
        }
      });
  
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Delete error:", error);
      next(error);
    }
  });


  const getVaccinesForSpecificAnimal = asyncwrapper(async (req, res, next) => {
    const animal = await Animal.findById(req.params.animalId);
    if (!animal) {
        const error = AppError.create('Animal not found', 404, httpstatustext.FAIL);
        return next(error);
    }
 
    
    const vaccineEntries = await VaccineEntry.find({ 
        tagId: animal.tagId // Changed from animalId to tagId
    })
    .populate('Vaccine') // Matches your schema definition
    .populate('locationShed', 'locationShedName'); // Optional if you need shed info

    if (!vaccineEntries || vaccineEntries.length === 0) {
        console.warn(`No vaccines found for animal ${animal._id} with tag ${animal.tagId}`);
        const error = AppError.create('No vaccine records found for this animal', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Format the response data
    const responseData = {
        animal: {
            _id: animal._id,
            tagId: animal.tagId,
            animalType: animal.animalType,
            gender: animal.gender
        },
        vaccines: vaccineEntries.map(entry => ({
            _id: entry._id,
            date: entry.date,
            entryType: entry.entryType,
            vaccine: entry.Vaccine ? {
                _id: entry.Vaccine._id,
                name: entry.Vaccine.vaccineName
            } : null,
            locationShed: entry.locationShed ? {
                _id: entry.locationShed._id,
                name: entry.locationShed.locationShedName
            } : null
        }))
    };

    return res.json({ 
        status: httpstatustext.SUCCESS, 
        data: responseData
    });
});

const importVaccineEntriesFromExcel = asyncwrapper(async (req, res, next) => {
    const userId = req.user?.id || req.userId;
    if (!userId) {
        return next(AppError.create(i18n.__('UNAUTHORIZED'), 401, httpstatustext.FAIL));
    }

    try {
        const data = excelOps.readExcelFile(req.file.buffer);

        // Skip header row
        for (let i = 1; i < data.length; i++) {
            const row = data[i];

            // Skip empty rows
            if (!row || row.length === 0 || row.every(cell => !cell)) continue;

            // Extract and validate data
            const [
                tagId,
                vaccineName,
                entryType,
                dateStr,
                locationShedName
            ] = row.map(cell => cell?.toString().trim());

            // Validate required fields
            if (!tagId || !vaccineName || !entryType || !dateStr) {
                return next(AppError.create(i18n.__('REQUIRED_FIELDS_MISSING', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Parse date
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return next(AppError.create(i18n.__('INVALID_DATE_FORMAT', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Validate entry type
            const validEntryTypes = ['First Dose', 'Booster Dose', 'Annual Dose', 'جرعة أولى', 'جرعة منشطة', 'جرعة سنوية'];
            if (!validEntryTypes.includes(entryType)) {
                return next(AppError.create(i18n.__('INVALID_ENTRY_TYPE', { row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Find animal
            const animal = await Animal.findOne({ tagId, owner: userId });
            if (!animal) {
                return next(AppError.create(i18n.__('ANIMAL_NOT_FOUND', { tagId, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Find vaccine
            const vaccine = await Vaccine.findOne({ 
                vaccineName: { $regex: new RegExp(`^${vaccineName}$`, 'i') },
                owner: userId 
            });
            if (!vaccine) {
                return next(AppError.create(i18n.__('VACCINE_NOT_FOUND', { name: vaccineName, row: i + 1 }), 404, httpstatustext.FAIL));
            }

            // Check if vaccine is expired
            if (vaccine.expiryDate && new Date() > vaccine.expiryDate) {
                return next(AppError.create(i18n.__('VACCINE_EXPIRED', { 
                    name: vaccineName, 
                    date: vaccine.expiryDate.toISOString().split('T')[0], 
                    row: i + 1 
                }), 400, httpstatustext.FAIL));
            }

            // Check stock
            if (vaccine.stock.totalDoses < 1) {
                return next(AppError.create(i18n.__('NO_VACCINE_DOSES', { name: vaccineName, row: i + 1 }), 400, httpstatustext.FAIL));
            }

            // Find location shed if provided, otherwise use animal's current shed
            let locationShed = animal.locationShed;
            if (locationShedName) {
                const shed = await LocationShed.findOne({ locationShedName, owner: userId });
                if (!shed) {
                    return next(AppError.create(i18n.__('LOCATION_SHED_NOT_FOUND', { name: locationShedName, row: i + 1 }), 404, httpstatustext.FAIL));
                }
                locationShed = shed._id;
            }

            // Calculate dose price
            const dosePrice = vaccine.pricing.dosePrice || 
                           (vaccine.pricing.bottlePrice / vaccine.stock.dosesPerBottle);

            // Create new vaccine entry
            const newVaccineEntry = new VaccineEntry({
                Vaccine: vaccine._id,
                tagId,
                locationShed,
                date,
                entryType,
                owner: userId
            });

            // Update vaccine stock using findOneAndUpdate to avoid validation
            await Vaccine.findOneAndUpdate(
                { _id: vaccine._id },
                { 
                    $inc: { 'stock.totalDoses': -1 },
                    $set: { 'stock.bottles': Math.ceil((vaccine.stock.totalDoses - 1) / vaccine.stock.dosesPerBottle) }
                }
            );

            // Update animal cost
            const animalCost = await AnimalCost.findOne({ animalTagId: tagId }) || new AnimalCost({
                animalTagId: tagId,
                feedCost: 0,
                treatmentCost: 0,
                vaccineCost: 0,
                date,
                owner: userId
            });
            animalCost.vaccineCost += dosePrice;

            // Save entries
            await Promise.all([
                newVaccineEntry.save(),
                animalCost.save()
            ]);
        }

        res.json({
            status: httpstatustext.SUCCESS,
            message: i18n.__('VACCINE_ENTRIES_IMPORTED_SUCCESSFULLY')
        });
    } catch (error) {
        console.error('Import error:', error);
        return next(AppError.create(i18n.__('IMPORT_FAILED') + ': ' + error.message, 500, httpstatustext.ERROR));
    }
});

const exportVaccineEntriesToExcel = asyncwrapper(async (req, res, next) => {
    try {
        const userId = req.user?.id || req.userId;
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        if (!userId) {
            return next(AppError.create(isArabic ? 'المستخدم غير مصرح' : 'User not authenticated', 401, httpstatustext.FAIL));
        }

        // Build filter
        const filter = { owner: userId };
        if (req.query.tagId) filter.tagId = req.query.tagId;
        if (req.query.entryType) filter.entryType = req.query.entryType;
        
        // Date range filtering
        if (req.query.startDate || req.query.endDate) {
            filter.date = {};
            if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
            if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
        }

        const entries = await VaccineEntry.find(filter)
            .sort({ date: 1 })
            .populate('Vaccine', 'vaccineName pricing.dosePrice')
            .populate('locationShed', 'locationShedName');

        if (entries.length === 0) {
            return res.status(404).json({
                status: httpstatustext.FAIL,
                message: isArabic ? 'لم يتم العثور على سجلات التطعيم' : 'No vaccine entries found'
            });
        }

        const headers = excelOps.headers.vaccine[lang].export;
        const sheetName = excelOps.sheetNames.vaccine.export[lang];

        const data = entries.map(entry => [
            entry.tagId,
            entry.Vaccine?.vaccineName || '',
            entry.entryType,
            entry.date?.toISOString().split('T')[0] || '',
            entry.locationShed?.locationShedName || '',
            entry.Vaccine?.pricing?.dosePrice || 
            (entry.Vaccine?.pricing?.bottlePrice / entry.Vaccine?.stock?.dosesPerBottle) || '',
            entry.createdAt?.toISOString().split('T')[0] || ''
        ]);

        const workbook = excelOps.createExcelFile(data, headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];

        // Set column widths
        const columnWidths = [15, 25, 20, 12, 20, 12, 12];
        excelOps.setColumnWidths(worksheet, columnWidths);

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `vaccine_entries_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Export error:', error);
        return next(AppError.create(
            isArabic ? 'فشل التصدير: ' + error.message : 'Export failed: ' + error.message,
            500,
            httpstatustext.ERROR
        ));
    }
});

const downloadVaccineEntryTemplate = asyncwrapper(async (req, res, next) => {
    try {
        const lang = req.query.lang || 'en';
        const isArabic = lang === 'ar';

        const headers = excelOps.headers.vaccine[lang].template;
        const exampleRow = excelOps.templateExamples.vaccine[lang];
        const sheetName = excelOps.sheetNames.vaccine.template[lang];

        const workbook = excelOps.createExcelFile([exampleRow], headers, sheetName);
        const worksheet = workbook.Sheets[sheetName];
        excelOps.setColumnWidths(worksheet, headers.map(() => 20));

        const buffer = excelOps.writeExcelBuffer(workbook);
        excelOps.setExcelResponseHeaders(res, `vaccine_entry_template_${lang}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Template Download Error:', error);
        next(AppError.create(i18n.__('TEMPLATE_GENERATION_FAILED'), 500, httpstatustext.ERROR));
    }
});

module.exports = {
    addVaccine,
    getVaccines,
    getVaccine,
    getAllVaccines,
    updateVaccine,
    deleteVaccine,
    addVaccineForAnimals,
    addVaccineForAnimal,
    getSingleVaccineEntry,
    updateVaccineEntry,
    getAllVaccineEntries,
    deleteVaccineEntry,
    getVaccinesForSpecificAnimal,
    importVaccineEntriesFromExcel,
    exportVaccineEntriesToExcel,
    downloadVaccineEntryTemplate
};