const Accounting = require('../Models/accounting.model');

async function recordAccounting({ owner, type, source, amount, category, date, meta }) {
  if (!owner || !type || !source || !Number.isFinite(amount)) return;
  return Accounting.create({
    owner,
    type,        // 'income' | 'expense'
    source,      // 'feed' | 'treatment' | 'vaccine' | 'purchase' | 'sale'
    amount: Math.max(0, Number(amount)),
    category: category || undefined,
    date: date || new Date(),
    meta: meta || undefined,
  });
}

module.exports = { recordAccounting };
