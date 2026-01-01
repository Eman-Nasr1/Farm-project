/**
 * Authorization Middleware
 * 
 * Checks if the user has the required permission.
 * Usage: authorize('animals.create')
 * 
 * Special rule: If permissions includes "*", user has all permissions (owner)
 */

const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');

const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return next(AppError.create('Authentication required', 401, httpstatustext.FAIL));
    }

    // Check if user has tenantId (for tenant isolation)
    if (!req.user.tenantId) {
      return next(AppError.create('Tenant ID is required', 403, httpstatustext.FAIL));
    }

    // Get user permissions (from JWT or computed)
    const userPermissions = req.user.permissions || [];

    // Special case: "*" means all permissions (owner)
    if (userPermissions.includes('*')) {
      return next(); // Owner has access to everything
    }

    // Check if user has at least one of the required permissions
    const hasPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return next(AppError.create(
        `Access denied. Required permission(s): ${requiredPermissions.join(', ')}`,
        403,
        httpstatustext.FAIL
      ));
    }

    next();
  };
};

module.exports = authorize;
