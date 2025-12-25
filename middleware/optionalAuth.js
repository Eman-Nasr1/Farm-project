/**
 * Optional Authentication Middleware
 * 
 * Validates JWT token if present, but doesn't fail if missing.
 * Sets req.user if token is valid, otherwise continues without error.
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
    const id = decoded.id || decoded.userId;
    
    if (id) {
      req.user = {
        id,
        email: decoded.email || null,
        role: decoded.role || 'user',
        permissions: decoded.permissions || [],
        isAdmin: decoded.role === 'admin',
      };
    }
  } catch (error) {
    // Invalid token - continue without setting req.user (don't fail)
    // This allows anonymous access
  }
  
  next();
};
