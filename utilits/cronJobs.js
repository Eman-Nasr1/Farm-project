const cron = require('node-cron');
const notificationChecker = require('./notificationChecker');
const Notification = require('../Models/notification.model');
const subscriptionRenewalService = require('../services/subscriptionRenewalService');

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

// Function to process subscription renewals
const processSubscriptionRenewals = async () => {
    try {
        console.log(`Starting subscription renewal check at ${new Date().toLocaleString()}`);
        
        // Find subscriptions due for renewal (today or past due)
        const subscriptions = await subscriptionRenewalService.findSubscriptionsDueForRenewal(0);
        
        console.log(`Found ${subscriptions.length} subscriptions due for renewal`);
        
        // Process each subscription
        for (const subscription of subscriptions) {
            try {
                const result = await subscriptionRenewalService.processRenewal(subscription);
                
                if (result.success) {
                    console.log(`✅ Successfully renewed subscription ${subscription._id} for user ${subscription.userId}`);
                } else {
                    console.log(`⚠️  Failed to renew subscription ${subscription._id}: ${result.reason}`);
                    
                    // If requires manual payment, log it for admin action
                    if (result.requiresManualPayment) {
                        console.log(`   Manual payment required. URL: ${result.paymentUrl}`);
                    }
                }
            } catch (error) {
                console.error(`Error processing renewal for subscription ${subscription._id}:`, error);
            }
        }
        
        console.log(`Subscription renewal check completed at ${new Date().toLocaleString()}`);
    } catch (error) {
        console.error('Error in subscription renewal cron job:', error);
    }
};

// Schedule the cron job to run once per day at midnight
const scheduleExpiryCheck = () => {
    // Run at 00:00 (midnight)
    cron.schedule('0 0 * * *', checkExpiryAndNotify);
   // console.log('Scheduled daily expiry check for 12 AM (midnight)');
};

// Schedule subscription renewal check
// Run every 6 hours to catch renewals throughout the day
const scheduleSubscriptionRenewals = () => {
    // Run every 6 hours: 00:00, 06:00, 12:00, 18:00
    cron.schedule('0 */6 * * *', processSubscriptionRenewals);
    console.log('Scheduled subscription renewal check to run every 6 hours');
    
    // Also run immediately on startup to catch any overdue renewals
    processSubscriptionRenewals();
};

module.exports = {
    scheduleExpiryCheck,
    checkExpiryAndNotify, // Exported for testing purposes
    scheduleSubscriptionRenewals,
    processSubscriptionRenewals, // Exported for testing purposes
}; 