/**
 * Backfill Script: Generate tenantCode for existing users
 * 
 * This script adds tenantCode to users who don't have one.
 * Format: First 3 letters of name + 4 random digits (e.g., "AHM1234")
 * 
 * Usage: node scripts/backfillTenantCode.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../Models/user.model");

const BATCH_SIZE = 100;

/**
 * Generate a unique tenantCode for a user
 * Format: First 3 letters of name (uppercase) + 4 random digits
 * Fallback: FARM + last 6 digits of timestamp
 */
function generateTenantCode(name) {
  // Get first 3 letters of name, uppercase, remove non-letters
  const namePrefix = (name || "FARM")
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, "") || "FARM";
  
  // Generate 4 random digits (1000-9999)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  
  return `${namePrefix}${randomNum}`;
}

/**
 * Generate fallback tenantCode using timestamp
 */
function generateFallbackTenantCode() {
  return `FARM${Date.now().toString().slice(-6)}`;
}

/**
 * Check if tenantCode is unique
 */
async function isTenantCodeUnique(tenantCode) {
  const exists = await User.findOne({ tenantCode });
  return !exists;
}

/**
 * Generate a unique tenantCode with retries
 */
async function generateUniqueTenantCode(name, maxAttempts = 10) {
  // Try with name-based code
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateTenantCode(name);
    if (await isTenantCodeUnique(code)) {
      return code;
    }
  }
  
  // Fallback to timestamp-based code
  let attempts = 0;
  while (attempts < maxAttempts) {
    const code = generateFallbackTenantCode();
    if (await isTenantCodeUnique(code)) {
      return code;
    }
    attempts++;
    // Small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Last resort: timestamp + random
  return `FARM${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error("❌ MONGO_URL is not set in .env file");
    process.exit(1);
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(mongoUrl);
  console.log("✅ Connected to MongoDB");

  // Find users without tenantCode
  const filter = {
    $or: [
      { tenantCode: { $exists: false } },
      { tenantCode: null },
      { tenantCode: "" },
    ],
  };

  const total = await User.countDocuments(filter);
  console.log(`\n📊 Found ${total} user(s) without tenantCode`);

  if (total === 0) {
    await mongoose.disconnect();
    console.log("✅ All users already have tenantCode. Nothing to do.");
    process.exit(0);
  }

  let processed = 0;
  let modifiedTotal = 0;
  let errors = 0;

  console.log("\n🚀 Starting backfill process...\n");

  while (true) {
    // Get batch of users without tenantCode
    const users = await User.find(filter)
      .select("_id name email tenantCode")
      .limit(BATCH_SIZE)
      .lean();

    if (!users.length) break;

    // Process each user individually to ensure uniqueness
    const ops = [];
    
    for (const user of users) {
      try {
        const tenantCode = await generateUniqueTenantCode(user.name);
        ops.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: { tenantCode } },
            upsert: false,
          },
        });
      } catch (error) {
        console.error(`❌ Error generating code for user ${user._id}:`, error.message);
        errors++;
      }
    }

    if (ops.length > 0) {
      try {
        // Execute bulk write
        const result = await User.collection.bulkWrite(ops, { ordered: false });
        modifiedTotal += result.modifiedCount || 0;
        processed += users.length;
        
        console.log(`⏳ Processed ${processed}/${total} | Modified: ${result.modifiedCount || 0}`);
      } catch (error) {
        console.error(`❌ Bulk write error:`, error.message);
        errors += ops.length;
      }
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Backfill completed!");
  console.log(`📊 Total processed: ${processed}`);
  console.log(`✅ Total modified: ${modifiedTotal}`);
  if (errors > 0) {
    console.log(`⚠️  Errors: ${errors}`);
  }
  console.log("=".repeat(50));

  // Verify: Check if any users still don't have tenantCode
  const remaining = await User.countDocuments(filter);
  if (remaining > 0) {
    console.log(`\n⚠️  Warning: ${remaining} user(s) still missing tenantCode`);
  } else {
    console.log("\n✅ All users now have tenantCode!");
  }

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB");
  process.exit(0);
}

// Run the script
run().catch(async (error) => {
  console.error("\n❌ Fatal error:", error);
  try {
    await mongoose.disconnect();
  } catch (e) {
    // Ignore disconnect errors
  }
  process.exit(1);
});
