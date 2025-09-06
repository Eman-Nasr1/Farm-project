const Treatment = require('../Models/treatment.model');
const Vaccine = require('../Models/vaccine.model');
const i18n = require('../i18n');
const { daysUntil, getStage, fmt ,addDays,addMonths} = require('../helpers/dateHelpers'); 
const Animal = require("../Models/animal.model");
const Breeding = require('../Models/breeding.model');
const VaccineEntry = require('../Models/vaccineEntry.model');

const getVaccineDisplayName = (vaccineDoc, lang = 'en') => {
    const other = (vaccineDoc.otherVaccineName || '').trim();
    if (other) return other;

    // محتاج تكون عامِل populate لـ vaccineType قبل النداء على الهيلبر
    if (lang === 'ar') {
        return vaccineDoc.vaccineType?.arabicName || i18n.__('UNKNOWN_VACCINE');
    }
    return vaccineDoc.vaccineType?.englishName || i18n.__('UNKNOWN_VACCINE');
};

function getStageExpiry(daysUntilExpiry) {
    if (daysUntilExpiry <= 0) return 'expired';
    if (daysUntilExpiry <= 7) return 'week';
    return 'month';
}
// Main function to check for expiring items
const checkExpiringItems = async (lang = 'en') => {
    // Set the language
    i18n.setLocale(lang);

    const notifications = [];
    const today = new Date();
    const warningDays = 30; // Changed to 30 days warning

    try {
        // Check treatments
        const treatments = await Treatment.find({
            expireDate: {
                $exists: true,
                $ne: null
            }
        });

        for (const treatment of treatments) {
            if (treatment.expireDate) {
                const daysUntilExpiry = Math.ceil((treatment.expireDate - today) / (1000 * 60 * 60 * 24));
                const d = new Date(treatment.expireDate);
                const expireDateFormatted = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;


                // Notify if expired or expiring within 30 days
                if (daysUntilExpiry <= warningDays) {
                    let message;
                    let severity;

                    if (daysUntilExpiry <= 0) {
                        message = i18n.__('TREATMENT_EXPIRED', {
                            name: treatment.name,
                            date: expireDateFormatted
                        });
                        severity = 'high';
                    } else if (daysUntilExpiry <= 7) {
                        message = i18n.__('TREATMENT_EXPIRE_SOON', {
                            name: treatment.name,
                            days: daysUntilExpiry,
                            date: expireDateFormatted
                        });
                        severity = 'high';
                    } else {
                        message = i18n.__('TREATMENT_EXPIRE_WARNING', {
                            name: treatment.name,
                            days: daysUntilExpiry,
                            date: expireDateFormatted
                        });
                        severity = 'medium';
                    }

                    // مثال داخل لوب الـ treatments (بعد ما تحسبي daysUntilExpiry و message و severity)
                    notifications.push({
                        type: 'Treatment',
                        itemId: treatment._id,
                        message,
                        expiryDate: treatment.expireDate,   // اختياري لو عايزاه
                        owner: treatment.owner,
                        severity,
                        stage: getStageExpiry(daysUntilExpiry)     // ← أضفنا المرحلة
                    });

                }
            }
        }

        // Check vaccines
        const vaccines = await Vaccine.find({
            expiryDate: { $exists: true, $ne: null }
        }).populate({ path: 'vaccineType', select: 'arabicName englishName' });

        for (const vaccine of vaccines) {
            if (!vaccine.expiryDate) continue;

            const daysUntilExpiry = Math.ceil((vaccine.expiryDate - today) / (1000 * 60 * 60 * 24));
            const d = new Date(vaccine.expiryDate);
            const expireDateFormatted = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;

            const displayName = getVaccineDisplayName(vaccine, lang);

            if (daysUntilExpiry <= warningDays) {
                let message, severity;

                if (daysUntilExpiry <= 0) {
                    message = i18n.__('VACCINE_EXPIRED', { name: displayName, date: expireDateFormatted });
                    severity = 'high';
                } else if (daysUntilExpiry <= 7) {
                    message = i18n.__('VACCINE_EXPIRE_SOON', { name: displayName, days: daysUntilExpiry, date: expireDateFormatted });
                    severity = 'high';
                } else {
                    message = i18n.__('VACCINE_EXPIRE_WARNING', { name: displayName, days: daysUntilExpiry, date: expireDateFormatted });
                    severity = 'medium';
                }
                notifications.push({
                    type: 'Vaccine',
                    itemId: vaccine._id,
                    message,
                    expiryDate: vaccine.expiryDate,      // اختياري
                    owner: vaccine.owner,
                    severity,
                    stage: getStageExpiry(daysUntilExpiry)
                });

            }
        }

        return notifications;
    } catch (error) {
        console.error('Error checking expiring items:', error);
        throw error;
    }
};

