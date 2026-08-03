const express = require('express');
const router = express.Router();
const courseRegistrationController = require('../Controllers/courseRegistration.controller');
const authenticateCourseStudent = require('../middleware/authenticateCourseStudent');
const { courseRegistrationValidation } = require('../middleware/course.validation');
const { uploadRegistrationFiles } = require('../middleware/courseUpload');

router.post(
  '/',
  authenticateCourseStudent,
  uploadRegistrationFiles.fields([
    { name: 'verificationDocument', maxCount: 1 },
    { name: 'participantDocuments', maxCount: 5 },
  ]),
  courseRegistrationValidation,
  courseRegistrationController.createRegistration
);

router.get(
  '/me',
  authenticateCourseStudent,
  courseRegistrationController.getMyRegistration
);

module.exports = router;
