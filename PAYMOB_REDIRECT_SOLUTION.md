# Paymob IFrame Error - Redirect Solution

## المشكلة (Problem)

خطأ: `"IFrame matching query does not exist"`

## الحل السريع (Quick Solution)

استخدم **Redirect URL** بدلاً من IFrame.

### الخطوات (Steps):

1. **أضف في `.env`:**
   ```env
   PAYMOB_USE_REDIRECT=true
   ```

2. **أعد تشغيل السيرفر:**
   ```bash
   node index
   ```

3. **جرب الطلب مرة أخرى**

### كيف يعمل (How It Works):

- **بدلاً من IFrame**: سيستخدم redirect URL
- **المستخدم سيتم توجيهه**: إلى صفحة Paymob للدفع
- **بعد الدفع**: سيتم إرجاعه إلى callback URL

## الفرق بين IFrame و Redirect

### IFrame (الحالي - لا يعمل):
```
https://accept.paymob.com/api/acceptance/iframes/{iframe_id}?payment_token={token}
```
- يعرض Paymob داخل iframe في صفحتك
- يحتاج IFrame ID صحيح

### Redirect (الحل البديل):
```
https://accept.paymob.com/api/acceptance/payments/pay?payment_token={token}
```
- ينقل المستخدم إلى صفحة Paymob مباشرة
- لا يحتاج IFrame ID
- يعمل دائماً

## الإعدادات (Configuration)

### Option 1: استخدام Redirect (موصى به)

في `.env`:
```env
PAYMOB_USE_REDIRECT=true
PAYMOB_INTEGRATION_ID=5430985
```

### Option 2: استخدام IFrame (إذا كان لديك IFrame ID)

في `.env`:
```env
PAYMOB_USE_REDIRECT=false
PAYMOB_INTEGRATION_ID=5430985
PAYMOB_IFRAME_ID=your_iframe_id_here
```

## Response Format

الـ response سيكون:
```json
{
  "status": "success",
  "data": {
    "url": "https://accept.paymob.com/api/acceptance/payments/pay?payment_token=...",
    "redirectUrl": "https://accept.paymob.com/api/acceptance/payments/pay?payment_token=...",
    "orderId": "434306858",
    ...
  }
}
```

## Frontend Integration

### مع Redirect URL:

```javascript
// في Frontend
const response = await fetch('/api/subscriptions/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ planId: '...' })
});

const data = await response.json();
const paymentUrl = data.data.url;

// توجيه المستخدم إلى صفحة الدفع
window.location.href = paymentUrl;
```

### مع IFrame (إذا كان يعمل):

```html
<iframe src="{{ paymentUrl }}" width="100%" height="600px"></iframe>
```

## ملاحظات (Notes)

1. **Redirect هو الأسهل**: لا يحتاج IFrame ID
2. **IFrame أفضل UX**: لكن يحتاج إعداد صحيح
3. **Callback URL**: تأكد من إعداد callback URL في Paymob Dashboard

## التحقق (Verification)

بعد إضافة `PAYMOB_USE_REDIRECT=true`، في logs ستجد:
```
Using Paymob redirect URL (no iframe needed)
Paymob payment URL constructed: {
  method: 'redirect',
  url: 'https://accept.paymob.com/api/acceptance/payments/pay?payment_token=...'
}
```

