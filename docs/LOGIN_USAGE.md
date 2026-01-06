# Login Usage Guide

## Unified Login Endpoint: `POST /api/auth/login`

This endpoint handles both **Owner** and **Employee** logins in a single request.

---

## Owner Login

### Request (No token needed)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "password123"
}
```

### Response
```json
{
  "status": "SUCCESS",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accountType": "owner",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "owner@example.com",
      "name": "John Doe",
      "tenantId": "507f1f77bcf86cd799439011"
    }
  }
}
```

**Token Payload:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "tenantId": "507f1f77bcf86cd799439011",
  "accountType": "owner",
  "email": "owner@example.com",
  "permissions": ["*"]
}
```

---

## Employee Login

Employee login **REQUIRES** `tenantId` for security. You can provide it in two ways:

### Option 1: Provide tenantId in Request Body

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "employee@example.com",
  "password": "password123",
  "tenantId": "507f1f77bcf86cd799439011"
}
```

### Option 2: Extract tenantId from Owner's Token (Recommended)

If the owner is already logged in, you can use their token to automatically get the `tenantId`:

```http
POST /api/auth/login
Content-Type: application/json
Authorization: Bearer <owner_token_here>

{
  "email": "employee@example.com",
  "password": "password123"
}
```

The system will:
1. Extract `tenantId` from the Authorization header token
2. Use it for employee lookup (prevents cross-tenant access)

### Response
```json
{
  "status": "SUCCESS",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accountType": "employee",
    "employee": {
      "id": "507f191e810c19729de860ea",
      "name": "Jane Employee",
      "email": "employee@example.com",
      "tenantId": "507f1f77bcf86cd799439011"
    },
    "permissions": [
      "animals.read",
      "animals.create",
      "treatments.read"
    ]
  }
}
```

**Token Payload:**
```json
{
  "id": "507f191e810c19729de860ea",
  "employeeId": "507f191e810c19729de860ea",
  "tenantId": "507f1f77bcf86cd799439011",
  "accountType": "employee",
  "email": "employee@example.com",
  "permissions": ["animals.read", "animals.create", "treatments.read"]
}
```

---

## Frontend Implementation Examples

### React/JavaScript Example

```javascript
// Owner Login
async function ownerLogin(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  if (data.status === 'SUCCESS') {
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('tenantId', data.data.user.tenantId);
    return data.data;
  }
  throw new Error(data.message);
}

// Employee Login (using owner's token)
async function employeeLogin(email, password) {
  const ownerToken = localStorage.getItem('token'); // Get owner's token
  
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerToken}`, // Include owner's token
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  if (data.status === 'SUCCESS') {
    localStorage.setItem('employeeToken', data.data.token);
    return data.data;
  }
  throw new Error(data.message);
}

// Employee Login (with explicit tenantId)
async function employeeLoginWithTenantId(email, password, tenantId) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      email, 
      password,
      tenantId // Explicit tenantId
    }),
  });
  
  const data = await response.json();
  if (data.status === 'SUCCESS') {
    localStorage.setItem('employeeToken', data.data.token);
    return data.data;
  }
  throw new Error(data.message);
}
```

### Axios Example

```javascript
import axios from 'axios';

// Owner Login
const ownerLogin = async (email, password) => {
  const response = await axios.post('/api/auth/login', {
    email,
    password,
  });
  
  const { token, user } = response.data.data;
  localStorage.setItem('token', token);
  localStorage.setItem('tenantId', user.tenantId);
  return response.data.data;
};

// Employee Login (using owner's token)
const employeeLogin = async (email, password) => {
  const ownerToken = localStorage.getItem('token');
  
  const response = await axios.post(
    '/api/auth/login',
    { email, password },
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`, // Extract tenantId from this token
      },
    }
  );
  
  const { token } = response.data.data;
  localStorage.setItem('employeeToken', token);
  return response.data.data;
};
```

---

## How Employees Get tenantId

### Method 1: From Owner's Login Response
When the owner logs in, the response includes `tenantId`:
```json
{
  "user": {
    "tenantId": "507f1f77bcf86cd799439011"
  }
}
```

Store this in your frontend state/localStorage and use it for employee login.

### Method 2: From Owner's Token
The owner's JWT token contains `tenantId`:
```javascript
// Decode JWT token (client-side)
function getTenantIdFromToken(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  const decoded = JSON.parse(jsonPayload);
  return decoded.tenantId;
}

// Usage
const ownerToken = localStorage.getItem('token');
const tenantId = getTenantIdFromToken(ownerToken);
```

### Method 3: Use Authorization Header (Automatic)
Simply include the owner's token in the Authorization header when logging in as employee. The backend will automatically extract `tenantId` from it.

---

## Security Notes

1. **Employee emails are NOT globally unique** - they're unique per tenant only
2. **tenantId is REQUIRED** for employee login to prevent cross-tenant access
3. **Always use `req.user.tenantId`** (not `req.user.id`) for tenant data filtering
4. **Owner has `permissions: ["*"]`** - full access to everything
5. **Employee permissions** are computed from assigned roles

---

## Error Responses

### Missing tenantId for Employee
```json
{
  "status": "ERROR",
  "message": "Invalid email or password. For employee login, tenantId is required (provide in body or Authorization header).",
  "code": 401
}
```

### Invalid Credentials
```json
{
  "status": "ERROR",
  "message": "Invalid email or password",
  "code": 401
}
```
