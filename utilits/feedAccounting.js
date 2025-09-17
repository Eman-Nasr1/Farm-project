// utilits/feedAccounting.js
const Feed = require('../Models/feed.model');
const { recordAccounting } = require('./accounting'); // اللي عملناه قبل كده

// احسب تكلفة ShedEntry (سعر العلف * الكمية) لكل العناصر
async function computeShedEntryCost(entry, session) {
  const feedIds = entry.feeds.map(f => f.feedId);
  if (feedIds.length === 0) return 0;

  const docs = await Feed.find(
    { _id: { $in: feedIds } },
    { _id: 1, price: 1 }
  ).session?.(session) ?? await Feed.find({ _id: { $in: feedIds } }, { _id: 1, price: 1 });

  const priceById = new Map(docs.map(f => [String(f._id), f.price || 0]));

  let total = 0;
  for (const f of entry.feeds) {
    const price = priceById.get(String(f.feedId)) || 0;
    total += price * (f.quantity || 0);
  }
  return total;
}

// يُستخدم بعد الإنشاء: يسجل مصروف feed
async function afterCreateShedEntry(entry) {
  const total = await computeShedEntryCost(entry);
  if (total > 0) {
    await recordAccounting({
      owner: entry.owner,
      type: 'expense',
      source: 'feed',
      amount: total,
      category: 'feed_consume',
      date: entry.date || new Date(),
      meta: { shedEntryId: entry._id, locationShed: entry.locationShed }
    });
  }
}

// يُستخدم بعد التحديث: يسجل فرق التكلفة (زيادة مصروف أو “استرجاع”)
async function afterUpdateShedEntry(beforeEntry, afterEntry) {
  const before = await computeShedEntryCost(beforeEntry);
  const after  = await computeShedEntryCost(afterEntry);
  const delta  = after - before;

  if (delta === 0) return;

  if (delta > 0) {
    // زيادة مصروف
    await recordAccounting({
      owner: afterEntry.owner,
      type: 'expense',
      source: 'feed_adjustment',
      amount: delta,
      category: 'feed_consume',
      date: afterEntry.date || new Date(),
      meta: { shedEntryId: afterEntry._id }
    });
  } else {
    // تقليل مصروف → سجّل “رد” كدخل
    await recordAccounting({
      owner: afterEntry.owner,
      type: 'income',
      source: 'feed_refund',
      amount: Math.abs(delta),
      category: 'feed_consume',
      date: afterEntry.date || new Date(),
      meta: { shedEntryId: afterEntry._id }
    });
  }
}

// يُستخدم بعد الحذف: اعمل عكس لِلمصروف (دخل بنفس القيمة)
async function afterDeleteShedEntry(deletedEntry) {
  const total = await computeShedEntryCost(deletedEntry);
  if (total > 0) {
    await recordAccounting({
      owner: deletedEntry.owner,
      type: 'income',
      source: 'feed_delete_refund',
      amount: total,
      category: 'feed_consume',
      date: deletedEntry.date || deletedEntry.createdAt || new Date(),
      meta: { shedEntryId: deletedEntry._id, locationShed: deletedEntry.locationShed }
    });
  }
}

module.exports = {
  computeShedEntryCost,
  afterCreateShedEntry,
  afterUpdateShedEntry,
  afterDeleteShedEntry
};
