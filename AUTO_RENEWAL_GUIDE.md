# Auto-Renewal Guide - Paymob Subscriptions

## نظرة عامة (Overview)

تم تنفيذ نظام التجديد التلقائي للاشتراكات مع Paymob. النظام يعمل بشكل مشابه لـ Stripe ولكن يتطلب بعض الإعدادات الإضافية.

## الميزات (Features)

### ✅ ما تم تنفيذه:

1. **حقول جديدة في UserSubscription:**
   - `autoRenew`: تفعيل/إلغاء التجديد التلقائي (افتراضي: true)
   - `paymentToken`: حفظ token للدفع التلقائي
   - `lastRenewalAttempt`: تاريخ آخر محاولة تجديد
   - `failedRenewalAttempts`: عدد محاولات التجديد الفاشلة

2. **Cron Job للتجديد التلقائي:**
   - يعمل كل 6 ساعات (00:00, 06:00, 12:00, 18:00)
   - يتحقق من الاشتراكات المستحقة للتجديد
   - يعالج التجديد تلقائياً

3. **Endpoints جديدة:**
   - `PUT /api/subscriptions/auto-renew`: تفعيل/إلغاء التجديد التلقائي
   - `PUT /api/subscriptions/cancel`: إلغاء الاشتراك

## كيف يعمل النظام (How It Works)

### 1. عند الدفع الأولي (Initial Payment)

عندما يدفع المستخدم لأول مرة:
- يتم حفظ `paymentToken` من Paymob (إذا كان متاحاً)
- يتم تفعيل `autoRenew` تلقائياً
- يتم حساب `nextBillingDate` بناءً على خطة الاشتراك

### 2. عملية التجديد (Renewal Process)

عندما يحين موعد التجديد:

1. **Cron Job يكتشف الاشتراكات المستحقة:**
   ```javascript
   // يعمل كل 6 ساعات
   cron.schedule('0 */6 * * *', processSubscriptionRenewals);
   ```

2. **إذا كان paymentToken موجود:**
   - يحاول النظام شحن الدفعة تلقائياً باستخدام Token
   - إذا نجح: يتم تحديث `nextBillingDate` وتفعيل الاشتراك
   - إذا فشل: يتم إنشاء order جديد وإرسال رابط دفع للمستخدم

3. **إذا لم يكن paymentToken موجود:**
   - يتم إنشاء order جديد
   - يتم إرسال رابط دفع للمستخدم لإكمال الدفع يدوياً
   - يتم تحديث حالة الاشتراك إلى `past_due`

### 3. معالجة الفشل (Failure Handling)

- بعد 3 محاولات فاشلة: يتم تغيير حالة الاشتراك إلى `past_due`
- يتم إرسال إشعارات للمستخدم (يمكن إضافة email notifications)

## API Endpoints

### تفعيل/إلغاء التجديد التلقائي

**PUT** `/api/subscriptions/auto-renew`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request:**
```json
{
  "autoRenew": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Auto-renewal enabled successfully",
  "data": {
    "subscriptionId": "507f1f77bcf86cd799439011",
    "autoRenew": true
  }
}
```

### إلغاء الاشتراك

**PUT** `/api/subscriptions/cancel`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": "success",
  "message": "Subscription canceled successfully",
  "data": {
    "subscriptionId": "507f1f77bcf86cd799439011",
    "canceledAt": "2025-12-13T17:14:00.000Z"
  }
}
```

## Paymob Tokenization

### ملاحظة مهمة (Important Note)

Paymob قد يدعم حفظ payment tokens للدفع التلقائي، لكن:
- **API structure قد يختلف** عن Stripe
- **يجب مراجعة Paymob documentation** لمعرفة كيفية استخدام Tokenization
- **الكود الحالي يحتوي على placeholder** يحتاج إلى التعديل حسب Paymob API

### كيفية تنفيذ Tokenization (إذا كان متاحاً)

1. **عند الدفع الأول:**
   - احفظ `token` من Paymob response
   - احفظه في `subscription.paymentToken`

2. **عند التجديد:**
   - استخدم Token لشحن الدفعة تلقائياً
   - راجع Paymob API documentation للـ endpoint الصحيح

### مثال على التنفيذ (إذا كان Paymob يدعم Tokenization):

```javascript
// في services/subscriptionRenewalService.js
// استبدل chargeWithToken function بـ:

