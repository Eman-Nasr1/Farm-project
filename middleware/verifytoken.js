const jwt = require('jsonwebtoken');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

module.exports = function verifyToken(req, res, next) {
  const raw = req.headers['authorization'];
  if (!raw) return next(AppError.create('Token is required', 401, httpstatustext.ERROR));

  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
  if (!token) return next(AppError.create('Token is missing', 401, httpstatustext.ERROR));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const id = decoded.id || decoded.userId;
    if (!id) return next(AppError.create('Token payload missing user id', 401, httpstatustext.ERROR));

    req.user = {
      id,
      email: decoded.email || null,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      isAdmin: decoded.role === 'admin',
    };
    next();
  } catch {
    return next(AppError.create('Token is invalid', 401, httpstatustext.ERROR));
  }
};
