const AppError = require('../utilits/AppError');

module.exports = (...roles) => {
  return (req, res, next) => {
    if (!req.user?.role) return next(AppError.create('Missing role on request', 401));
    if (!roles.includes(req.user.role)) return next(AppError.create('the role not valid', 403));
    next();
  };
};
