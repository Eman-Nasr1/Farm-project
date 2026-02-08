/**
 * Permission Constants
 * 
 * All available permissions in the system.
 * Format: resource.action (e.g., animals.read, treatments.create)
 */

const PERMISSIONS = {
  // Animals
  ANIMALS_READ: 'animals.read',
  ANIMALS_CREATE: 'animals.create',
  ANIMALS_UPDATE: 'animals.update',
  ANIMALS_DELETE: 'animals.delete',
  ANIMALS_COST: 'animals.cost',

  // Treatments
  TREATMENTS_READ: 'treatments.read',
  TREATMENTS_CREATE: 'treatments.create',
  TREATMENTS_UPDATE: 'treatments.update',
  TREATMENTS_DELETE: 'treatments.delete',

  // Vaccines
  VACCINES_READ: 'vaccines.read',
  VACCINES_CREATE: 'vaccines.create',
  VACCINES_UPDATE: 'vaccines.update',
  VACCINES_DELETE: 'vaccines.delete',

  // Feed
  FEED_READ: 'feed.read',
  FEED_CREATE: 'feed.create',
  FEED_UPDATE: 'feed.update',
  FEED_DELETE: 'feed.delete',

  // Breeding
  BREEDING_READ: 'breeding.read',
  BREEDING_CREATE: 'breeding.create',
  BREEDING_UPDATE: 'breeding.update',
  BREEDING_DELETE: 'breeding.delete',

  // Mating
  MATING_READ: 'mating.read',
  MATING_CREATE: 'mating.create',
  MATING_UPDATE: 'mating.update',
  MATING_DELETE: 'mating.delete',

  // Weight
  WEIGHT_READ: 'weight.read',
  WEIGHT_CREATE: 'weight.create',
  WEIGHT_UPDATE: 'weight.update',
  WEIGHT_DELETE: 'weight.delete',

  // Reports
  REPORTS_VIEW: 'reports.view',

  // Employees
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_MANAGE: 'employees.manage',

  // Roles
  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',

  // Settings
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',

  // Statistics
  STATISTICS_VIEW: 'statistics.view',

  // Excluded
  EXCLUDED_READ: 'excluded.read',
  EXCLUDED_CREATE: 'excluded.create',
  EXCLUDED_UPDATE: 'excluded.update',
  EXCLUDED_DELETE: 'excluded.delete',

  // Support Tickets
  SUPPORT_READ: 'support.read',
  SUPPORT_MANAGE: 'support.manage',
};

// Get all permission keys as array
const getAllPermissions = () => Object.values(PERMISSIONS);

// Default role permissions
const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: getAllPermissions(), // All permissions
  MANAGER: [
    PERMISSIONS.ANIMALS_READ,
    PERMISSIONS.ANIMALS_CREATE,
    PERMISSIONS.ANIMALS_UPDATE,
    PERMISSIONS.ANIMALS_COST,
    PERMISSIONS.TREATMENTS_READ,
    PERMISSIONS.TREATMENTS_CREATE,
    PERMISSIONS.TREATMENTS_UPDATE,
    PERMISSIONS.VACCINES_READ,
    PERMISSIONS.VACCINES_CREATE,
    PERMISSIONS.VACCINES_UPDATE,
    PERMISSIONS.FEED_READ,
    PERMISSIONS.FEED_CREATE,
    PERMISSIONS.FEED_UPDATE,
    PERMISSIONS.BREEDING_READ,
    PERMISSIONS.BREEDING_CREATE,
    PERMISSIONS.BREEDING_UPDATE,
    PERMISSIONS.MATING_READ,
    PERMISSIONS.MATING_CREATE,
    PERMISSIONS.MATING_UPDATE,
    PERMISSIONS.WEIGHT_READ,
    PERMISSIONS.WEIGHT_CREATE,
    PERMISSIONS.WEIGHT_UPDATE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.STATISTICS_VIEW,
    PERMISSIONS.EMPLOYEES_READ,
    PERMISSIONS.EXCLUDED_READ,
    PERMISSIONS.EXCLUDED_CREATE,
    PERMISSIONS.EXCLUDED_UPDATE,
    PERMISSIONS.SUPPORT_READ,
    PERMISSIONS.SUPPORT_MANAGE,
  ],
  EMPLOYEE: [
    PERMISSIONS.ANIMALS_READ,
    PERMISSIONS.TREATMENTS_READ,
    PERMISSIONS.VACCINES_READ,
    PERMISSIONS.FEED_READ,
    PERMISSIONS.BREEDING_READ,
    PERMISSIONS.MATING_READ,
    PERMISSIONS.WEIGHT_READ,
    PERMISSIONS.EXCLUDED_READ,
  ],
};

module.exports = {
  PERMISSIONS,
  getAllPermissions,
  DEFAULT_ROLE_PERMISSIONS,
};
