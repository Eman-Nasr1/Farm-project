const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CourseStudent = require('../Models/courseStudent.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const {
  notifyAccountCreated,
  notifyRegistrationCreated,
} = require('../utilits/courseEmail');
const { createRegistrationFromRequest } = require('../services/courseRegistrationService');

function signCourseStudentToken(student) {
  return jwt.sign(
    {
      id: student._id,
      email: student.email,
      accountType: 'course_student',
      role: 'course_student',
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '7d' }
  );
}

function sanitizeStudent(student) {
  return {
    id: student._id,
    fullName: student.fullName,
    email: student.email,
    phone: student.phone,
    isActive: student.isActive,
    lastLoginAt: student.lastLoginAt,
    createdAt: student.createdAt,
  };
}

/**
 * POST /api/course/auth/register
 *
 * Individual: creates 1 account + registration.
 * Group: creates 5 accounts; leader email must be one of the 5 participants;
 *        only leader password is used from the form; other members get temp passwords.
 */
const register = asyncwrapper(async (req, res, next) => {
  const { fullName, email, phone, password, category } = req.body;

  if (!fullName || !email || !phone || !password) {
    return next(
      AppError.create(
        'fullName, email, phone and password are required',
        400,
        httpstatustext.FAIL
      )
    );
  }

  if (!category) {
    return next(AppError.create('Category is required', 400, httpstatustext.FAIL));
  }

  // ---------- Group registration ----------
  if (category === 'student_group') {
    let result;
    try {
      result = await createRegistrationFromRequest({
        studentId: null,
        body: req.body,
        files: req.files,
        file: req.file,
        leaderInfo: {
          fullName,
          email,
          phone,
          password,
        },
      });
    } catch (error) {
      return next(error);
    }

    const { registration, leader, groupMembers } = result;
    const token = signCourseStudentToken(leader);

    notifyAccountCreated(leader).catch(() => {});
    groupMembers
      .filter((m) => !m.isLeader)
      .forEach((m) => {
        notifyAccountCreated({
          email: m.email,
          fullName: m.fullName,
        }).catch(() => {});
      });
    notifyRegistrationCreated(leader, registration).catch(() => {});

    return res.status(201).json({
      status: httpstatustext.SUCCESS,
      message:
        'Group registration created. All 5 members have accounts. Only the leader can pay.',
      data: {
        token,
        student: sanitizeStudent(leader),
        registration,
        groupMembers,
        paymentNote:
          'Only the group leader can complete payment. After payment is confirmed, all 5 members can access lectures.',
      },
    });
  }

  // ---------- Individual registration ----------
  const existingEmail = await CourseStudent.findOne({ email: email.toLowerCase() });
  if (existingEmail) {
    return next(
      AppError.create('Email is already registered for the course', 400, httpstatustext.FAIL)
    );
  }

  const existingPhone = await CourseStudent.findOne({ phone });
  if (existingPhone) {
    return next(
      AppError.create(
        'Phone number is already registered for the course',
        400,
        httpstatustext.FAIL
      )
    );
  }

  const hashedPassword = await bcrypt.hash(password, 7);

  const student = await CourseStudent.create({
    fullName,
    email: email.toLowerCase(),
    phone,
    password: hashedPassword,
  });

  let registration;
  try {
    const result = await createRegistrationFromRequest({
      studentId: student._id,
      body: req.body,
      files: req.files,
      file: req.file,
    });
    registration = result.registration;
  } catch (error) {
    await CourseStudent.findByIdAndDelete(student._id);
    return next(error);
  }

  const token = signCourseStudentToken(student);

  notifyAccountCreated(student).catch(() => {});
  notifyRegistrationCreated(student, registration).catch(() => {});

  res.status(201).json({
    status: httpstatustext.SUCCESS,
    message: 'Account and course registration created successfully',
    data: {
      token,
      student: sanitizeStudent(student),
      registration,
    },
  });
});

/**
 * POST /api/course/auth/login
 */
const login = asyncwrapper(async (req, res, next) => {
  const { email, password } = req.body;

  const student = await CourseStudent.findOne({ email: email.toLowerCase() }).select(
    '+password'
  );
  if (!student) {
    return next(AppError.create('Invalid email or password', 401, httpstatustext.FAIL));
  }

  if (!student.isActive) {
    return next(
      AppError.create('Account is disabled. Contact support.', 403, httpstatustext.FAIL)
    );
  }

  const matched = await bcrypt.compare(password, student.password);
  if (!matched) {
    return next(AppError.create('Invalid email or password', 401, httpstatustext.FAIL));
  }

  student.lastLoginAt = new Date();
  await student.save();

  const token = signCourseStudentToken(student);

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: {
      token,
      student: sanitizeStudent(student),
    },
  });
});

/**
 * POST /api/course/auth/logout
 */
const logout = asyncwrapper(async (_req, res) => {
  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message: 'Logged out successfully',
  });
});

/**
 * GET /api/course/auth/me
 */
const me = asyncwrapper(async (req, res, next) => {
  const student = await CourseStudent.findById(req.courseStudent.id);
  if (!student) {
    return next(AppError.create('Course student not found', 404, httpstatustext.FAIL));
  }

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { student: sanitizeStudent(student) },
  });
});

module.exports = {
  register,
  login,
  logout,
  me,
};
