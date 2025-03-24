const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const Breed = require('../Models/breed.model');

// Get all breeds for a user (with pagination)
const getAllBreeds = asyncwrapper(async (req, res) => {
    const userId = req.user.id; // Get the user ID from the request
    const query = req.query;
    const limit = query.limit || 10; // Default limit for pagination
    const page = query.page || 1; // Default page for pagination
    const skip = (page - 1) * limit; // Calculate skip for pagination

    const filter = { owner: userId }; // Filter by the user's ID

    // Optional query filters
    if (query.breedName) {
        filter.breedName = query.breedName;
    }

    // Fetch breeds with pagination
    const breeds = await Breed.find(filter, { "__v": false })
        .limit(limit)
        .skip(skip);

    const total = await Breed.countDocuments(filter); // Total number of breeds
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
const addBreed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request
    const { breedName } = req.body; // Extract breed name from the request body

    // Check if the breed name is provided
    if (!breedName) {
        const error = AppError.create('Breed name is required', 400, httpstatustext.FAIL);
        return next(error);
    }

    // Create a new breed
    const newBreed = new Breed({
        breedName,
        owner: userId
    });

    await newBreed.save(); // Save the new breed to the database

    res.json({ status: httpstatustext.SUCCESS, data: { breed: newBreed } });
});

// Update a breed
const updateBreed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request
    const breedId = req.params.breedId; // Get the breed ID from the request params
    const updatedData = req.body; // Get the updated data from the request body

    // Find the breed by ID and owner
    let breed = await Breed.findOne({ _id: breedId, owner: userId });

    if (!breed) {
        const error = AppError.create('Breed not found or unauthorized to update', 404, httpstatustext.FAIL);
        return next(error);
    }

    // Update the breed
    breed = await Breed.findOneAndUpdate(
        { _id: breedId },
        updatedData,
        { new: true } // Return the updated document
    );

    res.json({ status: httpstatustext.SUCCESS, data: { breed } });
});

// Delete a breed
const deleteBreed = asyncwrapper(async (req, res, next) => {
    const userId = req.user.id; // Get the user ID from the request
    const breedId = req.params.breedId; // Get the breed ID from the request params

    // Find the breed by ID and owner
    const breed = await Breed.findOne({ _id: breedId, owner: userId });

    if (!breed) {
        const error = AppError.create('Breed not found or unauthorized to delete', 404, httpstatustext.FAIL);
        return next(error);
    }

    await Breed.deleteOne({ _id: breedId }); // Delete the breed

    res.json({ status: httpstatustext.SUCCESS, message: 'Breed deleted successfully' });
});

module.exports = {
    getAllBreeds,
    getAllBreedsWithoutPagination,
    getSingleBreed,
    addBreed,
    updateBreed,
    deleteBreed
};