const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const LocationShed = require('../Models/locationsed.model');

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
    getAllLocationShedsWithoutPagination
};