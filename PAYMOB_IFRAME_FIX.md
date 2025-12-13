# Paymob IFrame Error Fix

## Error: "IFrame matching query does not exist"

### المشكلة (Problem)

Paymob لا يمكنه العثور على iframe بالـ Integration ID المحدد.

### السبب (Cause)

في Paymob، **Integration ID** و **IFrame ID** قد يكونان مختلفين:
- **Integration ID**: يستخدم لإنشاء payment key
- **IFrame ID**: يستخدم لعرض iframe

### الحل (Solution)

#### الطريقة 1: استخدام IFrame ID منفصل

1. **في Paymob Dashboard:**
   - اذهب إلى **Developers** → **Iframes**
   - ابحث عن iframe ID الخاص بك
   - أو أنشئ iframe جديد إذا لم يكن موجوداً

2. **أضف في `.env`:**
   ```env
   PAYMOB_IFRAME_ID=your_iframe_id_here
   PAYMOB_INTEGRATION_ID=your_integration_id_here
   ```

3. **إذا كان IFrame ID = Integration ID:**
   - لا حاجة لإضافة `PAYMOB_IFRAME_ID`
   - النظام سيستخدم `PAYMOB_INTEGRATION_ID` تلقائياً

#### الطريقة 2: التحقق من Integration ID

1. **في Paymob Dashboard:**
   - اذهب إلى **Developers** → **Payment Integrations**
   - افتح Integration ID الخاص بك
   - تحقق من:
     - Integration ID صحيح
     - Integration مفعّل
     - Integration يدعم iframe

#### الطريقة 3: استخدام Redirect URL بدلاً من Iframe

إذا كان iframe لا يعمل، يمكن استخدام redirect URL:

```javascript
// في paymobService.js
// بدلاً من iframe URL، استخدم redirect URL
const redirectUrl = `https://accept.paymob.com/api/acceptance/payments/pay?payment_token=${response.data.token}`;
```

### التحقق (Verification)

1. **تحقق من Logs:**
   ```
   Paymob iframe URL constructed: {
     iframeId: '...',
     integrationId: '...',
     paymentToken: '...'
   }
   ```

2. **اختبر Iframe URL مباشرة:**
   - افتح URL في المتصفح
   - يجب أن يظهر Paymob payment form

### ملاحظات مهمة (Important Notes)

1. **Integration ID ≠ IFrame ID**: قد يكونان مختلفين
2. **IFrame يجب أن يكون مفعّل**: تحقق من إعدادات iframe في Paymob
3. **Currency Support**: تأكد من أن iframe يدعم العملة (EGP)

### Example Configuration

```env
# Integration ID (لإنشاء payment key)
PAYMOB_INTEGRATION_ID=5430985

# IFrame ID (لعرض iframe) - اختياري
# إذا لم تحدد، سيستخدم Integration ID
PAYMOB_IFRAME_ID=5430985
```

### Troubleshooting

إذا استمرت المشكلة:

1. **تحقق من Paymob Dashboard:**
   - IFrame موجود ومفعّل؟
   - Integration ID صحيح؟

2. **اختبر Payment Key:**
   - Payment key يتم إنشاؤه بنجاح؟
   - تحقق من logs

3. **تواصل مع Paymob Support:**
   - أرسل Integration ID و IFrame ID
   - اطلب المساعدة في إعداد iframe

