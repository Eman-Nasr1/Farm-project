# API Examples - Paymob Integration

## POST /api/subscriptions/checkout

### Request
```json
{
  "planId": "507f1f77bcf86cd799439011"
}
```

### Response (Success)
```json
{
  "status": "success",
  "message": "Checkout created successfully",
  "data": {
    "gateway": "paymob",
    "url": "https://accept.paymob.com/api/acceptance/iframes/123456?payment_token=token_xxx",
    "orderId": "123456",
    "paymentKey": "token_xxx",
    "amount": 10000,
    "currency": "EGP",
    "planId": "507f1f77bcf86cd799439011",
    "planName": "Starter",
    "subscriptionId": "507f1f77bcf86cd799439012"
  }
}
```

### Response (Error)
```json
{
  "status": "fail",
  "message": "Plan not found",
  "code": 404,
  "data": null
}
```

## POST /api/webhooks/paymob

### Request (from Paymob)
```json
{
  "obj": {
    "id": 123456789,
    "order": {
      "id": 987654321
    },
    "amount_cents": 10000,
    "currency": "EGP",
    "success": true
  }
}
```

### Response
```json
{
  "received": true
}
```

