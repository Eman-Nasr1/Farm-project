# Stripe Subscription Integration - Usage Guide

## Overview

This implementation provides a complete Stripe subscription system for your Farm management SaaS with a **30-day free trial (no card required)**. Users automatically get a free trial on registration, and after the trial ends, they must subscribe with Stripe to continue using the system.

**Key Features:**
- ✅ 30-day free trial managed entirely by the app (no Stripe subscription during trial)
- ✅ No credit card required for trial
- ✅ Animal limits: 100 animals during trial, plan-specific limits after subscription
- ✅ Automatic trial initialization on registration
- ✅ Seamless transition from trial to paid subscription

## Environment Variables

Add these to your `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Setup Steps

### 1. Stripe Dashboard Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create Products for "Fattening Plan" and "Breeding Plan"
3. Create Prices for each product with appropriate billing intervals (monthly, 3-monthly, etc.)
4. Copy the `price_xxx` IDs

### 2. Create Plans in Database (Admin)

Use the admin API to create plans. **Important:** Each plan must include an `animalLimit` field:

```bash
POST /api/admin/plans
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Fattening – up to 50 animals – 3 months",
  "registerationType": "fattening",
  "stripePriceId": "price_xxxxx",
  "currency": "usd",
  "interval": "month",
  "intervalCount": 3,
  "amount": 4500,
  "animalLimit": 50,
  "isActive": true
}
```

**Plan Fields:**
- `name`: Display name for the plan
- `registerationType`: Either `"fattening"` or `"breeding"`
- `stripePriceId`: Stripe Price ID (e.g., `price_xxx`)
- `currency`: Currency code (default: `"usd"`)
- `interval`: Billing interval (`"month"` or `"year"`)
- `intervalCount`: Number of intervals (e.g., `3` for every 3 months)
- `amount`: Price in smallest currency unit (e.g., cents for USD)
- `animalLimit`: **Required** - Maximum number of animals allowed for this plan
- `isActive`: Whether the plan is available for subscription

### 3. Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `checkout.session.completed` ⭐ **NEW**
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
- `POST /api/subscriptions/checkout` - Create checkout session (requires trial expired or user choosing to upgrade)
- `GET /api/subscriptions/status` - Get current subscription status with trial information

**Example: Get Subscription Status**

```bash
GET /api/subscriptions/status
Authorization: Bearer <user_token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "subscriptionStatus": "trialing",
    "trialStart": "2025-01-01T00:00:00.000Z",
    "trialEnd": "2025-01-31T00:00:00.000Z",
    "isTrialActive": true,
    "isTrialExpired": false,
    "planId": null,
    "animalLimit": null,
    "subscriptionCurrentPeriodEnd": null,
    "registerationType": "fattening"
  }
}
```

**Example: Create Checkout Session**

```bash
POST /api/subscriptions/checkout
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "planId": "507f1f77bcf86cd799439011",
  "successUrl": "https://your-frontend.com/subscription/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://your-frontend.com/subscription/cancel"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Checkout session created successfully",
  "data": {
    "url": "https://checkout.stripe.com/c/pay/...",
    "sessionId": "cs_test_..."
  }
}
```

### Webhooks

- `POST /api/webhooks/stripe` - Stripe webhook endpoint (no auth required)

## Protecting Paid Features

### Option 1: Basic Subscription Check

Use `requireSubscriptionOrTrial` middleware to ensure user has active subscription OR valid trial:

```javascript
const express = require('express');
const router = express.Router();
const verifytoken = require('../middleware/verifytoken');
const requireSubscriptionOrTrial = require('../middleware/requireSubscriptionOrTrial');

// This route requires authentication AND (active subscription OR valid trial)
router.post(
  '/api/some-protected-route',
  verifytoken,
  requireSubscriptionOrTrial,
  yourController.yourHandler
);
```

### Option 2: Subscription + Animal Limit Check (Recommended for Animal Creation)

Use `requireSubscriptionAndCheckAnimalLimit` middleware to enforce subscription AND animal limits:

```javascript
const express = require('express');
const router = express.Router();
const animalcontroller = require('../Controllers/animal.controller');
const verifytoken = require('../middleware/verifytoken');
const { requireSubscriptionAndCheckAnimalLimit } = require('../middleware/subscriptionLimit');

