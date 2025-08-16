// controllers/report.controller.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const pdf = require('html-pdf');

const Animal = require('../Models/animal.model');
const Excluded = require('../Models/excluded.model');
const Mating = require('../Models/mating.model');
const Breeding = require('../Models/breeding.model');
const Feed = require('../Models/feed.model');
const ShedEntry = require('../Models/shedFeed.model');
const Treatment = require('../Models/treatment.model');
const TreatmentEntry = require('../Models/treatmentEntry.model');
const Vaccine = require('../Models/vaccine.model');
const VaccineEntry = require('../Models/vaccineEntry.model');
const Weight = require('../Models/weight.model');
const User = require('../Models/user.model');

const asyncwrapper = require('../middleware/asyncwrapper');

/* ===== Charts (offline) ===== */
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { Chart, registerables } = require('chart.js');
Chart.register(...registerables);

// ===== THEME & COLORS =====
const brand = {
  base:  '#14532d',
  accent:'#46AE65',
  text:  '#1f2937',
  grid:  'rgba(107,114,128,0.20)'
};
const categorical10 = [
  '#14532d','#0ea5e9','#f59e0b','#ef4444','#8b5cf6',
  '#10b981','#f97316','#22c55e','#14b8a6','#a855f7'
];
const genderColors = {
  male:   'rgba(14,165,233,0.85)',
  female: 'rgba(244,114,182,0.85)'
};
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace('#','');
  const bigint = parseInt(h.length === 3 ? h.split('').map(x=>x+x).join('') : h, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
Chart.defaults.color = brand.text;

const chartRenderer = new ChartJSNodeCanvas({
  width: 900,
  height: 450,
  backgroundColour: 'white'
});

async function chartToBase64(config) {
  const buf = await chartRenderer.renderToBuffer(config);
  return buf.toString('base64');
}

const typeLabel = (key, isArabic) => {
  const map = {
    death: isArabic ? 'نفوق' : 'Death',
    sweep: isArabic ? 'ذبح' : 'Sweep',
    sale:  isArabic ? 'بيع'  : 'Sale'
  };
  return map[key] || key;
};

/* ====== Font embedding (VERY IMPORTANT) ====== */
const FONTS_DIR = path.join(process.cwd(), 'assets', 'fonts');
const FONT_REGULAR = path.join(FONTS_DIR, 'NotoNaskhArabic-Regular.ttf');
const FONT_BOLD    = path.join(FONTS_DIR, 'NotoNaskhArabic-Bold.ttf');

function fontToBase64Safe(p) {
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p).toString('base64');
  } catch (_) {}
  return null;
}

/** CSS snippets to embed NotoNaskhArabic if available */
function notoCss() {
  const reg = fontToBase64Safe(FONT_REGULAR);
  const bold = fontToBase64Safe(FONT_BOLD);

  if (!reg || !bold) {
    // fallback without crashing
    return `
      /* Fallback fonts (Noto not found) */
      html, body { font-family: Tahoma, Arial, sans-serif; }
    `;
  }

  return `
    @font-face {
      font-family: 'NotoNaskhArabic';
      src: url(data:font/truetype;base64,${reg}) format('truetype');
      font-weight: 400; font-style: normal;
    }
    @font-face {
      font-family: 'NotoNaskhArabic';
      src: url(data:font/truetype;base64,${bold}) format('truetype');
      font-weight: 700; font-style: normal;
    }
    html, body { font-family: 'NotoNaskhArabic', Tahoma, Arial, sans-serif; }
  `;
}

/* =========================== */

const safeNum = v => (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
const daysBetween = (fromDate, toDate) => Math.max(1, Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)));

const fmtDate = (d) => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
function parseYMDLocal(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m - 1), d);
}

/** ---------------------------
 *  SHARED REPORT DATA BUILDER
 *  --------------------------- */
