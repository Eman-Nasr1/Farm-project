require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("crypto");
const Animal = require("../Models/animal.model");

const BATCH_SIZE = 1000;

function genToken() {
  return crypto.randomBytes(24).toString("hex");
}

async function run() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error("❌ MONGO_URL is not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log("✅ Connected");

  const filter = {
    $or: [{ qrToken: { $exists: false } }, { qrToken: null }, { qrToken: "" }],
  };

  const total = await Animal.countDocuments(filter);
  console.log(`📊 Missing qrToken: ${total}`);

  if (total === 0) {
    await mongoose.disconnect();
    console.log("✅ Nothing to do");
    process.exit(0);
  }

  let processed = 0;
  let modifiedTotal = 0;

  while (true) {
    // هات دفعة IDs فقط
    const docs = await Animal.find(filter).select("_id").limit(BATCH_SIZE).lean();
    if (!docs.length) break;

    const ops = docs.map((d) => ({
      updateOne: {
        filter: { _id: d._id },
        // ✅ لازم $set
        update: { $set: { qrToken: genToken() } },
        upsert: false,
      },
    }));

    // ✅ استخدمي collection.bulkWrite مباشرة (driver level)
    const result = await Animal.collection.bulkWrite(ops, { ordered: false });

    processed += docs.length;
    modifiedTotal += result.modifiedCount || 0;

    console.log(`⏳ Processed ${processed}/${total} | modified: ${result.modifiedCount || 0}`);
  }

  console.log("\n✅ Done");
  console.log(`Total modified: ${modifiedTotal}`);

  await mongoose.disconnect();
  console.log("✅ Disconnected");
  process.exit(0);
}

run().catch(async (e) => {
  console.error("❌ Fatal:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
