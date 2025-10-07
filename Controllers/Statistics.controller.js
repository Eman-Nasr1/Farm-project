const mongoose = require('mongoose');
const Animal = require('../Models/animal.model');
const Excluded = require('../Models/excluded.model');
const Mating = require('../Models/mating.model');
const Notification = require('../Models/notification.model');
const User = require('../Models/user.model');
const Accounting = require('../Models/accounting.model');
const Weights = require('../Models/weight.model');          // وزن الحيوانات
const AnimalCost = require('../Models/animalCost.model');   // تكاليف الحيوان (علف/علاج/تطعيم)

const Vaccine = require('../Models/vaccine.model');
// لو هتستخدم النسخة B للمواليد:
let Breeding; try { Breeding = require('../Models/breed.model'); } catch (e) { }

const daysAgo = (n) => new Date(Date.now() - n * 864e5);
const daysAhead = (n) => new Date(Date.now() + n * 864e5);
const round2 = (x) => Number((x ?? 0).toFixed(2));

// ====== USER STATS (نسختك الحالية) ======
exports.getUserStats = async (req, res) => {
  try {
    const owner = req.user.id;
    const ownerId = new mongoose.Types.ObjectId(owner);
    const terminalTypes = ['death', 'sale', 'sweep']; // عدّلي الأنواع حسب الموجود عندك

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
      Animal.countDocuments({ owner: ownerId, animalType: 'goat', _id: { $nin: excludedIds } }),
      Animal.countDocuments({ owner: ownerId, animalType: 'sheep', _id: { $nin: excludedIds } }),
      Excluded.countDocuments({ owner: ownerId, type: 'death', createdAt: { $gte: daysAgo(30) } }),
      Mating.countDocuments({ owner: ownerId, sonarResult: 'positive', createdAt: { $gte: daysAgo(30) } }),
      Notification.countDocuments({
        owner: ownerId,
        type: { $in: ['Treatment', 'Vaccine', 'Weight'] },
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
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$animalId', '$$aid'] },
                    { $eq: ['$owner', '$$own'] },
                    { $in: ['$type', ['death', 'sale', 'sweep']] }
                  ]
                }
              }
            }
          ],
          as: 'ex'
        }
      },
      { $match: { 'ex.0': { $exists: false } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } }
    ]);

    // 5) الداشبورد المالي
    // بافتراض أن عندك Model اسمه Accounting فيه: owner, type: 'income'|'expense', amount(Number), category(String), createdAt(Date)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // إجمالي الشهر الحالي (إيراد/مصروف) + أعلى فئات تكلفة
    const financeAgg = await Accounting.aggregate([
      { $match: { owner: ownerId, createdAt: { $gte: monthStart } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const monthRevenue = financeAgg.find(x => x._id === 'income')?.total || 0;
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
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, type: '$type' },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: { y: '$_id.y', m: '$_id.m' },
          income: { $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] } }
        }
      },
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

