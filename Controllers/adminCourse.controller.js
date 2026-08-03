const CourseStudent = require('../Models/courseStudent.model');
const CourseRegistration = require('../Models/courseRegistration.model');
const CoursePayment = require('../Models/coursePayment.model');
const CourseLecture = require('../Models/courseLecture.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const {
  getOrCreatePaymentSettings,
  pushStatusHistory,
} = require('../services/courseService');
const {
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifyRegistrationConfirmed,
  notifyLecturePublished,
} = require('../utilits/courseEmail');

function buildPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * GET /api/admin/course/dashboard
 */
const getDashboard = asyncwrapper(async (_req, res) => {
  const [
    totalStudents,
    totalRegistrations,
    paidPayments,
    pendingPayments,
    underReviewPayments,
    rejectedPayments,
    confirmedRegistrations,
    revenueAgg,
    categoryCounts,
  ] = await Promise.all([
    CourseStudent.countDocuments(),
    CourseRegistration.countDocuments(),
    CoursePayment.countDocuments({ status: 'paid' }),
    CoursePayment.countDocuments({ status: 'pending' }),
    CoursePayment.countDocuments({ status: 'pending_review' }),
    CoursePayment.countDocuments({ status: 'rejected' }),
    CourseRegistration.countDocuments({ registrationStatus: 'confirmed' }),
    CoursePayment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    CourseRegistration.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);

  const categoryMap = Object.fromEntries(
    categoryCounts.map((c) => [c._id, c.count])
  );

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      totalCourseStudents: totalStudents,
      totalRegistrations,
      paidRegistrations: paidPayments,
      pendingPayments,
      paymentsUnderReview: underReviewPayments,
      rejectedPayments,
      confirmedRegistrations,
      totalConfirmedRevenue: revenueAgg[0]?.total || 0,
      breederRegistrations: categoryMap.breeder || 0,
      doctorEngineerRegistrations: categoryMap.doctor_engineer || 0,
      individualStudentRegistrations: categoryMap.student || 0,
      groupRegistrations: categoryMap.student_group || 0,
    },
  });
});

/**
 * GET /api/admin/course/registrations
 */
const listRegistrations = asyncwrapper(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};

  if (req.query.category) filter.category = req.query.category;
  if (req.query.registrationStatus) {
    filter.registrationStatus = req.query.registrationStatus;
  }
  if (req.query.bookingCode) {
    filter.bookingCode = new RegExp(req.query.bookingCode, 'i');
  }

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  // Text / payment filters via student or payment join
  let studentIds = null;
  if (req.query.search || req.query.email || req.query.phone || req.query.name) {
    const studentFilter = {};
    if (req.query.email) studentFilter.email = new RegExp(req.query.email, 'i');
    if (req.query.phone) studentFilter.phone = new RegExp(req.query.phone, 'i');
    if (req.query.name) studentFilter.fullName = new RegExp(req.query.name, 'i');
    if (req.query.search) {
      studentFilter.$or = [
        { fullName: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { phone: new RegExp(req.query.search, 'i') },
      ];
    }
    const students = await CourseStudent.find(studentFilter).select('_id');
    studentIds = students.map((s) => s._id);
    filter.student = { $in: studentIds };
  }

  let registrations = await CourseRegistration.find(filter)
    .populate('student', 'fullName email phone isActive')
    .populate('payment')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  if (req.query.paymentStatus || req.query.paymentMethod) {
    registrations = registrations.filter((r) => {
      if (!r.payment) return false;
      if (req.query.paymentStatus && r.payment.status !== req.query.paymentStatus) {
        return false;
      }
      if (req.query.paymentMethod && r.payment.method !== req.query.paymentMethod) {
        return false;
      }
      return true;
    });
  }

  const total = await CourseRegistration.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { registrations },
  });
});

/**
 * GET /api/admin/course/registrations/:id
 */
const getRegistration = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findById(req.params.id)
    .populate('student', '-password')
    .populate({
      path: 'payment',
      populate: { path: 'reviewedBy', select: 'name email' },
    })
    .populate('attendanceMarkedBy', 'name email');

  if (!registration) {
    return next(AppError.create('Registration not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { registration },
  });
});

/**
 * PATCH /api/admin/course/registrations/:id/confirm
 */
