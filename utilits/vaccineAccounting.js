// utilits/vaccineAccounting.js
const Vaccine = require('../Models/vaccine.model');
const { recordAccounting } = require('./accounting');

async function computeVaccineEntryCost(entry) {
  if (!entry?.Vaccine) return 0;

  // Project only what we need
  const v = await Vaccine.findById(entry.Vaccine, {
    'pricing.dosePrice': 1,
    'pricing.bottlePrice': 1,
    'stock.dosesPerBottle': 1,
  }).lean();

  if (!v) return 0;

  let amount = v?.pricing?.dosePrice;
  if (amount == null) {
    const bottle = v?.pricing?.bottlePrice;
    const perBottle = v?.stock?.dosesPerBottle;
    if (bottle != null && perBottle > 0) {
      amount = bottle / perBottle;
    }
  }

  // Normalize to 2 decimals
  return amount != null ? Number(amount.toFixed(2)) : 0;
}

async function afterCreateVaccineEntry(entry) {
  const total = await computeVaccineEntryCost(entry);
  if (total > 0) {
    await recordAccounting({
      owner: entry.owner,
      type: 'expense',
      source: 'vaccine',
      amount: total,
      category: entry.entryType || 'vaccine',
      date: entry.date || entry.createdAt || new Date(),
      meta: { vaccineEntryId: entry._id, tagId: entry.tagId, locationShed: entry.locationShed }
    });
  }
}

async function afterUpdateVaccineEntry(beforeEntry, afterEntry) {
  const before = await computeVaccineEntryCost(beforeEntry);
  const after  = await computeVaccineEntryCost(afterEntry);
  const delta  = Number((after - before).toFixed(2));
  if (delta === 0) return;

  if (delta > 0) {
    await recordAccounting({
      owner: afterEntry.owner,
      type: 'expense',
      source: 'vaccine_adjustment',
      amount: delta,
      category: afterEntry.entryType || 'vaccine',
      date: afterEntry.date || new Date(),
      meta: { vaccineEntryId: afterEntry._id }
    });
  } else {
    await recordAccounting({
      owner: afterEntry.owner,
      type: 'income',
      source: 'vaccine_refund',
      amount: Math.abs(delta),
      category: afterEntry.entryType || 'vaccine',
      date: afterEntry.date || new Date(),
      meta: { vaccineEntryId: afterEntry._id }
    });
  }
}

async function afterDeleteVaccineEntry(deletedEntry) {
  const total = await computeVaccineEntryCost(deletedEntry);
  if (total > 0) {
    await recordAccounting({
      owner: deletedEntry.owner,
      type: 'income',
      source: 'vaccine_delete_refund',
      amount: total,
      category: deletedEntry.entryType || 'vaccine',
      date: deletedEntry.date || deletedEntry.createdAt || new Date(),
      meta: { vaccineEntryId: deletedEntry._id, tagId: deletedEntry.tagId }
    });
  }
}

module.exports = {
  computeVaccineEntryCost,
  afterCreateVaccineEntry,
  afterUpdateVaccineEntry,
  afterDeleteVaccineEntry
};
