const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const LocationShed = require('../Models/locationsed.model');
const Animal = require('../Models/animal.model');
const mongoose = require('mongoose');
const Excluded = require('../Models/excluded.model');



async function resolveShed({ id, name, owner }) {
    const q = { owner };
    if (id) q._id = id;
    if (name) q.locationShedName = name;
    return LocationShed.findOne(q);
}

const getAnimalsInShed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id;
  
    const {
      locationShedId,
      locationShed,         // alias للـ id
      locationShedName,     // بالاسم
      gender,
      animalType,
      breed,                // Breed _id
      tagId,
      includeStats,
      page: qPage = 1,
      limit: qLimit = 10
    } = req.query;
  
    const shedIdOrNull = locationShedId || locationShed || null;
  
    if (!shedIdOrNull && !locationShedName) {
      return next(AppError.create('حدد locationShed (id) أو locationShedName', 400, httpstatustext.FAIL));
    }
  
    // تأكيد العنبر
    const shed = await resolveShed({ id: shedIdOrNull, name: locationShedName, owner: userId });
    if (!shed) {
      return next(AppError.create('العنبر غير موجود لهذا المستخدم', 404, httpstatustext.FAIL));
    }
  
    // قوائم الاستبعاد من جدول Excluded (لهذا الـ owner)
    // ممكن بعض السجلات مافيهاش animalId؛ لذلك بنستخدم animalId و tagId معًا
    const [excludedAnimalIdsRaw, excludedTagIdsRaw] = await Promise.all([
      Excluded.find({ owner: userId }).distinct('animalId'),
      Excluded.find({ owner: userId }).distinct('tagId'),
    ]);
  
    // تنضيف القوائم
    const excludedAnimalIds = excludedAnimalIdsRaw
      .filter(v => !!v) // remove null/undefined
      .map(v => (typeof v === 'string' ? v : String(v)))
      .filter(v => mongoose.Types.ObjectId.isValid(v))
      .map(v => new mongoose.Types.ObjectId(v));
  
    const excludedTagIds = excludedTagIdsRaw
      .filter(v => typeof v === 'string' && v.trim().length > 0);
  
    // فلتر القائمة (find) — Mongoose سيعمل casting تلقائي للـ ObjectId
    const baseFilter = { owner: userId, locationShed: shed._id };
    if (gender) baseFilter.gender = gender;
    if (animalType) baseFilter.animalType = animalType;
    if (breed) baseFilter.breed = breed;  // يتوقع _id
    if (tagId) baseFilter.tagId = tagId;
  
    // نضيف شروط الاستبعاد باستخدام $and حتى لو فيه equality على tagId
    const andConds = [];
    if (excludedAnimalIds.length) andConds.push({ _id: { $nin: excludedAnimalIds } });
    if (excludedTagIds.length)   andConds.push({ tagId: { $nin: excludedTagIds } });
  
    const findFilter = andConds.length ? { $and: [baseFilter, ...andConds] } : baseFilter;
  
    const limit = Math.max(1, parseInt(qLimit, 10) || 10);
    const page  = Math.max(1, parseInt(qPage, 10)  || 1);
    const skip  = (page - 1) * limit;
  
    // البيانات + إجمالي الصفوف
    const [animals, total] = await Promise.all([
      Animal.find(findFilter, { "__v": false })
        .populate('locationShed', 'locationShedName')
        .populate('breed', 'breedName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Animal.countDocuments(findFilter)
    ]);
  
    // ===== الإحصائيات =====
    // ترجع دائمًا ككائن (حتى لو مش مفعّلة)
    let stats = { total: 0, males: 0, females: 0, goats: 0, sheep: 0 };
  
    const wantStats = ['true','1','yes','y','on'].includes(String(includeStats).toLowerCase());
    if (wantStats) {
      // في aggregate لازم casting يدوي
      const matchFilter = {
        owner: new mongoose.Types.ObjectId(userId),
        locationShed: new mongoose.Types.ObjectId(String(shed._id)),
      };
      if (gender) matchFilter.gender = gender;
      if (animalType) matchFilter.animalType = animalType;
      if (breed) {
        if (!mongoose.Types.ObjectId.isValid(breed)) {
          return next(AppError.create('breed ليس ObjectId صالح', 400, httpstatustext.FAIL));
        }
        matchFilter.breed = new mongoose.Types.ObjectId(breed);
      }
      if (tagId) matchFilter.tagId = tagId;
  
      // إضافة شروط الاستبعاد إلى $match عبر $and
      const matchAnd = [matchFilter];
      if (excludedAnimalIds.length) matchAnd.push({ _id: { $nin: excludedAnimalIds } });
      if (excludedTagIds.length)   matchAnd.push({ tagId: { $nin: excludedTagIds } });
  
      const rows = await Animal.aggregate([
        { $match: { $and: matchAnd } },
        {
          $group: {
            _id: null,
            total:   { $sum: 1 },
            males:   { $sum: { $cond: [{ $eq: ['$gender','male'] }, 1, 0] } },
            females: { $sum: { $cond: [{ $eq: ['$gender','female'] }, 1, 0] } },
            goats:   { $sum: { $cond: [{ $eq: ['$animalType','goat'] }, 1, 0] } },
            sheep:   { $sum: { $cond: [{ $eq: ['$animalType','sheep'] }, 1, 0] } },
          }
        },
        // نخفي _id من الإخراج
        { $project: { _id: 0, total: 1, males: 1, females: 1, goats: 1, sheep: 1 } }
      ]);
  
      if (rows[0]) stats = rows[0];
    }
  
    return res.status(200).json({
      status: httpstatustext.SUCCESS,
      shed: { id: shed._id, name: shed.locationShedName },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      },
      data: { animals, stats }
    });
  });
  
