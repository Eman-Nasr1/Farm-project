# Support Tickets - Complete Postman Testing Guide

## 📋 Overview
Complete guide for testing all Support Ticket endpoints in Postman.

---

## 🔧 Setup Postman Environment

### Create Environment Variables

1. Open Postman → **Environments** → **Create Environment**
2. Add these variables:

```
base_url: http://localhost:5000
user_token: YOUR_USER_JWT_TOKEN
admin_token: YOUR_ADMIN_JWT_TOKEN
ticket_id: (will be set from responses)
```

---

## 📝 Step 1: Login (Get Tokens)

### Owner/Admin Login
```
POST {{base_url}}/api/auth/login
```

**Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Save the token** to `admin_token` environment variable.

### User Login (Optional - for testing user endpoints)
```
POST {{base_url}}/api/auth/login
```

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Save the token** to `user_token` environment variable.

---

## 📝 Step 2: Submit Support Ticket (Public - No Auth)

### Request
```
POST {{base_url}}/api/support/tickets
```

### Headers
```
Content-Type: application/json
(No Authorization header required)
```

### Body
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Payment Issue",
  "message": "I'm having trouble with my payment. The transaction failed but money was deducted.",
  "type": "billing",
  "priority": "high"
}
```

### Expected Response (201 Created)
```json
{
  "status": "success",
  "message": "Support ticket created successfully",
  "data": {
    "ticket": {
      "_id": "507f1f77bcf86cd799439011",
      "userId": null,
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Payment Issue",
      "message": "...",
      "type": "billing",
      "priority": "high",
      "status": "open",
      "replies": [],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Save `_id` to `ticket_id` environment variable**

---

## 📝 Step 3: Submit Ticket with Auth (Optional)

### Request
```
POST {{base_url}}/api/support/tickets
```

### Headers
```
Authorization: Bearer {{user_token}}
Content-Type: application/json
```

### Body
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "subject": "Feature Request",
  "message": "I would like to request a new feature for animal tracking.",
  "type": "feature_request",
  "priority": "medium"
}
```

**Note:** If user is logged in, their name and email from account will be used automatically.

---

## 📝 Step 4: Get User's Own Tickets (Authenticated)

### Request
```
GET {{base_url}}/api/support/tickets
```

### Headers
```
Authorization: Bearer {{user_token}}
```

### Query Parameters (Optional)
```
status: open
page: 1
limit: 20
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "tickets": [
      {
        "_id": "...",
        "userId": "...",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "subject": "Feature Request",
        "status": "open",
        "priority": "medium",
        "type": "feature_request",
        "replies": [],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "pages": 1
    }
  }
}
```

---

## 📝 Step 5: User Reply to Own Ticket

### Request
```
POST {{base_url}}/api/support/tickets/{{ticket_id}}/reply
```

### Headers
```
Authorization: Bearer {{user_token}}
Content-Type: application/json
```

### Body
```json
{
  "message": "Thank you for the update. I've tried the solution and it works now."
}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "status": "open",
      "replies": [
        {
          "message": "Thank you for the update...",
          "repliedBy": "...",
          "repliedByName": "Jane Doe",
          "isAdmin": false,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  }
}
```

---

## 📝 Step 6: Get All Tickets (Admin Only)

### Request
```
GET {{base_url}}/api/admin/support/tickets
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Query Parameters (Optional)
```
status: open
type: billing
priority: high
userId: 507f1f77bcf86cd799439012
page: 1
limit: 20
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "tickets": [
      {
        "_id": "...",
        "userId": {
          "_id": "...",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "name": "John Doe",
        "email": "john@example.com",
        "subject": "Payment Issue",
        "message": "...",
        "type": "billing",
        "priority": "high",
        "status": "open",
        "replies": [],
        "assignedTo": null,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

---

## 📝 Step 7: Get Single Ticket Details (Admin Only)

### Request
```
GET {{base_url}}/api/admin/support/tickets/{{ticket_id}}
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "ticket": {
      "_id": "...",
      "userId": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+1234567890"
      },
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Payment Issue",
      "message": "...",
      "type": "billing",
      "priority": "high",
      "status": "open",
      "replies": [
        {
          "message": "Thank you...",
          "repliedBy": {
            "_id": "...",
            "name": "Jane Doe",
            "email": "jane@example.com",
            "role": "user"
          },
          "repliedByName": "Jane Doe",
          "isAdmin": false,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "assignedTo": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

## 📝 Step 8: Update Ticket Status (Admin Only)

### Request
```
PATCH {{base_url}}/api/admin/support/tickets/{{ticket_id}}/status
```

### Headers
```
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

### Body (Update Status Only)
```json
{
  "status": "in_progress"
}
```

### Body (Update Status + Assign)
```json
{
  "status": "in_progress",
  "assignedTo": "507f1f77bcf86cd799439013"
}
```

### Body (Unassign)
```json
{
  "assignedTo": null
}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "message": "Ticket status updated successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "status": "in_progress",
      "assignedTo": "507f1f77bcf86cd799439013",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Valid Statuses:** `open`, `in_progress`, `resolved`, `closed`

---

## 📝 Step 9: Admin Reply to Ticket

### Request
```
POST {{base_url}}/api/admin/support/tickets/{{ticket_id}}/reply
```

### Headers
```
Authorization: Bearer {{admin_token}}
Content-Type: application/json
```

### Body
```json
{
  "message": "We've investigated the issue and fixed it. Please try the payment again. If the problem persists, let us know."
}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "status": "in_progress",
      "replies": [
        {
          "message": "We've investigated...",
          "repliedBy": {
            "_id": "...",
            "name": "Admin User",
            "email": "admin@example.com",
            "role": "admin"
          },
          "repliedByName": "Admin User",
          "isAdmin": true,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  }
}
```

**Note:** If ticket was `closed` or `resolved`, status auto-updates to `in_progress` when admin replies.

---

## 📝 Step 10: Get Ticket Statistics (Admin Only)

### Request
```
GET {{base_url}}/api/admin/support/statistics
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "total": 150,
    "byStatus": {
      "open": 25,
      "in_progress": 10,
      "resolved": 80,
      "closed": 35
    },
    "byType": {
      "technical": 50,
      "billing": 40,
      "feature_request": 30,
      "bug_report": 20,
      "general": 10
    },
    "byPriority": {
      "low": 30,
      "medium": 70,
      "high": 40,
      "urgent": 10
    }
  }
}
```

---

## 📝 Step 11: Delete Ticket (Admin Only)

### Request
```
DELETE {{base_url}}/api/admin/support/tickets/{{ticket_id}}
```

### Headers
```
Authorization: Bearer {{admin_token}}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "message": "Support ticket deleted successfully"
}
```

---

## 🧪 Complete Test Flow

### Test Scenario 1: Full Ticket Lifecycle

1. ✅ **Submit Ticket** (Public)
   ```
   POST /api/support/tickets
   Body: { name, email, subject, message, type: "billing", priority: "high" }
   ```
   → Save `ticket_id` from response

2. ✅ **Admin View Ticket**
   ```
   GET /api/admin/support/tickets/{{ticket_id}}
   ```
   → Verify ticket details

3. ✅ **Admin Update Status**
   ```
   PATCH /api/admin/support/tickets/{{ticket_id}}/status
   Body: { "status": "in_progress", "assignedTo": "ADMIN_ID" }
   ```

4. ✅ **Admin Reply**
   ```
   POST /api/admin/support/tickets/{{ticket_id}}/reply
   Body: { "message": "We're working on it..." }
   ```

5. ✅ **User Reply**
   ```
   POST /api/support/tickets/{{ticket_id}}/reply
   Body: { "message": "Thank you..." }
   ```

6. ✅ **Admin Resolve**
   ```
   PATCH /api/admin/support/tickets/{{ticket_id}}/status
   Body: { "status": "resolved" }
   ```

7. ✅ **Admin Close**
   ```
   PATCH /api/admin/support/tickets/{{ticket_id}}/status
   Body: { "status": "closed" }
   ```

---

## 🔍 Filtering Examples

### Get Open Tickets Only
```
GET /api/admin/support/tickets?status=open
```

### Get Billing Tickets
```
GET /api/admin/support/tickets?type=billing
```

### Get High Priority Tickets
```
GET /api/admin/support/tickets?priority=high
```

### Get Tickets by User
```
GET /api/admin/support/tickets?userId=507f1f77bcf86cd799439012
```

### Combined Filters
```
GET /api/admin/support/tickets?status=open&type=billing&priority=high&page=1&limit=10
```

---

## 📋 Postman Collection JSON

### Export Collection
```json
{
  "info": {
    "name": "Support Tickets API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Submit Ticket (Public)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"John Doe\",\n  \"email\": \"john@example.com\",\n  \"subject\": \"Payment Issue\",\n  \"message\": \"I'm having trouble with my payment.\",\n  \"type\": \"billing\",\n  \"priority\": \"high\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/support/tickets",
          "host": ["{{base_url}}"],
          "path": ["api", "support", "tickets"]
        }
      }
    },
    {
      "name": "2. Get User Tickets",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{user_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/support/tickets?status=open&page=1&limit=20",
          "host": ["{{base_url}}"],
          "path": ["api", "support", "tickets"],
          "query": [
            {
              "key": "status",
              "value": "open"
            },
            {
              "key": "page",
              "value": "1"
            },
            {
              "key": "limit",
              "value": "20"
            }
          ]
        }
      }
    },
    {
      "name": "3. User Reply",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{user_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"message\": \"Thank you for the update.\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/support/tickets/{{ticket_id}}/reply",
          "host": ["{{base_url}}"],
          "path": ["api", "support", "tickets", "{{ticket_id}}", "reply"]
        }
      }
    },
    {
      "name": "4. Get All Tickets (Admin)",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/admin/support/tickets?status=open&page=1&limit=20",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "support", "tickets"],
          "query": [
            {
              "key": "status",
              "value": "open"
            },
            {
              "key": "page",
              "value": "1"
            },
            {
              "key": "limit",
              "value": "20"
            }
          ]
        }
      }
    },
    {
      "name": "5. Get Single Ticket (Admin)",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/admin/support/tickets/{{ticket_id}}",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "support", "tickets", "{{ticket_id}}"]
        }
      }
    },
    {
      "name": "6. Update Status (Admin)",
      "request": {
        "method": "PATCH",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"status\": \"in_progress\",\n  \"assignedTo\": \"507f1f77bcf86cd799439013\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/admin/support/tickets/{{ticket_id}}/status",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "support", "tickets", "{{ticket_id}}", "status"]
        }
      }
    },
    {
      "name": "7. Admin Reply",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"message\": \"We've fixed the issue. Please try again.\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/admin/support/tickets/{{ticket_id}}/reply",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "support", "tickets", "{{ticket_id}}", "reply"]
        }
      }
    },
    {
      "name": "8. Get Statistics (Admin)",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/admin/support/statistics",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "support", "statistics"]
        }
      }
    },
    {
      "name": "9. Delete Ticket (Admin)",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/admin/support/tickets/{{ticket_id}}",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "support", "tickets", "{{ticket_id}}"]
        }
      }
    }
  ]
}
```

---

## ⚠️ Error Responses

### 400 Bad Request (Missing Fields)
```json
{
  "status": "fail",
  "message": "Name, email, subject, and message are required",
  "code": 400,
  "data": null
}
```

### 401 Unauthorized (Missing Token)
```json
{
  "status": "error",
  "message": "Token is required",
  "code": 401,
  "data": null
}
```

### 403 Forbidden (No Permission)
```json
{
  "status": "error",
  "message": "Insufficient permissions",
  "code": 403,
  "data": null
}
```

### 404 Not Found
```json
{
  "status": "fail",
  "message": "Support ticket not found",
  "code": 404,
  "data": null
}
```

---

## 📊 Ticket Types

- `technical` - Technical issues
- `billing` - Payment/subscription issues
- `feature_request` - Feature requests
- `bug_report` - Bug reports
- `general` - General inquiries (default)
- `other` - Other issues

---

## 🎯 Ticket Priorities

- `low` - Low priority
- `medium` - Medium priority (default)
- `high` - High priority
- `urgent` - Urgent issues

---

## 📈 Ticket Statuses

- `open` - New ticket (default)
- `in_progress` - Being worked on
- `resolved` - Issue resolved
- `closed` - Ticket closed

**Auto-updates:**
- Admin replies to `closed`/`resolved` → status → `in_progress`
- User replies to `closed`/`resolved` → status → `open`
- Status → `resolved` → `resolvedAt` auto-set
- Status → `closed` → `closedAt` auto-set

---

## ✅ Testing Checklist

- [ ] Submit ticket (public, no auth)
- [ ] Submit ticket (with auth)
- [ ] Get user's own tickets
- [ ] User reply to own ticket
- [ ] Get all tickets (admin)
- [ ] Get single ticket (admin)
- [ ] Update ticket status (admin)
- [ ] Assign ticket to admin
- [ ] Admin reply to ticket
- [ ] Get statistics (admin)
- [ ] Filter by status
- [ ] Filter by type
- [ ] Filter by priority
- [ ] Pagination test
- [ ] Delete ticket (admin)

---

## 🔗 Quick Reference

| Method | Endpoint | Auth | Permission | Purpose |
|--------|----------|------|------------|---------|
| POST | `/api/support/tickets` | Optional | - | Submit ticket |
| GET | `/api/support/tickets` | Yes | - | Get user's tickets |
| POST | `/api/support/tickets/:id/reply` | Yes | - | User reply |
| GET | `/api/admin/support/tickets` | Yes | `support.read` | Get all tickets |
| GET | `/api/admin/support/tickets/:id` | Yes | `support.read` | Get single ticket |
| PATCH | `/api/admin/support/tickets/:id/status` | Yes | `support.manage` | Update status |
| POST | `/api/admin/support/tickets/:id/reply` | Yes | `support.manage` | Admin reply |
| DELETE | `/api/admin/support/tickets/:id` | Yes | `support.manage` | Delete ticket |
| GET | `/api/admin/support/statistics` | Yes | `support.read` | Get statistics |