const confirmRegistration = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findById(req.params.id).populate('payment');
  if (!registration) {
    return next(AppError.create('Registration not found', 404, httpstatustext.FAIL));
  }

  const payment = registration.payment
    ? await CoursePayment.findById(registration.payment._id || registration.payment)
    : null;

  if (!payment || payment.status !== 'paid') {
    return next(
      AppError.create('Cannot confirm registration without an approved payment', 400, httpstatustext.FAIL)
    );
  }

  const oldStatus = registration.registrationStatus;
  registration.registrationStatus = 'confirmed';
  registration.rejectionReason = null;
  pushStatusHistory(registration, {
    oldStatus,
    newStatus: 'confirmed',
    changedBy: req.user.id,
    changedByType: 'admin',
    reason: 'Registration confirmed by admin',
  });
  await registration.save();

  const student = await CourseStudent.findById(registration.student);
  if (student) notifyRegistrationConfirmed(student, registration).catch(() => {});

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { registration },
  });
});

/**
 * PATCH /api/admin/course/registrations/:id/reject
 */
const rejectRegistration = asyncwrapper(async (req, res, next) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason || !String(rejectionReason).trim()) {
    return next(AppError.create('Rejection reason is required', 400, httpstatustext.FAIL));
  }

  const registration = await CourseRegistration.findById(req.params.id);
  if (!registration) {
    return next(AppError.create('Registration not found', 404, httpstatustext.FAIL));
  }

  const oldStatus = registration.registrationStatus;
  registration.registrationStatus = 'rejected';
  registration.rejectionReason = String(rejectionReason).trim();
  pushStatusHistory(registration, {
    oldStatus,
    newStatus: 'rejected',
    changedBy: req.user.id,
    changedByType: 'admin',
    reason: registration.rejectionReason,
  });
  await registration.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { registration },
  });
});

/**
 * PATCH /api/admin/course/registrations/:id/attendance
 */
const markAttendance = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findById(req.params.id);
  if (!registration) {
    return next(AppError.create('Registration not found', 404, httpstatustext.FAIL));
  }

  registration.attended = true;
  registration.attendanceMarkedAt = new Date();
  registration.attendanceMarkedBy = req.user.id;
  pushStatusHistory(registration, {
    oldStatus: registration.registrationStatus,
    newStatus: registration.registrationStatus,
    changedBy: req.user.id,
    changedByType: 'admin',
    reason: 'Attendance marked',
  });
  await registration.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { registration },
  });
});

/**
 * PATCH /api/admin/course/registrations/:id/remove-attendance
 */
const removeAttendance = asyncwrapper(async (req, res, next) => {
  const registration = await CourseRegistration.findById(req.params.id);
  if (!registration) {
    return next(AppError.create('Registration not found', 404, httpstatustext.FAIL));
  }

  registration.attended = false;
  registration.attendanceMarkedAt = null;
  registration.attendanceMarkedBy = null;
  pushStatusHistory(registration, {
    oldStatus: registration.registrationStatus,
    newStatus: registration.registrationStatus,
    changedBy: req.user.id,
    changedByType: 'admin',
    reason: 'Attendance removed',
  });
  await registration.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { registration },
  });
});

/**
 * PATCH /api/admin/course/students/:id/status
 * Body: { isActive: boolean }
 */
const setStudentActive = asyncwrapper(async (req, res, next) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return next(AppError.create('isActive boolean is required', 400, httpstatustext.FAIL));
  }

  const student = await CourseStudent.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  );

  if (!student) {
    return next(AppError.create('Student not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { student },
  });
});

/**
 * GET /api/admin/course/students
 */
const listStudents = asyncwrapper(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};

  if (req.query.search) {
    filter.$or = [
      { fullName: new RegExp(req.query.search, 'i') },
      { email: new RegExp(req.query.search, 'i') },
      { phone: new RegExp(req.query.search, 'i') },
    ];
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const [students, total] = await Promise.all([
    CourseStudent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    CourseStudent.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { students },
  });
});

/**
 * GET /api/admin/course/payments
 */
const listPayments = asyncwrapper(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;

  const payments = await CoursePayment.find(filter)
    .populate('student', 'fullName email phone')
    .populate({
      path: 'registration',
      select: 'category amount bookingCode registrationStatus',
    })
    .populate('reviewedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await CoursePayment.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: { payments },
  });
});

