const jwt = require('jsonwebtoken');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const CourseStudent = require('../Models/courseStudent.model');

/**
 * Authenticate course students using a dedicated JWT payload.
 * Does NOT require tenantId / farm subscription context.
 */
module.exports = async function authenticateCourseStudent(req, res, next) {
  const raw = req.headers.authorization;
  if (!raw) {
    return next(AppError.create('Token is required', 401, httpstatustext.ERROR));
  }

  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
  if (!token) {
    return next(AppError.create('Token is missing', 401, httpstatustext.ERROR));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    if (decoded.accountType !== 'course_student') {
      return next(
        AppError.create('Invalid course student token', 401, httpstatustext.ERROR)
      );
    }

    const studentId = decoded.id || decoded.studentId;
    if (!studentId) {
      return next(
        AppError.create('Token payload missing student id', 401, httpstatustext.ERROR)
      );
    }

    const student = await CourseStudent.findById(studentId);
    if (!student) {
      return next(AppError.create('Course student not found', 401, httpstatustext.ERROR));
    }

    if (!student.isActive) {
      return next(
        AppError.create('Course student account is disabled', 403, httpstatustext.FAIL)
      );
    }

    req.courseStudent = {
      id: student._id,
      email: student.email,
      fullName: student.fullName,
      phone: student.phone,
      accountType: 'course_student',
    };

    next();
  } catch {
    return next(AppError.create('Token is invalid', 401, httpstatustext.ERROR));
  }
};
