const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const Supplier = require('../Models/supplier.model');
const Treatment = require('../Models/treatment.model');
const Feed = require('../Models/feed.model');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Get all suppliers with populated treatments and feeds
const getSuppliers = asyncwrapper(async (req, res) => {
  const userId = req.user.id;
  const query = req.query;
  const limit = parseInt(query.limit) || 10;
  const page = parseInt(query.page) || 1;
  const skip = (page - 1) * limit;

  // Base filter - always filter by owner
  const filter = { owner: userId };

  // Add optional filters
  if (query.name) {
    filter.name = { $regex: query.name, $options: 'i' }; // Case-insensitive search
  }

  if (query.company) {
    filter.company = { $regex: query.company, $options: 'i' };
  }

  if (query.email) {
    filter.email = { $regex: query.email, $options: 'i' };
  }
  // ✅ فلترة بالموبايل (contains + case-insensitive)
  if (query.phone) {
    filter.phone = { $regex: escapeRegex(query.phone), $options: 'i' };
  }

  if (query.createdAtTo) {
    filter.createdAt = { 
      ...filter.createdAt, 
      $lte: new Date(query.createdAtTo) 
    };
  }

  // Get total count for pagination
  const totalCount = await Supplier.countDocuments(filter);

  // Get paginated results
  const suppliers = await Supplier.find(filter, { "__v": false })
    .populate('treatments')
    .populate('feeds')
    .sort({ createdAt: -1 }) // Newest first
    .limit(limit)
    .skip(skip);

  res.json({
    status: httpstatustext.SUCCESS,
    data: {
      suppliers,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    }
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
  // بنفصل ونطنّش أي treatmentIds / feedIds لو جُم في البودي
  const { name, email, phone, company, notes, supplyType } = req.body;

  if (!name || !email || !phone || !company) {
    return next(AppError.create(
      "Name, email, phone, and company are required.",
      400,
      httpstatustext.FAIL
    ));
  }

  // إنشـاء المورد بدون أي علاقات
  const newSupplier = new Supplier({
    name,
    email,
    phone,
    company,
    notes,
    owner: req.user.id,
    // تأكيد إنهم فاضيين عند الإنشاء
    treatments: [],
    feeds: [],
    supplyType
  });

  await newSupplier.save();

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    data: { supplier: newSupplier }
  });
});


// Add treatment to existing supplier
// const addTreatmentToSupplier = asyncwrapper(async (req, res, next) => {
//   const { supplierId, treatmentId } = req.params;

//   const [supplier, treatment] = await Promise.all([
//     Supplier.findOne({ _id: supplierId, owner: req.user.id }),
//     Treatment.findOne({ _id: treatmentId, owner: req.user.id })
//   ]);

//   if (!supplier || !treatment) {
//     return next(AppError.create(
//       'Supplier or treatment not found',
//       404,
//       httpstatustext.FAIL
//     ));
//   }

//   // Add to both sides of the relationship
//   supplier.treatments.addToSet(treatmentId);
//   treatment.supplier = supplierId;

//   await Promise.all([supplier.save(), treatment.save()]);
//   await supplier.populate('treatments');

//   res.json({
//     status: httpstatustext.SUCCESS,
//     data: { supplier }
//   });
// });

// Add feed to existing supplier
// const addFeedToSupplier = asyncwrapper(async (req, res, next) => {
//   const { supplierId, feedId } = req.params;

//   const [supplier, feed] = await Promise.all([
//     Supplier.findOne({ _id: supplierId, owner: req.user.id }),
//     Feed.findOne({ _id: feedId, owner: req.user.id })
//   ]);

//   if (!supplier || !feed) {
//     return next(AppError.create(
//       'Supplier or feed not found',
//       404,
//       httpstatustext.FAIL
//     ));
//   }

//   // Add to both sides of the relationship
//   supplier.feeds.addToSet(feedId);
//   feed.supplier = supplierId;

//   await Promise.all([supplier.save(), feed.save()]);
//   await supplier.populate('feeds');

//   res.json({
//     status: httpstatustext.SUCCESS,
//     data: { supplier }
//   });
// });

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

};