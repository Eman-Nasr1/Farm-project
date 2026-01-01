/**
 * Compute Effective Permissions for Employee
 * 
 * effective = union(role.permissionKeys for all roleIds) + extraPermissions - deniedPermissions
 */

const Role = require('../Models/role.model');

/**
 * Compute effective permissions for an employee
 * @param {Object} employee - Employee document with roleIds, extraPermissions, deniedPermissions
 * @returns {Promise<Array<string>>} Array of effective permission keys
 */
async function computeEffectivePermissions(employee) {
  // If no roles assigned, return only extra permissions (minus denied)
  if (!employee.roleIds || employee.roleIds.length === 0) {
    return employee.extraPermissions?.filter(p => !employee.deniedPermissions?.includes(p)) || [];
  }

  // Fetch all roles for the employee
  const roles = await Role.find({
    _id: { $in: employee.roleIds },
    user: employee.user, // Ensure tenant isolation
  }).select('permissionKeys');

  // Collect all permissions from roles
  const rolePermissions = new Set();
  roles.forEach(role => {
    if (role.permissionKeys && Array.isArray(role.permissionKeys)) {
      role.permissionKeys.forEach(perm => rolePermissions.add(perm));
    }
  });

  // Add extra permissions
  if (employee.extraPermissions && Array.isArray(employee.extraPermissions)) {
    employee.extraPermissions.forEach(perm => rolePermissions.add(perm));
  }

  // Remove denied permissions
  if (employee.deniedPermissions && Array.isArray(employee.deniedPermissions)) {
    employee.deniedPermissions.forEach(perm => rolePermissions.delete(perm));
  }

  return Array.from(rolePermissions);
}

module.exports = { computeEffectivePermissions };
