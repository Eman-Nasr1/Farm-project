const CourseRegistration = require('../Models/courseRegistration.model');

/**
 * Generate a readable booking code: COURSE-YYYY-NNNNN
 */
async function generateBookingCode() {
  const year = new Date().getFullYear();
  const prefix = `COURSE-${year}-`;

  const latest = await CourseRegistration.findOne({
    bookingCode: new RegExp(`^${prefix}`),
  })
    .sort({ bookingCode: -1 })
    .select('bookingCode')
    .lean();

  let nextNumber = 1;
  if (latest?.bookingCode) {
    const parts = latest.bookingCode.split('-');
    const last = parseInt(parts[2], 10);
    if (!Number.isNaN(last)) {
      nextNumber = last + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(5, '0')}`;
}

module.exports = { generateBookingCode };
