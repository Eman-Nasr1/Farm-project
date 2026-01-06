# Paymob Payment Cycle - Postman Testing Guide

## 📋 Overview
This guide explains how to test the complete Paymob payment cycle using Postman.

---

## 🔧 Setup Postman Environment

### Create Environment Variables

1. Open Postman → **Environments** → **Create Environment**
2. Add these variables:

```
base_url: http://localhost:5000
token: YOUR_JWT_TOKEN_HERE
plan_id: YOUR_PLAN_ID
discount_code: SAVE20 (optional)
```

---

## 📝 Step 1: Get Plans (Optional - to get planId)

### Request
```
GET {{base_url}}/api/admin/plans
```

### Headers
```
(No headers required - public endpoint)
```

### Response
```json
{
  "status": "success",
  "data": {
    "plans": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Premium Plan",
        "prices": [
          { "currency": "USD", "amount": 100 },
          { "currency": "EGP", "amount": 10000 }
        ],
        "isActive": true
      }
    ]
  }
}
```

**Copy the `_id` of a plan to use as `plan_id`**

---

## 📝 Step 2: Login (Get JWT Token)

### Request
```
POST {{base_url}}/api/auth/login
```

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "email": "owner@example.com",
  "password": "password123"
}
```

### Response
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accountType": "owner",
    "user": {
      "id": "507f1f77bcf86cd799439012",
      "email": "owner@example.com"
    }
  }
}
```

**Copy the `token` and set it in your environment variable**

---

## 📝 Step 3: Create Checkout Session

### Request
```
POST {{base_url}}/api/subscriptions/checkout
```

### Headers
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

### Body (Without Discount Code)
```json
{
  "planId": "{{plan_id}}"
}
```

### Body (With Discount Code)
```json
{
  "planId": "{{plan_id}}",
  "discountCode": "{{discount_code}}"
}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "url": "https://accept.paymob.com/api/acceptance/iframes/123456?payment_token=abc123...&amount_cents=10000",
    "orderId": "123456",
    "paymentKey": "token_abc123",
    "amount": 10000,
    "currency": "EGP",
    "displayPrice": {
      "amount": 100,
      "currency": "USD"
    },
    "subscriptionId": "507f1f77bcf86cd799439013"
  }
}
```

### Save for Next Steps
- **orderId**: Save this for webhook testing
- **subscriptionId**: Save this for status checking
- **url**: This is the Paymob payment URL

---

## 📝 Step 4: Test Paymob URL (Browser)

### Manual Test
1. Copy the `url` from Step 3 response
2. Open it in a browser
3. You'll see Paymob payment page
4. Use Paymob test cards:
   - **Card**: `4987654321098769`
   - **CVV**: `123`
   - **Expiry**: Any future date (e.g., `12/25`)
   - **Name**: Any name

### Test Cards (Paymob)
- **Success**: `4987654321098769`
- **Failure**: `5123456789012346`
- **3D Secure**: `4987654321098769` (will redirect to 3DS page)

---

## 📝 Step 5: Simulate Paymob Redirect (Manual)

### After Payment Success
Paymob will redirect to:
```
GET {{base_url}}/api/payments/paymob/return?success=true&id=789&order_id=123456&amount_cents=10000
```

### Test in Postman

#### Request
```
GET {{base_url}}/api/payments/paymob/return
```

#### Query Parameters
```
success: true
id: 789
order_id: 123456
amount_cents: 10000
```

### Expected Response
**HTTP 302 Redirect** to:
```
https://mazraaonline.com/payment/success?order_id=123456&transaction_id=789
```

**Note**: Postman will show the redirect URL in the response headers.

---

## 📝 Step 6: Check Subscription Status

### Request
```
GET {{base_url}}/api/subscriptions/current
```

