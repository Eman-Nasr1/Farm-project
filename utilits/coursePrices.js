/**
 * Course registration category prices (EGP).
 * Backend is the only source of truth for pricing.
 */
const COURSE_PRICES = Object.freeze({
  breeder: 995,
  doctor_engineer: 895,
  student: 495,
  student_group: 2000,
});

const COURSE_CATEGORIES = Object.freeze(Object.keys(COURSE_PRICES));

const COURSE_CATEGORY_LABELS = Object.freeze({
  breeder: 'Breeder',
  doctor_engineer: 'Doctor / Engineer',
  student: 'Student',
  student_group: 'Group of 5 Students',
});

/**
 * @param {string} category
 * @returns {number}
 */
function getCoursePrice(category) {
  if (!COURSE_PRICES[category]) {
    throw new Error(`Invalid course category: ${category}`);
  }
  return COURSE_PRICES[category];
}

/**
 * Convert EGP amount to Paymob amount_cents (piasters).
 * @param {number} amountEgp
 * @returns {number}
 */
function toAmountCents(amountEgp) {
  return Math.round(Number(amountEgp) * 100);
}

module.exports = {
  COURSE_PRICES,
  COURSE_CATEGORIES,
  COURSE_CATEGORY_LABELS,
  getCoursePrice,
  toAmountCents,
};
