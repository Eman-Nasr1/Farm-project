# Stripe Subscription Integration - Usage Guide

## Overview

This implementation provides a complete Stripe subscription system for your Farm management SaaS. Users can subscribe to plans based on their registration type (fattening or breeding) with a 1-month free trial.

## Environment Variables

Add these to your `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

**Note:** `.env.example` file creation was blocked, but you should add the above variables to your `.env` file.

## Setup Steps

### 1. Stripe Dashboard Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create Products for "Fattening Plan" and "Breeding Plan"
3. Create Prices for each product (monthly recurring)
4. Copy the `price_xxx` IDs

### 2. Create Plans in Database (Admin)

Use the admin API to create plans:

```bash
POST /api/admin/plans
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Fattening Plan",
  "registerationType": "fattening",
  "stripePriceId": "price_xxxxx",
  "currency": "usd",
  "interval": "month",
  "amount": 2999,
  "isActive": true
}
```

### 3. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`

## API Endpoints

### Admin Plan Management

- `POST /api/admin/plans` - Create a plan (admin only)
- `GET /api/admin/plans` - List all plans (admin only)
- `GET /api/admin/plans/:id` - Get a plan by ID (admin only)
- `PUT /api/admin/plans/:id` - Update a plan (admin only)
- `DELETE /api/admin/plans/:id` - Deactivate a plan (admin only)

### User Subscription

- `GET /api/subscriptions/plans` - Get available plans (filtered by user's registration type)
- `POST /api/subscriptions/checkout` - Create checkout session
- `GET /api/subscriptions/status` - Get current subscription status

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook endpoint (no auth required)

## Protecting Paid Features

Use the `requireActiveSubscription` middleware to protect routes that require an active subscription:

```javascript
// Example: Protect animal routes
const express = require('express');
const router = express.Router();
const animalcontroller = require('../Controllers/animal.controller');
const verifytoken = require('../middleware/verifytoken');
const requireActiveSubscription = require('../middleware/requireActiveSubscription');

// This route requires both authentication AND active subscription
router.post(
  '/api/animal/addanimal',
  verifytoken,                    // First check authentication
  requireActiveSubscription,       // Then check subscription
  animalcontroller.addanimal
);

// You can also protect multiple routes at once
router.use(verifytoken);
router.use(requireActiveSubscription);

router.get('/api/animal/getallanimals', animalcontroller.getallanimals);
router.post('/api/animal/addanimal', animalcontroller.addanimal);
// ... all routes here require active subscription
```

The middleware allows access if `subscriptionStatus` is `"active"` or `"trialing"`.

## User Model Updates

The User model now includes these fields:

```javascript
subscriptionStatus: { 
  type: String, 
  enum: ["active", "canceled", "past_due", "trialing", "none"], 
  default: "none" 
},
stripeCustomerId: { type: String },
stripeSubscriptionId: { type: String },
subscriptionCurrentPeriodEnd: { type: Date }
```

## Subscription Flow

1. **User Registration**: User selects `registerationType` (fattening or breeding)
2. **View Plans**: User calls `GET /api/subscriptions/plans` to see available plans
3. **Subscribe**: User calls `POST /api/subscriptions/checkout` with `planId`
4. **Stripe Checkout**: User is redirected to Stripe Checkout page
5. **Trial Period**: Subscription starts with 30-day free trial (`trialing` status)
6. **Webhook Updates**: Stripe sends webhooks to update subscription status
7. **After Trial**: Subscription automatically becomes `active` and charges begin

## Testing

### Test Mode

1. Use Stripe test keys (`sk_test_...`)
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date and CVC
4. Test webhooks using Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

### Production

1. Switch to live keys (`sk_live_...`)
2. Update webhook endpoint to production URL
3. Update `successUrl` and `cancelUrl` in checkout requests

## Important Notes

1. **Webhook Security**: The webhook endpoint uses Stripe signature verification - never skip this in production
2. **Raw Body**: The webhook route uses `express.raw()` middleware - this is configured in `index.js`
3. **Trial Period**: All subscriptions get 30 days free trial automatically
4. **Status Mapping**: Stripe statuses are mapped to local enum values in the webhook handler
5. **Customer Creation**: Stripe customers are created automatically on first subscription attempt

## Troubleshooting

### Webhook not receiving events
- Check `STRIPE_WEBHOOK_SECRET` is set correctly
- Verify webhook endpoint URL in Stripe dashboard
- Ensure webhook route is registered BEFORE `express.json()` middleware

### Subscription status not updating
- Check webhook events are being received (check server logs)
- Verify user has `stripeCustomerId` set
- Check webhook handler logs for errors

### Checkout session creation fails
- Verify `stripePriceId` exists in Stripe
- Ensure plan is active (`isActive: true`)
- Check user's `registerationType` matches plan's `registerationType`