/**
 * GET /api/admin/course/payments/:id
 */
const getPayment = asyncwrapper(async (req, res, next) => {
  const payment = await CoursePayment.findById(req.params.id)
    .populate('student', 'fullName email phone isActive')
    .populate('registration')
    .populate('reviewedBy', 'name email');

  if (!payment) {
    return next(AppError.create('Payment not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { payment },
  });
});

/**
 * PATCH /api/admin/course/payments/:id/approve
 * Atomic update to prevent duplicate approvals.
 */
const approvePayment = asyncwrapper(async (req, res, next) => {
  const payment = await CoursePayment.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $in: ['pending_review', 'pending', 'rejected'] },
    },
    {
      $set: {
        status: 'paid',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      $push: {
        statusHistory: {
          oldStatus: 'pending_review',
          newStatus: 'paid',
          changedBy: req.user.id,
          changedByType: 'admin',
          reason: 'Payment approved by admin',
          changedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!payment) {
    const existing = await CoursePayment.findById(req.params.id);
    if (!existing) {
      return next(AppError.create('Payment not found', 404, httpstatustext.FAIL));
    }
    if (existing.status === 'paid') {
      return next(AppError.create('Payment already approved', 409, httpstatustext.FAIL));
    }
    return next(AppError.create('Payment cannot be approved in its current status', 400, httpstatustext.FAIL));
  }

  const registration = await CourseRegistration.findById(payment.registration);
  if (registration) {
    const oldStatus = registration.registrationStatus;
    registration.registrationStatus = 'confirmed';
    pushStatusHistory(registration, {
      oldStatus,
      newStatus: 'confirmed',
      changedBy: req.user.id,
      changedByType: 'admin',
      reason: 'Payment approved',
    });
    await registration.save();

    const student = await CourseStudent.findById(payment.student);
    if (student) {
      notifyPaymentApproved(student, registration).catch(() => {});
      notifyRegistrationConfirmed(student, registration).catch(() => {});
    }
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { payment, registration },
  });
});

/**
 * PATCH /api/admin/course/payments/:id/reject
 */
const rejectPayment = asyncwrapper(async (req, res, next) => {
  const { rejectionReason } = req.body;
  if (!rejectionReason || !String(rejectionReason).trim()) {
    return next(AppError.create('Rejection reason is required', 400, httpstatustext.FAIL));
  }

  const reason = String(rejectionReason).trim();

  const payment = await CoursePayment.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $in: ['pending_review', 'pending'] },
    },
    {
      $set: {
        status: 'rejected',
        rejectionReason: reason,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      $push: {
        statusHistory: {
          oldStatus: 'pending_review',
          newStatus: 'rejected',
          changedBy: req.user.id,
          changedByType: 'admin',
          reason,
          changedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!payment) {
    const existing = await CoursePayment.findById(req.params.id);
    if (!existing) {
      return next(AppError.create('Payment not found', 404, httpstatustext.FAIL));
    }
    return next(
      AppError.create('Payment cannot be rejected in its current status', 400, httpstatustext.FAIL)
    );
  }

  const registration = await CourseRegistration.findById(payment.registration);
  if (registration) {
    // Keep registration awaiting a new receipt; do not permanently reject registration
    pushStatusHistory(registration, {
      oldStatus: registration.registrationStatus,
      newStatus: registration.registrationStatus,
      changedBy: req.user.id,
      changedByType: 'admin',
      reason: `Payment rejected: ${reason}`,
    });
    await registration.save();

    const student = await CourseStudent.findById(payment.student);
    if (student) {
      notifyPaymentRejected(student, registration, reason).catch(() => {});
    }
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { payment, registration },
  });
});

/**
 * PATCH /api/admin/course/payments/:id/refund
 */
const refundPayment = asyncwrapper(async (req, res, next) => {
  const payment = await CoursePayment.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'paid',
    },
    {
      $set: {
        status: 'refunded',
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      $push: {
        statusHistory: {
          oldStatus: 'paid',
          newStatus: 'refunded',
          changedBy: req.user.id,
          changedByType: 'admin',
          reason: req.body.reason || 'Marked as refunded',
          changedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!payment) {
    return next(
      AppError.create('Only paid payments can be refunded', 400, httpstatustext.FAIL)
    );
  }

  const registration = await CourseRegistration.findById(payment.registration);
  if (registration && registration.registrationStatus === 'confirmed') {
    const oldStatus = registration.registrationStatus;
    registration.registrationStatus = 'cancelled';
    pushStatusHistory(registration, {
      oldStatus,
      newStatus: 'cancelled',
      changedBy: req.user.id,
      changedByType: 'admin',
      reason: 'Payment refunded',
    });
    await registration.save();
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { payment, registration },
  });
});

/**
 * Lecture admin CRUD
 */
const listLectures = asyncwrapper(async (_req, res) => {
  const lectures = await CourseLecture.find()
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { lectures },
  });
});

