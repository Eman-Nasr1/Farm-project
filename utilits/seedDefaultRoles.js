/**
 * Seed Default Roles for New Tenant
 * 
 * Creates Owner, Manager, and Employee roles when a new tenant (User) is created.
 * These are system roles that cannot be deleted.
 */

const Role = require('../Models/role.model');
const { DEFAULT_ROLE_PERMISSIONS } = require('./permissions');

/**
 * Seed default roles for a tenant
 * @param {ObjectId} tenantId - The User ID (tenant ID)
 * @returns {Promise<Array>} Array of created roles
 */
async function seedDefaultRoles(tenantId) {
  const defaultRoles = [
    {
      user: tenantId,
      name: 'Owner',
      key: 'owner',
      permissionKeys: DEFAULT_ROLE_PERMISSIONS.OWNER,
      description: 'Full access to all features',
      isSystem: true,
    },
    {
      user: tenantId,
      name: 'Manager',
      key: 'manager',
      permissionKeys: DEFAULT_ROLE_PERMISSIONS.MANAGER,
      description: 'Can manage most operations except system settings',
      isSystem: true,
    },
    {
      user: tenantId,
      name: 'Employee',
      key: 'employee',
      permissionKeys: DEFAULT_ROLE_PERMISSIONS.EMPLOYEE,
      description: 'Read-only access to basic features',
      isSystem: true,
    },
  ];

  // Check if roles already exist
  const existingRoles = await Role.find({ user: tenantId, isSystem: true });
  if (existingRoles.length > 0) {
    // Roles already seeded
    return existingRoles;
  }

  // Create roles
  const createdRoles = await Role.insertMany(defaultRoles);
  return createdRoles;
}

module.exports = { seedDefaultRoles };
