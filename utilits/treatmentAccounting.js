// utilits/treatmentAccounting.js
const Treatment = require('../Models/treatment.model');
const { recordAccounting } = require('./accounting');

// احسب تكلفة خطة علاجية واحدة
function calcPlanCost(plan, tDoc) {
  const volPerAnimal = plan.volumePerAnimal || 0;
  const doses = plan.numberOfDoses || (Array.isArray(plan.doses) ? plan.doses.length : 1);

  // سعر لكل ملّ
  let pricePerMl = 0;
  if (tDoc?.pricePerMl && tDoc.pricePerMl > 0) {
    pricePerMl = tDoc.pricePerMl;
  } else {
    const bottle = tDoc?.pricing?.bottlePrice || 0;
    const volume = tDoc?.stock?.volumePerBottle || 1;
    pricePerMl = bottle > 0 && volume > 0 ? (bottle / volume) : 0;
  }

  return pricePerMl * volPerAnimal * doses;
}

// احسب تكلفة TreatmentEntry كاملة
async function computeTreatmentEntryCost(entry) {
  const ids = (entry.treatments || []).map(p => p.treatmentId).filter(Boolean);
  if (!ids.length) return 0;

  const docs = await Treatment.find({ _id: { $in: ids } }, {
    _id:1, pricePerMl:1, 'pricing.bottlePrice':1, 'stock.volumePerBottle':1
  }).lean();

  const byId = new Map(docs.map(d => [String(d._id), d]));
  let total = 0;
  for (const plan of (entry.treatments || [])) {
    const doc = byId.get(String(plan.treatmentId));
    total += calcPlanCost(plan, doc);
  }
  return total;
}

async function afterCreateTreatmentEntry(entry) {
  const total = await computeTreatmentEntryCost(entry);
  if (total > 0) {
    await recordAccounting({
      owner: entry.owner,
      type: 'expense',
      source: 'treatment',
      amount: total,
      category: 'treatment_course',
      date: entry.date || entry.createdAt || new Date(),
      meta: { treatmentEntryId: entry._id, tagId: entry.tagId, locationShed: entry.locationShed }
    });
  }
}

async function afterUpdateTreatmentEntry(beforeEntry, afterEntry) {
  const before = await computeTreatmentEntryCost(beforeEntry);
  const after  = await computeTreatmentEntryCost(afterEntry);
  const delta  = after - before;
  if (delta === 0) return;

  if (delta > 0) {
    await recordAccounting({
      owner: afterEntry.owner, type: 'expense', source: 'treatment_adjustment', amount: delta,
      category: 'treatment_course', date: afterEntry.date || new Date(),
      meta: { treatmentEntryId: afterEntry._id }
    });
  } else {
    await recordAccounting({
      owner: afterEntry.owner, type: 'income', source: 'treatment_refund', amount: Math.abs(delta),
      category: 'treatment_course', date: afterEntry.date || new Date(),
      meta: { treatmentEntryId: afterEntry._id }
    });
  }
}

async function afterDeleteTreatmentEntry(deletedEntry) {
  const total = await computeTreatmentEntryCost(deletedEntry);
  if (total > 0) {
    await recordAccounting({
      owner: deletedEntry.owner, type: 'income', source: 'treatment_delete_refund', amount: total,
      category: 'treatment_course', date: deletedEntry.date || deletedEntry.createdAt || new Date(),
      meta: { treatmentEntryId: deletedEntry._id, tagId: deletedEntry.tagId }
    });
  }
}

module.exports = {
  computeTreatmentEntryCost,
  afterCreateTreatmentEntry,
  afterUpdateTreatmentEntry,
  afterDeleteTreatmentEntry
};
