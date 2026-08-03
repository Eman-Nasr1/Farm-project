const express = require('express');
const router = express.Router();
const courseLectureController = require('../Controllers/courseLecture.controller');
const authenticateCourseStudent = require('../middleware/authenticateCourseStudent');

router.get(
  '/',
  authenticateCourseStudent,
  courseLectureController.getPublishedLectures
);

module.exports = router;
