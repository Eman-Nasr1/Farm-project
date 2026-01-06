# Using Permissions in Routes - Complete Guide

## 📋 Overview

This guide explains how to use the `authorize` middleware with permissions to protect routes in your Express.js application.

---

## 🔧 Setup

### 1. Import Required Modules

At the top of your route file:

```javascript
const express = require('express');
const router = express.Router();
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const yourController = require('../Controllers/your.controller');
```

---

## 📝 Basic Usage

### Single Permission

Protect a route with one permission:

```javascript
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getAnimals);
```

**How it works:**
1. `verifytoken` - Checks if user is authenticated
2. `authorize(PERMISSIONS.ANIMALS_READ)` - Checks if user has `animals.read` permission
3. If both pass → route handler executes
4. If permission missing → returns `403 Forbidden`

---

### Multiple Permissions (OR Logic)

Allow access if user has **at least one** of the permissions:

```javascript
router.post('/api/treatments', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_CREATE, PERMISSIONS.TREATMENTS_UPDATE), 
  treatmentController.createTreatment
);
```

**Note**: User needs **either** `treatments.create` **OR** `treatments.update` to access this route.

---

## 🎯 Complete Examples

### Example 1: Animal Routes

```javascript
const express = require('express');
const router = express.Router();
const animalController = require('../Controllers/animal.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Read operations - require read permission
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getAllAnimals);
router.get('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getAnimal);

// Create operation - require create permission
router.post('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_CREATE), animalController.createAnimal);

// Update operation - require update permission
router.patch('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_UPDATE), animalController.updateAnimal);

// Delete operation - require delete permission
router.delete('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_DELETE), animalController.deleteAnimal);

module.exports = router;
```

---

### Example 2: Treatment Routes

```javascript
const express = require('express');
const router = express.Router();
const treatmentController = require('../Controllers/treatment.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Read
router.get('/api/treatments', verifytoken, authorize(PERMISSIONS.TREATMENTS_READ), treatmentController.getTreatments);
router.get('/api/treatments/:id', verifytoken, authorize(PERMISSIONS.TREATMENTS_READ), treatmentController.getTreatment);

// Create
router.post('/api/treatments', verifytoken, authorize(PERMISSIONS.TREATMENTS_CREATE), treatmentController.createTreatment);

// Update (allow create OR update)
router.patch('/api/treatments/:id', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_UPDATE, PERMISSIONS.TREATMENTS_CREATE), 
  treatmentController.updateTreatment
);

// Delete
router.delete('/api/treatments/:id', verifytoken, authorize(PERMISSIONS.TREATMENTS_DELETE), treatmentController.deleteTreatment);

module.exports = router;
```

---

### Example 3: Mixed Routes (Public + Protected)

```javascript
const express = require('express');
const router = express.Router();
const animalController = require('../Controllers/animal.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const optionalAuth = require('../middleware/optionalAuth');

// Public route (no auth required)
router.get('/api/animals/public', animalController.getPublicAnimals);

// Optional auth (works with or without token)
router.get('/api/animals/scan/:token', optionalAuth, animalController.scanAnimal);

// Protected routes (auth + permission required)
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getAllAnimals);
router.post('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_CREATE), animalController.createAnimal);

module.exports = router;
```

---

## 🔐 Permission Types

### Read Operations
Use `*.read` permissions:
- `PERMISSIONS.ANIMALS_READ`
- `PERMISSIONS.TREATMENTS_READ`
- `PERMISSIONS.VACCINES_READ`
- etc.

### Create Operations
Use `*.create` permissions:
- `PERMISSIONS.ANIMALS_CREATE`
- `PERMISSIONS.TREATMENTS_CREATE`
- etc.

### Update Operations
Use `*.update` permissions:
- `PERMISSIONS.ANIMALS_UPDATE`
- `PERMISSIONS.TREATMENTS_UPDATE`
- etc.

### Delete Operations
Use `*.delete` permissions:
- `PERMISSIONS.ANIMALS_DELETE`
- `PERMISSIONS.TREATMENTS_DELETE`
- etc.

### Management Operations
Use `*.manage` permissions:
- `PERMISSIONS.EMPLOYEES_MANAGE` (create, update, delete employees)
- `PERMISSIONS.ROLES_MANAGE` (create, update, delete roles)
- `PERMISSIONS.SUPPORT_MANAGE` (manage support tickets)

---

## ⚠️ Important Rules

### 1. Middleware Order

**Always use `verifytoken` BEFORE `authorize`:**

```javascript
// ✅ Correct
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.getAnimals);

// ❌ Wrong - authorize needs req.user from verifytoken
router.get('/api/animals', authorize(PERMISSIONS.ANIMALS_READ), verifytoken, controller.getAnimals);
```

### 2. Owner Bypass

**Owners (with `"*"` permission) bypass all permission checks automatically.**

