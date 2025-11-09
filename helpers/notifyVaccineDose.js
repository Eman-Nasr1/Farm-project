const NotificationService = require('../utilits/notificationService');
const i18n = require('../i18n');
const { daysUntil, getStage, fmt, addDays } = require('./dateHelpers');

async function upsertVaccineDoseNotification({
    owner,
    vaccineEntryId,
    subtype,           // 'booster' | 'annual'
    dueDate,           // تاريخ الجرعة الفعلي
    tagId,
    vaccineName,       // اسم اللقاح
    lang = 'en',
    twoPoints = true   // تشغيل على نقطتين: -7 أيام واليوم نفسه
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

    // Use notification service with idempotency
    await NotificationService.upsertNotification({
        type: 'VaccineDose',
        owner,
        itemId: vaccineEntryId,
        dueDate: storedDueDate,
        subtype,
        message,
        severity,
        stage,
        category: 'medical',
        metadata: {
            tagId,
            vaccineName,
            dateStr,
            delta
        },
        itemTagId: tagId,
        itemName: vaccineName
    });
}

module.exports = { upsertVaccineDoseNotification };
