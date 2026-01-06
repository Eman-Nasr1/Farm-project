# Paymob Payment - Quick Start Guide

## 🚀 Quick Implementation

### 1. Create Checkout

```jsx
const handleCheckout = async (planId, discountCode = null) => {
  const token = localStorage.getItem('token');
  
  const response = await axios.post(
    `${API_URL}/api/subscriptions/checkout`,
    { planId, discountCode },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  if (response.data.status === 'success') {
    // Redirect to Paymob
    window.location.href = response.data.data.url;
  }
};
```

### 2. Handle Success Redirect

```jsx
// pages/payment/success.js
export default function PaymentSuccess() {
  const { order_id } = useRouter().query;
  
  useEffect(() => {
    // Check subscription status after 2 seconds
    setTimeout(() => {
      checkSubscriptionStatus();
    }, 2000);
  }, [order_id]);
  
  return <div>Payment Successful! Order: {order_id}</div>;
}
```

### 3. Handle Failure Redirect

```jsx
// pages/payment/failed.js
export default function PaymentFailed() {
  const { order_id, error } = useRouter().query;
  
  return (
    <div>
      <h1>Payment Failed</h1>
      <p>Order: {order_id}</p>
      <p>Error: {error}</p>
    </div>
  );
}
```

---

## 📋 API Endpoints

### Create Checkout
```
POST /api/subscriptions/checkout
Body: { planId, discountCode? }
Response: { url, orderId, amount, currency }
```

### Check Subscription
```
GET /api/subscriptions/current
Headers: Authorization: Bearer TOKEN
Response: { subscription }
```

---

## 🔄 Flow

```
1. POST /api/subscriptions/checkout
   ↓
2. Redirect to Paymob URL
   ↓
3. User pays on Paymob
   ↓
4. Paymob redirects to /api/payments/paymob/return
   ↓
5. Backend redirects to /payment/success or /payment/failed
   ↓
6. Frontend checks subscription status
```

---

## ✅ Complete Example

```jsx
import axios from 'axios';

// 1. Checkout
const checkout = async (planId) => {
  const res = await axios.post(
    '/api/subscriptions/checkout',
    { planId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  window.location.href = res.data.data.url;
};

// 2. Success Page
const PaymentSuccess = () => {
  const { order_id } = useRouter().query;
  return <div>Success! Order: {order_id}</div>;
};

// 3. Failed Page
const PaymentFailed = () => {
  const { error } = useRouter().query;
  return <div>Failed: {error}</div>;
};
```

---

## 🎯 Key Points

- ✅ **Checkout**: Returns Paymob iframe/redirect URL
- ✅ **Redirect**: Backend handles Paymob redirect
- ✅ **Status**: Poll subscription after redirect
- ✅ **Webhook**: Updates subscription automatically (server-side)

