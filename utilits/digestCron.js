// utilits/digestCron.js
const cron = require('node-cron');
const NotificationDigest = require('../Models/notificationDigest.model');
const UserAlertPreference = require('../Models/userAlertPreference.model');
const NotificationService = require('./notificationService');
const nodemailer = require('nodemailer');

// Email configuration (should be moved to environment variables)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER ,
    pass: process.env.EMAIL_PASS 
  }
});

/**
 * Generate email HTML content for digest
 */
function generateDigestEmail(digest, user, lang = 'en') {
  const { summary, highlights, notifications } = digest;
  
  let html = `
    <!DOCTYPE html>
    <html lang="${lang}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Weekly Farm Notifications Digest</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
        .summary { background-color: #f4f4f4; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .highlight { background-color: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }
        .notification { padding: 10px; margin: 10px 0; border-bottom: 1px solid #ddd; }
        .critical { background-color: #f8d7da; border-left: 4px solid #dc3545; }
        .high { background-color: #fff3cd; border-left: 4px solid #ffc107; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${lang === 'ar' ? 'ملخص إشعارات المزرعة الأسبوعي' : 'Weekly Farm Notifications Digest'}</h1>
          <p>${lang === 'ar' ? `الأسبوع ${digest.digestPeriod.weekNumber} من ${digest.digestPeriod.year}` : `Week ${digest.digestPeriod.weekNumber} of ${digest.digestPeriod.year}`}</p>
        </div>
        
        <div class="summary">
          <h3>${lang === 'ar' ? 'ملخص' : 'Summary'}</h3>
          <p><strong>${lang === 'ar' ? 'إجمالي الإشعارات' : 'Total Notifications'}:</strong> ${summary.totalNotifications}</p>
          <p><strong>${lang === 'ar' ? 'غير مقروءة' : 'Unread'}:</strong> ${summary.unreadCount}</p>
          ${summary.criticalCount > 0 ? `<p style="color: #dc3545;"><strong>${lang === 'ar' ? 'حرجة' : 'Critical'}:</strong> ${summary.criticalCount}</p>` : ''}
        </div>
  `;

  if (highlights && highlights.length > 0) {
    html += `
      <h3>${lang === 'ar' ? 'أهم الإشعارات' : 'Highlights'}</h3>
    `;
    highlights.forEach(h => {
      const notification = notifications.find(n => n._id.toString() === h.notificationId.toString());
      if (notification) {
        html += `
          <div class="highlight ${h.priority}">
            <strong>${notification.title || h.headline}</strong>
            <p>${notification.message}</p>
          </div>
        `;
      }
    });
  }

  html += `
        <h3>${lang === 'ar' ? 'جميع الإشعارات' : 'All Notifications'}</h3>
  `;

  notifications.forEach(notif => {
    html += `
      <div class="notification ${notif.severity}">
        <strong>${notif.type}</strong> - ${notif.message}
        <p><small>${new Date(notif.createdAt).toLocaleString()}</small></p>
      </div>
    `;
  });

  html += `
        <div class="footer">
          <p>${lang === 'ar' ? 'تم إنشاء هذا الملخص تلقائياً' : 'This digest was automatically generated'}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Send digest email
 */
async function sendDigestEmail(digest) {
  try {
    const User = require('../Models/user.model');
    const user = await User.findById(digest.owner);
    
    if (!user) {
      console.error('User not found for digest:', digest.owner);
      return false;
    }

    const preferences = await UserAlertPreference.findOne({ user: digest.owner });
    const lang = preferences?.language || digest.locale || 'en';

    const emailHtml = generateDigestEmail(digest, user, lang);
    const emailSubject = lang === 'ar' 
      ? `ملخص إشعارات المزرعة - الأسبوع ${digest.digestPeriod.weekNumber}`
      : `Farm Notifications Digest - Week ${digest.digestPeriod.weekNumber}`;

    const mailOptions = {
      from: transporter.options.auth.user,
      to: preferences?.channels?.find(c => c.channel === 'email')?.emailAddress || user.email,
      subject: emailSubject,
      html: emailHtml,
      text: `You have ${digest.summary.totalNotifications} notifications. Visit your farm dashboard to see details.`
    };

    await transporter.sendMail(mailOptions);
    
    // Update digest status
    digest.deliveryStatus = 'sent';
    digest.sentAt = new Date();
    digest.recipientEmail = mailOptions.to;
    digest.recipientName = user.name;
    await digest.save();

    console.log(`Digest sent successfully to ${mailOptions.to}`);
    return true;
  } catch (error) {
    console.error('Error sending digest email:', error);
    
    // Update digest status to failed
    digest.deliveryStatus = 'failed';
    digest.deliveryError = error.message;
    digest.deliveryAttempts += 1;
    digest.lastDeliveryAttempt = new Date();
    await digest.save();
    
    return false;
  }
}

/**
 * Create and send weekly digests for users
 */
async function processWeeklyDigests() {
  try {
    console.log('Starting weekly digest processing...');

    // Get all users with digest enabled
    const preferences = await UserAlertPreference.find({
      'digestPreferences.enabled': true,
      'digestPreferences.frequency': 'weekly'
    });

    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const weekNumber = NotificationDigest.getWeekNumber(currentDate);

    // Get or create digests for each user
    for (const pref of preferences) {
      try {
        const digest = await NotificationService.createWeeklyDigest(
          pref.user,
          year,
          weekNumber - 1 // Previous week
        );

        if (digest && digest.deliveryStatus === 'pending') {
          // Check if it's time to send
          const shouldSend = digest.scheduledFor <= currentDate;
          
          if (shouldSend) {
            await sendDigestEmail(digest);
          }
        }
      } catch (error) {
        console.error(`Error processing digest for user ${pref.user}:`, error);
      }
    }

    console.log('Weekly digest processing completed');
  } catch (error) {
    console.error('Error in processWeeklyDigests:', error);
  }
}

/**
 * Clean up old digests
 */
async function cleanupOldDigests() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365); // Keep for 1 year

    const result = await NotificationDigest.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`Cleaned up ${result.deletedCount} old digests`);
  } catch (error) {
    console.error('Error cleaning up old digests:', error);
  }
}

// Schedule daily at 9 AM to process digests
cron.schedule('0 9 * * *', async () => {
  console.log('Running daily digest cron job...');
  await processWeeklyDigests();
  await cleanupOldDigests();
});

// Schedule cleanup to run weekly
cron.schedule('0 0 * * 0', async () => {
  console.log('Running weekly cleanup...');
  await cleanupOldDigests();
});

module.exports = {
  processWeeklyDigests,
  sendDigestEmail,
  cleanupOldDigests,
  cron
};