async function collectWeightNotifications(lang = 'en') {
    i18n.setLocale(lang);

    const PRE_REMINDER_DAYS = 7;   // ← قبل الموعد بـ 7 أيام
    const today = new Date();
    const results = [];

    // هات السجلات اللي فيها plannedWeights
    const breedings = await Breeding.find(
        { 'birthEntries.plannedWeights.0': { $exists: true } },
        { birthEntries: 1, owner: 1 }
    ).lean();

    // كاش للحيوانات
    const animalCache = new Map();
    const getAnimalId = async (ownerId, tagId) => {
        const key = `${ownerId}:${tagId}`;
        if (animalCache.has(key)) return animalCache.get(key);
        const doc = await Animal.findOne({ owner: ownerId, tagId }, { _id: 1 }).lean();
        const val = doc ? doc._id : null;
        animalCache.set(key, val);
        return val;
    };

    for (const b of breedings) {
        const ownerId = String(b.owner);

        for (const entry of b.birthEntries || []) {
            if (!entry?.plannedWeights || !entry.tagId) continue;

            for (const due of entry.plannedWeights) {
                const d = new Date(due);
                if (Number.isNaN(d.getTime())) continue;

                const delta = daysUntil(today, d);
                const animalId = await getAnimalId(ownerId, entry.tagId);
                if (!animalId) continue;

                // 1) تَنبيه قبل 7 أيام بالظبط
                if (delta === PRE_REMINDER_DAYS) {
                    const message = i18n.__('WEIGHT_REMINDER_7_DAYS', {
                        tagId: entry.tagId,
                        date: fmt(d)       // تاريخ الوزن نفسه
                    });
                    results.push({
                        type: 'Weight',
                        itemId: animalId,  // Animal._id
                        message,
                        dueDate: d,        // تاريخ الوزن (مش تاريخ التذكير)
                        owner: ownerId,
                        severity: 'high',
                        stage: 'week'      // لأنه داخل أسبوع
                    });
                    continue; // نكمل للموعد التالي
                }

                // 2) (اختياري) إشعار يوم الموعد/بعده
                if (delta <= 0) {
                    const message = i18n.__('WEIGHT_DUE_TODAY_OR_OVERDUE', {
                        tagId: entry.tagId,
                        date: fmt(d)
                    });
                    results.push({
                        type: 'Weight',
                        itemId: animalId,
                        message,
                        dueDate: d,
                        owner: ownerId,
                        severity: 'high',
                        stage: 'expired'
                    });
                    // مافيهوش continue عشان خلاص هنروح للوزن اللي بعده تلقائي
                }
            }
        }
    }

    return results;
}

const collectVaccineDoseNotifications = async (lang = 'en') => { 
    i18n.setLocale(lang);
    const out = [];
    const REMINDER_DAYS = 7;
  
    const entries = await VaccineEntry.find({})
      .populate({
        path: 'Vaccine',
        select: 'BoosterDose AnnualDose owner otherVaccineName vaccineType',
        populate: { path: 'vaccineType', select: 'arabicName englishName' }
      })
      .lean();
  
    const today = new Date();
  
    for (const e of entries) {
      const v = e.Vaccine;
      if (!v) continue;
  
      const name = getVaccineDisplayName(v, lang);
 
      // ---------- Booster (بالأيام) ----------
      if (typeof v.BoosterDose === 'number' && v.BoosterDose > 0) {
        const due = addDays(new Date(e.date), v.BoosterDose); // تاريخ الجرعة
        const delta = daysUntil(today, due);
        const dateStr = fmt(due);
  
        // 1) قبل 7 أيام (مرّة واحدة)
        if (delta === REMINDER_DAYS) {
          const reminderDate = addDays(due, -REMINDER_DAYS); // نخزّن dueDate مختلف علشان يبقى إشعار مستقل
          out.push({
            type: 'VaccineDose',
            itemId: e._id,
            subtype: 'booster',
            dueDate: reminderDate,
            message: i18n.__('VACCINE_BOOSTER_DUE_IN_DAYS', { tagId: e.tagId, name, days: REMINDER_DAYS, date: dateStr }),
            owner: v.owner,
            severity: 'high',
            stage: 'week'
          });
        }
  
        // 2) يوم الموعد نفسه
        if (delta === 0) {
          out.push({
            type: 'VaccineDose',
            itemId: e._id,
            subtype: 'booster',
            dueDate: due, // تاريخ الجرعة نفسه
            message: i18n.__('VACCINE_BOOSTER_DUE_TODAY', { tagId: e.tagId, name, date: dateStr }),
            owner: v.owner,
            severity: 'high',
            stage: 'expired' // خليه زي ما هو بما إن map بتاعتك week/expired
          });
        }
      }
  
      // ---------- Annual (بالشهور) ----------
      if (typeof v.AnnualDose === 'number' && v.AnnualDose > 0) {
        const due = addMonths(new Date(e.date), v.AnnualDose);
        const delta = daysUntil(today, due);
        const dateStr = fmt(due);
  
        // 1) قبل 7 أيام
        if (delta === REMINDER_DAYS) {
          const reminderDate = addDays(due, -REMINDER_DAYS);
          out.push({
            type: 'VaccineDose',
            itemId: e._id,
            subtype: 'annual',
            dueDate: reminderDate,
            message: i18n.__('VACCINE_ANNUAL_DUE_IN_DAYS', { tagId: e.tagId, name, days: REMINDER_DAYS, date: dateStr }),
            owner: v.owner,
            severity: 'high',
            stage: 'week'
          });
        }
  
        // 2) يوم الموعد
        if (delta === 0) {
          out.push({
            type: 'VaccineDose',
            itemId: e._id,
            subtype: 'annual',
            dueDate: due,
            message: i18n.__('VACCINE_ANNUAL_DUE_TODAY', { tagId: e.tagId, name, date: dateStr }),
            owner: v.owner,
            severity: 'high',
            stage: 'expired'
          });
        }
      }
    }
   
    return out;
  };
  
  
  
  /** دالة جامعة لو تحبي تستخدمى واحدة ترجع الكل: */
  const collectAllNotifications = async (lang = 'en') => {
    const a = await checkExpiringItems(lang);
    const b = await collectWeightNotifications(lang);
    const c = await collectVaccineDoseNotifications(lang); // اختياري: سيبيها لو عايزة rely على الإنشاء وقت التسجيل فقط
    return [...a, ...b, ...c];
  };
module.exports = {
    checkExpiringItems,
    collectWeightNotifications,
    collectVaccineDoseNotifications,
    collectAllNotifications 
}; 