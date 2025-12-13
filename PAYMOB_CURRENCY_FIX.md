# Paymob Currency Error Fix

## Error: "Invalid currency sent"

### المشكلة (Problem)

Paymob يرفض العملة المرسلة في `getPaymentKey` request.

### السبب المحتمل (Possible Cause)

**Integration ID مرتبط بعملة معينة**: كل Integration ID في Paymob مرتبط بعملة محددة. إذا كان Integration ID للـ EGP، لا يمكن استخدامه مع SAR أو USD.

### الحل (Solution)

#### الطريقة 1: استخدام Integration IDs مختلفة لكل عملة

1. في Paymob Dashboard، أنشئ Integration IDs منفصلة لكل عملة:
   - Integration ID للـ EGP
   - Integration ID للـ SAR  
   - Integration ID للـ USD

2. أضف في `.env`:
   ```env
   PAYMOB_INTEGRATION_ID_EGP=your_egp_integration_id
   PAYMOB_INTEGRATION_ID_SAR=your_sar_integration_id
   PAYMOB_INTEGRATION_ID_USD=your_usd_integration_id
   ```

3. حدّث `paymobService.js`:
   ```javascript
   const integrationId = 
     currency.toUpperCase() === 'EGP' ? process.env.PAYMOB_INTEGRATION_ID_EGP :
     currency.toUpperCase() === 'SAR' ? process.env.PAYMOB_INTEGRATION_ID_SAR :
     process.env.PAYMOB_INTEGRATION_ID_USD || process.env.PAYMOB_INTEGRATION_ID;
   ```

#### الطريقة 2: استخدام Integration ID واحد متعدد العملات

إذا كان Integration ID يدعم عدة عملات:
- تأكد من أن Integration ID في Paymob Dashboard مفعّل لجميع العملات المطلوبة
- تحقق من إعدادات Integration في Paymob Dashboard

### التحقق (Verification)

1. **تحقق من Integration ID في Paymob Dashboard:**
   - اذهب إلى Payment Integrations
   - افتح Integration ID الخاص بك
   - تحقق من Currency المسموح بها

2. **تحقق من Logs:**
   - افتح server console
   - ابحث عن "Paymob payment key request"
   - تحقق من Currency و Integration ID المرسلة

### Example Log Output

```
Paymob payment key request: {
  amount_cents: 10000,
  currency: 'EGP',
  original_currency: 'EGP',
  order_id: '123456',
  integration_id: '5430985'
}
```

### ملاحظات مهمة (Important Notes)

1. **Integration ID = Currency Binding**: كل Integration ID مرتبط بعملة في Paymob
2. **Multi-Currency Support**: إذا أردت دعم عدة عملات، استخدم Integration IDs منفصلة
3. **Test Environment**: تأكد من استخدام Integration IDs الصحيحة في بيئة Test

### Quick Fix (Temporary)

إذا كنت تريد اختبار مع عملة واحدة فقط:

1. استخدم Integration ID للعملة التي تريدها (مثلاً EGP)
2. تأكد من أن جميع Plans تستخدم نفس العملة مؤقتاً
3. بعد الاختبار، نفّذ الحل الكامل مع Integration IDs متعددة

