const Role = require('../Models/role.model');
const Employee = require('../Models/employee.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const { PERMISSIONS, getAllPermissions } = require('../utilits/permissions');

// Create role (requires roles.manage permission)
const createRole = asyncwrapper(async (req, res, next) => {
    const { name, key, permissionKeys, description } = req.body;
    const tenantId = req.user.tenantId || req.user.id;

    if (!name || !key) {
        return next(AppError.create('Name and key are required', 400, httpstatustext.FAIL));
    }

    // Validate permission keys
    const allPermissions = getAllPermissions();
    if (permissionKeys && permissionKeys.some(p => !allPermissions.includes(p))) {
        return next(AppError.create('Invalid permission key(s)', 400, httpstatustext.FAIL));
    }

    // Check if role key already exists for this tenant
    const existingRole = await Role.findOne({ user: tenantId, key: key.toLowerCase() });
    if (existingRole) {
        return next(AppError.create('Role with this key already exists', 400, httpstatustext.FAIL));
    }

    const newRole = new Role({
        user: tenantId,
        name,
        key: key.toLowerCase(),
        permissionKeys: permissionKeys || [],
        description: description || '',
        isSystem: false,
    });

    await newRole.save();

    res.status(201).json({
        status: httpstatustext.SUCCESS,
        data: { role: newRole },
    });
});

// Get all roles for tenant
const getAllRoles = asyncwrapper(async (req, res, next) => {
    const tenantId = req.user.tenantId || req.user.id;

    const roles = await Role.find({ user: tenantId })
        .sort({ isSystem: -1, createdAt: -1 });

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { roles },
    });
});

// Get single role
const getRole = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.id;

    const role = await Role.findOne({ _id: id, user: tenantId });
    if (!role) {
        return next(AppError.create('Role not found', 404, httpstatustext.FAIL));
    }

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { role },
    });
});

// Update role
const updateRole = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const { name, permissionKeys, description } = req.body;
    const tenantId = req.user.tenantId || req.user.id;

    const role = await Role.findOne({ _id: id, user: tenantId });
    if (!role) {
        return next(AppError.create('Role not found', 404, httpstatustext.FAIL));
    }

    // Prevent updating system roles
    if (role.isSystem) {
        return next(AppError.create('System roles cannot be modified', 403, httpstatustext.FAIL));
    }

    // Validate permission keys
    if (permissionKeys) {
        const allPermissions = getAllPermissions();
        if (permissionKeys.some(p => !allPermissions.includes(p))) {
            return next(AppError.create('Invalid permission key(s)', 400, httpstatustext.FAIL));
        }
        role.permissionKeys = permissionKeys;
    }

    if (name) role.name = name;
    if (description !== undefined) role.description = description;

    await role.save();

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { role },
    });
});

// Delete role
const deleteRole = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.id;

    const role = await Role.findOne({ _id: id, user: tenantId });
    if (!role) {
        return next(AppError.create('Role not found', 404, httpstatustext.FAIL));
    }

    // Prevent deleting system roles
    if (role.isSystem) {
        return next(AppError.create('System roles cannot be deleted', 403, httpstatustext.FAIL));
    }

    // Check if any employees are using this role
    const employeesUsingRole = await Employee.countDocuments({
        user: tenantId,
        roleIds: id,
    });

    if (employeesUsingRole > 0) {
        return next(AppError.create(
            `Cannot delete role. ${employeesUsingRole} employee(s) are assigned to this role`,
            400,
            httpstatustext.FAIL
        ));
    }

    await Role.findByIdAndDelete(id);

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: null,
    });
});

// Get all available permissions (for frontend)
const getAvailablePermissions = asyncwrapper(async (req, res, next) => {
    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: {
            permissions: getAllPermissions(),
            permissionGroups: {
                animals: [
                    PERMISSIONS.ANIMALS_READ,
                    PERMISSIONS.ANIMALS_CREATE,
                    PERMISSIONS.ANIMALS_UPDATE,
                    PERMISSIONS.ANIMALS_DELETE,
                ],
                treatments: [
                    PERMISSIONS.TREATMENTS_READ,
                    PERMISSIONS.TREATMENTS_CREATE,
                    PERMISSIONS.TREATMENTS_UPDATE,
                    PERMISSIONS.TREATMENTS_DELETE,
                ],
                vaccines: [
                    PERMISSIONS.VACCINES_READ,
                    PERMISSIONS.VACCINES_CREATE,
                    PERMISSIONS.VACCINES_UPDATE,
                    PERMISSIONS.VACCINES_DELETE,
                ],
                feed: [
                    PERMISSIONS.FEED_READ,
                    PERMISSIONS.FEED_CREATE,
                    PERMISSIONS.FEED_UPDATE,
                    PERMISSIONS.FEED_DELETE,
                ],
                breeding: [
                    PERMISSIONS.BREEDING_READ,
                    PERMISSIONS.BREEDING_CREATE,
                    PERMISSIONS.BREEDING_UPDATE,
                    PERMISSIONS.BREEDING_DELETE,
                ],
                mating: [
                    PERMISSIONS.MATING_READ,
                    PERMISSIONS.MATING_CREATE,
                    PERMISSIONS.MATING_UPDATE,
                    PERMISSIONS.MATING_DELETE,
                ],
                weight: [
                    PERMISSIONS.WEIGHT_READ,
                    PERMISSIONS.WEIGHT_CREATE,
                    PERMISSIONS.WEIGHT_UPDATE,
                    PERMISSIONS.WEIGHT_DELETE,
                ],
                reports: [PERMISSIONS.REPORTS_VIEW],
                statistics: [PERMISSIONS.STATISTICS_VIEW],
                employees: [
                    PERMISSIONS.EMPLOYEES_READ,
                    PERMISSIONS.EMPLOYEES_MANAGE,
                ],
                roles: [
                    PERMISSIONS.ROLES_READ,
                    PERMISSIONS.ROLES_MANAGE,
                ],
                settings: [
                    PERMISSIONS.SETTINGS_READ,
                    PERMISSIONS.SETTINGS_MANAGE,
                ],
            },
        },
    });
});

module.exports = {
    createRole,
    getAllRoles,
    getRole,
    updateRole,
    deleteRole,
    getAvailablePermissions,
};