### Headers
```
Authorization: Bearer {{token}}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "userId": "507f1f77bcf86cd799439012",
    "planId": "507f1f77bcf86cd799439011",
    "plan": {
      "name": "Premium Plan",
      "animalLimit": 100
    },
    "status": "active",
    "paymentMethod": "paymob",
    "currency": "EGP",
    "amount": 10000,
    "nextBillingDate": "2024-02-01T00:00:00.000Z",
    "paymobOrderId": "123456",
    "paymobTransactionId": "789",
    "metadata": {
      "displayPrice": {
        "amount": 100,
        "currency": "USD"
      },
      "discountAmount": 0,
      "discountCode": null
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 📝 Step 7: Simulate Paymob Webhook

### Request
```
POST {{base_url}}/api/webhooks/paymob
```

### Headers
```
Content-Type: application/json
```

### Body (Success Transaction)
```json
{
  "obj": {
    "id": 789,
    "success": true,
    "pending": false,
    "amount_cents": 10000,
    "currency": "EGP",
    "order": {
      "id": 123456
    },
    "created_at": "2024-01-01T00:00:00Z"
  },
  "hmac": "calculated_hmac_signature"
}
```

### Body (GET Request - Query Parameters)
If Paymob sends GET request, use query parameters:
```
GET {{base_url}}/api/webhooks/paymob?obj[id]=789&obj[success]=true&obj[pending]=false&obj[amount_cents]=10000&obj[order][id]=123456&hmac=signature
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "message": "Webhook processed successfully"
}
```

**Note**: HMAC verification is optional but recommended. If `PAYMOB_HMAC` is set in `.env`, webhook will verify the signature.

---

## 📝 Step 8: Validate Discount Code (Optional)

### Request
```
GET {{base_url}}/api/discount-codes/validate/{{discount_code}}
```

### Headers
```
Authorization: Bearer {{token}}
```

### Expected Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "code": "SAVE20",
    "discountType": "percentage",
    "discountValue": 20,
    "discountAmount": 2000,
    "isValid": true
  }
}
```

---

## 🧪 Complete Test Flow in Postman

### Test Collection Setup

1. **Create Collection**: "Paymob Payment Flow"

2. **Add Requests in Order**:
   ```
   1. Get Plans (GET)
   2. Login (POST)
   3. Create Checkout (POST)
   4. Check Subscription Status (GET)
   5. Simulate Paymob Redirect (GET)
   6. Simulate Paymob Webhook (POST)
   7. Validate Discount Code (GET)
   ```

3. **Set Environment Variables**:
   - `base_url`: `http://localhost:5000`
   - `token`: (from login response)
   - `plan_id`: (from get plans response)
   - `order_id`: (from checkout response)
   - `subscription_id`: (from checkout response)

---

## 📋 Postman Collection JSON

### Export Collection
```json
{
  "info": {
    "name": "Paymob Payment Flow",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Get Plans",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/admin/plans",
          "host": ["{{base_url}}"],
          "path": ["api", "admin", "plans"]
        }
      }
    },
    {
      "name": "2. Login",
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
          "raw": "{\n  \"email\": \"owner@example.com\",\n  \"password\": \"password123\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/auth/login",
          "host": ["{{base_url}}"],
          "path": ["api", "auth", "login"]
        }
      }
    },
    {
      "name": "3. Create Checkout",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"planId\": \"{{plan_id}}\",\n  \"discountCode\": \"{{discount_code}}\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/subscriptions/checkout",
          "host": ["{{base_url}}"],
          "path": ["api", "subscriptions", "checkout"]
        }
      }
    },
    {
      "name": "4. Check Subscription Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/api/subscriptions/current",
          "host": ["{{base_url}}"],
          "path": ["api", "subscriptions", "current"]
        }
      }
    },
    {
      "name": "5. Simulate Paymob Redirect",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/payments/paymob/return?success=true&id=789&order_id={{order_id}}&amount_cents=10000",
          "host": ["{{base_url}}"],
          "path": ["api", "payments", "paymob", "return"],
          "query": [
            {
              "key": "success",
              "value": "true"
            },
            {
              "key": "id",
              "value": "789"
            },
            {
              "key": "order_id",
              "value": "{{order_id}}"
            },
            {
              "key": "amount_cents",
              "value": "10000"
            }
          ]
        }
      }
    },
    {
      "name": "6. Simulate Paymob Webhook",
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
          "raw": "{\n  \"obj\": {\n    \"id\": 789,\n    \"success\": true,\n    \"pending\": false,\n    \"amount_cents\": 10000,\n    \"currency\": \"EGP\",\n    \"order\": {\n      \"id\": {{order_id}}\n    }\n  }\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/webhooks/paymob",
          "host": ["{{base_url}}"],
          "path": ["api", "webhooks", "paymob"]
        }
      }
    }
  ]
}
```

