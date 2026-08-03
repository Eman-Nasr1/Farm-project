const CourseStudent = require('../Models/courseStudent.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const {
  findActiveRegistration,
  findLatestRegistration,
} = require('../services/courseService');
const { createRegistrationFromRequest } = require('../services/courseRegistrationService');
const { notifyRegistrationCreated } = require('../utilits/courseEmail');

/**
 * POST /api/course/registration
 *
 * For individual re-registration after cancel/reject.
 * Group of 5 must use POST /api/course/auth/register.
 */
const createRegistration = asyncwrapper(async (req, res, next) => {
  const studentId = req.courseStudent.id;

  if (req.body.category === 'student_group') {
    return next(
      AppError.create(
        'Group registration must use POST /api/course/auth/register so all 5 member accounts are created',
        400,
        httpstatustext.FAIL
      )
    );
  }

  const active = await findActiveRegistration(studentId);
  if (active) {
    return next(
      AppError.create(
        'You already have an active course registration. Cancel or wait for rejection before registering again.',
        400,
        httpstatustext.FAIL
      )
    );
  }

  const { registration } = await createRegistrationFromRequest({
    studentId,
    body: req.body,
    files: req.files,
    file: req.file,
  });

  const student = await CourseStudent.findById(studentId);
  if (student) {
    notifyRegistrationCreated(student, registration).catch(() => {});
  }

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    data: { registration },
  });
});

/**
 * GET /api/course/registration/me
 * Works for group leader and group members.
 */
const getMyRegistration = asyncwrapper(async (req, res, next) => {
  const registration = await findLatestRegistration(req.courseStudent.id);

  if (!registration) {
    return next(AppError.create('No registration found', 404, httpstatustext.FAIL));
  }

  const leaderId = registration.groupLeader || registration.student;
  const isLeader = String(leaderId) === String(req.courseStudent.id);

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      registration,
      isGroupLeader: isLeader,
      canPay: isLeader,
    },
  });
});

module.exports = {
  createRegistration,
  getMyRegistration,
};
