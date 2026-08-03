const express = require('express');
const router = express.Router();
const verifytoken = require('../middleware/verifytoken');
const requireAdmin = require('../middleware/requireAdmin');
const adminCourseController = require('../Controllers/adminCourse.controller');
const courseFileController = require('../Controllers/courseFile.controller');
const {
  rejectPaymentValidation,
  lectureValidation,
  mongoIdParam,
} = require('../middleware/course.validation');

router.use(verifytoken, requireAdmin);

router.get('/dashboard', adminCourseController.getDashboard);

router.get('/students', adminCourseController.listStudents);
router.patch('/students/:id/status', ...mongoIdParam('id'), adminCourseController.setStudentActive);

router.get('/registrations', adminCourseController.listRegistrations);
router.get('/registrations/:id', ...mongoIdParam('id'), adminCourseController.getRegistration);
router.patch('/registrations/:id/confirm', ...mongoIdParam('id'), adminCourseController.confirmRegistration);
router.patch('/registrations/:id/reject', ...mongoIdParam('id'), adminCourseController.rejectRegistration);
router.patch('/registrations/:id/attendance', ...mongoIdParam('id'), adminCourseController.markAttendance);
router.patch(
  '/registrations/:id/remove-attendance',
  ...mongoIdParam('id'),
  adminCourseController.removeAttendance
);

router.get('/payments', adminCourseController.listPayments);
router.get('/payments/:id', ...mongoIdParam('id'), adminCourseController.getPayment);
router.patch('/payments/:id/approve', ...mongoIdParam('id'), adminCourseController.approvePayment);
router.patch(
  '/payments/:id/reject',
  ...mongoIdParam('id'),
  rejectPaymentValidation,
  adminCourseController.rejectPayment
);
router.patch('/payments/:id/refund', ...mongoIdParam('id'), adminCourseController.refundPayment);

router.get('/payments/:id/receipt', ...mongoIdParam('id'), courseFileController.adminGetPaymentReceipt);
router.get(
  '/registrations/:id/document',
  ...mongoIdParam('id'),
  courseFileController.adminGetRegistrationDocument
);
router.get(
  '/registrations/:id/participants/:participantId/document',
  ...mongoIdParam('id'),
  courseFileController.adminGetParticipantDocument
);

router.get('/lectures', adminCourseController.listLectures);
router.post('/lectures', lectureValidation, adminCourseController.createLecture);
router.put('/lectures/:id', ...mongoIdParam('id'), lectureValidation, adminCourseController.updateLecture);
router.delete('/lectures/:id', ...mongoIdParam('id'), adminCourseController.deleteLecture);
router.patch('/lectures/:id/publish', ...mongoIdParam('id'), adminCourseController.publishLecture);
router.patch('/lectures/:id/unpublish', ...mongoIdParam('id'), adminCourseController.unpublishLecture);

router.get('/payment-settings', adminCourseController.getPaymentSettings);
router.put('/payment-settings', adminCourseController.updatePaymentSettings);

module.exports = router;
