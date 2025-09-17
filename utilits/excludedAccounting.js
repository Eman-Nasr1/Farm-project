// utilits/excludedAccounting.js
const { recordAccounting } = require('./accounting');

async function afterCreateExcluded(ex) {
  if (ex.excludedType === 'sale' && ex.price && ex.price > 0) {
    await recordAccounting({
      owner: ex.owner, type: 'income', source: 'sale', amount: ex.price,
      category: 'animal_sale', date: ex.Date || ex.createdAt || new Date(),
      meta: { excludedId: ex._id, animalId: ex.animalId, tagId: ex.tagId }
    });
  }
}

// لو عدّلت السعر/النوع من/إلى sale
async function afterUpdateExcluded(beforeDoc, afterDoc) {
  const wasSale = beforeDoc.excludedType === 'sale';
  const isSale  = afterDoc.excludedType === 'sale';
  const before  = wasSale ? (beforeDoc.price || 0) : 0;
  const after   = isSale  ? (afterDoc.price || 0)  : 0;
  const delta   = after - before;
  if (delta === 0) return;

  if (delta > 0) {
    await recordAccounting({
      owner: afterDoc.owner, type: 'income', source: 'sale_adjustment', amount: delta,
      category: 'animal_sale', date: afterDoc.Date || new Date(),
      meta: { excludedId: afterDoc._id, animalId: afterDoc.animalId, tagId: afterDoc.tagId }
    });
  } else {
    await recordAccounting({
      owner: afterDoc.owner, type: 'expense', source: 'sale_refund', amount: Math.abs(delta),
      category: 'animal_sale', date: afterDoc.Date || new Date(),
      meta: { excludedId: afterDoc._id }
    });
  }
}

async function afterDeleteExcluded(deletedDoc) {
  if (deletedDoc.excludedType === 'sale' && deletedDoc.price && deletedDoc.price > 0) {
    // حذف عملية بيع → اعتبره إلغاء دخل (نسجله كـ مصروف بنفس القيمة)
    await recordAccounting({
      owner: deletedDoc.owner, type: 'expense', source: 'sale_delete_refund', amount: deletedDoc.price,
      category: 'animal_sale', date: deletedDoc.Date || deletedDoc.createdAt || new Date(),
      meta: { excludedId: deletedDoc._id, animalId: deletedDoc.animalId, tagId: deletedDoc.tagId }
    });
  }
}

module.exports = {
  afterCreateExcluded,
  afterUpdateExcluded,
  afterDeleteExcluded
};
