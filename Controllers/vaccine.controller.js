const httpstatustext=require('../utilits/httpstatustext');
const asyncwrapper=require('../middleware/asyncwrapper');
const AppError=require('../utilits/AppError');
const Vaccine=require('../Models/vaccine.model');
const Animal=require('../Models/animal.model');
const AnimalCost = require("../Models/animalCost.model");
const LocationShed=require('../Models/locationsed.model');
const VaccineEntry=require('../Models/vaccineEntry.model');
const mongoose = require("mongoose");
const i18n = require('../i18n');


const addVaccine = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
    const { 
      vaccineName,
      BoosterDose,
      AnnualDose,
      bottles,
      dosesPerBottle,
      bottlePrice
    } = req.body;
  
    // Validate input
    if (
      !vaccineName ||
      bottles === undefined || isNaN(bottles) || bottles < 0 ||
      dosesPerBottle === undefined || isNaN(dosesPerBottle) || dosesPerBottle < 1 ||
      bottlePrice === undefined || isNaN(bottlePrice) || bottlePrice < 0
    ) {
      return res.status(400).json({
        status: httpstatustext.FAIL,
        message: "Valid vaccine name, bottles, doses per bottle, and bottle price are required.",
      });
    }
  
    // Calculate derived values
    const totalDoses = bottles * dosesPerBottle;
    const dosePrice = bottlePrice / dosesPerBottle;
  
    // Create new vaccine with proper nesting
    const newVaccine = new Vaccine({
      vaccineName,
      BoosterDose: BoosterDose || null,
      AnnualDose: AnnualDose || null,
      stock: {
        bottles: Number(bottles),
        dosesPerBottle: Number(dosesPerBottle),
        totalDoses: Number(totalDoses)
      },
      pricing: {
        bottlePrice: Number(bottlePrice),
        dosePrice: Number(dosePrice)
      },
      owner: userId
    });
  
    try {
      await newVaccine.save();
      res.status(201).json({
        status: httpstatustext.SUCCESS,
        data: { vaccine: newVaccine },
      });
    } catch (error) {
      return next(new AppError('Failed to save vaccine: ' + error.message, 500));
    }
  });

  // Get all vaccines (without pagination)
const getVaccines = asyncwrapper(async (req, res) => {
    const userId = req.user.id;
    const vaccines = await Vaccine.find({ owner: userId }, { __v: false }).sort({
      createdAt: -1,
    });
    res.json({
      status: httpstatustext.SUCCESS,
      data: { vaccines },
    });
  });
  
  // Get single vaccine
  const getVaccine = asyncwrapper(async (req, res, next) => {
    const vaccine = await Vaccine.findById(req.params.vaccineId);
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
  
    if (query.vaccineName) {
      filter.vaccineName = { $regex: query.vaccineName, $options: 'i' };
    }
  
    const vaccines = await Vaccine.find(filter, { __v: false })
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

  module.exports = {
    addVaccine, // From your previous implementation
    getVaccines,
    getVaccine,
    getAllVaccines,
    updateVaccine,
    deleteVaccine,
    addVaccineForAnimals,
    addVaccineForAnimal ,
    getSingleVaccineEntry ,
    updateVaccineEntry,
    getAllVaccineEntries,
    deleteVaccineEntry,
    getVaccinesForSpecificAnimal
  };