// ====== ADMIN STATS (نسختك الحالية) ======
exports.getAdminStats = async (req, res) => {
  try {
    // أرقام النظام العامة (كل الحيوانات)
    const [users, animals, openAlerts] = await Promise.all([
      User.countDocuments({}),
      Animal.countDocuments({}),
      Notification.countDocuments({ stage: { $in: ['week', 'expired'] }, severity: 'high' }),
    ]);

    // تعريف حالات الاستبعاد النهائي
    const terminalTypes = ['death', 'sale', 'sweep'];

    // 1) Top users حسب "الحيوانات النشطة" فقط
    const activeLeaders = await Animal.aggregate([
      {
        $lookup: {
          from: 'excludeds',
          let: { aid: '$_id', own: '$owner' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$animalId', '$$aid'] },
                    { $eq: ['$owner', '$$own'] },
                    { $in: ['$type', terminalTypes] },
                  ],
                },
              },
            },
          ],
          as: 'ex',
        },
      },
      { $match: { 'ex.0': { $exists: false } } }, // نشِطة فقط
      { $group: { _id: '$owner', activeAnimals: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      {
        $project: {
          _id: 0,
          ownerId: '$_id',
          activeAnimals: 1,
          ownerName: { $ifNull: [{ $first: '$u.name' }, '—'] },
          ownerEmail: { $ifNull: [{ $first: '$u.email' }, '—'] },
        },
      },
      { $sort: { activeAnimals: -1 } },
      { $limit: 5 },
    ]);

    // 2) إجمالي الحيوانات (كلها) لكل مالك — لضمّه بجانب activeAnimals
    const totalsPerOwner = await Animal.aggregate([
      { $group: { _id: '$owner', totalAnimals: { $sum: 1 } } },
    ]);
    const totalsMap = new Map(totalsPerOwner.map((x) => [String(x._id), x.totalAnimals]));

    const leaders = activeLeaders.map((row) => ({
      _id: row.ownerId,
      ownerName: row.ownerName,
      ownerEmail: row.ownerEmail,
      activeAnimals: row.activeAnimals,
      totalAnimals: totalsMap.get(String(row.ownerId)) || 0,
    }));

    // 3) ترند الحيوانات (كل الحيوانات)
    const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
    const animalsPerMonth = await Animal.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    res.json({
      data: {
        system: { users, animals, openAlerts },
        leaders,
        trends: { animalsPerMonth },
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to compute admin stats' });
  }
};


// ====== USER STATS V2 (مطوّرة) ======
exports.getUserStatsV2 = async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);
    const terminalTypes = ['death', 'sale', 'sweep'];
    const now = new Date();

    // مستبعَدين نهائيًا (باستخدام الحقل الصحيح excludedType)
    const excludedIds = await Excluded.distinct('animalId', {
      owner: ownerId,
      excludedType: { $in: terminalTypes }
    });

    // مواليد آخر 30 يوم (Animal أو Breeding)
    const births30_A = await Animal.countDocuments({
      owner: ownerId, birthDate: { $gte: daysAgo(30) }
    });
    const births30_B = Breeding
      ? await Breeding.aggregate([
          { $match: { owner: ownerId } },
          { $unwind: '$birthEntries' },
          { $match: { 'birthEntries.birthDate': { $gte: daysAgo(30) } } },
          { $count: 'c' },
        ]).then(r => r[0]?.c || 0)
      : 0;
    const births30 = Breeding ? births30_B : births30_A;

    // عدادات أساسية + dueSoon (استبعاد المستبعدين) + وفيات + سونار إيجابي
    const [animals, goats, sheep, deaths30, sonarPos30, dueSoon] = await Promise.all([
      Animal.countDocuments({ owner: ownerId, _id: { $nin: excludedIds } }),
      Animal.countDocuments({ owner: ownerId, animalType: 'goat', _id: { $nin: excludedIds } }),
      Animal.countDocuments({ owner: ownerId, animalType: 'sheep', _id: { $nin: excludedIds } }),

      // وفيات آخر 30 يوم (لو عايزة تاريخ الواقعة بدّلي createdAt -> Date)
      Excluded.countDocuments({
        owner: ownerId,
        excludedType: 'death',
        createdAt: { $gte: daysAgo(30) }
        // Date: { $gte: daysAgo(30) }
      }),

      // سونار إيجابي آخر 30 يوم:
      // - يدعم sonarResult و sonarRsult (داتا قديمة) + يعتمد sonarDate ثم createdAt كـ fallback
      Mating.countDocuments({
        owner: ownerId,
        $and: [
          { $or: [
            { sonarResult: { $regex: /^positive$/i } },
            { sonarRsult:  { $regex: /^positive$/i } }, // دعم اسم الحقل القديم لو موجود
          ]},
          { $or: [
            { sonarDate:  { $gte: daysAgo(30) } },
            { createdAt:  { $gte: daysAgo(30) } },
          ]},
        ]
      }),

      Notification.countDocuments({
        owner: ownerId, type: { $in: ['Treatment', 'Vaccine', 'Weight'] },
        dueDate: { $lte: daysAhead(7) }, stage: { $nin: ['done'] },
      }),
    ]);

    // animalsPerMonth (آخر 6 شهور) — استبعاد المستبعَدين مباشرة بـ $nin
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const animalsPerMonth = await Animal.aggregate([
      { $match: { owner: ownerId, createdAt: { $gte: sixMonthsAgo }, _id: { $nin: excludedIds } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } }
    ]);

    // Finances (الشهر الحالي + آخر 6 شهور)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const financeAgg = await Accounting.aggregate([
      { $match: { owner: ownerId, createdAt: { $gte: monthStart } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const monthRevenue = financeAgg.find(x => x._id === 'income')?.total || 0;
    const monthExpenses = financeAgg.find(x => x._id === 'expense')?.total || 0;
    const monthNet = round2(monthRevenue - monthExpenses);

    const topExpenseCats = await Accounting.aggregate([
      { $match: { owner: ownerId, type: 'expense', createdAt: { $gte: monthStart } } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]);

    const last6mFinance = await Accounting.aggregate([
      { $match: { owner: ownerId, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, type: '$type' },
          total: { $sum: '$amount' },
        }
      },
      {
        $group: {
          _id: { y: '$_id.y', m: '$_id.m' },
          income: { $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] } },
        }
      },
      { $addFields: { net: { $subtract: ['$income', '$expense'] } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    // KPIs
    const monthDueVacc = await Notification.countDocuments({
      owner: ownerId, type: 'Vaccine', dueDate: { $gte: monthStart }
    });
    const doneThisMonth = await Notification.countDocuments({
      owner: ownerId, type: 'Vaccine', dueDate: { $gte: monthStart }, stage: 'done'
    });
    const overdueVacc = await Notification.countDocuments({
      owner: ownerId, type: 'Vaccine', dueDate: { $lt: now }, stage: { $nin: ['done'] }
    });
    const vaccineAdherencePct = monthDueVacc ? Math.round((doneThisMonth / monthDueVacc) * 100) : 100;

    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [sonarTotal, sonarPos, born, weaned] = await Promise.all([
      Mating.countDocuments({ owner: ownerId, createdAt: { $gte: periodStart } }),
      Mating.countDocuments({
        owner: ownerId,
        $and: [
          { $or: [
            { sonarResult: { $regex: /^positive$/i } },
            { sonarRsult:  { $regex: /^positive$/i } },
          ]},
          { $or: [
            { sonarDate:  { $gte: periodStart } },
            { createdAt:  { $gte: periodStart } },
          ]},
        ]
      }),
      Breeding
        ? Breeding.aggregate([
            { $match: { owner: ownerId, 'birthEntries.birthDate': { $gte: periodStart } } },
            { $unwind: '$birthEntries' },
            { $match: { 'birthEntries.birthDate': { $gte: periodStart } } },
            { $count: 'c' },
          ]).then(r => r[0]?.c || 0)
        : Animal.countDocuments({ owner: ownerId, birthDate: { $gte: periodStart } }),
      Weights.countDocuments({ owner: ownerId, weightType: 'Weaning', Date: { $gte: periodStart } }),
    ]);
    const conceptionRate = sonarTotal ? Math.round((sonarPos / sonarTotal) * 100) : 0;
    const weaningRate = born ? Math.round((weaned / born) * 100) : 0;

    // Occupancy (توزيع الحيوانات النشِطة على العنابر)
    const shedsAgg = await Animal.aggregate([
      { $match: { owner: ownerId, _id: { $nin: excludedIds } } },
      { $group: { _id: '$locationShed', count: { $sum: 1 } } },
      { $lookup: { from: 'locationsheds', localField: '_id', foreignField: '_id', as: 'shed' } },
      { $unwind: '$shed' },
      {
        $project: {
          shedId: '$_id',
          shedName: '$shed.locationShedName',
          animals: '$count'
        }
      },
      { $sort: { animals: -1 } },
    ]);

    // نمو آخر 30 يوم + cost/kg
    const since = daysAgo(30);
    const weightTrend = await Weights.aggregate([
      { $match: { owner: ownerId, Date: { $gte: since } } },
      { $sort: { tagId: 1, Date: 1 } },
      {
        $group: {
          _id: '$tagId',
          firstW: { $first: '$weight' },
          lastW:  { $last:  '$weight' },
          count:  { $sum: 1 },
        }
      },
      {
        $addFields: {
          deltaKg: { $subtract: ['$lastW', '$firstW'] },
          adg:     { $divide: [{ $subtract: ['$lastW', '$firstW'] }, 30] },
        }
      },
    ]);

    const costLast30 = await AnimalCost.aggregate([
      { $match: { owner: ownerId, date: { $gte: since } } },
      { $group: {
          _id: '$animalTagId',
          feed:  { $sum: '$feedCost' },
          treat: { $sum: '$treatmentCost' },
          vacc:  { $sum: '$vaccineCost' },
        }
      },
      { $project: { totalCost: { $add: ['$feed', '$treat', '$vacc'] } } },
    ]);
    const costMap = new Map(costLast30.map(c => [c._id, c.totalCost]));
    const growth = weightTrend.map(w => {
      const totalCost = costMap.get(w._id) || 0;
      const deltaKg = w.deltaKg || 0;
      const costPerKgGain = deltaKg > 0 ? round2(totalCost / deltaKg) : null;
      return {
        tagId: w._id,
        deltaKg: round2(w.deltaKg),
        adg: round2(w.adg),
        totalCost: round2(totalCost),
        costPerKgGain,
      };
    });

    // الرد
    res.json({
      data: {
        totals: { animals, goats, sheep },
        last30d: { births: births30, deaths: deaths30, sonarPositive: sonarPos30 },
        dueSoon: { count: dueSoon, horizonDays: 7 },
        trends: { animalsPerMonth },
        finances: {
          month: {
            revenue: round2(monthRevenue),
            expenses: round2(monthExpenses),
            net: round2(monthNet),
            topExpenseCategories: topExpenseCats.map(c => ({ category: c._id || 'other', total: round2(c.total) })),
          },
          last6m: last6mFinance.map(r => ({
            y: r._id.y, m: r._id.m, income: round2(r.income), expense: round2(r.expense), net: round2(r.net),
          })),
        },
        kpis: { vaccineAdherencePct, overdueVaccines: overdueVacc, conceptionRate, weaningRate },
        sheds: shedsAgg.map(s => ({ shedId: s.shedId, shedName: s.shedName, animals: s.animals })),
        growth: { last30d: growth },
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to compute user stats v2' });
  }
};



// ====== DAILY TASKS (مهام اليوم) ======
exports.getDailyTasks = async (req, res) => {
  try {
    const ownerId = new mongoose.Types.ObjectId(req.user.id);

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const WEIGHT_DAYS_THRESHOLD = Number(process.env.WEIGHT_DAYS_THRESHOLD || 30);
    const LOW_STOCK_THRESHOLD = Number(process.env.VACCINE_LOW_STOCK || 10);   // جرعات
    const EXPIRY_DAYS = Number(process.env.VACCINE_EXPIRY_DAYS || 30); // أيام

    // 1) إشعارات Due اليوم + المتأخرة
    const [dueToday, overdue] = await Promise.all([
      Notification.find({
        owner: ownerId,
        type: { $in: ['Vaccine', 'Treatment', 'Weight'] },
        dueDate: { $gte: todayStart, $lte: todayEnd },
        stage: { $nin: ['done'] },
      }).sort({ dueDate: 1 }).lean(),
      Notification.find({
        owner: ownerId,
        type: { $in: ['Vaccine', 'Treatment', 'Weight'] },
        dueDate: { $lt: todayStart },
        stage: { $nin: ['done'] },
      }).sort({ dueDate: 1 }).lean(),
    ]);

    // 2) حيوانات تحتاج وزن (لم تُوزن منذ N يوم)
    const since = daysAgo(WEIGHT_DAYS_THRESHOLD);

    const lastWeights = await Weights.aggregate([
      { $match: { owner: ownerId } },
      { $sort: { tagId: 1, Date: -1 } },
      { $group: { _id: '$tagId', lastDate: { $first: '$Date' }, lastWeight: { $first: '$weight' } } },
    ]);
    const lastMap = new Map(lastWeights.map(w => [w._id, w]));

    const activeAnimalIds = await Excluded.distinct('animalId', { owner: ownerId, type: { $in: ['death', 'sale', 'sweep'] } });
    const activeAnimals = await Animal.find(
      { owner: ownerId, _id: { $nin: activeAnimalIds } },
      { tagId: 1, animalType: 1, locationShed: 1 }
    ).lean();

    const needWeighing = activeAnimals
      .filter(a => {
        const lw = lastMap.get(a.tagId);
        if (!lw) return true;       // لا يوجد وزن سابق
        return lw.lastDate < since; // آخر وزن أقدم من العتبة
      })
      .map(a => ({
        tagId: a.tagId,
        animalType: a.animalType,
        locationShed: a.locationShed,
        lastWeightDate: lastMap.get(a.tagId)?.lastDate || null,
      }));

    // 3) عنابر ≥ 90% إشغال
    const occupancy = await Animal.aggregate([
      { $match: { owner: ownerId } },
      { $group: { _id: '$locationShed', count: { $sum: 1 } } },
      { $lookup: { from: 'locationsheds', localField: '_id', foreignField: '_id', as: 'shed' } },
      { $unwind: '$shed' },
      {
        $project: {
          shedId: '$_id', shedName: '$shed.locationShedName', capacity: '$shed.capacity', animals: '$count',
          occupancyPct: {
            $cond: [
              { $gt: ['$shed.capacity', 0] },
              { $multiply: [{ $divide: ['$count', '$shed.capacity'] }, 100] },
              0,
            ]
          }
        }
      },
      { $match: { occupancyPct: { $gte: 90 } } },
      { $sort: { occupancyPct: -1 } },
    ]);

    // 4) لقاحات Low stock أو قرب انتهاء
    const vaccines = await Vaccine.find(
      { owner: ownerId },
      { otherVaccineName: 1, 'vaccineType.englishName': 1, expiryDate: 1, 'stock.totalDoses': 1 }
    ).lean();

    const nearExpiryDate = daysAhead(EXPIRY_DAYS);
    const vaccinesAttention = vaccines
      .map(v => {
        const name = v.otherVaccineName || v.vaccineType?.englishName || 'Vaccine';
        const total = v.stock?.totalDoses ?? 0;
        const nearExpiry = v.expiryDate ? v.expiryDate <= nearExpiryDate : false;
        const lowStock = total <= LOW_STOCK_THRESHOLD;
        if (!nearExpiry && !lowStock) return null;
        return { name, totalDoses: total, expiryDate: v.expiryDate || null, lowStock, nearExpiry };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.nearExpiry !== b.nearExpiry) return a.nearExpiry ? -1 : 1;
        if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1;
        return (a.totalDoses || 0) - (b.totalDoses || 0);
      });

    res.json({
      data: {
        today: new Date().toISOString().split('T')[0],
        notifications: {
          dueTodayCount: dueToday.length,
          overdueCount: overdue.length,
          dueToday,
          overdue,
        },
        actions: {
          needWeighingCount: needWeighing.length,
          needWeighing,
          highOccupancySheds: occupancy.map(s => ({
            shedId: s.shedId,
            shedName: s.shedName,
            animals: s.animals,
            capacity: s.capacity ?? 0,
            occupancyPct: round2(s.occupancyPct),
          })),
          vaccinesAttention, // [{name,totalDoses,expiryDate,lowStock,nearExpiry}]
        },
        tips: [
          'ابدأ بالمهام المتأخرة، ثم مهام اليوم.',
          `وازن الحيوانات التي لم تُوزن منذ ${WEIGHT_DAYS_THRESHOLD} يومًا.`,
          'خفّف الضغط عن العنابر ≥ 90% إشغال.',
          `اطلب لقاحات ناقصة (<${LOW_STOCK_THRESHOLD} جرعة) أو قربت تنتهي (≤ ${EXPIRY_DAYS} يوم).`,
        ],
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to compute daily tasks' });
  }
};