```javascript
// Owner can access this route even without explicit animals.read permission
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.getAnimals);
```

### 3. Tenant Isolation

**Always filter by `tenantId` in controllers:**

```javascript
// In controller
const getAllAnimals = asyncwrapper(async (req, res, next) => {
  const tenantId = req.user.tenantId; // ALWAYS use tenantId
  
  const animals = await Animal.find({ user: tenantId });
  // ...
});
```

---

## 📊 Real-World Examples

### Example 1: Complete Animal Routes with Permissions

```javascript
const express = require('express');
const router = express.Router();
const animalController = require('../Controllers/animal.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const optionalAuth = require('../middleware/optionalAuth');

// Public scan route
router.get('/api/scan/:token', optionalAuth, animalController.getAnimalByQrToken);

// Read operations
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getAllAnimals);
router.get('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getAnimal);
router.get('/api/animals/statistics', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.getStatistics);

// Create operation
router.post('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_CREATE), animalController.createAnimal);

// Update operation
router.patch('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_UPDATE), animalController.updateAnimal);

// Delete operation
router.delete('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_DELETE), animalController.deleteAnimal);

// Export (read permission)
router.get('/api/animals/export', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), animalController.exportAnimals);

// Import (create permission)
router.post('/api/animals/import', verifytoken, authorize(PERMISSIONS.ANIMALS_CREATE), animalController.importAnimals);

module.exports = router;
```

---

### Example 2: Treatment Routes with Multiple Permissions

```javascript
const express = require('express');
const router = express.Router();
const treatmentController = require('../Controllers/treatment.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Read
router.get('/api/treatments', verifytoken, authorize(PERMISSIONS.TREATMENTS_READ), treatmentController.getTreatments);
router.get('/api/treatments/:id', verifytoken, authorize(PERMISSIONS.TREATMENTS_READ), treatmentController.getTreatment);

// Create
router.post('/api/treatments', verifytoken, authorize(PERMISSIONS.TREATMENTS_CREATE), treatmentController.createTreatment);

// Update (allow create OR update - useful for draft editing)
router.patch('/api/treatments/:id', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_UPDATE, PERMISSIONS.TREATMENTS_CREATE), 
  treatmentController.updateTreatment
);

// Delete
router.delete('/api/treatments/:id', verifytoken, authorize(PERMISSIONS.TREATMENTS_DELETE), treatmentController.deleteTreatment);

module.exports = router;
```

---

### Example 3: Statistics Route (View Permission)

```javascript
const express = require('express');
const router = express.Router();
const statisticsController = require('../Controllers/statistics.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Statistics view (requires statistics.view permission)
router.get('/api/statistics', verifytoken, authorize(PERMISSIONS.STATISTICS_VIEW), statisticsController.getStatistics);

// Reports view (requires reports.view permission)
router.get('/api/reports', verifytoken, authorize(PERMISSIONS.REPORTS_VIEW), reportsController.getReports);

module.exports = router;
```

---

## 🎯 Common Patterns

### Pattern 1: CRUD Operations

```javascript
// Create
router.post('/api/resource', verifytoken, authorize(PERMISSIONS.RESOURCE_CREATE), controller.create);

// Read
router.get('/api/resource', verifytoken, authorize(PERMISSIONS.RESOURCE_READ), controller.getAll);
router.get('/api/resource/:id', verifytoken, authorize(PERMISSIONS.RESOURCE_READ), controller.getOne);

// Update
router.patch('/api/resource/:id', verifytoken, authorize(PERMISSIONS.RESOURCE_UPDATE), controller.update);

// Delete
router.delete('/api/resource/:id', verifytoken, authorize(PERMISSIONS.RESOURCE_DELETE), controller.delete);
```

---

### Pattern 2: Management Routes

```javascript
// List (read permission)
router.get('/api/employees', verifytoken, authorize(PERMISSIONS.EMPLOYEES_READ), controller.getAll);

// Create/Update/Delete (manage permission)
router.post('/api/employees', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), controller.create);
router.patch('/api/employees/:id', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), controller.update);
router.delete('/api/employees/:id', verifytoken, authorize(PERMISSIONS.EMPLOYEES_MANAGE), controller.delete);
```

---

### Pattern 3: Mixed Permissions

```javascript
// View (read permission)
router.get('/api/support/tickets', verifytoken, authorize(PERMISSIONS.SUPPORT_READ), controller.getAll);

// Manage (manage permission - more powerful)
router.post('/api/support/tickets/:id/reply', verifytoken, authorize(PERMISSIONS.SUPPORT_MANAGE), controller.reply);
router.delete('/api/support/tickets/:id', verifytoken, authorize(PERMISSIONS.SUPPORT_MANAGE), controller.delete);
```

---

## 🔍 Error Responses

### Missing Authentication (401)

