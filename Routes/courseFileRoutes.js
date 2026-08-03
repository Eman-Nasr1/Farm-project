const express = require('express');
const router = express.Router();
const courseFileController = require('../Controllers/courseFile.controller');
const authenticateCourseStudent = require('../middleware/authenticateCourseStudent');

router.get(
  '/verification-document',
  authenticateCourseStudent,
  courseFileController.getMyVerificationDocument
);

router.get(
  '/receipt',
  authenticateCourseStudent,
  courseFileController.getMyReceipt
);

module.exports = router;
