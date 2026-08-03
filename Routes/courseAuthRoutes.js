const express = require('express');
const router = express.Router();
const courseAuthController = require('../Controllers/courseAuth.controller');
const authenticateCourseStudent = require('../middleware/authenticateCourseStudent');
const {
  courseRegisterValidation,
  courseLoginValidation,
} = require('../middleware/course.validation');
const { uploadRegistrationFiles } = require('../middleware/courseUpload');

/**
 * Single registration:
 * account + category + documents in one multipart request
 */
router.post(
  '/register',
  uploadRegistrationFiles.fields([
    { name: 'verificationDocument', maxCount: 1 },
    { name: 'participantDocuments', maxCount: 5 },
  ]),
  courseRegisterValidation,
  courseAuthController.register
);

router.post('/login', courseLoginValidation, courseAuthController.login);
router.post('/logout', authenticateCourseStudent, courseAuthController.logout);
router.get('/me', authenticateCourseStudent, courseAuthController.me);

module.exports = router;
