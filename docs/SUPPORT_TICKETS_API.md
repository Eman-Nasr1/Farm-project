# Support Tickets API Documentation

## 📋 Overview
Complete REST API for support ticket management system with role-based access control.

---

## 🔐 Permissions

- `support.read` - View tickets (Admin)
- `support.manage` - Full ticket management (Admin)

---

## 📝 Public Endpoints (No Auth Required)

### 1. Submit Support Ticket
**POST** `/api/support/tickets`

Submit a new support ticket (works with or without authentication).

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Payment Issue",
  "message": "I'm having trouble with my payment...",
  "type": "billing",           // optional: technical, billing, feature_request, bug_report, general, other
  "priority": "high"           // optional: low, medium, high, urgent
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Support ticket created successfully",
  "data": {
    "ticket": {
      "_id": "...",
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

---

## 👤 Authenticated User Endpoints

### 2. Get User's Own Tickets
**GET** `/api/support/tickets`

Get all tickets submitted by the authenticated user.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `status` (optional): Filter by status (open, in_progress, resolved, closed)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "tickets": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 3. User Reply to Ticket
**POST** `/api/support/tickets/:id/reply`

User can reply to their own ticket.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "message": "Thank you for the update. I've tried that and it works now."
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "replies": [
        {
          "message": "...",
          "repliedBy": "...",
          "repliedByName": "John Doe",
          "isAdmin": false,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  }
}
```

---

## 🔧 Admin Endpoints (Require `support.read` or `support.manage`)

### 4. Get All Tickets
**GET** `/api/admin/support/tickets`

Get all support tickets with filtering and pagination.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Query Parameters:**
- `status` (optional): Filter by status
- `type` (optional): Filter by type
- `priority` (optional): Filter by priority
- `userId` (optional): Filter by user ID
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "tickets": [
      {
        "_id": "...",
        "userId": { "name": "John Doe", "email": "john@example.com" },
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

### 5. Get Single Ticket
**GET** `/api/admin/support/tickets/:id`

Get detailed information about a specific ticket.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
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
          "message": "We're looking into this...",
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
      ],
      "assignedTo": {
        "_id": "...",
        "name": "Support Agent",
        "email": "support@example.com"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 6. Update Ticket Status
**PATCH** `/api/admin/support/tickets/:id/status`

Update ticket status and/or assign to admin.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "status": "in_progress",        // optional: open, in_progress, resolved, closed
  "assignedTo": "507f1f77bcf86cd799439011"  // optional: admin user ID or null to unassign
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Ticket status updated successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "status": "in_progress",
      "assignedTo": "507f1f77bcf86cd799439011",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 7. Admin Reply to Ticket
**POST** `/api/admin/support/tickets/:id/reply`

Admin can reply to any ticket.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Request Body:**
```json
{
  "message": "We've fixed the issue. Please try again."
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Reply added successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "status": "in_progress",  // Auto-updated from closed/resolved
      "replies": [
        {
          "message": "We've fixed the issue...",
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

### 8. Delete Ticket
**DELETE** `/api/admin/support/tickets/:id`

Permanently delete a support ticket.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Support ticket deleted successfully"
}
```

### 9. Get Ticket Statistics
**GET** `/api/admin/support/statistics`

Get statistics about support tickets.

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response (200):**
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

## 📊 Ticket Types

- `technical` - Technical issues
- `billing` - Payment/subscription issues
- `feature_request` - Feature requests
- `bug_report` - Bug reports
- `general` - General inquiries
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
- When admin replies to `closed`/`resolved` ticket → status changes to `in_progress`
- When user replies to `closed`/`resolved` ticket → status changes to `open`
- When status changes to `resolved` → `resolvedAt` is set automatically
- When status changes to `closed` → `closedAt` is set automatically

---

## 🔄 Workflow Example

1. **User submits ticket** → `POST /api/support/tickets` (status: `open`)
2. **Admin views ticket** → `GET /api/admin/support/tickets/:id`
3. **Admin updates status** → `PATCH /api/admin/support/tickets/:id/status` (status: `in_progress`)
4. **Admin replies** → `POST /api/admin/support/tickets/:id/reply`
5. **User replies** → `POST /api/support/tickets/:id/reply` (status: `open`)
6. **Admin resolves** → `PATCH /api/admin/support/tickets/:id/status` (status: `resolved`)
7. **Admin closes** → `PATCH /api/admin/support/tickets/:id/status` (status: `closed`)

---

## 🎨 Frontend Integration Examples

### Submit Ticket (Public)
```javascript
const submitTicket = async (ticketData) => {
  const response = await fetch('/api/support/tickets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Optional: Authorization header if user is logged in
    },
    body: JSON.stringify(ticketData),
  });
  return response.json();
};
```

### Get User Tickets (Authenticated)
```javascript
const getUserTickets = async (token, filters = {}) => {
  const queryParams = new URLSearchParams(filters);
  const response = await fetch(`/api/support/tickets?${queryParams}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
};
```

### Admin Get All Tickets
```javascript
const getAllTickets = async (token, filters = {}) => {
  const queryParams = new URLSearchParams(filters);
  const response = await fetch(`/api/admin/support/tickets?${queryParams}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.json();
};
```

---

## ✅ Features

- ✅ Public ticket submission (with or without auth)
- ✅ User can view and reply to their own tickets
- ✅ Admin full CRUD operations
- ✅ Ticket status management
- ✅ Reply system (admin and user)
- ✅ Assignment to admins
- ✅ Statistics dashboard
- ✅ Pagination support
- ✅ Filtering by status, type, priority, user
- ✅ Auto-update timestamps (resolvedAt, closedAt)
- ✅ Role-based access control (RBAC)
- ✅ Clean, scalable architecture

