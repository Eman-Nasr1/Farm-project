# Paymob Amount Not Showing - Debug Guide

## المشكلة (Problem)

المبلغ غير موجود في نموذج الدفع في Paymob.

## التحقق (Verification)

### 1. تحقق من Server Logs

عند إنشاء checkout، يجب أن ترى:

```
Creating Paymob order with amount: {
  amount_cents: 10000,
  currency: 'EGP',
  planName: 'Starter'
}

✅ Paymob order created successfully: {
  orderId: 434306858,
  amount_cents: 10000,
  currency: 'EGP'
}

Paymob payment key request: {
  amount_cents: 10000,
  currency: 'EGP',
  order_id: 434306858,
  ...
}
```

### 2. تحقق من Order في Paymob Dashboard

1. اذهب إلى **Paymob Dashboard** → **Orders**
2. ابحث عن Order ID من logs (مثلاً: 434306858)
3. تحقق من:
   - المبلغ موجود؟
   - العملة صحيحة؟
   - Order status؟

### 3. تحقق من IFrame Settings

1. اذهب إلى **Developers** → **Iframes**
2. افتح IFrame ID المستخدم (986541 أو 986540)
3. تحقق من:
   - IFrame مفعّل؟
   - IFrame يدعم العملة (EGP)؟
   - IFrame مرتبط بـ Integration ID الصحيح؟

## الحلول المحتملة (Possible Solutions)

### الحل 1: IFrame Settings

قد يكون IFrame غير مضبوط بشكل صحيح:

1. في Paymob Dashboard → **Iframes**
2. افتح IFrame المستخدم
3. تأكد من:
   - **Currency**: EGP
   - **Integration**: مرتبط بـ Integration ID الصحيح
   - **Status**: Active

### الحل 2: استخدام IFrame مختلف

جرب IFrame آخر:

```env
PAYMOB_IFRAME_ID=986540
```

أو:

```env
PAYMOB_IFRAME_ID=986541
```

### الحل 3: استخدام Redirect URL

إذا كان IFrame لا يعمل:

```env
PAYMOB_USE_REDIRECT=true
```

### الحل 4: التحقق من Order Amount

تأكد من أن المبلغ في Order صحيح:

1. في logs، تحقق من `amount_cents` في Order
2. تأكد من أن المبلغ بالـ piasters (مثلاً: 100 EGP = 10000 piasters)

## Example: 100 EGP

- **Amount in EGP**: 100
- **Amount in piasters**: 10000 (100 × 100)
- **في Order**: `amount_cents: 10000`
- **في Payment Key**: `amount_cents: 10000`

## Debug Steps

1. **تحقق من Plan Prices:**
   ```javascript
   // في Plan
   prices: [
     { country: "EG", currency: "EGP", amount: 10000 }, // 100 EGP
     { country: "US", currency: "USD", amount: 1000 }  // 10 USD
   ]
   ```

2. **تحقق من Logs:**
   - Order creation logs
   - Payment key request logs
   - IFrame URL logs

3. **اختبر Order مباشرة:**
   - افتح Paymob Dashboard
   - ابحث عن Order ID
   - تحقق من المبلغ

## Contact Paymob Support

إذا استمرت المشكلة:
- Order موجود لكن المبلغ لا يظهر في IFrame
- قد تكون مشكلة في إعدادات IFrame في Paymob
- تواصل مع Paymob Support مع:
  - Order ID
  - IFrame ID
  - Integration ID

