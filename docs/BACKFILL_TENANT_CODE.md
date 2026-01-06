# Backfill Tenant Code Script

## 📋 Overview

This script adds `tenantCode` (farm code) to existing users who don't have one. The `tenantCode` is required for employee login and tenant identification.

## 🎯 Purpose

When the `tenantCode` feature was added, existing users didn't have this field. This script:
- Finds all users without `tenantCode`
- Generates unique codes for each user
- Updates the database in batches

## 📝 Tenant Code Format

The script generates codes using this format:
- **Format**: `{NAME_PREFIX}{4_DIGITS}`
- **Example**: `AHM1234` (from name "Ahmed")
- **Fallback**: `FARM{6_DIGITS}` (if name prefix fails or code exists)

### Generation Logic:
1. Takes first 3 letters of user's name (uppercase, letters only)
2. Adds 4 random digits (1000-9999)
3. Checks uniqueness
4. Retries up to 10 times if code exists
5. Falls back to timestamp-based code if needed

## 🚀 Usage

### Prerequisites

1. Ensure `.env` file has `MONGO_URL` set:
   ```env
   MONGO_URL=mongodb://localhost:27017/farm-db
   ```

2. Make sure you have a backup of your database (recommended)

### Run the Script

```bash
node scripts/backfillTenantCode.js
```

### Expected Output

```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Found 25 user(s) without tenantCode

🚀 Starting backfill process...

⏳ Processed 25/25 | Modified: 25
==================================================
✅ Backfill completed!
📊 Total processed: 25
✅ Total modified: 25
==================================================

✅ All users now have tenantCode!

✅ Disconnected from MongoDB
```

## ⚙️ Configuration

### Batch Size

The script processes users in batches. Default batch size is **100**.

To change it, edit `BATCH_SIZE` in the script:
```javascript
const BATCH_SIZE = 100; // Change this value
```

### Retry Attempts

Default retry attempts for generating unique codes is **10**.

To change it, edit the `maxAttempts` parameter:
```javascript
const tenantCode = await generateUniqueTenantCode(user.name, 10); // Change this value
```

## 🔍 Verification

After running the script, verify the results:

### Check Users Without tenantCode

```javascript
// In MongoDB shell or Compass
db.users.find({ 
  $or: [
    { tenantCode: { $exists: false } },
    { tenantCode: null },
    { tenantCode: "" }
  ]
}).count()
```

Should return `0` if all users have codes.

### View Sample Codes

```javascript
// In MongoDB shell or Compass
db.users.find({ tenantCode: { $exists: true } })
  .select({ name: 1, email: 1, tenantCode: 1 })
  .limit(10)
```

## ⚠️ Important Notes

1. **Idempotent**: Safe to run multiple times. Only updates users without `tenantCode`.

2. **Unique Codes**: Each code is guaranteed to be unique. The script checks for duplicates.

3. **No Data Loss**: Only adds `tenantCode`. Doesn't modify any other fields.

4. **Performance**: Processes in batches to avoid memory issues with large databases.

5. **Errors**: If errors occur, the script continues processing other users and reports total errors at the end.

## 🐛 Troubleshooting

### Error: "MONGO_URL is not set"

**Solution**: Ensure `.env` file exists and contains `MONGO_URL`.

### Error: "Cannot connect to MongoDB"

**Solution**: 
- Check MongoDB is running
- Verify `MONGO_URL` is correct
- Check network/firewall settings

### Some Users Still Missing Codes

**Possible Causes**:
- Database connection lost during execution
- Validation errors (unlikely)
- Concurrent updates from another process

**Solution**: Run the script again. It will only process remaining users.

### Duplicate tenantCode Error

**Cause**: Rare edge case where two users get the same code simultaneously.

**Solution**: The script handles this automatically with retries and fallback codes.

## 📊 Example Results

### Before Running Script

```javascript
// User document before
{
  "_id": "...",
  "name": "Ahmed Mohamed",
  "email": "ahmed@example.com",
  "tenantCode": null  // Missing
}
```

### After Running Script

```javascript
// User document after
{
  "_id": "...",
  "name": "Ahmed Mohamed",
  "email": "ahmed@example.com",
  "tenantCode": "AHM1234"  // Generated
}
```

## 🔐 Security Notes

- The script doesn't require authentication (runs as a standalone script)
- Ensure only authorized personnel run this script
- Consider running during maintenance window for production databases
- Keep a backup before running on production

## 📝 Related Files

- **Script**: `scripts/backfillTenantCode.js`
- **User Model**: `Models/user.model.js`
- **User Controller**: `Controllers/User.controller.js` (registration logic)
- **Login Guide**: `docs/LOGIN_USAGE.md` (how tenantCode is used)

## ✅ Checklist

Before running:
- [ ] Database backup created
- [ ] `.env` file has `MONGO_URL`
- [ ] MongoDB is running
- [ ] Tested on development/staging first (recommended)

After running:
- [ ] Verify all users have `tenantCode`
- [ ] Test employee login with `farmCode`
- [ ] Check for any errors in output
- [ ] Document any manual fixes needed

## 🆘 Support

If you encounter issues:
1. Check the error message in the console
2. Verify MongoDB connection
3. Check database permissions
4. Review the troubleshooting section above
