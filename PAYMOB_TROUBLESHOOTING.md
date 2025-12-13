# Paymob Integration Troubleshooting Guide

## Error: "Failed to create Paymob order: Request failed with status code 400"

### الأسباب المحتملة (Possible Causes):

1. **مفاتيح API غير صحيحة أو مفقودة**
2. **تنسيق البيانات غير صحيح**
3. **حقول مطلوبة مفقودة**
4. **مشكلة في تنسيق العملة**

---

## الحلول (Solutions)

### 1. التحقق من Environment Variables

تأكد من وجود هذه المتغيرات في ملف `.env`:

```env
PAYMOB_API_KEY=your_api_key_here
PAYMOB_INTEGRATION_ID=your_integration_id_here
PAYMOB_HMAC_SECRET=your_hmac_secret_here
```

**للتحقق:**
- افتح ملف `.env` في المشروع
- تأكد من وجود القيم الصحيحة
- لا توجد مسافات إضافية قبل أو بعد القيم

### 2. التحقق من Paymob API Credentials

1. سجل دخول إلى [Paymob Dashboard](https://accept.paymob.com)
2. اذهب إلى **Developers** → **API Keys**
3. تأكد من أن API Key صحيح
4. تأكد من أن Integration ID صحيح

### 3. التحقق من تنسيق البيانات

Paymob يتطلب:

- **amount_cents**: المبلغ بالعملة الصغيرة (piasters لـ EGP, cents لـ USD)
- **currency**: كود العملة (EGP, SAR, USD)
- **email**: بريد المستخدم (مطلوب)
- **phone_number**: رقم الهاتف (مطلوب)

### 4. اختبار Authentication

أنشئ ملف `test-paymob.js`:

```javascript
const axios = require('axios');
require('dotenv').config();

async function testPaymobAuth() {
  try {
    const response = await axios.post('https://accept.paymob.com/api/auth/tokens', {
      api_key: process.env.PAYMOB_API_KEY,
    });
    
    console.log('✅ Authentication successful!');
    console.log('Token:', response.data.token);
  } catch (error) {
    console.error('❌ Authentication failed:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
  }
}

testPaymobAuth();
```

شغّل:
```bash
node test-paymob.js
```

### 5. التحقق من User Data

تأكد من أن المستخدم لديه:
- `email` (مطلوب)
- `phone` (مطلوب)
- `name` (مطلوب)
- `country` (اختياري، افتراضي: 'EG')

### 6. التحقق من Plan Data

تأكد من أن Plan لديه:
- `name` (مطلوب)
- `prices` array مع بيانات صحيحة

### 7. Logs مفيدة

تحقق من server logs عند حدوث الخطأ. يجب أن ترى:
- Request data المرسلة لـ Paymob
- Error response من Paymob

---

## Common Paymob API Errors

### Error 400: Bad Request

**الأسباب:**
- بيانات مفقودة أو غير صحيحة
- تنسيق خاطئ للعملة
- قيم غير صالحة

**الحل:**
- تحقق من جميع الحقول المطلوبة
- تأكد من تنسيق المبلغ (amount_cents)
- تأكد من كود العملة (EGP, SAR, USD)

### Error 401: Unauthorized

**السبب:**
- API Key غير صحيح أو منتهي الصلاحية

**الحل:**
- تحقق من `PAYMOB_API_KEY` في `.env`
- احصل على API Key جديد من Paymob Dashboard

### Error 404: Not Found

**السبب:**
- Integration ID غير صحيح

**الحل:**
- تحقق من `PAYMOB_INTEGRATION_ID` في `.env`
- تأكد من Integration ID في Paymob Dashboard

---

## Testing Checklist

- [ ] Environment variables موجودة في `.env`
- [ ] API Key صحيح ومفعّل
- [ ] Integration ID صحيح
- [ ] User لديه email و phone
- [ ] Plan لديه prices array
- [ ] Amount في تنسيق صحيح (piasters/cents)
- [ ] Currency code صحيح (EGP, SAR, USD)
- [ ] Server logs تظهر تفاصيل الخطأ

---

## Debug Mode

لتفعيل debug mode، أضف في `paymobService.js`:

```javascript
// في بداية createOrder function
console.log('Creating Paymob order with data:', {
  amount,
  currency,
  userEmail: user.email,
  userPhone: user.phone,
  planName: plan.name,
});
```

---

## Contact Paymob Support

إذا استمرت المشكلة:
1. تحقق من [Paymob Documentation](https://docs.paymob.com)
2. تواصل مع Paymob Support
3. أرسل لهم:
   - Error message
   - Request payload
   - API credentials (في بيئة test)

---

## Example Working Request

```javascript
{
  auth_token: "token_from_authentication",
  delivery_needed: "false",
  amount_cents: 10000,  // 100 EGP
  currency: "EGP",
  items: [
    {
      name: "Starter Plan",
      amount_cents: 10000,
      description: "Subscription plan: Starter",
      quantity: 1
    }
  ],
  shipping_data: {
    apartment: "NA",
    email: "user@example.com",
    floor: "NA",
    first_name: "Ahmed",
    street: "NA",
    building: "NA",
    phone_number: "01234567890",
    postal_code: "NA",
    city: "NA",
    country: "EG",
    last_name: "Mohamed",
    state: "NA"
  }
}
```

