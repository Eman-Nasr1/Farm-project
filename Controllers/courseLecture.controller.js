const CourseLecture = require('../Models/courseLecture.model');
const asyncwrapper = require('../middleware/asyncwrapper');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const { studentHasLectureAccess } = require('../services/courseService');

/**
 * GET /api/course/lectures
 * Only paid + confirmed students receive published lecture links.
 */
const getPublishedLectures = asyncwrapper(async (req, res, next) => {
  const access = await studentHasLectureAccess(req.courseStudent.id);

  if (!access.allowed) {
    return next(
      AppError.create(
        'Lecture access requires a confirmed registration with an approved payment',
        403,
        httpstatustext.FAIL
      )
    );
  }

  const lectures = await CourseLecture.find({ isPublished: true })
    .sort({ lectureDate: 1, createdAt: -1 })
    .select('title description lectureUrl platform lectureDate isPublished createdAt');

  res.status(200).json({
    status: httpstatustext.SUCCESS,
    message:
      lectures.length === 0
        ? 'The lecture link will be available soon.'
        : undefined,
    data: { lectures },
  });
});

module.exports = {
  getPublishedLectures,
};
