const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const Breed = require('../Models/breed.model');
const i18n = require('../i18n');

// Get all breeds for a user (with pagination)
// Get all breeds for a user (with pagination)
const getAllBreeds = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const query = req.query;
  const limit = parseInt(query.limit, 10) || 10;
  const page = parseInt(query.page, 10) || 1;
  const skip = (page - 1) * limit;

  const filter = { owner: userId };

  if (query.breedName) {
    filter.breedName = query.breedName;
  }

  const breeds = await Breed.find(filter, { "__v": false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);

  const total = await Breed.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  res.json({
    status: httpstatustext.SUCCESS,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: { breeds }
  });
});


// Get all breeds for a user (without pagination)
const getAllBreedsWithoutPagination = asyncwrapper(async (req, res) => {
  const userId = req.user.id; // Get the user ID from the request
  const query = req.query;

  const filter = { owner: userId }; // Filter by the user's ID

  // Optional query filters
  if (query.breedName) {
    filter.breedName = query.breedName;
  }

  // Fetch all breeds without pagination
  const breeds = await Breed.find(filter, { "__v": false });

  res.json({
    status: httpstatustext.SUCCESS,
    data: { breeds }
  });
});

// Get a single breed by ID
const getSingleBreed = asyncwrapper(async (req, res, next) => {
  const breedId = req.params.breedId; // Get the breed ID from the request params
  const breed = await Breed.findById(breedId);

  if (!breed) {
    const error = AppError.create('Breed not found', 404, httpstatustext.FAIL);
    return next(error);
  }

  res.json({ status: httpstatustext.SUCCESS, data: { breed } });
});

// Add a new breed
// Add a new breed
const addBreed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { breedName, standards } = req.body;

  if (!breedName) {
    const error = AppError.create('Breed name is required', 400, httpstatustext.FAIL);
    return next(error);
  }

  const breed = await Breed.create({
    breedName: breedName?.trim(),
    standards: standards ?? {},
    owner: userId
  });

  res.json({ status: httpstatustext.SUCCESS, data: { breed } });
});

// Update a breed
const updateBreed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const breedId = req.params.breedId;
  const { breedName, standards, ...rest } = req.body;

  // only owner can update
  const existing = await Breed.findOne({ _id: breedId, owner: userId });
  if (!existing) {
    const error = AppError.create(i18n.__('BREED_UNAUTHORIZED'), 404, httpstatustext.FAIL);
    return next(error);
  }

  const update = {
    ...rest,
  };
  if (typeof breedName !== 'undefined') update.breedName = breedName?.trim();
  if (typeof standards !== 'undefined') update.standards = standards;

  const breed = await Breed.findOneAndUpdate(
    { _id: breedId },
    update,
    { new: true, runValidators: true }
  );

  res.json({ status: httpstatustext.SUCCESS, data: { breed } });
});


// Delete a breed
const deleteBreed = asyncwrapper(async (req, res, next) => {
  const userId = req.user.id;
  const breedId = req.params.breedId;

  // Find the breed by ID and owner
  const breed = await Breed.findOne({ _id: breedId, owner: userId });

  if (!breed) {
    const error = AppError.create(i18n.__('BREED_NOT_FOUND'), 404, httpstatustext.FAIL);
    return next(error);
  }

  await Breed.deleteOne({ _id: breedId });

  res.json({ status: httpstatustext.SUCCESS, message: i18n.__('BREED_DELETED') });
});

module.exports = {
  getAllBreeds,
  getAllBreedsWithoutPagination,
  getSingleBreed,
  addBreed,
  updateBreed,
  deleteBreed
};