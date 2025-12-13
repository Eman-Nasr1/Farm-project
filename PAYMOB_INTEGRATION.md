# Paymob Multi-Currency Integration Guide

This document describes the Paymob payment gateway integration with multi-currency support for the Farm SaaS application.

## Overview

The application now supports multi-currency payments through Paymob:
- **Egypt (EG)**: EGP (Egyptian Pound)
- **Saudi Arabia (SA)**: SAR (Saudi Riyal)
- **Other countries**: USD (US Dollar)

## Environment Variables

Add these to your `.env` file:

```env
# Paymob Configuration
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_HMAC_SECRET=your_hmac_secret_for_webhook_verification
```

## Database Models

### Plan Model (Updated)

The `Plan` model now supports multi-currency pricing through a `prices` array:

```javascript
{
  name: "Starter",
  registerationType: "fattening",
  prices: [
    { country: "EG", currency: "EGP", amount: 10000 },  // 100 EGP (in piasters)
    { country: "SA", currency: "SAR", amount: 3000 },   // 30 SAR (in halalas)
    { country: "US", currency: "USD", amount: 1000 }    // 10 USD (in cents)
  ],
  animalLimit: 50,
  isActive: true
}
```

### UserSubscription Model (New)

Tracks user subscriptions separately from the User model:

```javascript
{
  userId: ObjectId,
  planId: ObjectId,
  status: "active" | "canceled" | "past_due" | "trialing" | "expired" | "none",
  paymentMethod: "paymob" | "stripe" | "other",
  currency: "EGP" | "SAR" | "USD",
  amount: Number,
  paymobOrderId: String,
  paymobTransactionId: String,
  startedAt: Date,
  nextBillingDate: Date
}
```

### Settings Model (New)

Stores application-wide settings, including active payment gateway:

```javascript
{
  activePaymentGateway: "paymob" | "stripe"
}
```

## API Endpoints

### 1. Create Checkout Session

**Endpoint:** `POST /api/subscriptions/checkout`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "planId": "507f1f77bcf86cd799439011"
}
```

**Response (Success):**
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

**Response (Error):**
```json
{
  "status": "fail",
  "message": "Plan not found",
  "code": 404,
  "data": null
}
```

**How it works:**
1. Gets the authenticated user
2. Determines user's country from `user.country`
3. Fetches the correct plan price based on country:
   - If `country == 'EG'` → uses EGP price
   - Else if `country == 'SA'` → uses SAR price
   - Else → uses USD price
4. Creates a Paymob order and payment key
5. Returns the Paymob iframe URL

### 2. Paymob Webhook

**Endpoint:** `POST /api/webhooks/paymob`

**Headers:**
```
Content-Type: application/json
X-HMAC: <hmac_signature> (optional, for verification)
```

**Request Body (Example):**
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

**Response:**
```json
{
  "received": true
}
```

**How it works:**
1. Validates Paymob's HMAC signature (if configured)
2. Extracts order ID, transaction ID, amount, and currency
3. Finds the UserSubscription by `paymobOrderId`
4. Verifies amount and currency match
5. On successful transaction:
   - Updates subscription status to `active`
   - Updates user's subscription status
   - Saves transaction ID

## Currency Selection Logic

The system automatically selects the currency based on the user's country:

1. **Egypt (EG)**: Uses EGP price from plan
2. **Saudi Arabia (SA)**: Uses SAR price from plan
3. **Other countries**: Uses USD price from plan

If a price for the user's country is not found, the system falls back to:
- EGP for Egypt
- SAR for Saudi Arabia
- USD for all other countries

## Creating Plans with Multi-Currency Prices

Example: Creating a "Starter" plan with prices for different countries:

```javascript
const Plan = require('./Models/Plan');

const starterPlan = new Plan({
  name: "Starter",
  registerationType: "fattening",
  prices: [
    { country: "EG", currency: "EGP", amount: 10000 },  // 100 EGP
    { country: "SA", currency: "SAR", amount: 3000 },    // 30 SAR
    { country: "US", currency: "USD", amount: 1000 }     // 10 USD
  ],
  animalLimit: 50,
  isActive: true,
  interval: "month",
  intervalCount: 1
});

await starterPlan.save();
```

## Amount Format

**Important:** All amounts are stored in the currency's smallest unit:
- **EGP**: Piasters (1 EGP = 100 piasters)
- **SAR**: Halalas (1 SAR = 100 halalas)
- **USD**: Cents (1 USD = 100 cents)

Example:
- 100 EGP = 10000 piasters
- 30 SAR = 3000 halalas
- 10 USD = 1000 cents

## Frontend Integration

### Step 1: Get Checkout URL

```javascript
const response = await fetch('/api/subscriptions/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    planId: '507f1f77bcf86cd799439011'
  })
});

const data = await response.json();
const iframeUrl = data.data.url;
```

### Step 2: Display Paymob Iframe

```html
<iframe 
  src="{{ iframeUrl }}" 
  width="100%" 
  height="600px"
  frameborder="0">
</iframe>
```

Or redirect the user:

```javascript
window.location.href = iframeUrl;
```

### Step 3: Handle Success/Callback

After payment, Paymob will redirect to your success URL (configured in Paymob dashboard) or call the webhook. The webhook will automatically activate the subscription.

## Testing

### Test with Paymob Test Cards

Paymob provides test cards for different scenarios. Check Paymob's documentation for current test card numbers.

### Test Webhook Locally

Use a tool like [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 5000
```

Then configure the webhook URL in Paymob dashboard:
```
https://your-ngrok-url.ngrok.io/api/webhooks/paymob
```

## Error Handling

Common errors and solutions:

1. **"PAYMOB_API_KEY environment variable is not set"**
   - Add `PAYMOB_API_KEY` to your `.env` file

2. **"No price configured for your country"**
   - Ensure the plan has a price entry for the user's country

3. **"Failed to create Paymob order"**
   - Check Paymob API credentials
   - Verify network connectivity
   - Check Paymob dashboard for API status

## Future Enhancements

The code is structured to easily add Stripe support:

1. The `paymentGatewayService` routes to the active gateway
2. Settings model allows switching between gateways
3. UserSubscription model supports both Paymob and Stripe IDs

To add Stripe:
1. Create `services/stripeService.js`
2. Update `paymentGatewayService.js` to handle Stripe
3. Update webhook controller with Stripe handler (already exists)

## Support

For issues or questions:
1. Check Paymob API documentation
2. Review webhook logs in your server console
3. Verify environment variables are set correctly

