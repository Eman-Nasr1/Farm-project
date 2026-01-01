const express = require('express');
const router = express.Router();
const employeeController = require('../Controllers/employee.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Note: Employee login is now handled by POST /api/auth/login (unified endpoint)
// Employee login requires: email, password, farmCode

// Protected routes - require authentication
router.get('/api/employees', verifytoken, authorize(PERMISSIONS.EMPLOYEES_READ), employeeController.getAllEmployees);
router.get('/api/employees/:id', verifytoken, authorize(PERMISSIONS.EMPLOYEES_READ), employeeController.getEmployee);
router.post('/api/employees', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), employeeController.createEmployee);
router.patch('/api/employees/:id', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), employeeController.updateEmployee);
router.patch('/api/employees/:id/roles', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), employeeController.updateEmployeeRoles);
router.delete('/api/employees/:id', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), employeeController.deleteEmployee);

module.exports = router;