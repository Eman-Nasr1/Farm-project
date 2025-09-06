const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Mating = require('../Models/mating.model');

// Email setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'emannasr2001@gmail.com',
        pass: 'oabb urgv ohae btvu'
    }
});

// Notification function
async function sendSingleNotification(userEmail, matingData, eventType) {
    const eventDate = eventType === 'sonar' ? matingData.sonarDate : matingData.expectedDeliveryDate;
    const eventName = eventType === 'sonar' ? 'السونار' : 'الولادة المتوقعة';
    const preparation = eventType === 'sonar' ? 'الفحص البيطري' : 'الولادة';

    const mailOptions = {
        from: 'emannasr2001@gmail.com',
        to: userEmail,
        subject: `تذكير بموعد ${eventName}`,
        text: `عزيزي المربي،
        
هذا تذكير بأن موعد ${eventName} للحيوان ${matingData.tagId} 
سيكون بعد أسبوع من اليوم (${eventDate.toLocaleDateString('ar-EG')}).

يرجى التحضير ل${preparation} وتجهيز جميع المستلزمات اللازمة.

مع خالص التقدير،
إدارة المزرعة`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`تم إرسال إشعار ${eventType} لـ ${matingData.tagId} إلى ${userEmail}`);

        // Mark notification as sent
        await Mating.updateOne(
            { _id: matingData._id },
            { $set: { [`${eventType}NotificationSent`]: true } }
        );

    } catch (error) {
        console.error(`فشل إرسال إشعار ${eventType}:`, error);
    }
}

// Daily check at 8 AM
cron.schedule('0 8 * * *', async () => {
    console.log('بدء التحقق من مواعيد السونار والولادة...');

    try {
        const today = new Date();
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(today.getDate() + 7);

        // Find matings where dates fall exactly one week from today
        const matings = await Mating.find({
            $or: [
                {
                    sonarDate: {
                        $gte: new Date(oneWeekFromNow.setHours(0, 0, 0, 0)),
                        $lte: new Date(oneWeekFromNow.setHours(23, 59, 59, 999))
                    },
                    sonarNotificationSent: false
                },
                {
                    expectedDeliveryDate: {
                        $gte: new Date(oneWeekFromNow.setHours(0, 0, 0, 0)),
                        $lte: new Date(oneWeekFromNow.setHours(23, 59, 59, 999))
                    },
                    sonarResult: 'positive',
                    deliveryNotificationSent: false
                }
            ]
        }).populate('owner');

        // Send notifications
        for (const mating of matings) {
            if (mating.sonarDate && !mating.sonarNotificationSent) {
                await sendSingleNotification(mating.owner.email, mating, 'sonar');
            }
            
            if (mating.expectedDeliveryDate && mating.sonarResult === 'positive' && !mating.deliveryNotificationSent) {
                await sendSingleNotification(mating.owner.email, mating, 'delivery');
            }
        }

    } catch (error) {
        console.error('حدث خطأ أثناء التحقق:', error);
    }
});

module.exports = cron;