// Get all location sheds for a user
const getAllLocationSheds = asyncwrapper(async (req, res) => {
    const userId = req.user.id; // Get the user ID from the request
    const query = req.query;
    const limit = query.limit || 10; // Default limit for pagination
    const page = query.page || 1; // Default page for pagination
    const skip = (page - 1) * limit; // Calculate skip for pagination

    const filter = { owner: userId }; // Filter by the user's ID

    // Optional query filters
    if (query.locationShedName) {
        filter.locationShedName = query.locationShedName;
    }

    // Fetch location sheds with pagination
    const locationSheds = await LocationShed.find(filter, { "__v": false })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

    const total = await LocationShed.countDocuments(filter); // Total number of location sheds
    const totalPages = Math.ceil(total / limit); // Calculate total pages

    res.json({
        status: httpstatustext.SUCCESS,
        pagination: {
            page: page,
            limit: limit,
            total: total,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        },
        data: { locationSheds }
    });
});

const getAllLocationShedsWithoutPagination = asyncwrapper(async (req, res) => {
    const userId = req.user.id; // Get the user ID from the request
    const query = req.query;

    const filter = { owner: userId }; // Filter by the user's ID

    // Optional query filters
    if (query.locationShedName) {
        filter.locationShedName = query.locationShedName;
    }

    // Fetch all location sheds without pagination
    const locationSheds = await LocationShed.find(filter, { "__v": false });

    res.json({
        status: httpstatustext.SUCCESS,
        data: { locationSheds }
    });
});
// Get a single location shed by ID
const getSingleLocationShed = asyncwrapper(async (req, res, next) => {
    const locationShedId = req.params.locationShedId; // Get the location shed ID from the request params
    const locationShed = await LocationShed.findById(locationShedId);

    if (!locationShed) {
        const error = AppError.create('Location shed not found', 404, httpstatustext.FAIL);
        return next(error);
    }

    res.json({ status: httpstatustext.SUCCESS, data: { locationShed } });
});

// Add a new location shed
const addLocationShed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request
    const { locationShedName } = req.body; // Extract location shed name from the request body

    // Check if the location shed name is provided
    if (!locationShedName) {
        const error = AppError.create('Location shed name is required', 400, httpstatustext.FAIL);
        return next(error);
    }

    // Create a new location shed
    const newLocationShed = new LocationShed({
        locationShedName,
        owner: userId
    });

    await newLocationShed.save(); // Save the new location shed to the database

    res.json({ status: httpstatustext.SUCCESS, data: { locationShed: newLocationShed } });
});

// Update a location shed
const updateLocationShed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request
    const locationShedId = req.params.locationShedId; // Get the location shed ID from the request params
    const updatedData = req.body; // Get the updated data from the request body

    // Find the location shed by ID and owner
    let locationShed = await LocationShed.findOne({ _id: locationShedId, owner: userId });

    if (!locationShed) {
        const error = AppError.create('Location shed not found or unauthorized to update', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Update the location shed
    locationShed = await LocationShed.findOneAndUpdate(
        { _id: locationShedId },
        updatedData,
        { new: true } // Return the updated document
    );

    res.json({ status: httpstatustext.SUCCESS, data: { locationShed } });
});

// Delete a location shed
const deleteLocationShed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request
    const locationShedId = req.params.locationShedId; // Get the location shed ID from the request params

    // Find the location shed by ID and owner
    const locationShed = await LocationShed.findOne({ _id: locationShedId, owner: userId });

    if (!locationShed) {
        const error = AppError.create('Location shed not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }

    await LocationShed.deleteOne({ _id: locationShedId }); // Delete the location shed

    res.json({ status: httpstatustext.SUCCESS, message: 'Location shed deleted successfully' });
});

module.exports = {
    getAllLocationSheds,
    getSingleLocationShed,
    addLocationShed,
    updateLocationShed,
    deleteLocationShed,
    getAllLocationShedsWithoutPagination,
    getAnimalsInShed
};