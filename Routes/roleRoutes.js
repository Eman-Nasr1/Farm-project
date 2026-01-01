const express = require('express');
const router = express.Router();
const roleController = require('../Controllers/role.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Get available permissions (public for authenticated users)
router.get('/api/permissions', verifytoken, roleController.getAvailablePermissions);

// Role CRUD operations (require roles.manage permission)
router.get('/api/roles', verifytoken, authorize(PERMISSIONS.ROLES_READ), roleController.getAllRoles);
router.get('/api/roles/:id', verifytoken, authorize(PERMISSIONS.ROLES_READ), roleController.getRole);
router.post('/api/roles', verifytoken, authorize(PERMISSIONS.ROLES_MANAGE), roleController.createRole);
router.patch('/api/roles/:id', verifytoken, authorize(PERMISSIONS.ROLES_MANAGE), roleController.updateRole);
router.delete('/api/roles/:id', verifytoken, authorize(PERMISSIONS.ROLES_MANAGE), roleController.deleteRole);

module.exports = router;
