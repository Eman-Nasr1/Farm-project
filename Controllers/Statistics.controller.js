const mongoose = require('mongoose');
const Animal = require('../Models/animal.model');
const Excluded = require('../Models/excluded.model');
const Mating = require('../Models/mating.model');
const Notification = require('../Models/notification.model');
const User = require('../Models/user.model');
const Accounting = require('../Models/accounting.model');
// لو هتستخدم النسخة B للمواليد:
let Breeding; try { Breeding = require('../Models/breed.model'); } catch(e) {}

const daysAgo = (n) => new Date(Date.now() - n*864e5);
const daysAhead = (n) => new Date(Date.now() + n*864e5);

// ====== USER STATS ======
exports.getUserStats = async (req, res) => {
    try {
      const owner = req.user.id;
      const ownerId = new mongoose.Types.ObjectId(owner);
      const terminalTypes = ['death','sale','sweep']; // عدّلي الأنواع حسب الموجود عندك
  
      // 1) IDs الحيوانات المستبعَدة (نهائيًا) لهذا المستخدم
      const excludedIds = await Excluded.distinct('animalId', { owner: ownerId, type: { $in: terminalTypes } });
  
      // 2) المواليد آخر 30 يوم
      const births30_A = await Animal.countDocuments({ owner: ownerId, birthDate: { $gte: daysAgo(30) } });
      const births30_B = Breeding ? await Breeding.aggregate([
        { $match: { owner: ownerId } },
        { $unwind: '$birthEntries' },
        { $match: { 'birthEntries.birthDate': { $gte: daysAgo(30) } } },
        { $count: 'c' }
      ]).then(r => r[0]?.c || 0) : 0;
      const births30 = Breeding ? births30_B : births30_A;
  
      // 3) عدادات النشِط فقط (باستبعاد المستبعَدين)
      const [animals, goats, sheep, deaths30, sonarPos30, dueSoon] = await Promise.all([
        Animal.countDocuments({ owner: ownerId, _id: { $nin: excludedIds } }),
        Animal.countDocuments({ owner: ownerId, animalType: 'goat',  _id: { $nin: excludedIds } }),
        Animal.countDocuments({ owner: ownerId, animalType: 'sheep', _id: { $nin: excludedIds } }),
        Excluded.countDocuments({ owner: ownerId, type: 'death', createdAt: { $gte: daysAgo(30) } }),
        Mating.countDocuments({ owner: ownerId, sonarResult: 'positive', createdAt: { $gte: daysAgo(30) } }),
        Notification.countDocuments({
          owner: ownerId,
          type: { $in: ['Treatment','Vaccine','Weight'] },
          dueDate: { $lte: daysAhead(7) },
          stage: { $nin: ['done'] },
        })
      ]);
  
      // 4) ترند إنشاء الحيوانات (نشِطة) آخر 6 شهور
      const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
      const animalsPerMonth = await Animal.aggregate([
        { $match: { owner: ownerId, createdAt: { $gte: sixMonthsAgo } } },
        // استبعاد المستبعَدين عبر $lookup سريع بدلاً من $nin على مصفوفة كبيرة
        {
          $lookup: {
            from: 'excludeds', // اسم الكولكشن حسب موديلك
            let: { aid: '$_id', own: '$owner' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$animalId', '$$aid'] },
                { $eq: ['$owner', '$$own'] },
                { $in: ['$type', terminalTypes] }
              ] } } }
            ],
            as: 'ex'
          }
        },
        { $match: { 'ex.0': { $exists: false } } },
        { $group: { _id: { y: { $year:'$createdAt' }, m: { $month:'$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } }
      ]);
  
      // 5) الداشبورد المالي
      // بافتراض أن عندك Model اسمه Accounting فيه: owner, type: 'income'|'expense', amount(Number), category(String), createdAt(Date)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
      // إجمالي الشهر الحالي (إيراد/مصروف) + أعلى فئات تكلفة
      const financeAgg = await Accounting.aggregate([
        { $match: { owner: ownerId, createdAt: { $gte: monthStart } } },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' }
          }
        }
      ]);
  
      const monthRevenue  = financeAgg.find(x => x._id === 'income')?.total  || 0;
      const monthExpenses = financeAgg.find(x => x._id === 'expense')?.total || 0;
      const monthNet = monthRevenue - monthExpenses;
  
      // أعلى 5 فئات تكلفة في الشهر الحالي
      const topExpenseCats = await Accounting.aggregate([
        { $match: { owner: ownerId, type: 'expense', createdAt: { $gte: monthStart } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 5 }
      ]);
  
      // ترند مالي آخر 6 شهور
      const sixMonthsFinance = await Accounting.aggregate([
        { $match: { owner: ownerId, createdAt: { $gte: sixMonthsAgo } } },
        { $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, type: '$type' },
            total: { $sum: '$amount' }
        } },
        { $group: {
            _id: { y: '$_id.y', m: '$_id.m' },
            income:  { $sum: { $cond: [{ $eq: ['$_id.type','income'] }, '$total', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$_id.type','expense']}, '$total', 0] } }
        } },
        { $addFields: { net: { $subtract: ['$income', '$expense'] } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } }
      ]);
  
      // 6) الرد
      res.json({
        data: {
          totals: { animals, goats, sheep },                // نشِط فقط
          last30d: { births: births30, deaths: deaths30, sonarPositive: sonarPos30 },
          dueSoon: { count: dueSoon, horizonDays: 7 },
          trends: { animalsPerMonth },
          finances: {
            month: {
              revenue: monthRevenue,
              expenses: monthExpenses,
              net: monthNet,
              topExpenseCategories: topExpenseCats.map(c => ({ category: c._id || 'other', total: c.total }))
            },
            last6m: sixMonthsFinance.map(r => ({
              y: r._id.y, m: r._id.m, income: r.income, expense: r.expense, net: r.net
            }))
          }
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to compute user stats' });
    }
  };

// ====== ADMIN STATS ======
exports.getAdminStats = async (req, res) => {
  try {
    const [users, animals, openAlerts] = await Promise.all([
      User.countDocuments({}),
      Animal.countDocuments({}),
      Notification.countDocuments({ stage: { $in: ['week','expired'] }, severity: 'high' }),
    ]);

    const topUsers = await Animal.aggregate([
      { $group: { _id: '$owner', animals: { $sum: 1 } } },
      { $sort: { animals: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $project: { animals: 1, ownerName: { $first: '$u.name' }, ownerEmail: { $first: '$u.email' } } },
    ]);

    const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth()-5, 1);
    const animalsPerMonth = await Animal.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { y: { $year:'$createdAt' }, m: { $month:'$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y':1, '_id.m':1 } }
    ]);

    // جودة بيانات بسيطة
    const [missingBreed, missingShed] = await Promise.all([
      Animal.countDocuments({ $or: [{ breed: { $exists:false } }, { breed: null }] }),
      Animal.countDocuments({ $or: [{ locationShed: { $exists:false } }, { locationShed: null }] }),
    ]);

    res.json({
      data: {
        system: { users, animals, openAlerts },
        leaders: topUsers,
        dataQuality: { missingBreed, missingShed },
        trends: { animalsPerMonth }
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to compute admin stats' });
  }
};
