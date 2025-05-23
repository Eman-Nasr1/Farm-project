const cron = require('node-cron');
const notificationChecker = require('./notificationChecker');
const Notification = require('../Models/notification.model');

// Function to run the expiry check
const checkExpiryAndNotify = async () => {
    try {
        const notifications = await notificationChecker.checkExpiringItems();
        
        // Save new notifications
        for (const notification of notifications) {
            // Check if a similar notification already exists
            const existingNotification = await Notification.findOne({
                owner: notification.owner,
                itemId: notification.itemId,
                type: notification.type,
                expiryDate: notification.expiryDate,
                isRead: false
            });

            if (!existingNotification) {
                await Notification.create(notification);
            }
        }

        console.log(`Expiry check completed at ${new Date().toLocaleString()}. Found ${notifications.length} items to notify about.`);
    } catch (error) {
        console.error('Error in expiry check cron job:', error);
    }
};

// Schedule the cron job to run once per day at midnight
const scheduleExpiryCheck = () => {
    // Run at 00:00 (midnight)
    cron.schedule('0 0 * * *', checkExpiryAndNotify);
   // console.log('Scheduled daily expiry check for 12 AM (midnight)');
};

module.exports = {
    scheduleExpiryCheck,
    checkExpiryAndNotify // Exported for testing purposes
}; 