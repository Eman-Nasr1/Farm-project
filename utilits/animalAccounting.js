// utilits/animalAccounting.js
const { recordAccounting } = require('./accounting');

async function afterCreateAnimal(animalDoc) {
  const amount = animalDoc.purchasePrice || 0;
  if (amount > 0) {
    await recordAccounting({
      owner: animalDoc.owner, type: 'expense', source: 'purchase', amount,
      category: 'animal_purchase', date: animalDoc.purchaseDate || animalDoc.createdAt || new Date(),
      meta: { animalId: animalDoc._id, tagId: animalDoc.tagId }
    });
  }
}

// (اختياري) تحديث السعر/تاريخ الشراء:
async function afterUpdateAnimalPurchase(beforeDoc, afterDoc) {
  const before = beforeDoc.purchasePrice || 0;
  const after  = afterDoc.purchasePrice || 0;
  const delta  = after - before;
  if (delta === 0) return;

  if (delta > 0) {
    await recordAccounting({
      owner: afterDoc.owner, type: 'expense', source: 'purchase_adjustment', amount: delta,
      category: 'animal_purchase', date: afterDoc.purchaseDate || new Date(),
      meta: { animalId: afterDoc._id, tagId: afterDoc.tagId }
    });
  } else {
    await recordAccounting({
      owner: afterDoc.owner, type: 'income', source: 'purchase_refund', amount: Math.abs(delta),
      category: 'animal_purchase', date: afterDoc.purchaseDate || new Date(),
      meta: { animalId: afterDoc._id, tagId: afterDoc.tagId }
    });
  }
}

module.exports = { afterCreateAnimal, afterUpdateAnimalPurchase };
