# Paymob Payment Cycle - Frontend Implementation Guide

## 📋 Overview
This guide explains the complete payment flow with Paymob for subscription checkout.

---

## 🔄 Payment Flow Diagram

```
1. User selects plan
   ↓
2. Frontend calls: POST /api/subscriptions/checkout
   ↓
3. Backend returns: Paymob iframe/redirect URL
   ↓
4. Frontend redirects user to Paymob payment page
   ↓
5. User completes payment on Paymob
   ↓
6. Paymob redirects to: GET /api/payments/paymob/return
   ↓
7. Backend redirects to frontend success/failure page
   ↓
8. Frontend checks subscription status
   ↓
9. Webhook updates subscription (server-to-server)
```

---

## 📦 Step 1: Create Checkout Session

### API Endpoint
```
POST /api/subscriptions/checkout
```

### Request Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Request Body
```json
{
  "planId": "507f1f77bcf86cd799439011",
  "discountCode": "SAVE20" // Optional
}
```

### Response (Success)
```json
{
  "status": "success",
  "data": {
    "url": "https://accept.paymob.com/api/acceptance/iframes/123456?payment_token=abc123...",
    "orderId": "123456",
    "paymentKey": "token_abc123",
    "amount": 10000,
    "currency": "EGP",
    "displayPrice": {
      "amount": 100,
      "currency": "USD"
    },
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

---

## 💻 Frontend Implementation

### React Component Example

```jsx
// components/CheckoutButton.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function CheckoutButton({ planId, discountCode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleCheckout = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/checkout`,
        {
          planId,
          discountCode: discountCode || null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        const { url, orderId, subscriptionId } = response.data.data;
        
        // Store orderId and subscriptionId for later use
        sessionStorage.setItem('paymob_orderId', orderId);
        sessionStorage.setItem('subscriptionId', subscriptionId);
        
        // Redirect to Paymob payment page
        window.location.href = url;
      } else {
        setError(response.data.message || 'Failed to create checkout session');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(
        err.response?.data?.message || 
        'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <button 
        onClick={handleCheckout} 
        disabled={loading}
        className="checkout-button"
      >
        {loading ? 'Processing...' : 'Subscribe Now'}
      </button>
    </div>
  );
}
```

---

## 🔀 Step 2: Handle Payment Redirect

### Paymob Redirect Flow

After payment, Paymob redirects to:
```
GET /api/payments/paymob/return?success=true&id=123&order_id=456&amount_cents=10000
```

The backend then redirects to your frontend:
- **Success**: `https://mazraaonline.com/payment/success?order_id=456&transaction_id=123`
- **Failure**: `https://mazraaonline.com/payment/failed?order_id=456&error=payment_failed`

---

## ✅ Step 3: Payment Success Page

### React Component Example

```jsx
// pages/payment/success.js
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';

export default function PaymentSuccess() {
  const router = useRouter();
  const { order_id, transaction_id } = router.query;
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!order_id) return;

    const checkSubscriptionStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get user subscription status
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/current`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.status === 'success') {
          setSubscription(response.data.data);
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
      } finally {
        setLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [order_id]);

  return (
    <div className="payment-success-page">
      <div className="success-icon">✅</div>
      <h1>Payment Successful!</h1>
      
      {order_id && (
        <p>Order ID: {order_id}</p>
      )}
      
      {transaction_id && (
        <p>Transaction ID: {transaction_id}</p>
      )}

      {loading ? (
        <p>Verifying subscription...</p>
      ) : subscription ? (
        <div className="subscription-info">
          <h2>Your Subscription</h2>
          <p>Status: <strong>{subscription.status}</strong></p>
          <p>Plan: {subscription.plan?.name}</p>
          {subscription.nextBillingDate && (
            <p>Next Billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}</p>
          )}
        </div>
      ) : (
        <p>Subscription is being activated. Please wait a moment...</p>
      )}

      <div className="actions">
        <Link href="/dashboard">
          <button>Go to Dashboard</button>
        </Link>
      </div>
    </div>
  );
}
```

---

## ❌ Step 4: Payment Failed Page

### React Component Example

```jsx
// pages/payment/failed.js
import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function PaymentFailed() {
  const router = useRouter();
  const { order_id, error } = router.query;

  return (
    <div className="payment-failed-page">
      <div className="error-icon">❌</div>
      <h1>Payment Failed</h1>
      
      {order_id && (
        <p>Order ID: {order_id}</p>
      )}
      
      {error && (
        <p className="error-message">Error: {error}</p>
      )}

      <p>Your payment could not be processed. Please try again.</p>

      <div className="actions">
        <Link href="/pricing">
          <button>Try Again</button>
        </Link>
        <Link href="/dashboard">
          <button>Go to Dashboard</button>
        </Link>
      </div>
    </div>
  );
}
```

---

## 🔍 Step 5: Check Subscription Status

### API Endpoint
```
GET /api/subscriptions/current
```

### Request Headers
```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Response
```json
{
  "status": "success",
  "data": {
    "_id": "...",
    "userId": "...",
    "planId": "...",
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

### React Hook Example

```jsx
// hooks/useSubscription.js
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/current`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.status === 'success') {
          setSubscription(response.data.data);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch subscription');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  return { subscription, loading, error };
}
```

