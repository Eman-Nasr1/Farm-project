const Employee = require('../Models/employee.model');
const User = require('../Models/user.model');
const Role = require('../Models/role.model');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { computeEffectivePermissions } = require('../utilits/computePermissions');

// Create employee (requires employees.manage permission)
const createEmployee = asyncwrapper(async (req, res, next) => {
    const { name, email, password, phone, roleIds, extraPermissions, deniedPermissions } = req.body;
    const tenantId = req.user.tenantId || req.user.id; // Tenant ID

    // Validate required fields
    if (!name || !email || !password || !phone) {
        return next(AppError.create('Name, email, password, and phone are required', 400, httpstatustext.FAIL));
    }

    // Check if employee already exists for this tenant
    const existingEmployee = await Employee.findOne({ user: tenantId, email });
    if (existingEmployee) {
        return next(AppError.create('Employee with this email already exists', 400, httpstatustext.FAIL));
    }

    // Validate roleIds belong to the same tenant
    if (roleIds && roleIds.length > 0) {
        const roles = await Role.find({ _id: { $in: roleIds }, user: tenantId });
        if (roles.length !== roleIds.length) {
            return next(AppError.create('One or more roles not found or belong to different tenant', 400, httpstatustext.FAIL));
        }
    }

    // Create the new employee
    const newEmployee = new Employee({
        user: tenantId,
        name,
        email,
        password,
        phone,
        roleIds: roleIds || [],
        extraPermissions: extraPermissions || [],
        deniedPermissions: deniedPermissions || [],
    });

    await newEmployee.save();

    // Populate roles for response
    await newEmployee.populate('roleIds', 'name key');

    res.status(201).json({
        status: httpstatustext.SUCCESS,
        data: { employee: newEmployee },
    });
});

// Get all employees for tenant
const getAllEmployees = asyncwrapper(async (req, res, next) => {
    const tenantId = req.user.tenantId || req.user.id;

    const employees = await Employee.find({ user: tenantId })
        .populate('roleIds', 'name key permissionKeys')
        .select('-password')
        .sort({ createdAt: -1 });

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { employees },
    });
});

// Get single employee
const getEmployee = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.id;

    const employee = await Employee.findOne({ _id: id, user: tenantId })
        .populate('roleIds', 'name key permissionKeys')
        .select('-password');

    if (!employee) {
        return next(AppError.create('Employee not found', 404, httpstatustext.FAIL));
    }

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { employee },
    });
});

// Update employee roles
const updateEmployeeRoles = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const { roleIds, extraPermissions, deniedPermissions } = req.body;
    const tenantId = req.user.tenantId || req.user.id;

    const employee = await Employee.findOne({ _id: id, user: tenantId });
    if (!employee) {
        return next(AppError.create('Employee not found', 404, httpstatustext.FAIL));
    }

    // Validate roleIds belong to the same tenant
    if (roleIds && roleIds.length > 0) {
        const roles = await Role.find({ _id: { $in: roleIds }, user: tenantId });
        if (roles.length !== roleIds.length) {
            return next(AppError.create('One or more roles not found or belong to different tenant', 400, httpstatustext.FAIL));
        }
        employee.roleIds = roleIds;
    }

    if (extraPermissions !== undefined) {
        employee.extraPermissions = extraPermissions;
    }

    if (deniedPermissions !== undefined) {
        employee.deniedPermissions = deniedPermissions;
    }

    await employee.save();
    await employee.populate('roleIds', 'name key permissionKeys');

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { employee },
    });
});

// Update employee (general update)
const updateEmployee = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const { name, email, phone, isActive } = req.body;
    const tenantId = req.user.tenantId || req.user.id;

    const employee = await Employee.findOne({ _id: id, user: tenantId });
    if (!employee) {
        return next(AppError.create('Employee not found', 404, httpstatustext.FAIL));
    }

    if (name) employee.name = name;
    if (phone) employee.phone = phone;
    if (isActive !== undefined) employee.isActive = isActive;

    // Check email uniqueness within tenant if changing email
    if (email && email !== employee.email) {
        const existing = await Employee.findOne({ user: tenantId, email });
        if (existing) {
            return next(AppError.create('Email already in use by another employee', 400, httpstatustext.FAIL));
        }
        employee.email = email;
    }

    await employee.save();
    await employee.populate('roleIds', 'name key');

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: { employee },
    });
});

// Delete employee
const deleteEmployee = asyncwrapper(async (req, res, next) => {
    const { id } = req.params;
    const tenantId = req.user.tenantId || req.user.id;

    const employee = await Employee.findOneAndDelete({ _id: id, user: tenantId });
    if (!employee) {
        return next(AppError.create('Employee not found', 404, httpstatustext.FAIL));
    }

    res.status(200).json({
        status: httpstatustext.SUCCESS,
        data: null,
    });
});

module.exports = {
    createEmployee,
    getAllEmployees,
    getEmployee,
    updateEmployee,
    updateEmployeeRoles,
    deleteEmployee,
};
