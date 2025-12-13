# How to Set Paymob as Active Payment Gateway

## الطريقة 1: استخدام API (Recommended)

### Set Paymob as Active Gateway

**PUT** `/api/admin/settings/paymob`

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

**Response:**
```json
{
  "status": "success",
  "message": "Paymob set as active payment gateway",
  "data": {
    "_id": "...",
    "activePaymentGateway": "paymob",
    "createdAt": "2025-12-13T17:14:00.000Z",
    "updatedAt": "2025-12-13T17:14:00.000Z"
  }
}
```

### Update Settings (General)

**PUT** `/api/admin/settings`

**Request:**
```json
{
  "activePaymentGateway": "paymob"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Settings updated successfully",
  "data": {
    "_id": "...",
    "activePaymentGateway": "paymob",
    "createdAt": "2025-12-13T17:14:00.000Z",
    "updatedAt": "2025-12-13T17:14:00.000Z"
  }
}
```

### Get Current Settings

**GET** `/api/admin/settings`

**Response:**
```json
{
  "status": "success",
  "data": {
    "_id": "...",
    "activePaymentGateway": "paymob",
    "createdAt": "2025-12-13T17:14:00.000Z",
    "updatedAt": "2025-12-13T17:14:00.000Z"
  }
}
```

---

## الطريقة 2: MongoDB مباشرة (Direct MongoDB)

### باستخدام MongoDB Shell

```javascript
// Connect to MongoDB
use your_database_name

// Check if settings exist
db.settings.findOne()

// Create or update settings
db.settings.updateOne(
  {},
  { 
    $set: { activePaymentGateway: "paymob" },
    $setOnInsert: { createdAt: new Date() }
  },
  { upsert: true }
)

// Verify
db.settings.findOne()
```

### باستخدام MongoDB Compass

1. افتح MongoDB Compass
2. اختر قاعدة البيانات الخاصة بك
3. ابحث عن collection باسم `settings`
4. إذا لم توجد، أنشئ document جديد:
   ```json
   {
     "activePaymentGateway": "paymob"
   }
   ```
5. إذا وجدت، عدّل `activePaymentGateway` إلى `"paymob"`

---

## الطريقة 3: Node.js Script

أنشئ ملف `setPaymob.js`:

```javascript
const mongoose = require('mongoose');
const Settings = require('./Models/Settings');
require('dotenv').config();

async function setPaymob() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({ activePaymentGateway: 'paymob' });
      console.log('✅ Created new settings with Paymob');
    } else {
      settings.activePaymentGateway = 'paymob';
      await settings.save();
      console.log('✅ Updated settings to use Paymob');
    }

    console.log('Current settings:', settings);
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setPaymob();
```

ثم شغّله:
```bash
node setPaymob.js
```

---

## التحقق من الإعدادات (Verification)

### Check via API

```bash
curl -X GET http://localhost:5000/api/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Check in Code

```javascript
const Settings = require('./Models/Settings');

async function checkGateway() {
  const settings = await Settings.getSettings();
  console.log('Active gateway:', settings.activePaymentGateway);
}
```

---

## Default Behavior

- **Default value**: `'paymob'` (محدد في Settings model)
- **Auto-creation**: إذا لم توجد settings، يتم إنشاؤها تلقائياً مع `'paymob'` كقيمة افتراضية

---

## Switch Between Gateways

### Switch to Stripe

**PUT** `/api/admin/settings/stripe`

أو:

**PUT** `/api/admin/settings`
```json
{
  "activePaymentGateway": "stripe"
}
```

### Switch back to Paymob

**PUT** `/api/admin/settings/paymob`

أو:

**PUT** `/api/admin/settings`
```json
{
  "activePaymentGateway": "paymob"
}
```

---

## cURL Examples

### Set Paymob

```bash
curl -X PUT http://localhost:5000/api/admin/settings/paymob \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Update Settings

```bash
curl -X PUT http://localhost:5000/api/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activePaymentGateway": "paymob"}'
```

### Get Settings

```bash
curl -X GET http://localhost:5000/api/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## ملاحظات مهمة (Important Notes)

1. **Admin Only**: جميع endpoints تتطلب admin role
2. **Singleton**: يوجد document واحد فقط في collection `settings`
3. **Auto-Creation**: إذا لم توجد settings، يتم إنشاؤها تلقائياً
4. **Default**: القيمة الافتراضية هي `'paymob'`

---

## Troubleshooting

### Error: "Settings not found"
- هذا طبيعي في المرة الأولى
- النظام سينشئ settings تلقائياً

### Error: "Unauthorized"
- تأكد من استخدام admin token
- تحقق من role في JWT token

### Gateway not changing
- تحقق من logs
- تأكد من حفظ settings بنجاح
- أعد تشغيل السيرفر إذا لزم الأمر