```json
{
  "status": "error",
  "message": "Authentication required",
  "code": 401,
  "data": null
}
```

**Cause**: No token provided or invalid token.

---

### Missing Permission (403)

```json
{
  "status": "error",
  "message": "Access denied. Required permission(s): animals.read",
  "code": 403,
  "data": null
}
```

**Cause**: User doesn't have the required permission.

---

### Missing Tenant ID (403)

```json
{
  "status": "error",
  "message": "Tenant ID is required",
  "code": 403,
  "data": null
}
```

**Cause**: Token doesn't have `tenantId` (old token). User needs to login again.

---

## ✅ Best Practices

### 1. Always Use verifytoken First

```javascript
// ✅ Correct
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.getAnimals);
```

### 2. Use Specific Permissions

```javascript
// ✅ Good - specific permission
router.delete('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_DELETE), controller.delete);

// ❌ Avoid - too broad
router.delete('/api/animals/:id', verifytoken, authorize(PERMISSIONS.ANIMALS_MANAGE), controller.delete);
```

### 3. Filter by tenantId in Controllers

```javascript
// ✅ Always filter by tenantId
const getAllAnimals = asyncwrapper(async (req, res, next) => {
  const tenantId = req.user.tenantId;
  const animals = await Animal.find({ user: tenantId });
  // ...
});
```

### 4. Use Multiple Permissions When Appropriate

```javascript
// ✅ Allow multiple permissions for flexibility
router.patch('/api/treatments/:id', 
  verifytoken, 
  authorize(PERMISSIONS.TREATMENTS_UPDATE, PERMISSIONS.TREATMENTS_CREATE), 
  controller.update
);
```

---

## 📋 Quick Reference

### Import Statement

```javascript
const { PERMISSIONS } = require('../utilits/permissions');
const authorize = require('../middleware/authorize');
const verifytoken = require('../middleware/verifytoken');
```

### Basic Syntax

```javascript
router.METHOD('/path', verifytoken, authorize(PERMISSION), controller.handler);
```

### Multiple Permissions

```javascript
router.METHOD('/path', verifytoken, authorize(PERM1, PERM2, PERM3), controller.handler);
```

### Without Permission (Public)

```javascript
router.METHOD('/path', controller.handler);
```

### Optional Auth

```javascript
const optionalAuth = require('../middleware/optionalAuth');
router.METHOD('/path', optionalAuth, controller.handler);
```

---

## 🧪 Testing

### Test with Postman

1. **Get token** (login as owner or employee)
2. **Add header**: `Authorization: Bearer YOUR_TOKEN`
3. **Make request** to protected route
4. **Check response**:
   - `200 OK` = Has permission ✅
   - `403 Forbidden` = Missing permission ❌
   - `401 Unauthorized` = Invalid/missing token ❌

### Test Different Users

- **Owner**: Should have access to all routes (has `"*"` permission)
- **Manager**: Should have access to most routes (check role permissions)
- **Employee**: Should have limited access (read-only typically)

---

## 📚 Related Files

- **Permissions**: `utilits/permissions.js` - All permission constants
- **Authorize Middleware**: `middleware/authorize.js` - Permission checking logic
- **Verify Token**: `middleware/verifytoken.js` - Authentication middleware
- **RBAC Guide**: `docs/RBAC_PERMISSIONS_ROLES_GUIDE.md` - Complete RBAC documentation

---

## 🆘 Troubleshooting

### Issue: "Access denied" even though user has permission

**Possible Causes**:
1. Old token (doesn't have permissions in JWT)
2. Token doesn't have `tenantId`
3. Permission not in user's effective permissions

**Solution**: 
- User needs to login again to get fresh token with permissions
- Check user's roles and effective permissions

---

### Issue: "Tenant ID is required"

**Cause**: Token doesn't have `tenantId` field.

**Solution**: User needs to login again. Old tokens don't have `tenantId`.

---

### Issue: Owner can't access route

**Cause**: Owner should have `"*"` permission which bypasses all checks.

**Solution**: Check owner's JWT token. Should have `permissions: ["*"]`.

---

## ✅ Checklist

When adding permissions to a route:

- [ ] Imported `PERMISSIONS` from `utilits/permissions`
- [ ] Imported `authorize` middleware
- [ ] Used `verifytoken` before `authorize`
- [ ] Used correct permission constant
- [ ] Controller filters by `req.user.tenantId`
- [ ] Tested with different user roles
- [ ] Documented permission requirement

---

## 🎓 Summary

1. **Import**: `PERMISSIONS` and `authorize`
2. **Order**: `verifytoken` → `authorize(PERMISSION)` → `controller`
3. **Owner**: Automatically bypasses with `"*"` permission
4. **Tenant**: Always filter by `tenantId` in controllers
5. **Multiple**: Use comma-separated permissions for OR logic