const createLecture = asyncwrapper(async (req, res) => {
  const lecture = await CourseLecture.create({
    title: req.body.title,
    description: req.body.description || '',
    lectureUrl: req.body.lectureUrl,
    platform: req.body.platform || 'other',
    lectureDate: req.body.lectureDate || null,
    isPublished: false,
    createdBy: req.user.id,
  });

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    data: { lecture },
  });
});

const updateLecture = asyncwrapper(async (req, res, next) => {
  const lecture = await CourseLecture.findById(req.params.id);
  if (!lecture) {
    return next(AppError.create('Lecture not found', 404, httpstatustext.FAIL));
  }

  const fields = ['title', 'description', 'lectureUrl', 'platform', 'lectureDate'];
  fields.forEach((field) => {
    if (req.body[field] !== undefined) {
      lecture[field] = req.body[field];
    }
  });

  await lecture.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { lecture },
  });
});

const deleteLecture = asyncwrapper(async (req, res, next) => {
  const lecture = await CourseLecture.findByIdAndDelete(req.params.id);
  if (!lecture) {
    return next(AppError.create('Lecture not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Lecture deleted',
  });
});

const publishLecture = asyncwrapper(async (req, res, next) => {
  const lecture = await CourseLecture.findByIdAndUpdate(
    req.params.id,
    { isPublished: true },
    { new: true }
  );

  if (!lecture) {
    return next(AppError.create('Lecture not found', 404, httpstatustext.FAIL));
  }

  // Notify confirmed paid students (non-blocking)
  try {
    const paidRegs = await CourseRegistration.find({
      registrationStatus: 'confirmed',
    }).populate('student');

    paidRegs.forEach((reg) => {
      if (reg.student?.email) {
        notifyLecturePublished(reg.student, lecture).catch(() => {});
      }
    });
  } catch (err) {
    console.error('[course] lecture publish notify failed:', err.message);
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { lecture },
  });
});

const unpublishLecture = asyncwrapper(async (req, res, next) => {
  const lecture = await CourseLecture.findByIdAndUpdate(
    req.params.id,
    { isPublished: false },
    { new: true }
  );

  if (!lecture) {
    return next(AppError.create('Lecture not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { lecture },
  });
});

/**
 * Payment settings
 */
const getPaymentSettings = asyncwrapper(async (_req, res) => {
  const settings = await getOrCreatePaymentSettings();
  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { settings },
  });
});

const updatePaymentSettings = asyncwrapper(async (req, res) => {
  const settings = await getOrCreatePaymentSettings();

  const allowed = [
    'paymobEnabled',
    'instapayEnabled',
    'instapayAddress',
    'instapayAccountName',
    'instapayInstructions',
    'fawryEnabled',
    'fawryInstructions',
    'bankTransferEnabled',
    'bankName',
    'bankAccountName',
    'bankAccountNumber',
    'iban',
    'bankInstructions',
    'manualReceiptEnabled',
    'manualPaymentInstructions',
  ];

  allowed.forEach((key) => {
    if (req.body[key] !== undefined) {
      settings[key] = req.body[key];
    }
  });

  await settings.save();

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { settings },
  });
});

module.exports = {
  getDashboard,
  listRegistrations,
  getRegistration,
  confirmRegistration,
  rejectRegistration,
  markAttendance,
  removeAttendance,
  setStudentActive,
  listStudents,
  listPayments,
  getPayment,
  approvePayment,
  rejectPayment,
  refundPayment,
  listLectures,
  createLecture,
  updateLecture,
  deleteLecture,
  publishLecture,
  unpublishLecture,
  getPaymentSettings,
  updatePaymentSettings,
};
