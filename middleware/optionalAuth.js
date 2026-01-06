/**
 * Optional Authentication Middleware
 * 
 * Validates JWT token if present, but doesn't fail if missing.
 * Sets req.user if token is valid, otherwise continues without error.
 * Compatible with verifytoken middleware structure (tenantId, accountType, etc.)
 */

const jwt = require('jsonwebtoken');

module.exports = function optionalAuth(req, res, next) {
  const raw = req.headers['authorization'];
  
  // If no authorization header, continue without setting req.user
  if (!raw) {
    return next();
  }

  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : raw.trim();
  
  // If token is empty, continue without error
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    
    // Extract ID: employeeId takes precedence, then id, then userId
    const id = decoded.employeeId || decoded.id || decoded.userId;
    if (!id) {
      return next(); // No ID in token, continue as anonymous
    }

    // tenantId MUST always be present (owner's ID)
    const tenantId = decoded.tenantId || decoded.id;
    if (!tenantId) {
      return next(); // No tenantId, continue as anonymous
    }

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
  } catch (error) {
    // Invalid token - continue without setting req.user (don't fail)
    // This allows anonymous access
  }
  
  next();
};
