const Notification = require('../Models/notification.model');
const i18n = require('../i18n');
const { daysUntil, getStage, fmt, addDays } = require('./dateHelpers')

async function upsertVaccineDoseNotification({
    owner,
    vaccineEntryId,
    subtype,           // 'booster' | 'annual'
    dueDate,           // تاريخ الجرعة الفعلي
    tagId,
    vaccineName,       // <<< ضيفي الاسم من الكولر
    lang = 'en',
    twoPoints = true   // لو شغّال الهيلبر بشكل دوري، خليه true. لو بتنده وهو بعيد عن الموعد، ممكن يبقى no-op.
}) {
    if (!dueDate) return;

    i18n.setLocale(lang);

    const today = new Date();
    const delta = daysUntil(today, dueDate); // باقي كام يوم للموعد
    const dateStr = fmt(dueDate);

    // لو عايزاها تشتغل "مرّة واحدة" فقط عند 7 أيام أو يوم الموعد:
    if (twoPoints && !(delta === 7 || delta === 0)) {
        return; // خارج النقطتين المستهدفين، بلاش نعمل إشعار
    }

    // حددي stage/severity
    const stage = getStage(delta);                 // month/week/expired
    const severity = (delta <= 7 ? 'high' : 'medium');

    // حضّري الرسالة باسم اللقاح + التاريخ
    const message = subtype === 'booster'
        ? (delta === 0
            ? i18n.__('VACCINE_BOOSTER_DUE_TODAY', { tagId, name: vaccineName, date: dateStr })
            : i18n.__('VACCINE_BOOSTER_DUE_IN_DAYS', { tagId, name: vaccineName, days: delta, date: dateStr }))
        : (delta === 0
            ? i18n.__('VACCINE_ANNUAL_DUE_TODAY', { tagId, name: vaccineName, date: dateStr })
            : i18n.__('VACCINE_ANNUAL_DUE_IN_DAYS', { tagId, name: vaccineName, days: delta, date: dateStr }));

    // نخزن dueDate مختلف لتذكير -7 أيام عشان يبقى إشعار مستقل عن إشعار يوم الموعد
    const storedDueDate = (twoPoints && delta === 7)
        ? addDays(dueDate, -7)
        : dueDate;

    // upsert يمنع التكرار على (owner,type,itemId,dueDate)
    await Notification.updateOne(
        { owner, type: 'VaccineDose', itemId: vaccineEntryId, dueDate: storedDueDate },
        { $set: { subtype, message, severity, stage, isRead: false } },
        { upsert: true }
    );
}

module.exports = { upsertVaccineDoseNotification };
