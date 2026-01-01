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
    
    // Extract ID: employeeId takes precedence, then id, then userId
    const id = decoded.employeeId || decoded.id || decoded.userId;
    if (!id) return next(AppError.create('Token payload missing user id', 401, httpstatustext.ERROR));

    // tenantId MUST always be present (owner's ID)
    // For owners: tenantId = id
    // For employees: tenantId is separate (owner's ID)
    const tenantId = decoded.tenantId;
    if (!tenantId) return next(AppError.create('Token payload missing tenantId', 401, httpstatustext.ERROR));

    const accountType = decoded.accountType || (decoded.employeeId ? 'employee' : 'owner');
    const employeeId = decoded.employeeId || null;

    req.user = {
      id, // Logged-in subject ID (owner ID or employee ID)
      employeeId, // Employee ID if logged in as employee (null for owners)
      tenantId, // ALWAYS the owner's ID (for tenant isolation)
      accountType, // 'owner' or 'employee'
      email: decoded.email || null,
      role: decoded.role || 'user',
      permissions: decoded.permissions || [],
      isAdmin: decoded.role === 'admin',
      isEmployee: accountType === 'employee',
      isOwner: accountType === 'owner',
    };
    next();
  } catch {
    return next(AppError.create('Token is invalid', 401, httpstatustext.ERROR));
  }
};
