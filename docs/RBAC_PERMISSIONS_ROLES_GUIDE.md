# RBAC (Role-Based Access Control) - Complete Guide

## 📋 Overview

This system implements **Role-Based Access Control (RBAC)** for a multi-tenant Farm Management SaaS. Each tenant (Owner) can create custom roles and assign them to employees with specific permissions.

### Key Concepts

- **Tenant**: Each Owner (User) is a tenant. All data is isolated per tenant.
- **Role**: A collection of permissions. Roles are tenant-scoped.
- **Employee**: Works for a specific tenant. Can have multiple roles.
- **Permission**: Granular access control (e.g., `animals.read`, `treatments.create`).
- **Effective Permissions**: Final permissions for an employee = `union(role.permissions) + extraPermissions - deniedPermissions`.

---

## 🔐 Permission System

### All Available Permissions

#### Animals
- `animals.read` - View animals
- `animals.create` - Create new animals
- `animals.update` - Update existing animals
- `animals.delete` - Delete animals

#### Treatments
- `treatments.read` - View treatments
- `treatments.create` - Create treatments
- `treatments.update` - Update treatments
- `treatments.delete` - Delete treatments

#### Vaccines
- `vaccines.read` - View vaccines
- `vaccines.create` - Create vaccine entries
- `vaccines.update` - Update vaccines
- `vaccines.delete` - Delete vaccines

#### Feed
- `feed.read` - View feed records
- `feed.create` - Create feed entries
- `feed.update` - Update feed records
- `feed.delete` - Delete feed records

#### Breeding
- `breeding.read` - View breeding records
- `breeding.create` - Create breeding entries
- `breeding.update` - Update breeding records
- `breeding.delete` - Delete breeding records

#### Mating
- `mating.read` - View mating records
- `mating.create` - Create mating entries
- `mating.update` - Update mating records
- `mating.delete` - Delete mating records

#### Weight
- `weight.read` - View weight records
- `weight.create` - Create weight entries
- `weight.update` - Update weight records
- `weight.delete` - Delete weight records

#### Reports & Statistics
- `reports.view` - View reports
- `statistics.view` - View statistics dashboard

#### Employees
- `employees.read` - View employees list
- `employees.manage` - Create, update, delete employees

#### Roles
- `roles.read` - View roles list
- `roles.manage` - Create, update, delete roles

#### Settings
- `settings.read` - View settings
- `settings.manage` - Update settings

#### Support Tickets
- `support.read` - View support tickets
- `support.manage` - Manage support tickets (reply, update status, delete)

### Special Permission

- `*` - **Owner only**. Grants all permissions. Cannot be assigned to roles.

---

## 👥 Default Roles

When a new tenant (Owner) registers, three default roles are automatically created:

### 1. Owner (System Role)
- **Key**: `owner`
- **Permissions**: All permissions (`*`)
- **Can be modified?**: No (system role)
- **Can be deleted?**: No (system role)
- **Usage**: Automatically assigned to the tenant owner

### 2. Manager (System Role)
- **Key**: `manager`
- **Permissions**:
  - `animals.read`, `animals.create`, `animals.update`
  - `treatments.read`, `treatments.create`, `treatments.update`
  - `vaccines.read`, `vaccines.create`, `vaccines.update`
  - `feed.read`, `feed.create`, `feed.update`
  - `breeding.read`, `breeding.create`, `breeding.update`
  - `mating.read`, `mating.create`, `mating.update`
  - `weight.read`, `weight.create`, `weight.update`
  - `reports.view`
  - `statistics.view`
  - `employees.read`
  - `support.read`, `support.manage`
- **Can be modified?**: No (system role)
- **Can be deleted?**: No (system role)
- **Usage**: For farm managers who need most permissions except delete operations

### 3. Employee (System Role)
- **Key**: `employee`
- **Permissions**: Read-only access
  - `animals.read`
  - `treatments.read`
  - `vaccines.read`
  - `feed.read`
  - `breeding.read`
  - `mating.read`
  - `weight.read`
- **Can be modified?**: No (system role)
- **Can be deleted?**: No (system role)
- **Usage**: For basic employees who only need to view data

---

## 🛠️ How to Use

### Step 1: Get Available Permissions

**Endpoint**: `GET /api/permissions`