// This route checks subscription AND enforces animal limits
router.post(
  '/api/animal/addanimal',
  verifytoken,
  requireSubscriptionAndCheckAnimalLimit,
  animalcontroller.addanimal
);

// Also applied to breeding routes (creates multiple animals)
router.post(
  '/api/breeding/AddBreeding',
  verifytoken,
  requireSubscriptionAndCheckAnimalLimit,
  breedingcontroller.addBreeding
);
```

**Animal Limits:**
- **Free Trial**: Up to 100 animals (configurable in `config/subscription.js`)
- **Paid Plan**: Up to `plan.animalLimit` animals

**Error Responses:**

When animal limit is reached:
```json
{
  "status": "error",
  "code": "TRIAL_ANIMAL_LIMIT_REACHED",
  "message": "You cannot create 2 animal(s). This would exceed the free trial limit of 100 animals (current: 99). Please subscribe to a paid plan to add more animals."
}
```

When trial expired:
```json
{
  "status": "error",
  "code": "NO_SUBSCRIPTION",
  "message": "Your free trial has ended. Please subscribe to continue using the system."
}
```

## User Model Updates

The User model now includes these fields:

```javascript
// Trial fields (managed by app, not Stripe)
trialStart: { type: Date },
trialEnd: { type: Date },

// Subscription fields
subscriptionStatus: { 
  type: String, 
  enum: ["active", "canceled", "past_due", "trialing", "none"], 
  default: "none" 
},
planId: { 
  type: mongoose.Schema.Types.ObjectId, 
  ref: 'Plan' 
},
stripeCustomerId: { type: String },
stripeSubscriptionId: { type: String },
subscriptionCurrentPeriodEnd: { type: Date }
```

## Plan Model Updates

The Plan model includes:

```javascript
{
  name: String,
  registerationType: String, // "fattening" or "breeding"
  stripePriceId: String,      // Stripe Price ID
  currency: String,           // Default: "usd"
  interval: String,           // "month" or "year"
  intervalCount: Number,      // e.g., 3 for every 3 months
  amount: Number,             // Price in smallest currency unit
  animalLimit: Number,        // ⭐ REQUIRED - Max animals for this plan
  isActive: Boolean
}
```

## Subscription Flow

### 1. User Registration
- User registers with `registerationType` (fattening or breeding)
- **Automatically receives 30-day free trial** (no card required)
- `subscriptionStatus` set to `"trialing"`
- `trialStart` and `trialEnd` are set automatically
- Can create up to **100 animals** during trial

### 2. During Trial
- User can use all features with trial limits
- `GET /api/subscriptions/status` shows `isTrialActive: true`
- No Stripe subscription exists yet
- User can optionally upgrade to paid plan before trial ends

### 3. Trial Expires
- After 30 days, `isTrialActive` becomes `false`
- `isTrialExpired` becomes `true`
- User must subscribe to continue
- Protected routes return `402 Payment Required`

### 4. Subscribe to Paid Plan
- User calls `POST /api/subscriptions/checkout` with `planId`
- Redirected to Stripe Checkout (card required)
- **No trial_period_days** - user already used free trial
- After successful payment, webhook updates user:
  - `subscriptionStatus` → `"active"`
  - `planId` → selected plan
  - `animalLimit` → plan's `animalLimit`

### 5. Active Subscription
- User can create animals up to `plan.animalLimit`
- Subscription renews automatically based on plan's `interval` and `intervalCount`
- Webhooks keep subscription status in sync

## Configuration

### Trial Animal Limit

Edit `config/subscription.js` to change the trial animal limit:

```javascript
module.exports = {
  TRIAL_ANIMAL_LIMIT: 100, // Change this value as needed
};
```

## Testing

### Test Mode

1. Use Stripe test keys (`sk_test_...`)
2. Use test card: `4242 4242 4242 4242`
3. Any future expiry date and CVC
4. Test webhooks using Stripe CLI:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

### Testing the Trial Flow

1. Register a new user → automatically gets 30-day trial
2. Check subscription status → should show `isTrialActive: true`
3. Create animals → allowed up to 100
4. Try to create 101st animal → should get `TRIAL_ANIMAL_LIMIT_REACHED` error
5. Wait for trial to expire OR manually set `trialEnd` to past date
6. Try to create animal → should get `NO_SUBSCRIPTION` error
7. Subscribe to a plan → should work normally

### Production

1. Switch to live keys (`sk_live_...`)
2. Update webhook endpoint to production URL
3. Update `successUrl` and `cancelUrl` in checkout requests

## Important Notes

1. **Trial Management**: The 30-day free trial is managed entirely by the app, NOT by Stripe. No Stripe subscription is created during the trial period.

2. **No Card for Trial**: Users can start using the system immediately after registration without providing payment information.

3. **Animal Limits**: 
   - Trial: 100 animals (configurable)
   - Paid: Based on `plan.animalLimit`
   - Limits are enforced when creating animals (single or multiple via breeding)

4. **Webhook Security**: The webhook endpoint uses Stripe signature verification - never skip this in production

5. **Raw Body**: The webhook route uses `express.raw()` middleware - this is configured in `index.js` BEFORE `express.json()`

6. **Checkout Session**: Does NOT include `trial_period_days` because users already used the free trial

7. **Plan Matching**: Users can only subscribe to plans matching their `registerationType`

8. **Existing Users**: Users without trial fields will get them initialized on first login (if no subscription exists)

## Troubleshooting

### Trial not starting on registration
- Check user registration endpoint logs
- Verify `trialStart` and `trialEnd` are being set
- Check `subscriptionStatus` is set to `"trialing"`

### Animal limit not enforced
- Verify middleware is applied to animal creation routes
- Check `config/subscription.js` has correct `TRIAL_ANIMAL_LIMIT`
- Ensure plan has `animalLimit` field set

### Webhook not receiving events
- Check `STRIPE_WEBHOOK_SECRET` is set correctly
- Verify webhook endpoint URL in Stripe dashboard
- Ensure webhook route is registered BEFORE `express.json()` middleware
- Add `checkout.session.completed` event to webhook configuration

### Subscription status not updating
- Check webhook events are being received (check server logs)
- Verify user has `stripeCustomerId` set
- Check webhook handler logs for errors
- Ensure `planId` is in subscription metadata

### Checkout session creation fails
- Verify `stripePriceId` exists in Stripe
- Ensure plan is active (`isActive: true`)
- Check user's `registerationType` matches plan's `registerationType`
- Verify user's trial has expired OR they're choosing to upgrade

### User can't create animals after subscribing
- Check `planId` is set on user document
- Verify plan has `animalLimit` field
- Check middleware is correctly checking subscription status
- Ensure webhook updated user's `planId` after checkout

## Example: Complete User Journey

1. **Day 0 - Registration**
   ```json
   {
     "subscriptionStatus": "trialing",
     "trialStart": "2025-01-01T00:00:00.000Z",
     "trialEnd": "2025-01-31T00:00:00.000Z",
     "isTrialActive": true,
     "animalLimit": null // Uses TRIAL_ANIMAL_LIMIT (100)
   }
   ```

2. **Day 15 - During Trial**
   - User creates 50 animals ✅
   - User creates 50 more animals ✅
   - User tries to create 1 more → ❌ `TRIAL_ANIMAL_LIMIT_REACHED`

3. **Day 31 - Trial Expired**
   ```json
   {
     "subscriptionStatus": "trialing",
     "isTrialActive": false,
     "isTrialExpired": true
   }
   ```
   - User tries to create animal → ❌ `NO_SUBSCRIPTION`

4. **Day 31 - User Subscribes**
   - User calls `POST /api/subscriptions/checkout`
   - Completes Stripe checkout
   - Webhook updates user:
   ```json
   {
     "subscriptionStatus": "active",
     "planId": "507f1f77bcf86cd799439011",
     "animalLimit": 50 // From plan
   }
   ```

5. **Day 32+ - Active Subscription**
   - User can create up to 50 animals ✅
   - Subscription renews automatically every 3 months