async function chargeWithToken(subscription, user, plan, priceInfo) {
  try {
    const authToken = await paymobService.authenticate();
    
    const order = await paymobService.createOrder(
      priceInfo.amount,
      priceInfo.currency,
      user,
      plan
    );

    // استخدم Paymob API للدفع بالـ Token
    const chargeResponse = await axios.post(
      `${PAYMOB_API_BASE}/acceptance/payments/pay`,
      {
        source: {
          identifier: subscription.paymentToken,
          subtype: 'TOKEN',
        },
        amount_cents: priceInfo.amount,
        currency: priceInfo.currency,
        order_id: order.orderId,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (chargeResponse.data && chargeResponse.data.success) {
      await updateSubscriptionAfterRenewal(
        subscription, 
        order.orderId, 
        chargeResponse.data.id
      );
      return { success: true, ... };
    }
  } catch (error) {
    // Handle error
  }
}
```

## الإعدادات (Configuration)

### Cron Job Schedule

يمكن تعديل جدولة Cron Job في `utilits/cronJobs.js`:

```javascript
// كل 6 ساعات (افتراضي)
cron.schedule('0 */6 * * *', processSubscriptionRenewals);

// أو كل ساعة
cron.schedule('0 * * * *', processSubscriptionRenewals);

// أو مرة يومياً في منتصف الليل
cron.schedule('0 0 * * *', processSubscriptionRenewals);
```

### عدد المحاولات الفاشلة

يمكن تعديل عدد المحاولات الفاشلة قبل تغيير الحالة:

```javascript
// في services/subscriptionRenewalService.js
// في handleRenewalFailure function:

if (subscription.failedRenewalAttempts >= 3) { // غيّر الرقم هنا
  subscription.status = 'past_due';
}
```

## إشعارات البريد الإلكتروني (Email Notifications)

### إضافة إشعارات عند التجديد

يمكن إضافة إشعارات بريد إلكتروني عند:
- نجاح التجديد
- فشل التجديد
- الحاجة للدفع اليدوي

**مثال:**

```javascript
// في services/subscriptionRenewalService.js
const nodemailer = require('nodemailer');

async function sendRenewalNotification(user, subscription, result) {
  // إرسال email للمستخدم
  // ...
}
```

## الاختبار (Testing)

### اختبار Cron Job يدوياً

```javascript
// في index.js أو test file
const { processSubscriptionRenewals } = require('./utilits/cronJobs');
processSubscriptionRenewals();
```

### اختبار التجديد لاشتراك محدد

```javascript
const subscriptionRenewalService = require('./services/subscriptionRenewalService');
const subscription = await UserSubscription.findById('...');
const result = await subscriptionRenewalService.processRenewal(subscription);
console.log(result);
```

## الفرق بين Paymob و Stripe

| الميزة | Stripe | Paymob |
|--------|--------|--------|
| **التجديد التلقائي** | ✅ مدمج | ⚠️ يتطلب تنفيذ |
| **Tokenization** | ✅ متاح | ⚠️ قد يكون متاح |
| **Webhooks** | ✅ متقدم | ✅ متاح |
| **إدارة الاشتراكات** | ✅ كاملة | ⚠️ يدوية |

## الخطوات التالية (Next Steps)

1. **مراجعة Paymob Documentation:**
   - تحقق من دعم Tokenization
   - راجع API endpoints للدفع التلقائي

2. **تنفيذ Tokenization (إذا كان متاحاً):**
   - حدّث `chargeWithToken` function
   - اختبر الدفع التلقائي

3. **إضافة Email Notifications:**
   - عند نجاح/فشل التجديد
   - عند الحاجة للدفع اليدوي

4. **مراقبة النظام:**
   - راقب logs للتجديدات
   - تتبع المحاولات الفاشلة

## ملاحظات مهمة (Important Notes)

1. **Paymob Tokenization قد لا يكون متاحاً** في جميع البلدان
2. **يجب اختبار النظام** في بيئة test قبل الإنتاج
3. **راقب failed renewals** واتخذ إجراءات فورية
4. **احفظ payment tokens بشكل آمن** (مشفر)

## الدعم (Support)

للمساعدة في:
- تنفيذ Paymob Tokenization
- إضافة Email Notifications
- تحسين نظام التجديد

راجع:
- `services/subscriptionRenewalService.js`
- `utilits/cronJobs.js`
- Paymob API Documentation