---

## 🎯 Complete Checkout Flow Component

### Full Example with All Steps

```jsx
// components/SubscriptionCheckout.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

export default function SubscriptionCheckout({ plan, onSuccess }) {
  const [discountCode, setDiscountCode] = useState('');
  const [discountInfo, setDiscountInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Validate discount code
  const validateDiscount = async (code) => {
    if (!code) {
      setDiscountInfo(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/discount-codes/validate/${code}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === 'success') {
        setDiscountInfo(response.data.data);
        setError(null);
      }
    } catch (err) {
      setDiscountInfo(null);
      setError('Invalid discount code');
    }
  };

  const handleCheckout = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/checkout`,
        {
          planId: plan._id,
          discountCode: discountCode || null,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.status === 'success') {
        const { url, orderId, subscriptionId } = response.data.data;
        
        // Store for redirect handling
        sessionStorage.setItem('paymob_orderId', orderId);
        sessionStorage.setItem('subscriptionId', subscriptionId);
        
        // Redirect to Paymob
        window.location.href = url;
      } else {
        setError(response.data.message || 'Failed to create checkout');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(
        err.response?.data?.message || 
        'An error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Calculate final price
  const finalPrice = discountInfo
    ? plan.prices.find(p => p.currency === 'USD').amount - discountInfo.discountAmount
    : plan.prices.find(p => p.currency === 'USD').amount;

  return (
    <div className="subscription-checkout">
      <h2>Subscribe to {plan.name}</h2>
      
      <div className="price-info">
        <p className="original-price">
          ${plan.prices.find(p => p.currency === 'USD').amount} USD
        </p>
        {discountInfo && (
          <p className="discount-info">
            Discount: {discountInfo.discountType === 'percentage' 
              ? `${discountInfo.discountValue}%` 
              : `$${discountInfo.discountValue}`}
          </p>
        )}
        <p className="final-price">
          Final Price: ${finalPrice} USD
        </p>
        <p className="payment-note">
          (Payment will be processed in EGP)
        </p>
      </div>

      <div className="discount-section">
        <input
          type="text"
          placeholder="Enter discount code (optional)"
          value={discountCode}
          onChange={(e) => {
            setDiscountCode(e.target.value);
            validateDiscount(e.target.value);
          }}
        />
        {discountInfo && (
          <span className="discount-valid">✓ Valid code</span>
        )}
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      <button 
        onClick={handleCheckout} 
        disabled={loading || !plan}
        className="checkout-button"
      >
        {loading ? 'Processing...' : 'Proceed to Payment'}
      </button>

      <p className="security-note">
        🔒 Secure payment powered by Paymob
      </p>
    </div>
  );
}
```

---

## 🔄 Polling for Subscription Status (After Redirect)

If webhook is delayed, poll for subscription status:

```jsx
// utils/pollSubscription.js
import axios from 'axios';

export async function pollSubscriptionStatus(orderId, maxAttempts = 10) {
  const token = localStorage.getItem('token');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/current`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.status === 'success') {
        const subscription = response.data.data;
        
        // Check if subscription is active and matches orderId
        if (subscription.status === 'active' && 
            subscription.paymobOrderId === orderId) {
          return subscription;
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }

    // Wait 2 seconds before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return null;
}
```

---

## 📋 Summary

### Payment Flow Steps:

1. **User selects plan** → Frontend shows plan details
2. **User enters discount code** (optional) → Validate via API
3. **User clicks "Subscribe"** → Call `POST /api/subscriptions/checkout`
4. **Backend returns Paymob URL** → Redirect user to Paymob
5. **User completes payment** → Paymob processes payment
6. **Paymob redirects** → `GET /api/payments/paymob/return`
7. **Backend redirects to frontend** → Success/Failure page
8. **Frontend checks status** → Poll subscription status
9. **Webhook updates subscription** → Server-to-server (automatic)

### Key Points:

- ✅ **Checkout URL**: Use iframe or redirect URL from backend
- ✅ **Redirect Handling**: Handle success/failure pages
- ✅ **Status Polling**: Check subscription status after redirect
- ✅ **Error Handling**: Show user-friendly error messages
- ✅ **Discount Codes**: Validate before checkout

---

## 🔗 Related Endpoints

- `POST /api/subscriptions/checkout` - Create checkout session
- `GET /api/subscriptions/current` - Get current subscription
- `GET /api/discount-codes/validate/:code` - Validate discount code
- `GET /api/payments/paymob/return` - Payment redirect (handled by backend)

---

## 🎨 CSS Styling Example

```css
.subscription-checkout {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.price-info {
  margin: 20px 0;
}

.original-price {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.discount-info {
  color: #4CAF50;
  font-weight: bold;
}

.final-price {
  font-size: 20px;
  color: #2196F3;
  font-weight: bold;
}

.checkout-button {
  width: 100%;
  padding: 15px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
}

.checkout-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  margin: 10px 0;
  padding: 10px;
  background: #ffebee;
  border-radius: 4px;
}
```