**Headers**:
```
Authorization: Bearer YOUR_TOKEN
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "permissions": [
      "animals.read",
      "animals.create",
      "animals.update",
      "animals.delete",
      ...
    ],
    "permissionGroups": {
      "animals": ["animals.read", "animals.create", "animals.update", "animals.delete"],
      "treatments": [...],
      ...
    }
  }
}
```

---

### Step 2: Create a Custom Role

**Endpoint**: `POST /api/roles`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Veterinarian",
  "key": "veterinarian",
  "description": "Can manage treatments and vaccines",
  "permissionKeys": [
    "animals.read",
    "treatments.read",
    "treatments.create",
    "treatments.update",
    "treatments.delete",
    "vaccines.read",
    "vaccines.create",
    "vaccines.update",
    "vaccines.delete"
  ]
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "role": {
      "_id": "507f1f77bcf86cd799439011",
      "user": "507f1f77bcf86cd799439012",
      "name": "Veterinarian",
      "key": "veterinarian",
      "permissionKeys": [...],
      "isSystem": false,
      "description": "Can manage treatments and vaccines",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Required Permissions**: `roles.manage`

---

### Step 3: Get All Roles

**Endpoint**: `GET /api/roles`

**Headers**:
```
Authorization: Bearer YOUR_TOKEN
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "roles": [
      {
        "_id": "...",
        "name": "Owner",
        "key": "owner",
        "permissionKeys": ["*"],
        "isSystem": true
      },
      {
        "_id": "...",
        "name": "Manager",
        "key": "manager",
        "permissionKeys": [...],
        "isSystem": true
      },
      {
        "_id": "...",
        "name": "Veterinarian",
        "key": "veterinarian",
        "permissionKeys": [...],
        "isSystem": false
      }
    ]
  }
}
```

**Required Permissions**: `roles.read`

---

### Step 4: Update a Role

**Endpoint**: `PATCH /api/roles/:id`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json
```

**Body** (all fields optional):
```json
{
  "name": "Senior Veterinarian",
  "permissionKeys": [
    "animals.read",
    "animals.update",
    "treatments.read",
    "treatments.create",
    "treatments.update",
    "treatments.delete",
    "vaccines.read",
    "vaccines.create",
    "vaccines.update",
    "vaccines.delete",
    "reports.view"
  ],
  "description": "Senior veterinarian with additional permissions"
}
```

**Note**: Cannot update system roles (`isSystem: true`)

**Required Permissions**: `roles.manage`

---

### Step 5: Delete a Role

**Endpoint**: `DELETE /api/roles/:id`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
```

**Response**:
```json
{
  "status": "success",
  "data": null
}
```

**Rules**:
- Cannot delete system roles (`isSystem: true`)
- Cannot delete if any employees are assigned to this role

**Required Permissions**: `roles.manage`

---

### Step 6: Create an Employee

**Endpoint**: `POST /api/employees`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json
```

**Body**:
```json
{
  "name": "Ahmed Mohamed",
  "email": "ahmed@farm.com",
  "password": "SecurePassword123",
  "phone": "+201234567890",
  "roleIds": ["507f1f77bcf86cd799439011"],
  "extraPermissions": ["animals.delete"],
  "deniedPermissions": []
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "employee": {
      "_id": "507f1f77bcf86cd799439013",
      "user": "507f1f77bcf86cd799439012",
      "name": "Ahmed Mohamed",
      "email": "ahmed@farm.com",
      "phone": "+201234567890",
      "roleIds": [
        {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Veterinarian",
          "key": "veterinarian"
        }
      ],
      "extraPermissions": ["animals.delete"],
      "deniedPermissions": [],
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Required Permissions**: `employees.manage`

**Notes**:
- Email must be unique per tenant
- Password is automatically hashed
- `roleIds` must belong to the same tenant
- `extraPermissions` and `deniedPermissions` are optional

---

### Step 7: Get All Employees

**Endpoint**: `GET /api/employees`

**Headers**:
```
Authorization: Bearer YOUR_TOKEN
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "employees": [
      {
        "_id": "...",
        "name": "Ahmed Mohamed",
        "email": "ahmed@farm.com",
        "phone": "+201234567890",
        "roleIds": [
          {
            "_id": "...",
            "name": "Veterinarian",
            "key": "veterinarian",
            "permissionKeys": [...]
          }
        ],
        "extraPermissions": ["animals.delete"],
        "deniedPermissions": [],
        "isActive": true
      }
    ]
  }
}
```

**Required Permissions**: `employees.read`

---

### Step 8: Update Employee Roles & Permissions

**Endpoint**: `PATCH /api/employees/:id/roles`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json
```

**Body** (all fields optional):
```json
{
  "roleIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439014"],
  "extraPermissions": ["animals.delete", "reports.view"],
  "deniedPermissions": ["treatments.delete"]
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "employee": {
      "_id": "...",
      "roleIds": [
        {
          "_id": "...",
          "name": "Veterinarian",
          "key": "veterinarian",
          "permissionKeys": [...]
        },
        {
          "_id": "...",
          "name": "Manager",
          "key": "manager",
          "permissionKeys": [...]
        }
      ],
      "extraPermissions": ["animals.delete", "reports.view"],
      "deniedPermissions": ["treatments.delete"]
    }
  }
}
```

**Required Permissions**: `employees.manage`

**How Effective Permissions are Calculated**:
1. Union all `permissionKeys` from all assigned roles
2. Add `extraPermissions`
3. Remove `deniedPermissions`

**Example**:
- Role 1 permissions: `["animals.read", "treatments.create"]`
- Role 2 permissions: `["vaccines.read", "treatments.delete"]`
- Extra permissions: `["animals.delete"]`
- Denied permissions: `["treatments.delete"]`
- **Effective**: `["animals.read", "animals.delete", "treatments.create", "vaccines.read"]`

---

### Step 9: Update Employee Info

**Endpoint**: `PATCH /api/employees/:id`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json
```

**Body** (all fields optional):
```json
{
  "name": "Ahmed Mohamed Ali",
  "email": "ahmed.new@farm.com",
  "phone": "+201234567891",
  "isActive": false
}
```

**Required Permissions**: `employees.manage`

---

### Step 10: Delete Employee

**Endpoint**: `DELETE /api/employees/:id`

**Headers**:
```
Authorization: Bearer OWNER_TOKEN
```

**Response**:
```json
{
  "status": "success",
  "data": null
}
```

**Required Permissions**: `employees.manage`

---

## 🔑 Employee Login

Employees log in using the **unified login endpoint** with `farmCode`:

**Endpoint**: `POST /api/auth/login`

**Body**:
```json
{
  "email": "ahmed@farm.com",
  "password": "SecurePassword123",
  "farmCode": "FARM123"
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "507f1f77bcf86cd799439013",
      "employeeId": "507f1f77bcf86cd799439013",
      "tenantId": "507f1f77bcf86cd799439012",
      "accountType": "employee",
      "permissions": [
        "animals.read",
        "treatments.read",
        "treatments.create",
        "vaccines.read",
        "animals.delete"
      ]
    }
  }
}
```

**Note**: `farmCode` maps to `tenantId` (Owner ID). It's required for employee login to ensure tenant isolation.

---

## 🛡️ Using Permissions in Routes

### In Route Files

```javascript
const express = require('express');
const router = express.Router();
const verifytoken = require('../middleware/verifytoken');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utilits/permissions');

// Single permission
router.get('/api/animals', verifytoken, authorize(PERMISSIONS.ANIMALS_READ), controller.getAnimals);

// Multiple permissions (OR logic - user needs at least one)
router.post('/api/treatments', verifytoken, authorize(PERMISSIONS.TREATMENTS_CREATE, PERMISSIONS.TREATMENTS_UPDATE), controller.createTreatment);

// Owner bypass: If user has "*" permission, they bypass all checks
```

### In Controllers

```javascript
const getAllAnimals = asyncwrapper(async (req, res, next) => {
  const tenantId = req.user.tenantId; // ALWAYS use tenantId for queries
  
  // Filter by tenant
  const animals = await Animal.find({ user: tenantId });
  
  res.status(200).json({
    status: httpstatustext.SUCCESS,
    data: { animals }
  });
});
```

**Important**: Always filter queries by `req.user.tenantId` to ensure tenant isolation.

---

## 📊 Complete Postman Examples

### 1. Get Available Permissions

```
GET http://localhost:5000/api/permissions
Authorization: Bearer YOUR_TOKEN
```

---

### 2. Create Custom Role

```
POST http://localhost:5000/api/roles
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json

{
  "name": "Veterinarian",
  "key": "veterinarian",
  "description": "Can manage treatments and vaccines",
  "permissionKeys": [
    "animals.read",
    "treatments.read",
    "treatments.create",
    "treatments.update",
    "treatments.delete",
    "vaccines.read",
    "vaccines.create",
    "vaccines.update",
    "vaccines.delete"
  ]
}
```

---

### 3. Get All Roles

```
GET http://localhost:5000/api/roles
Authorization: Bearer YOUR_TOKEN
```

---

### 4. Update Role

```
PATCH http://localhost:5000/api/roles/507f1f77bcf86cd799439011
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json

{
  "name": "Senior Veterinarian",
  "permissionKeys": [
    "animals.read",
    "animals.update",
    "treatments.read",
    "treatments.create",
    "treatments.update",
    "treatments.delete",
    "vaccines.read",
    "vaccines.create",
    "vaccines.update",
    "vaccines.delete",
    "reports.view"
  ]
}
```

---

### 5. Delete Role

```
DELETE http://localhost:5000/api/roles/507f1f77bcf86cd799439011
Authorization: Bearer OWNER_TOKEN
```

---

### 6. Create Employee

```
POST http://localhost:5000/api/employees
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json

{
  "name": "Ahmed Mohamed",
  "email": "ahmed@farm.com",
  "password": "SecurePassword123",
  "phone": "+201234567890",
  "roleIds": ["507f1f77bcf86cd799439011"],
  "extraPermissions": ["animals.delete"],
  "deniedPermissions": []
}
```

---

### 7. Get All Employees

```
GET http://localhost:5000/api/employees
Authorization: Bearer YOUR_TOKEN
```

---

### 8. Get Single Employee

```
GET http://localhost:5000/api/employees/507f1f77bcf86cd799439013
Authorization: Bearer YOUR_TOKEN
```

---

### 9. Update Employee Roles

```
PATCH http://localhost:5000/api/employees/507f1f77bcf86cd799439013/roles
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json

{
  "roleIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439014"],
  "extraPermissions": ["animals.delete", "reports.view"],
  "deniedPermissions": ["treatments.delete"]
}
```

---

### 10. Update Employee Info

```
PATCH http://localhost:5000/api/employees/507f1f77bcf86cd799439013
Authorization: Bearer OWNER_TOKEN
Content-Type: application/json

{
  "name": "Ahmed Mohamed Ali",
  "email": "ahmed.new@farm.com",
  "phone": "+201234567891",
  "isActive": true
}
```

---

### 11. Delete Employee

```
DELETE http://localhost:5000/api/employees/507f1f77bcf86cd799439013
Authorization: Bearer OWNER_TOKEN
```

---

### 12. Employee Login

```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "ahmed@farm.com",
  "password": "SecurePassword123",
  "farmCode": "FARM123"
}
```

---

## 🎯 Common Use Cases

### Use Case 1: Create a Veterinarian Role

1. **Get available permissions** → `GET /api/permissions`
2. **Create role** → `POST /api/roles` with veterinarian permissions
3. **Create employee** → `POST /api/employees` with the role ID

---

### Use Case 2: Grant Temporary Extra Permission

1. **Get employee** → `GET /api/employees/:id`
2. **Update roles** → `PATCH /api/employees/:id/roles` with `extraPermissions: ["animals.delete"]`

---

### Use Case 3: Restrict Permission for Specific Employee

1. **Get employee** → `GET /api/employees/:id`
2. **Update roles** → `PATCH /api/employees/:id/roles` with `deniedPermissions: ["treatments.delete"]`

---

### Use Case 4: Assign Multiple Roles

1. **Get all roles** → `GET /api/roles`
2. **Update employee** → `PATCH /api/employees/:id/roles` with multiple `roleIds`

---

### Use Case 5: Deactivate Employee

1. **Update employee** → `PATCH /api/employees/:id` with `isActive: false`

**Note**: Deactivated employees cannot log in, but their data remains.

---

## ⚠️ Important Rules

### Tenant Isolation

- **All queries MUST filter by `tenantId`**: `{ user: req.user.tenantId }`
- **Roles are tenant-scoped**: Each tenant has their own roles
- **Employees are tenant-scoped**: Email is unique per tenant, not globally
- **`farmCode` is required for employee login**: Prevents cross-tenant access

### System Roles

- **Cannot be modified**: `isSystem: true` roles cannot be updated
- **Cannot be deleted**: System roles are permanent
- **Auto-created**: Owner, Manager, Employee roles are created on tenant registration

### Role Deletion

- **Cannot delete if in use**: If any employee has this role, deletion fails
- **Check before deletion**: System checks for assigned employees

### Permission Calculation

- **Union of roles**: All permissions from all assigned roles are combined
- **Extra permissions added**: `extraPermissions` are added to the union
- **Denied permissions removed**: `deniedPermissions` are removed from the final set
- **Owner bypass**: Permission `"*"` grants all access

---

## 🔍 Troubleshooting

### Issue: "Role not found or belong to different tenant"

**Cause**: Trying to assign a role from a different tenant.

**Solution**: Ensure `roleIds` belong to the same tenant as the employee.

---

### Issue: "Employee with this email already exists"

**Cause**: Email is already used by another employee in the same tenant.

**Solution**: Use a different email or update the existing employee.

---

### Issue: "System roles cannot be modified/deleted"

**Cause**: Trying to modify/delete Owner, Manager, or Employee roles.

**Solution**: These roles are protected. Create custom roles instead.

---

### Issue: "Cannot delete role. X employee(s) are assigned"

**Cause**: Role is still assigned to employees.

**Solution**: Remove the role from all employees first, then delete.

---

### Issue: "Access denied. Required permission(s): ..."

**Cause**: Employee doesn't have the required permission.

**Solution**: 
1. Check employee's roles → `GET /api/employees/:id`
2. Check effective permissions (union of roles + extra - denied)
3. Add missing permission via `extraPermissions` or assign a role with that permission

---

### Issue: "Tenant ID is required"

**Cause**: JWT token doesn't have `tenantId`.

**Solution**: Perform a fresh login to get a new token with `tenantId`.

---

## 📋 Quick Reference Table

| Action | Endpoint | Method | Auth | Permission |
|--------|----------|--------|------|------------|
| Get permissions | `/api/permissions` | GET | Yes | - |
| Get all roles | `/api/roles` | GET | Yes | `roles.read` |
| Get single role | `/api/roles/:id` | GET | Yes | `roles.read` |
| Create role | `/api/roles` | POST | Yes | `roles.manage` |
| Update role | `/api/roles/:id` | PATCH | Yes | `roles.manage` |
| Delete role | `/api/roles/:id` | DELETE | Yes | `roles.manage` |
| Get all employees | `/api/employees` | GET | Yes | `employees.read` |
| Get single employee | `/api/employees/:id` | GET | Yes | `employees.read` |
| Create employee | `/api/employees` | POST | Yes | `employees.manage` |
| Update employee | `/api/employees/:id` | PATCH | Yes | `employees.manage` |
| Update employee roles | `/api/employees/:id/roles` | PATCH | Yes | `employees.manage` |
| Delete employee | `/api/employees/:id` | DELETE | Yes | `employees.manage` |
| Employee login | `/api/auth/login` | POST | No | - |

---

## ✅ Testing Checklist

- [ ] Get available permissions
- [ ] Create custom role
- [ ] Get all roles
- [ ] Update custom role
- [ ] Try to update system role (should fail)
- [ ] Create employee with role
- [ ] Get all employees
- [ ] Get single employee
- [ ] Update employee roles
- [ ] Add extra permissions
- [ ] Add denied permissions
- [ ] Assign multiple roles
- [ ] Employee login with farmCode
- [ ] Test permission-based access (try accessing endpoint without permission)
- [ ] Delete employee
- [ ] Try to delete role with assigned employees (should fail)
- [ ] Delete unused role

---

## 🎓 Best Practices

1. **Create roles first, then employees**: Define roles before assigning them
2. **Use descriptive role names**: "Veterinarian" is better than "Role1"
3. **Minimize extraPermissions**: Prefer creating roles over adding extra permissions
4. **Use deniedPermissions sparingly**: Only when you need to restrict a specific employee
5. **Test effective permissions**: After assigning roles, verify the employee's effective permissions
6. **Document custom roles**: Use the `description` field to explain role purpose
7. **Regular audits**: Periodically review roles and employee assignments
8. **Tenant isolation**: Always filter by `tenantId` in all queries

---

## 📚 Additional Resources

- **Login Guide**: See `docs/LOGIN_USAGE.md` for login details
- **Support Tickets**: See `docs/SUPPORT_TICKETS_POSTMAN_GUIDE.md` for support system
- **Permissions File**: `utilits/permissions.js` - All permission constants
- **Role Model**: `Models/role.model.js` - Role schema
- **Employee Model**: `Models/employee.model.js` - Employee schema
- **Authorization Middleware**: `middleware/authorize.js` - Permission checking
