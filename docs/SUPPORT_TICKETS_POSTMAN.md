# Support Tickets - Postman Testing Guide

## 📋 Quick Reference

### Public Endpoints (No Auth)

#### 1. Submit Ticket
```
POST /api/support/tickets
Body: {
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Payment Issue",
  "message": "I'm having trouble...",
  "type": "billing",
  "priority": "high"
}
```

---

### User Endpoints (Auth Required)

#### 2. Get User Tickets
```
GET /api/support/tickets?status=open&page=1&limit=20
Headers: Authorization: Bearer TOKEN
```

#### 3. User Reply
```
POST /api/support/tickets/:id/reply
Headers: Authorization: Bearer TOKEN
Body: { "message": "Thank you..." }
```

---

### Admin Endpoints (Auth + Permissions Required)

#### 4. Get All Tickets
```
GET /api/admin/support/tickets?status=open&type=billing&page=1&limit=20
Headers: Authorization: Bearer ADMIN_TOKEN
```

#### 5. Get Single Ticket
```
GET /api/admin/support/tickets/:id
Headers: Authorization: Bearer ADMIN_TOKEN
```

#### 6. Update Status
```
PATCH /api/admin/support/tickets/:id/status
Headers: Authorization: Bearer ADMIN_TOKEN
Body: {
  "status": "in_progress",
  "assignedTo": "USER_ID"
}
```

#### 7. Admin Reply
```
POST /api/admin/support/tickets/:id/reply
Headers: Authorization: Bearer ADMIN_TOKEN
Body: { "message": "We've fixed it..." }
```

#### 8. Delete Ticket
```
DELETE /api/admin/support/tickets/:id
Headers: Authorization: Bearer ADMIN_TOKEN
```

#### 9. Get Statistics
```
GET /api/admin/support/statistics
Headers: Authorization: Bearer ADMIN_TOKEN
```

---

## 📝 Complete Postman Examples

### Submit Ticket (Public)
```json
POST http://localhost:5000/api/support/tickets
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Payment Issue",
  "message": "I'm having trouble with my payment. Can you help?",
  "type": "billing",
  "priority": "high"
}
```

### Get All Tickets (Admin)
```json
GET http://localhost:5000/api/admin/support/tickets?status=open&page=1&limit=20
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Reply to Ticket (Admin)
```json
POST http://localhost:5000/api/admin/support/tickets/507f1f77bcf86cd799439011/reply
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "message": "We've fixed the issue. Please try again."
}
```

---

## ✅ Response Examples

### Success Response
```json
{
  "status": "success",
  "message": "Support ticket created successfully",
  "data": {
    "ticket": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "subject": "Payment Issue",
      "status": "open",
      "priority": "high",
      "type": "billing",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

