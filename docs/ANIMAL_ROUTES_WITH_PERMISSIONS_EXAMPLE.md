# Animal Routes with Permissions - Example

## 📋 Before (Current State)

```javascript
const express=require('express');
const router=express.Router();
const animalcontroller=require('../Controllers/animal.controller');
const verifytoken=require('../middleware/verifytoken');
// ... other imports

router.get('/api/animal/getallanimals',verifytoken,animalcontroller.getallanimals);
router.post('/api/animal/addanimal', verifytoken, requireSubscriptionAndCheckAnimalLimit, animalcontroller.addanimal);
router.patch('/api/animal/updateanimal/:tagId',verifytoken,animalcontroller.updateanimal);
router.delete('/api/animal/deleteanimal/:tagId',verifytoken,animalcontroller.deleteanimal);
```

**Problem**: All authenticated users can access all routes. No permission checks.

---

## ✅ After (With Permissions)

```javascript
const express = require('express');
const router = express.Router();
const animalcontroller = require('../Controllers/animal.controller');
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
const optionalAuth = require('../middleware/optionalAuth');
const animalCostController = require('../Controllers/animalcost.controller');
const { animalValidationRules, validateAnimal } = require('../middleware/animal.validation');
const setLocale = require('../middleware/localeMiddleware');
const excelOps = require('../utilits/excelOperations');
const { requireSubscriptionAndCheckAnimalLimit } = require('../middleware/subscriptionLimit');

router.use(setLocale);

// ============================================
// READ OPERATIONS (require animals.read)
// ============================================

router.get('/api/animal/location-sheds', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getAllLocationSheds
);

router.get('/api/animal/getAnimalStatistics', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getAnimalStatistics
);

router.get('/api/animal/getallanimals', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getallanimals
);

router.get('/api/animal/getsinglanimals/:tagId', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getsingleanimal
);

router.get('/api/animal/males', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getAllMaleAnimalTagIds
);

router.get('/api/animal/getanimalCost', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalCostController.getallanimalscost
);

// ============================================
// EXPORT OPERATIONS (require animals.read)
// ============================================

router.get('/api/animal/exportAnimalsToExcel', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.exportAnimalsToExcel
);

router.get('/api/animal/downloadAnimalTemplate', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.downloadAnimalTemplate
);

// ============================================
// CREATE OPERATIONS (require animals.create)
// ============================================

router.post('/api/animal/addanimal', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_CREATE), 
  requireSubscriptionAndCheckAnimalLimit, 
  animalcontroller.addanimal
);

router.post('/api/animal/import', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_CREATE), 
  excelOps.uploadExcelFile, 
  animalcontroller.importAnimalsFromExcel
);

// ============================================
// UPDATE OPERATIONS (require animals.update)
// ============================================

router.patch('/api/animal/updateanimal/:tagId', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_UPDATE), 
  animalcontroller.updateanimal
);

router.post('/api/animal/moveanimals', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_UPDATE), 
  animalcontroller.moveAnimals
);

// ============================================
// DELETE OPERATIONS (require animals.delete)
// ============================================

router.delete('/api/animal/deleteanimal/:tagId', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_DELETE), 
  animalcontroller.deleteanimal
);

// ============================================
// PUBLIC ROUTES (no permission required)
// ============================================

// Public scan route (optional auth - works with or without login)
router.get('/api/scan/:token', optionalAuth, animalcontroller.getAnimalByQrToken);

module.exports = router;
```

---

## 📊 Permission Mapping

| Route | Method | Permission Required | Purpose |
|-------|--------|---------------------|---------|
| `/api/animal/location-sheds` | GET | `animals.read` | Get all locations/sheds |
| `/api/animal/getAnimalStatistics` | GET | `animals.read` | Get statistics |
| `/api/animal/getallanimals` | GET | `animals.read` | List all animals |
| `/api/animal/getsinglanimals/:tagId` | GET | `animals.read` | Get single animal |
| `/api/animal/males` | GET | `animals.read` | Get male animals |
| `/api/animal/getanimalCost` | GET | `animals.read` | Get animal costs |
| `/api/animal/exportAnimalsToExcel` | GET | `animals.read` | Export to Excel |
| `/api/animal/downloadAnimalTemplate` | GET | `animals.read` | Download template |
| `/api/animal/addanimal` | POST | `animals.create` | Create animal |
| `/api/animal/import` | POST | `animals.create` | Import from Excel |
| `/api/animal/updateanimal/:tagId` | PATCH | `animals.update` | Update animal |
| `/api/animal/moveanimals` | POST | `animals.update` | Move animals |
| `/api/animal/deleteanimal/:tagId` | DELETE | `animals.delete` | Delete animal |
| `/api/scan/:token` | GET | None (public) | Scan QR code |

---

## 🔍 Step-by-Step Implementation

### Step 1: Add Imports

