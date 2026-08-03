/**
 * Optional course student auth — attaches req.courseStudent when token is valid,
 * otherwise continues without error (for public payment-methods endpoint).
 */
const jwt = require('jsonwebtoken');
const CourseStudent = require('../Models/courseStudent.model');

module.exports = async function optionalCourseStudent(req, _res, next) {
  try {
    const raw = req.headers.authorization;
    if (!raw) return next();

    const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    if (decoded.accountType !== 'course_student') return next();

    const studentId = decoded.id || decoded.studentId;
    if (!studentId) return next();

    const student = await CourseStudent.findById(studentId);
    if (!student || !student.isActive) return next();

    req.courseStudent = {
      id: student._id,
      email: student.email,
      fullName: student.fullName,
      phone: student.phone,
      accountType: 'course_student',
    };
  } catch {
    // ignore invalid tokens for optional auth
  }
  next();
};
