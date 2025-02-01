const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Breeding = require('../Models/breeding.model'); // تأكدي أن المسار صحيح

// إعداد البريد الإلكتروني
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'emannasr2001@gmail.com', // بريدك
        pass: 'oabb urgv ohae btvu'  // كلمة مرور التطبيق
    }
});

// وظيفة إرسال الإشعار
async function sendNotification(userEmail, birthEntry, breedingId) {
    const mailOptions = {
        from: 'emannasr2001@gmail.com',
        to: userEmail,
        subject: 'تذكير بموعد الفطام',
        text: `عزيزي المستخدم،\n\nهذا تذكير بأن موعد فطام الحيوان ${birthEntry.tagId} سيكون في ${birthEntry.expectedWeaningDate.toDateString()}.\n\nشكراً لك!`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`تم إرسال الإشعار إلى ${userEmail}`);

        // تحديث قاعدة البيانات لتحديد أن الإيميل قد أُرسل
        await Breeding.updateOne(
            { _id: breedingId, 'birthEntries._id': birthEntry._id },
            { $set: { 'birthEntries.$.isEmailSent': true } }
        );

    } catch (error) {
        console.error('خطأ أثناء إرسال البريد:', error);
    }
}

// مهمة الجدولة: تعمل مرة يوميًا عند منتصف الليل
cron.schedule('0 0 * * *', async () => {
    console.log('جاري التحقق من تواريخ الفطام القادمة...');

    try {
        const today = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setDate(today.getDate() + 7);

        // جلب الولادات التي موعد فطامها قريب ولم يتم إرسال الإيميل لها بعد
        const breedings = await Breeding.find({
            'birthEntries.expectedWeaningDate': { $gte: today, $lte: oneWeekLater },
            'birthEntries.isEmailSent': false  // شرط التأكد من عدم إرسال الإيميل سابقًا
        }).populate('owner'); 

        // إرسال الإيميل فقط للمواليد التي لم يُرسل لها من قبل
        for (const breeding of breedings) {
            for (const entry of breeding.birthEntries) {
                if (
                    entry.expectedWeaningDate >= today &&
                    entry.expectedWeaningDate <= oneWeekLater &&
                    !entry.isEmailSent  // التأكد من أن الإيميل لم يُرسل سابقًا
                ) {
                    const userEmail = breeding.owner.email;
                    await sendNotification(userEmail, entry, breeding._id);
                }
            }
        }
    } catch (error) {
        console.error('خطأ أثناء التحقق من تواريخ الفطام:', error);
    }
});

module.exports = cron;
