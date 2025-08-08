const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const Supplier = require('../Models/supplier.model');
const Treatment = require('../Models/treatment.model');
const Feed = require('../Models/feed.model');

// Get all suppliers with populated treatments and feeds
const getSuppliers = asyncwrapper(async (req, res) => {
  const suppliers = await Supplier.find({ owner: req.user.id })
    .populate('treatments')
    .populate('feeds');
    
  res.json({
    status: httpstatustext.SUCCESS,
    data: { suppliers }
  });
});

// Get single supplier with populated treatments and feeds
const getSingleSupplier = asyncwrapper(async (req, res, next) => {
  const supplier = await Supplier.findOne({
    _id: req.params.supplierId,
    owner: req.user.id
  })
  .populate('treatments')
  .populate('feeds');

  if (!supplier) {
    return next(AppError.create('Supplier not found', 404, httpstatustext.FAIL));
  }

  res.json({
    status: httpstatustext.SUCCESS,
    data: { supplier }
  });
});

// Add new supplier with optional treatment and feed associations
const addSupplier = asyncwrapper(async (req, res, next) => {
  const { name, email, phone, company, notes, treatmentIds, feedIds } = req.body;

  // Validate required fields
  if (!name || !email || !phone || !company) {
    return next(AppError.create(
      "Name, email, phone, and company are required.",
      400,
      httpstatustext.FAIL
    ));
  }

  // Create new supplier
  const newSupplier = new Supplier({
    name,
    email,
    phone,
    company,
    notes,
    owner: req.user.id
  });

  // Process treatment associations if provided
  if (treatmentIds?.length > 0) {
    const treatments = await Treatment.find({
      _id: { $in: treatmentIds },
      owner: req.user.id
    });

    if (treatments.length !== treatmentIds.length) {
      return next(AppError.create(
        "One or more treatments not found or not authorized.",
        400,
        httpstatustext.FAIL
      ));
    }

    newSupplier.treatments = treatmentIds;
    await Treatment.updateMany(
      { _id: { $in: treatmentIds } },
      { $set: { supplier: newSupplier._id } }
    );
  }

  // Process feed associations if provided
  if (feedIds?.length > 0) {
    const feeds = await Feed.find({
      _id: { $in: feedIds },
      owner: req.user.id
    });

    if (feeds.length !== feedIds.length) {
      return next(AppError.create(
        "One or more feeds not found or not authorized.",
        400,
        httpstatustext.FAIL
      ));
    }

    newSupplier.feeds = feedIds;
    await Feed.updateMany(
      { _id: { $in: feedIds } },
      { $set: { supplier: newSupplier._id } }
    );
  }

  await newSupplier.save();

  // Populate associations if they exist
  if (newSupplier.treatments.length > 0 || newSupplier.feeds.length > 0) {
    await newSupplier.populate('treatments feeds');
  }

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    data: { supplier: newSupplier }
  });
});

// Add treatment to existing supplier
const addTreatmentToSupplier = asyncwrapper(async (req, res, next) => {
  const { supplierId, treatmentId } = req.params;

  const [supplier, treatment] = await Promise.all([
    Supplier.findOne({ _id: supplierId, owner: req.user.id }),
    Treatment.findOne({ _id: treatmentId, owner: req.user.id })
  ]);

  if (!supplier || !treatment) {
    return next(AppError.create(
      'Supplier or treatment not found',
      404,
      httpstatustext.FAIL
    ));
  }

  // Add to both sides of the relationship
  supplier.treatments.addToSet(treatmentId);
  treatment.supplier = supplierId;

  await Promise.all([supplier.save(), treatment.save()]);
  await supplier.populate('treatments');

  res.json({
    status: httpstatustext.SUCCESS,
    data: { supplier }
  });
});

// Add feed to existing supplier
const addFeedToSupplier = asyncwrapper(async (req, res, next) => {
  const { supplierId, feedId } = req.params;

  const [supplier, feed] = await Promise.all([
    Supplier.findOne({ _id: supplierId, owner: req.user.id }),
    Feed.findOne({ _id: feedId, owner: req.user.id })
  ]);

  if (!supplier || !feed) {
    return next(AppError.create(
      'Supplier or feed not found',
      404,
      httpstatustext.FAIL
    ));
  }

  // Add to both sides of the relationship
  supplier.feeds.addToSet(feedId);
  feed.supplier = supplierId;

  await Promise.all([supplier.save(), feed.save()]);
  await supplier.populate('feeds');

  res.json({
    status: httpstatustext.SUCCESS,
    data: { supplier }
  });
});

// Update supplier basic info
const updateSupplier = asyncwrapper(async (req, res, next) => {
  const { name, email, phone, company, notes } = req.body;

  const supplier = await Supplier.findOneAndUpdate(
    { _id: req.params.supplierId, owner: req.user.id },
    { name, email, phone, company, notes },
    { new: true, runValidators: true }
  )
  .populate('treatments feeds');

  if (!supplier) {
    return next(AppError.create(
      'Supplier not found or not authorized',
      404,
      httpstatustext.FAIL
    ));
  }

  res.json({
    status: httpstatustext.SUCCESS,
    data: { supplier }
  });
});

// Delete supplier and clean up references
const deleteSupplier = asyncwrapper(async (req, res, next) => {
  const supplier = await Supplier.findOneAndDelete({
    _id: req.params.supplierId,
    owner: req.user.id
  });

  if (!supplier) {
    return next(AppError.create(
      'Supplier not found or not authorized',
      404,
      httpstatustext.FAIL
    ));
  }

  // Remove supplier references from associated treatments and feeds
  await Promise.all([
    Treatment.updateMany(
      { supplier: supplier._id },
      { $unset: { supplier: "" } }
    ),
    Feed.updateMany(
      { supplier: supplier._id },
      { $unset: { supplier: "" } }
    )
  ]);

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: null
  });
});

module.exports = {
  getSuppliers,
  getSingleSupplier,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  addTreatmentToSupplier,
  addFeedToSupplier
};