async function buildCombinedReportData({ userId, animalType, fromDate, toDate, lang = 'en' }) {
  const isArabic = (lang === 'ar');
  const user = await User.findById(userId).select('registerationType country');
  if (!user) throw new Error('USER_NOT_FOUND');

  // ===== Helpers =====
  const inventoryCountAsOf = (asOfDate) => Animal.aggregate([
    { $match: { owner: userId, animalType, createdAt: { $lte: asOfDate } } },
    {
      $lookup: {
        from: 'excludeds',
        let: { aId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$animalId', '$$aId'] },
                  { $in: ['$excludedType', ['death', 'sweep', 'sale']] },
                  { $lte: ['$Date', asOfDate] }
                ]
              }
            }
          }
        ],
        as: 'removed'
      }
    },
    { $match: { 'removed.0': { $exists: false } } },
    { $count: 'n' }
  ]);

  // ===== Aggregations =====
  const feedConsumptionAgg = ShedEntry.aggregate([
    { $match: { owner: userId, date: { $gte: fromDate, $lte: toDate } } },
    { $unwind: '$feeds' },
    { $lookup: { from: 'feeds', localField: 'feeds.feedId', foreignField: '_id', as: 'feedDetails' } },
    { $unwind: '$feedDetails' },
    { $group: { _id: '$feedDetails.name', totalConsumed: { $sum: '$feeds.quantity' }, totalCost: { $sum: { $multiply: ['$feeds.quantity', '$feedDetails.price'] } } } },
    { $project: { _id: 0, feedName: '$_id', totalConsumed: 1, totalCost: 1 } }
  ]);

  const remainingFeedStockAgg = Feed.aggregate([
    { $match: { owner: userId } },
    { $project: { name: 1, quantity: 1, price: 1 } }
  ]);

  const treatmentConsumptionAgg = TreatmentEntry.aggregate([
    { $match: { owner: userId, date: { $gte: fromDate, $lte: toDate } } },
    { $unwind: '$treatments' },
    { $lookup: { from: 'treatments', localField: 'treatments.treatmentId', foreignField: '_id', as: 'treatmentDetails' } },
    { $unwind: '$treatmentDetails' },
    { $addFields: { usedAmount: { $multiply: ['$treatments.volumePerAnimal', '$treatments.numberOfDoses'] } } },
    { $group: { _id: '$treatmentDetails.name', totalConsumed: { $sum: '$usedAmount' }, totalCost: { $sum: { $multiply: ['$usedAmount', { $ifNull: ['$treatmentDetails.pricePerMl', 0] }] } } } },
    { $project: { _id: 0, treatmentName: '$_id', totalConsumed: 1, totalCost: 1 } }
  ]);

  const remainingTreatmentStockAgg = Treatment.aggregate([
    { $match: { owner: userId } },
    { $project: { name: 1, volume: '$stock.totalVolume', pricePerMl: 1 } }
  ]);

  const vaccineConsumptionAgg = VaccineEntry.aggregate([
    { $match: { owner: userId, date: { $gte: fromDate, $lte: toDate } } },
    { $lookup: { from: 'vaccines', localField: 'Vaccine', foreignField: '_id', as: 'vaccineDetails' } },
    { $unwind: '$vaccineDetails' },
    { $lookup: { from: 'vaccinetypes', localField: 'vaccineDetails.vaccineType', foreignField: '_id', as: 'vType' } },
    { $unwind: { path: '$vType', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        vaccineName: {
          $ifNull: [
            '$vaccineDetails.otherVaccineName',
            { $ifNull: [isArabic ? '$vType.arabicName' : '$vType.englishName', '—'] }
          ]
        },
        dosePrice: { $ifNull: ['$vaccineDetails.pricing.dosePrice', 0] }
      }
    },
    { $group: { _id: '$vaccineName', totalConsumed: { $sum: 1 }, totalCost: { $sum: '$dosePrice' } } },
    { $project: { _id: 0, vaccineName: '$_id', totalConsumed: 1, totalCost: 1 } }
  ]);

  const remainingVaccineStockAgg = Vaccine.aggregate([
    { $match: { owner: userId } },
    { $lookup: { from: 'vaccinetypes', localField: 'vaccineType', foreignField: '_id', as: 'vType' } },
    { $unwind: { path: '$vType', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        vaccineName: {
          $ifNull: [
            '$otherVaccineName',
            { $ifNull: [isArabic ? '$vType.arabicName' : '$vType.englishName', '—'] }
          ]
        }
      }
    },
    { $project: { _id: 1, vaccineName: 1, stock: 1, pricing: 1 } }
  ]);

  const animalReportAgg = Animal.aggregate([
    { $match: { owner: userId, animalType, createdAt: { $lte: toDate } } },
    {
      $lookup: {
        from: 'excludeds',
        let: { aId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$animalId', '$$aId'] },
                  { $in: ['$excludedType', ['death', 'sweep', 'sale']] },
                  { $lte: ['$Date', toDate] }
                ]
              }
            }
          }
        ],
        as: 'removed'
      }
    },
    { $match: { 'removed.0': { $exists: false } } },
    { $group: { _id: { gender: '$gender', animalType: '$animalType' }, count: { $sum: 1 } } },
    { $project: { _id: 0, gender: '$_id.gender', animalType: '$_id.animalType', count: 1 } }
  ]);

  const excludedReportAgg = Excluded.aggregate([
    { $match: { owner: userId, excludedType: { $in: ['death', 'sweep', 'sale'] }, Date: { $gte: fromDate, $lte: toDate } } },
    { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
    { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
    { $match: { 'animal.animalType': animalType } },
    { $group: { _id: { excludedType: '$excludedType', animalType: '$animal.animalType', gender: '$animal.gender' }, count: { $sum: 1 }, value: { $sum: { $ifNull: ['$price', 0] } } } },
    { $project: { _id: 0, excludedType: '$_id.excludedType', animalType: '$_id.animalType', gender: '$_id.gender', count: 1, value: 1 } }
  ]);

  // === الولادات/السونار/التلقيحات (لو نوع التسجيل تربية)
  const breedingBlocks = user.registerationType === 'breeding' ? [
    Mating.aggregate([
      {
        $match: {
          owner: userId,
          sonarRsult: 'positive',
          matingDate: { $gte: fromDate, $lte: toDate },
          expectedDeliveryDate: { $gt: new Date() }
        }
      },
      { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
      { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
      { $match: { 'animal.animalType': animalType } },
      { $count: 'positiveSonarCount' }
    ]),
    Mating.aggregate([
      { $match: { owner: userId, matingDate: { $gte: fromDate, $lte: toDate } } },
      { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
      { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
      { $match: { 'animal.animalType': animalType } },
      { $count: 'totalMatings' }
    ]),
    Breeding.aggregate([
      { $match: { owner: userId, createdAt: { $gte: fromDate, $lte: toDate } } },
      { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
      { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
      { $match: { 'animal.animalType': animalType } },
      { $unwind: '$birthEntries' },
      { $match: { 'birthEntries.createdAt': { $gte: fromDate, $lte: toDate } } },
      {
        $group: {
          _id: null,
          totalBirthEntries: { $sum: 1 },
          totalMales: { $sum: { $cond: [{ $regexMatch: { input: '$birthEntries.gender', regex: /^male$/i } }, 1, 0] } },
          totalFemales: { $sum: { $cond: [{ $regexMatch: { input: '$birthEntries.gender', regex: /^female$/i } }, 1, 0] } }
        }
      }
    ])
  ] : [Promise.resolve([]), Promise.resolve([]), Promise.resolve([])];

  const feedByShedAgg = ShedEntry.aggregate([
    { $match: { owner: userId, date: { $gte: fromDate, $lte: toDate } } },
    { $unwind: '$feeds' },
    { $lookup: { from: 'feeds', localField: 'feeds.feedId', foreignField: '_id', as: 'feedDetails' } },
    { $unwind: '$feedDetails' },
    { $group: { _id: '$locationShed', totalConsumed: { $sum: '$feeds.quantity' }, totalCost: { $sum: { $multiply: ['$feeds.quantity', '$feedDetails.price'] } } } },
    { $lookup: { from: 'locationsheds', localField: '_id', foreignField: '_id', as: 'shed' } },
    { $unwind: { path: '$shed', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, shedId: '$_id', shedName: '$shed.locationShedName', totalConsumed: 1, totalCost: 1 } },
    { $sort: { totalCost: -1 } }
  ]);

  const excludedByShedAgg = Excluded.aggregate([
    { $match: { owner: userId, Date: { $gte: fromDate, $lte: toDate }, excludedType: { $in: ['death', 'sweep', 'sale'] } } },
    { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
    { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
    { $group: { _id: { shed: '$animal.locationShed', excludedType: '$excludedType' }, count: { $sum: 1 } } },
    { $lookup: { from: 'locationsheds', localField: '_id.shed', foreignField: '_id', as: 'shed' } },
    { $unwind: { path: '$shed', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, shedId: '$_id.shed', shedName: '$shed.locationShedName', excludedType: '$_id.excludedType', count: 1 } },
    { $sort: { shedName: 1 } }
  ]);

  const animalsByBreedAgg = Animal.aggregate([
    { $match: { owner: userId, animalType, createdAt: { $lte: toDate } } },
    {
      $lookup: {
        from: 'excludeds',
        let: { aId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$animalId', '$$aId'] },
                  { $in: ['$excludedType', ['death', 'sweep', 'sale']] },
                  { $lte: ['$Date', toDate] }
                ]
              }
            }
          }
        ],
        as: 'removed'
      }
    },
    { $match: { 'removed.0': { $exists: false } } },
    { $group: { _id: '$breed', count: { $sum: 1 } } },
    { $lookup: { from: 'breeds', localField: '_id', foreignField: '_id', as: 'breedObj' } },
    { $unwind: { path: '$breedObj', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, breedId: '$_id', breedName: '$breedObj.breedName', count: 1 } },
    { $sort: { count: -1 } }
  ]);

  const excludedByBreedAgg = Excluded.aggregate([
    { $match: { owner: userId, Date: { $gte: fromDate, $lte: toDate }, excludedType: { $in: ['death', 'sweep', 'sale'] } } },
    { $lookup: { from: 'animals', localField: 'animalId', foreignField: '_id', as: 'animal' } },
    { $unwind: { path: '$animal', preserveNullAndEmptyArrays: true } },
    { $match: { 'animal.animalType': animalType } },
    { $group: { _id: { breed: '$animal.breed', excludedType: '$excludedType' }, count: { $sum: 1 } } },
    { $lookup: { from: 'breeds', localField: '_id.breed', foreignField: '_id', as: 'breedObj' } },
    { $unwind: { path: '$breedObj', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, breedId: '$_id.breed', breedName: '$breedObj.breedName', excludedType: '$_id.excludedType', count: 1 } }
  ]);

  const adgByBreedAgg = Weight.aggregate([
    { $match: { owner: userId, Date: { $gte: fromDate, $lte: toDate } } },
    { $sort: { animalId: 1, Date: 1 } },
    { $group: { _id: '$animalId', firstDate: { $first: '$Date' }, firstWeight: { $first: '$weight' }, lastDate: { $last: '$Date' }, lastWeight: { $last: '$weight' } } },
    {
      $addFields: {
        days: { $max: [1, { $ceil: { $divide: [{ $subtract: ['$lastDate', '$firstDate'] }, 1000 * 60 * 60 * 24] } }] },
        gain: { $subtract: ['$lastWeight', '$firstWeight'] },
        adg: {
          $cond: [
            { $gt: [{ $subtract: ['$lastWeight', '$firstWeight'] }, 0] },
            { $divide: [{ $subtract: ['$lastWeight', '$firstWeight'] }, { $max: [1, { $ceil: { $divide: [{ $subtract: ['$lastDate', '$firstDate'] }, 1000 * 60 * 60 * 24] } }] }] },
            0
          ]
        }
      }
    },
    { $lookup: { from: 'animals', localField: '_id', foreignField: '_id', as: 'animal' } },
    { $unwind: '$animal' },
    { $match: { 'animal.animalType': animalType } },
    { $group: { _id: '$animal.breed', avgADG: { $avg: '$adg' }, totalGain: { $sum: '$gain' }, animals: { $sum: 1 } } },
    { $lookup: { from: 'breeds', localField: '_id', foreignField: '_id', as: 'breedObj' } },
    { $unwind: { path: '$breedObj', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 0, breedId: '$_id', breedName: '$breedObj.breedName', avgADG: 1, totalGain: 1, animals: 1 } },
    { $sort: { avgADG: -1 } }
  ]);

  const purchaseOrMarketCostAgg = Animal.aggregate([
    { $match: { owner: userId, animalType, createdAt: { $lte: toDate } } },
    { $project: { effectiveCost: { $ifNull: ['$purchasePrice', { $ifNull: ['$marketValue', 0] }] } } },
    { $group: { _id: null, totalPurchaseOrMarket: { $sum: '$effectiveCost' } } }
  ]);

  const animalsAtEndCount = inventoryCountAsOf(toDate);
  const animalsAtStartCount = inventoryCountAsOf(fromDate);

  const vaccinatedDistinctAgg = VaccineEntry.aggregate([
    { $match: { owner: userId, date: { $gte: fromDate, $lte: toDate } } },
    { $group: { _id: '$animalId' } },
    { $count: 'vaccinatedAnimals' }
  ]);
  const eligibleAnimalsCount = Animal.countDocuments({ owner: userId, animalType });

  const deathsCountAgg = Excluded.countDocuments({ owner: userId, excludedType: 'death', Date: { $gte: fromDate, $lte: toDate } });

  const treatmentIncidentsAgg = TreatmentEntry.countDocuments({ owner: userId, date: { $gte: fromDate, $lte: toDate } });

  const salesRevenueAgg = Excluded.aggregate([
    { $match: { owner: userId, excludedType: 'sale', Date: { $gte: fromDate, $lte: toDate } } },
    { $group: { _id: null, revenue: { $sum: { $ifNull: ['$price', 0] } } } }
  ]);

  const [
    feedConsumption, remainingFeedStock, treatmentConsumption, remainingTreatmentStock,
    vaccineConsumption, remainingVaccineStock, animalReport, excludedReport,
    positiveSonarCountArr, totalMatingsArr, birthEntriesReport,
    feedByShed, excludedByShed,
    animalsByBreed, excludedByBreed, adgByBreed,
    purchaseOrMarketCostArr, animalsAtEndArr, animalsAtStartArr,
    vaccinatedDistinctArr, eligibleAnimals,
    deathsCount, treatmentIncCount, salesRevenueArr
  ] = await Promise.all([
    feedConsumptionAgg, remainingFeedStockAgg, treatmentConsumptionAgg, remainingTreatmentStockAgg,
    vaccineConsumptionAgg, remainingVaccineStockAgg, animalReportAgg, excludedReportAgg,
    ...breedingBlocks,
    feedByShedAgg, excludedByShedAgg,
    animalsByBreedAgg, excludedByBreedAgg, adgByBreedAgg,
    purchaseOrMarketCostAgg, animalsAtEndCount, animalsAtStartCount,
    vaccinatedDistinctAgg, eligibleAnimalsCount,
    deathsCountAgg, treatmentIncidentsAgg, salesRevenueAgg
  ]);

  // === KPIs ===
  const totalAnimalsPeriod = safeNum((animalReport || []).reduce((s, a) => s + safeNum(a.count), 0));
  const totalFeedCost = safeNum(feedConsumption.reduce((s, f) => s + safeNum(f.totalCost), 0));
  const totalTreatmentCost = safeNum(treatmentConsumption.reduce((s, t) => s + safeNum(t.totalCost), 0));
  const totalVaccineCost = safeNum(vaccineConsumption.reduce((s, v) => s + safeNum(v.totalCost), 0));

  const totalPurchaseOrMarket = safeNum(purchaseOrMarketCostArr[0]?.totalPurchaseOrMarket);
  const animalsAtEnd = safeNum(animalsAtEndArr?.[0]?.n);
  const animalsAtStart = safeNum(animalsAtStartArr?.[0]?.n);
  const avgPopulation = ((animalsAtStart + animalsAtEnd) / 2) || totalAnimalsPeriod || 1;

  const avgCostPerAnimal = (animalsAtEnd > 0)
    ? (totalPurchaseOrMarket + totalFeedCost + totalTreatmentCost + totalVaccineCost) / animalsAtEnd
    : 0;

  const vaccinatedAnimals = safeNum(vaccinatedDistinctArr[0]?.vaccinatedAnimals);
  const eligible = safeNum(eligibleAnimals);
  const vaccinationCoverage = eligible > 0 ? (vaccinatedAnimals / eligible) * 100 : 0;

  const mortalityRate = avgPopulation > 0 ? (safeNum(deathsCount) / avgPopulation) * 100 : 0;
  const treatmentIncidence = totalAnimalsPeriod > 0 ? (safeNum(treatmentIncCount) / totalAnimalsPeriod) * 100 : 0;

  const revenue = safeNum(salesRevenueArr[0]?.revenue);
  const totalCostAll = totalFeedCost + totalTreatmentCost + totalVaccineCost;
  const profit = revenue - totalCostAll;
  const profitPerAnimal = animalsAtEnd > 0 ? (profit / animalsAtEnd) : 0;

  const totalWeightGain = safeNum((adgByBreed || []).reduce((s, b) => s + safeNum(b.totalGain), 0));
  const totalFeedConsumed = safeNum(feedConsumption.reduce((s, f) => s + safeNum(f.totalConsumed), 0));
  const fcrOverall = totalWeightGain > 0 ? (totalFeedConsumed / totalWeightGain) : null;

  // Days of Inventory
  const nDays = daysBetween(fromDate, toDate);
  const feedDailyUse = totalFeedConsumed / nDays;
  const treatmentDailyUse = (treatmentConsumption.reduce((s, t) => s + safeNum(t.totalConsumed), 0)) / nDays;
  const vaccineDailyUse = (vaccineConsumption.reduce((s, v) => s + safeNum(v.totalConsumed), 0)) / nDays;

  const feedCoverage = (remainingFeedStock || []).map(s => {
    const daysCover = feedDailyUse > 0 ? (safeNum(s.quantity) / feedDailyUse) : null;
    return { feedName: s.name, quantity: s.quantity, dailyUse: feedDailyUse, daysCover, warn: daysCover !== null && daysCover < 10 };
  });

  const treatmentCoverage = (remainingTreatmentStock || []).map(s => {
    const daysCover = treatmentDailyUse > 0 ? (safeNum(s.volume) / treatmentDailyUse) : null;
    return { treatmentName: s.name, quantity: s.volume, dailyUse: treatmentDailyUse, daysCover, warn: daysCover !== null && daysCover < 10 };
  });

  const vaccineCoverage = (remainingVaccineStock || []).map(s => {
    const totalDoses = safeNum(s?.stock?.totalDoses);
    const daysCover = vaccineDailyUse > 0 ? (totalDoses / vaccineDailyUse) : null;
    return { vaccineName: s.vaccineName, totalDoses, dailyUse: vaccineDailyUse, daysCover, warn: daysCover !== null && daysCover < 10 };
  });

  const birthEntriesData = user.registerationType === 'breeding'
    ? (birthEntriesReport[0] || { totalBirthEntries: 0, totalMales: 0, totalFemales: 0 })
    : { totalBirthEntries: 0, totalMales: 0, totalFemales: 0 };

  const pregnantSonar = user.registerationType === 'breeding'
    ? safeNum(positiveSonarCountArr[0]?.positiveSonarCount)
    : 0;

  const totalMatings = user.registerationType === 'breeding'
    ? safeNum(totalMatingsArr[0]?.totalMatings)
    : 0;

  const femaleCountPeriod = safeNum((animalReport || []).find(r => r.gender === 'female')?.count);
  const fertilityRate = totalMatings > 0
    ? (pregnantSonar / totalMatings) * 100
    : (femaleCountPeriod > 0 ? (pregnantSonar / femaleCountPeriod) * 100 : 0);

  return {
    data: {
      animalReport,
      excludedReport,
      ...(user.registerationType === 'breeding' && {
        pregnantAnimal: pregnantSonar,
        totalMatings,
        fertilityRate,
        birthEntries: birthEntriesData
      }),
      feedConsumption,
      remainingFeedStock,
      treatmentConsumption,
      remainingTreatmentStock,
      vaccineConsumption,
      remainingVaccineStock,
      extraKpis: {
        avgCostPerAnimal,
        vaccinationCoverage,
        mortalityRate,
        treatmentIncidence,
        revenue,
        profit,
        profitPerAnimal,
        fcrOverall,
        ...(user.registerationType === 'breeding' && { fertilityRate })
      },
      perShed: { feed: feedByShed, excluded: excludedByShed },
      perBreed: { animals: animalsByBreed, excluded: excludedByBreed, adg: adgByBreed },
      coverageDays: { feed: feedCoverage, treatment: treatmentCoverage, vaccine: vaccineCoverage },
      totalFeedCost,
      totalTreatmentCost,
      totalVaccineCost
    },
    meta: {
      animalType,
      dateFrom: fmtDate(fromDate),
      dateTo: fmtDate(toDate),
      registrationType: user.registerationType,
      generatedAt: new Date(),
      lang
    }
  };
}

/** ---------------------------
 *  JSON ROUTE
 *  --------------------------- */
const generateCombinedReport = asyncwrapper(async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  const { animalType, dateFrom, dateTo, lang = 'en' } = req.query;
  if (!animalType || !dateFrom || !dateTo) {
    return res.status(400).json({ status: 'error', message: 'Missing animalType, dateFrom, dateTo' });
  }

  let fromDate = parseYMDLocal(dateFrom);
  let toDate   = parseYMDLocal(dateTo);
  if (isNaN(fromDate) || isNaN(toDate)) {
    return res.status(400).json({ status: 'error', message: 'Invalid date format' });
  }
  if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];

  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  const { data, meta } = await buildCombinedReportData({
    userId: new mongoose.Types.ObjectId(req.user.id),
    animalType, fromDate, toDate, lang
  });

  res.status(200).json({ status: 'success', data, meta });
});

/** ---------------------------
 *  PDF ROUTE (with embedded font)
 *  --------------------------- */
const generateCombinedPDFReport = asyncwrapper(async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  const { animalType, dateFrom, dateTo, lang = 'en' } = req.query;
  if (!animalType || !dateFrom || !dateTo) {
    return res.status(400).json({ status: 'error', message: 'Missing animalType, dateFrom, dateTo' });
  }

  let fromDate = parseYMDLocal(dateFrom);
  let toDate   = parseYMDLocal(dateTo);
  if (isNaN(fromDate) || isNaN(toDate)) {
    return res.status(400).json({ status: 'error', message: 'Invalid date format' });
  }
  if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];

  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(23, 59, 59, 999);

  const { data, meta } = await buildCombinedReportData({
    userId: new mongoose.Types.ObjectId(req.user.id),
    animalType, fromDate, toDate, lang
  });

  const isArabic = lang === 'ar';
  const t = (en, ar) => (isArabic ? ar : en);
  const num = (v, d = 2) => (v == null || Number.isNaN(v)) ? '—' : Number(v).toFixed(d);

  const totalAnimalsPdf = data.animalReport?.reduce((sum, r) => sum + (r.count || 0), 0) || 0;
  const maleCount = data.animalReport?.find(r => r.gender === 'male')?.count || 0;
  const femaleCount = data.animalReport?.find(r => r.gender === 'female')?.count || 0;
  const pregnantCount = data.pregnantAnimal || 0;

  let charts = {};
  try {
    const maleCountChart   = data.animalReport?.find(r => r.gender === 'male')?.count   || 0;
    const femaleCountChart = data.animalReport?.find(r => r.gender === 'female')?.count || 0;

    const topFeedsByCost = [...(data.feedConsumption || [])]
      .sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))
      .slice(0, 8);

    const exTypes = ['death','sweep','sale'];
    const exTypesLabels = exTypes.map(k => typeLabel(k, isArabic));
    const exMale = exTypes.map(ty =>
      (data.excludedReport || [])
        .filter(r => r.excludedType === ty && r.gender === 'male')
        .reduce((s, r) => s + (r.count || 0), 0)
    );
    const exFemale = exTypes.map(ty =>
      (data.excludedReport || [])
        .filter(r => r.excludedType === ty && r.gender === 'female')
        .reduce((s, r) => s + (r.count || 0), 0)
    );

    const adgTopBreeds = [...(data.perBreed?.adg || [])]
      .sort((a, b) => (b.avgADG || 0) - (a.avgADG || 0))
      .slice(0, 8);

    charts.animalsByGender = await chartToBase64({
      type: 'doughnut',
      data: {
        labels: [t('Males','ذكور'), t('Females','إناث')],
        datasets: [{ data: [maleCountChart, femaleCountChart], backgroundColor: [genderColors.male, genderColors.female], borderWidth: 0 }]
      },
      options: { responsive: false, plugins: { title: { display: true, text: t('Animals by Gender','توزيع الحيوانات حسب الجنس'), color: brand.text }, legend: { position: 'bottom', labels: { color: brand.text } } } }
    });

    charts.feedCostTop = await chartToBase64({
      type: 'bar',
      data: {
        labels: topFeedsByCost.map(f => f.feedName || '—'),
        datasets: [{
          label: t('Cost','التكلفة'),
          data: topFeedsByCost.map(f => f.totalCost || 0),
          backgroundColor: categorical10.slice(0, topFeedsByCost.length).map(c => hexToRgba(c, 0.85)),
          borderColor: categorical10.slice(0, topFeedsByCost.length),
          borderWidth: 1, borderRadius: 6
        }]
      },
      options: {
        responsive: false,
        plugins: { title: { display: true, text: t('Top Feeds by Cost','أكثر الأعلاف تكلفة'), color: brand.text }, legend: { display: false } },
        scales: { x: { ticks: { color: brand.text }, grid: { color: brand.grid } }, y: { ticks: { color: brand.text }, grid: { color: brand.grid }, beginAtZero: true } }
      }
    });

    charts.excludedByTypeStacked = await chartToBase64({
      type: 'bar',
      data: {
        labels: exTypesLabels,
        datasets: [
          { label: t('Males','ذكور'),   data: exMale,   stack: 'gender', backgroundColor: genderColors.male,   borderWidth: 0 },
          { label: t('Females','إناث'), data: exFemale, stack: 'gender', backgroundColor: genderColors.female, borderWidth: 0 }
        ]
      },
      options: {
        responsive: false,
        plugins: { title: { display: true, text: t('Excluded by Type (Stacked)','الاستبعاد حسب النوع'), color: brand.text }, legend: { labels: { color: brand.text } } },
        scales: { x: { stacked: true, ticks: { color: brand.text }, grid: { color: brand.grid } },
                  y: { stacked: true, ticks: { color: brand.text }, grid: { color: brand.grid }, beginAtZero: true } }
      }
    });

    charts.adgByBreed = await chartToBase64({
      type: 'bar',
      data: {
        labels: (data.perBreed?.adg || []).slice(0,8).map(b => b.breedName || '—'),
        datasets: [{ label: t('Avg ADG','متوسط الزيادة اليومية'), data: (data.perBreed?.adg || []).slice(0,8).map(b => b.avgADG || 0), backgroundColor: hexToRgba(brand.accent, 0.85), borderColor: brand.accent, borderWidth: 1, borderRadius: 6 }]
      },
      options: {
        responsive: false,
        plugins: { title: { display: true, text: t('Avg ADG by Breed','متوسط الزيادة اليومية حسب السلالة'), color: brand.text }, legend: { display: false } },
        scales: { x: { ticks: { color: brand.text }, grid: { color: brand.grid } }, y: { ticks: { color: brand.text }, grid: { color: brand.grid }, beginAtZero: true } }
      }
    });

  } catch (e) {
    console.error('Chart rendering failed:', e);
    charts = {};
  }

  const css = `
    <style>
      ${notoCss()}
      body { margin: 20px; font-size: 14px; color: #333; direction:${isArabic ? 'rtl' : 'ltr'}; text-align:${isArabic ? 'right' : 'left'}; }
      .report-title{ text-align:center; font-size:24px; margin-bottom:20px; font-weight:bold; color:#2c3e50; padding:10px; border-bottom:2px solid #46AE65; }
      .report-subtitle{ text-align:center; font-size:16px; color:#7f8c8d; margin-bottom:30px; }
      .section{ margin-bottom:30px; background:#fff; padding:20px; border-radius:5px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
      .section-title{ color:#2c3e50; font-size:18px; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #eee; }
      .table{ width:100%; border-collapse:collapse; margin-bottom:20px; table-layout:fixed; }
      .table th, .table td{ padding:12px; border:1px solid #ddd; vertical-align:middle; white-space:nowrap; word-wrap:break-word; }
      .table thead th{ background:#14532d; color:#fff; font-weight:bold; font-size:15px; }
      .rtl .table th, .rtl .table td { text-align:center; }
      .num { direction:ltr; text-align:center; }
      .stats-container{ display:flex; flex-wrap:wrap; gap:12px; }
      .stat-box{ background:#f8f9fa; padding:15px; border-radius:5px; text-align:center; flex:1; min-width:180px; border:1px solid #dee2e6; }
      .stat-number{ font-size:22px; font-weight:bold; color:#21763e; margin:6px 0; }
      .stat-label{ color:#666; font-size:13px; }
      .footer{ text-align:center; margin-top:30px; padding-top:20px; border-top:1px solid #eee; color:#7f8c8d; font-size:12px; }
      .charts-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
      .chart-card{ background:#fff; border:1px solid #eee; border-radius:5px; padding:10px; display:flex; align-items:center; justify-content:center; }
      .chart-card img{ width:100%; height:auto; }
      @page { size: A4; margin: 20mm; }
    </style>
  `;

  const html = `
  <!doctype html>
  <html lang="${lang}" dir="${isArabic ? 'rtl' : 'ltr'}" class="${isArabic ? 'rtl' : 'ltr'}">
    <head><meta charset="utf-8" />${css}</head>
    <body>
      <h1 class="report-title">${t('Farm Management Report', 'تقرير إدارة المزرعة')}</h1>
      <div class="report-subtitle">
        <p>${t('Period', 'الفترة')}: ${meta.dateFrom} - ${meta.dateTo}</p>
        <p>${t('Animal Type', 'نوع الحيوان')}: ${meta.animalType}</p>
      </div>

      <div class="section">
        <h2 class="section-title">${t('Key Performance Indicators (KPIs)', 'مؤشرات الأداء الرئيسية')}</h2>
        <div class="stats-container">
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.avgCostPerAnimal)}</span></div><div class="stat-label">${t('Avg Cost / Animal', 'متوسط التكلفة/حيوان')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.vaccinationCoverage, 1)}%</span></div><div class="stat-label">${t('Vaccination Coverage', 'تغطية التطعيم')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.mortalityRate, 2)}%</span></div><div class="stat-label">${t('Mortality Rate', 'معدل النفوق')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.treatmentIncidence, 2)}%</span></div><div class="stat-label">${t('Treatment Incidence', 'معدل العلاج')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${data.extraKpis?.fcrOverall ? num(data.extraKpis.fcrOverall, 2) : '—'}</span></div><div class="stat-label">${t('Overall FCR', 'FCR إجمالي')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.revenue)}</span></div><div class="stat-label">${t('Sales Revenue', 'إيراد المبيعات')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.profit)}</span></div><div class="stat-label">${t('Net Profit', 'صافي الربح')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(data.extraKpis?.profitPerAnimal)}</span></div><div class="stat-label">${t('Profit / Animal', 'الربح/حيوان')}</div></div>
          ${meta.registrationType === 'breeding' ? `
            <div class="stat-box">
              <div class="stat-number"><span class="num">${num(data.extraKpis?.fertilityRate, 2)}%</span></div>
              <div class="stat-label">${t('Fertility Rate', 'معدل الخصوبة')}</div>
            </div>
          ` : '' }
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">${t('Animal Counts', 'أعداد الحيوانات')}</h2>
        <div class="stats-container">
          <div class="stat-box"><div class="stat-number"><span class="num">${num(totalAnimalsPdf, 0)}</span></div><div class="stat-label">${t('Total Animals', 'إجمالي الحيوانات')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(maleCount, 0)}</span></div><div class="stat-label">${t('Males', 'ذكور')}</div></div>
          <div class="stat-box"><div class="stat-number"><span class="num">${num(femaleCount, 0)}</span></div><div class="stat-label">${t('Females', 'إناث')}</div></div>
          ${ (pregnantCount > 0) ? `<div class="stat-box"><div class="stat-number"><span class="num">${num(pregnantCount, 0)}</span></div><div class="stat-label">${t('Pregnant', 'حوامل')}</div></div>` : '' }
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">${t('Charts','رسوم بيانية')}</h2>
        <div class="charts-grid">
          ${charts.animalsByGender ? `<div class="chart-card"><img src="data:image/png;base64,${charts.animalsByGender}" alt="animals by gender"/></div>` : ''}
          ${charts.feedCostTop ? `<div class="chart-card"><img src="data:image/png;base64,${charts.feedCostTop}" alt="feed cost"/></div>` : ''}
          ${charts.excludedByTypeStacked ? `<div class="chart-card"><img src="data:image/png;base64,${charts.excludedByTypeStacked}" alt="excluded stacked"/></div>` : ''}
          ${charts.adgByBreed ? `<div class="chart-card"><img src="data:image/png;base64,${charts.adgByBreed}" alt="adg by breed"/></div>` : ''}
        </div>
      </div>

      <div class="section">
        <h2 class="section-title">${t('Per Shed', 'حسب الحظيرة')}</h2>
        <h3>${t('Feed Consumption/Cost', 'استهلاك/تكلفة العلف')}</h3>
        <table class="table">
          <colgroup><col style="width:45%"><col style="width:27.5%"><col style="width:27.5%"></colgroup>
          <thead><tr><th>${t('Shed', 'الحظيرة')}</th><th>${t('Consumed', 'الاستهلاك')}</th><th>${t('Cost', 'التكلفة')}</th></tr></thead>
          <tbody>${(data.perShed?.feed || []).map(s => `<tr><td>${s.shedName || '—'}</td><td class="num">${num(s.totalConsumed, 2)}</td><td class="num">${num(s.totalCost, 2)}</td></tr>`).join('')}</tbody>
        </table>
        <h3>${t('Mortality/Excluded', 'النفوق/الاستبعاد')}</h3>
        <table class="table">
          <colgroup><col style="width:45%"><col style="width:27.5%"><col style="width:27.5%"></colgroup>
          <thead><tr><th>${t('Shed', 'الحظيرة')}</th><th>${t('Reason', 'السبب')}</th><th>${t('Count', 'العدد')}</th></tr></thead>
          <tbody>${(data.perShed?.excluded || []).map(s => `<tr><td>${s.shedName || '—'}</td><td>${s.excludedType}</td><td class="num">${s.count}</td></tr>`).join('')}</tbody>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">${t('Per Breed', 'حسب السلالة')}</h2>
        <h3>${t('Animal Count', 'عدد الحيوانات')}</h3>
        <table class="table">
          <colgroup><col style="width:60%"><col style="width:40%"></colgroup>
          <thead><tr><th>${t('Breed', 'السلالة')}</th><th>${t('Count', 'العدد')}</th></tr></thead>
          <tbody>${(data.perBreed?.animals || []).map(b => `<tr><td>${b.breedName || '—'}</td><td class="num">${b.count || 0}</td></tr>`).join('')}</tbody>
        </table>
        <h3>${t('Excluded', 'الاستبعاد')}</h3>
        <table class="table">
          <colgroup><col style="width:40%"><col style="width:40%"><col style="width:20%"></colgroup>
          <thead><tr><th>${t('Breed', 'السلالة')}</th><th>${t('Reason', 'السبب')}</th><th>${t('Count', 'العدد')}</th></tr></thead>
          <tbody>${(data.perBreed?.excluded || []).map(b => `<tr><td>${b.breedName || '—'}</td><td>${b.excludedType}</td><td class="num">${b.count}</td></tr>`).join('')}</tbody>
        </table>
        <h3>ADG</h3>
        <table class="table">
          <colgroup><col style="width:40%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>
          <thead><tr><th>${t('Breed', 'السلالة')}</th><th>${t('Avg ADG', 'متوسط الزيادة اليومية')}</th><th>${t('Total Gain', 'إجمالي الزيادة')}</th><th>${t('Animals', 'عدد الحيوانات')}</th></tr></thead>
          <tbody>${(data.perBreed?.adg || []).map(b => `<tr><td>${b.breedName || '—'}</td><td class="num">${num(b.avgADG, 2)}</td><td class="num">${num(b.totalGain, 2)}</td><td class="num">${b.animals || 0}</td></tr>`).join('')}</tbody>
        </table>
      </div>

      <div class="section">
        <h2 class="section-title">${t('Days of Inventory', 'تغطية المخزون (أيام)')}</h2>
        <h3>${t('Feed', 'العلف')}</h3>
        <table class="table" dir="${isArabic ? 'rtl' : 'ltr'}">
          <colgroup><col style="width:26%"><col style="width:18%"><col style="width:20%"><col style="width:20%"><col style="width:16%"></colgroup>
          <thead><tr><th>${t('Feed', 'العلف')}</th><th>${t('Stock', 'المخزون')}</th><th>${t('Daily Use', 'الاستهلاك اليومي')}</th><th>${t('Days Cover', 'أيام التغطية')}</th><th>${t('Warn', 'تحذير')}</th></tr></thead>
          <tbody>
            ${(data.coverageDays?.feed || []).map(r => `
              <tr>
                <td>${r.feedName ?? '—'}</td>
                <td class="num">${r.quantity != null ? Number(r.quantity).toFixed(2) : '—'}</td>
                <td class="num">${r.dailyUse != null ? Number(r.dailyUse).toFixed(2) : '—'}</td>
                <td class="num">${r.daysCover != null ? Number(r.daysCover).toFixed(1) : '—'}</td>
                <td>${r.warn ? (isArabic ? 'نعم' : 'Yes') : (isArabic ? 'لا' : 'No')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>${t('Treatment', 'العلاج')}</h3>
        <table class="table" dir="${isArabic ? 'rtl' : 'ltr'}">
          <colgroup><col style="width:26%"><col style="width:18%"><col style="width:20%"><col style="width:20%"><col style="width:16%"></colgroup>
          <thead><tr><th>${t('Treatment', 'العلاج')}</th><th>${t('Stock', 'المخزون')}</th><th>${t('Daily Use', 'الاستهلاك اليومي')}</th><th>${t('Days Cover', 'أيام التغطية')}</th><th>${t('Warn', 'تحذير')}</th></tr></thead>
          <tbody>
            ${(data.coverageDays?.treatment || []).map(r => `
              <tr>
                <td>${r.treatmentName ?? '—'}</td>
                <td class="num">${r.quantity != null ? Number(r.quantity).toFixed(2) : '—'}</td>
                <td class="num">${r.dailyUse != null ? Number(r.dailyUse).toFixed(2) : '—'}</td>
                <td class="num">${r.daysCover != null ? Number(r.daysCover).toFixed(1) : '—'}</td>
                <td>${r.warn ? (isArabic ? 'نعم' : 'Yes') : (isArabic ? 'لا' : 'No')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>${t('Vaccine', 'اللقاح')}</h3>
        <table class="table" dir="${isArabic ? 'rtl' : 'ltr'}">
          <colgroup><col style="width:32%"><col style="width:20%"><col style="width:20%"><col style="width:16%"><col style="width:12%"></colgroup>
          <thead><tr><th>${t('Vaccine', 'اللقاح')}</th><th>${t('Remaining Doses', 'الجرعات المتبقية')}</th><th>${t('Daily Use', 'الاستهلاك اليومي')}</th><th>${t('Days Cover', 'أيام التغطية')}</th><th>${t('Warn', 'تحذير')}</th></tr></thead>
          <tbody>
            ${(data.coverageDays?.vaccine || []).map(r => `
              <tr>
                <td>${r.vaccineName ?? '—'}</td>
                <td class="num">${r.totalDoses != null ? Number(r.totalDoses).toFixed(0) : '—'}</td>
                <td class="num">${r.dailyUse != null ? Number(r.dailyUse).toFixed(2) : '—'}</td>
                <td class="num">${r.daysCover != null ? Number(r.daysCover).toFixed(1) : '—'}</td>
                <td>${r.warn ? (isArabic ? 'نعم' : 'Yes') : (isArabic ? 'لا' : 'No')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="footer">
        <p>${t('Generated on', 'تم الإنشاء في')}: ${new Date().toLocaleString(isArabic ? 'ar-EG' : 'en-US')}</p>
        <p>${t('Report Period', 'فترة التقرير')}: ${meta.dateFrom} - ${meta.dateTo}</p>
      </div>
    </body>
  </html>`;

  // html-pdf options tuned for PhantomJS
  const options = {
    format: 'A4',
    orientation: 'portrait',
    border: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    timeout: 60000,
    base: 'file://' + path.resolve(process.cwd()) + '/',
    phantomArgs: ['--ssl-protocol=any', '--ignore-ssl-errors=true', '--web-security=false']
  };

  const filePath = path.join(__dirname, `combined_report_${lang}.pdf`);
  pdf.create(html, options).toFile(filePath, (err) => {
    if (err) return res.status(500).json({ status: 'error', message: 'Failed to generate PDF', details: err.message });
    res.download(filePath, `farm_report_${lang}.pdf`, (e) => {
      if (e) console.error('Download error:', e);
      fs.unlink(filePath, () => {});
    });
  });
});

module.exports = {
  generateCombinedReport,
  generateCombinedPDFReport
};