```javascript
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');
```

### Step 2: Identify Route Types

- **Read**: GET requests that fetch data
- **Create**: POST requests that create new data
- **Update**: PATCH/PUT requests that modify data
- **Delete**: DELETE requests that remove data

### Step 3: Add authorize Middleware

Insert `authorize(PERMISSION)` between `verifytoken` and the controller:

```javascript
// Before
router.get('/api/animal/getallanimals', verifytoken, animalcontroller.getallanimals);

// After
router.get('/api/animal/getallanimals', 
  verifytoken, 
  authorize(PERMISSIONS.ANIMALS_READ), 
  animalcontroller.getallanimals
);
```

### Step 4: Handle Multiple Middleware

If you have multiple middleware, keep the order:

```javascript
router.post('/api/animal/addanimal', 
  verifytoken,                           // 1. Authenticate
  authorize(PERMISSIONS.ANIMALS_CREATE), // 2. Check permission
  requireSubscriptionAndCheckAnimalLimit, // 3. Check subscription
  animalcontroller.addanimal            // 4. Execute handler
);
```

---

## 🎯 Testing

### Test 1: User with Read Permission

```bash
# Login as employee with animals.read permission
POST /api/auth/login
{
  "email": "employee@farm.com",
  "password": "password",
  "farmCode": "FARM123"
}

# Should succeed
GET /api/animal/getallanimals
Authorization: Bearer TOKEN
# ✅ 200 OK

# Should fail (no create permission)
POST /api/animal/addanimal
Authorization: Bearer TOKEN
# ❌ 403 Forbidden: "Access denied. Required permission(s): animals.create"
```

### Test 2: Owner (Has All Permissions)

```bash
# Login as owner
POST /api/auth/login
{
  "email": "owner@farm.com",
  "password": "password"
}

# Should succeed (owner has "*" permission)
GET /api/animal/getallanimals
POST /api/animal/addanimal
DELETE /api/animal/deleteanimal/:tagId
# ✅ All 200 OK
```

### Test 3: Public Route

```bash
# No token required
GET /api/scan/abc123def456
# ✅ 200 OK (works without auth)
```

---

## ⚠️ Important Notes

### 1. Middleware Order

**Always maintain this order:**
1. `verifytoken` (authentication)
2. `authorize(PERMISSION)` (authorization)
3. Other middleware (subscription checks, validation, etc.)
4. Controller handler

### 2. Owner Bypass

Owners automatically bypass permission checks because they have `"*"` permission. No need to add special handling.

### 3. Tenant Isolation

Make sure your controllers filter by `tenantId`:

```javascript
// In animal.controller.js
const getallanimals = asyncwrapper(async (req, res, next) => {
  const tenantId = req.user.tenantId; // Always use tenantId
  
  const animals = await Animal.find({ user: tenantId });
  // ...
});
```

### 4. Public Routes

Routes that don't need authentication should NOT have `verifytoken` or `authorize`:

```javascript
// ✅ Public route
router.get('/api/scan/:token', optionalAuth, controller.scan);

// ❌ Don't add verifytoken/authorize to public routes
router.get('/api/scan/:token', verifytoken, authorize(...), controller.scan);
```

---

## 📝 Complete Example File

See the full example above in the "After (With Permissions)" section.

---

## ✅ Checklist

When adding permissions to routes:

- [ ] Imported `authorize` and `PERMISSIONS`
- [ ] Added `authorize(PERMISSION)` after `verifytoken`
- [ ] Used correct permission for each route type:
  - [ ] Read operations → `*.read`
  - [ ] Create operations → `*.create`
  - [ ] Update operations → `*.update`
  - [ ] Delete operations → `*.delete`
- [ ] Maintained middleware order
- [ ] Left public routes without permissions
- [ ] Tested with different user roles
- [ ] Verified tenant isolation in controllers

---

## 🆘 Common Mistakes

### Mistake 1: Wrong Middleware Order

```javascript
// ❌ Wrong
router.get('/api/animals', authorize(PERMISSIONS.ANIMALS_READ), verifytoken, controller.get);

// ✅ Correct
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.get);
```

### Mistake 2: Missing verifytoken

```javascript
// ❌ Wrong - authorize needs req.user from verifytoken
router.get('/api/animals', authorize(PERMISSIONS.ANIMALS_READ), controller.get);

// ✅ Correct
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.get);
```

### Mistake 3: Wrong Permission Type

```javascript
// ❌ Wrong - GET should use read, not create
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_CREATE), controller.get);

// ✅ Correct
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.get);
```

---

## 📚 Related Documentation

- **Using Permissions Guide**: `docs/USING_PERMISSIONS_IN_ROUTES.md`
- **RBAC Guide**: `docs/RBAC_PERMISSIONS_ROLES_GUIDE.md`
- **Permissions File**: `utilits/permissions.js`
