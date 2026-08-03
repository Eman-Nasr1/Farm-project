const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

/**
 * Require an authenticated farm admin (existing User with role=admin).
 * Uses verifytoken first so req.user is populated.
 */
module.exports = function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(AppError.create('Authentication required', 401, httpstatustext.ERROR));
  }

  if (req.user.role !== 'admin' && !req.user.isAdmin) {
    return next(AppError.create('Admin access only', 403, httpstatustext.ERROR));
  }

  next();
};