---

## 🔍 Testing Scenarios

### Scenario 1: Successful Payment Flow

1. ✅ Login
2. ✅ Create Checkout (get orderId)
3. ✅ Simulate Paymob Redirect (success=true)
4. ✅ Check Subscription Status (should be 'active')
5. ✅ Simulate Webhook (success=true)

### Scenario 2: Failed Payment Flow

1. ✅ Login
2. ✅ Create Checkout (get orderId)
3. ✅ Simulate Paymob Redirect (success=false)
4. ✅ Check Subscription Status (should be 'trialing' or not found)

### Scenario 3: With Discount Code

1. ✅ Login
2. ✅ Validate Discount Code
3. ✅ Create Checkout (with discountCode)
4. ✅ Verify discount applied in response

---

## ⚠️ Important Notes

### 1. Order ID Matching
- The `order_id` in redirect/webhook must match the `orderId` from checkout
- Backend uses `paymobOrderId` to find the subscription

### 2. Webhook HMAC
- If `PAYMOB_HMAC` is set in `.env`, webhook will verify signature
- For testing, you can temporarily disable HMAC verification
- Or calculate HMAC using Paymob's algorithm

### 3. Subscription Status
- After checkout: `status: 'trialing'`
- After webhook success: `status: 'active'`
- Webhook is the source of truth (server-to-server)

### 4. Redirect URLs
- Success: `https://mazraaonline.com/payment/success`
- Failure: `https://mazraaonline.com/payment/failed`
- These are hardcoded in `payment.controller.js`

---

## 🐛 Troubleshooting

### Issue: "Subscription not found" in webhook
**Solution**: Make sure `order_id` in webhook matches `paymobOrderId` from checkout

### Issue: "HMAC verification failed"
**Solution**: 
- Check `PAYMOB_HMAC` in `.env`
- Or remove HMAC from webhook request for testing
- Or calculate correct HMAC signature

### Issue: "Plan not found"
**Solution**: 
- Verify `planId` exists
- Check plan is `isActive: true`
- Verify user's `registerationType` matches plan

### Issue: "Invalid discount code"
**Solution**:
- Check discount code exists
- Verify code is not expired
- Check code applies to plan/registration type

---

## 📞 Quick Reference

### Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/admin/plans` | No | Get available plans |
| POST | `/api/auth/login` | No | Get JWT token |
| POST | `/api/subscriptions/checkout` | Yes | Create checkout session |
| GET | `/api/subscriptions/current` | Yes | Check subscription status |
| GET | `/api/payments/paymob/return` | No | Handle Paymob redirect |
| POST | `/api/webhooks/paymob` | No | Handle Paymob webhook |
| GET | `/api/discount-codes/validate/:code` | Yes | Validate discount code |

---

## ✅ Checklist

- [ ] Environment variables set up
- [ ] Login successful (token obtained)
- [ ] Plan ID obtained
- [ ] Checkout created (orderId obtained)
- [ ] Paymob URL tested in browser
- [ ] Redirect simulated
- [ ] Webhook simulated
- [ ] Subscription status checked
- [ ] Discount code validated (if used)

