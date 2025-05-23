const Treatment = require('../Models/treatment.model');
const Vaccine = require('../Models/vaccine.model');
const i18n = require('../i18n');

// Main function to check for expiring items
const checkExpiringItems = async () => {
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
                
                // Notify if expired or expiring within 30 days
                if (daysUntilExpiry <= warningDays) {
                    let message;
                    let severity;

                    if (daysUntilExpiry <= 0) {
                        message = `Treatment ${treatment.name} has expired!`;
                        severity = 'high';
                    } else if (daysUntilExpiry <= 7) {
                        message = `Treatment ${treatment.name} will expire very soon (in ${daysUntilExpiry} days)`;
                        severity = 'high';
                    } else {
                        message = `Treatment ${treatment.name} will expire in ${daysUntilExpiry} days`;
                        severity = 'medium';
                    }

                    notifications.push({
                        type: 'Treatment',
                        itemId: treatment._id,
                        message,
                        expiryDate: treatment.expireDate,
                        owner: treatment.owner,
                        severity
                    });
                }
            }
        }

        // Check vaccines
        const vaccines = await Vaccine.find({
            expiryDate: { 
                $exists: true, 
                $ne: null 
            }
        });

        for (const vaccine of vaccines) {
            if (vaccine.expiryDate) {
                const daysUntilExpiry = Math.ceil((vaccine.expiryDate - today) / (1000 * 60 * 60 * 24));
                
                // Notify if expired or expiring within 30 days
                if (daysUntilExpiry <= warningDays) {
                    let message;
                    let severity;

                    if (daysUntilExpiry <= 0) {
                        message = `Vaccine ${vaccine.vaccineName} has expired!`;
                        severity = 'high';
                    } else if (daysUntilExpiry <= 7) {
                        message = `Vaccine ${vaccine.vaccineName} will expire very soon (in ${daysUntilExpiry} days)`;
                        severity = 'high';
                    } else {
                        message = `Vaccine ${vaccine.vaccineName} will expire in ${daysUntilExpiry} days`;
                        severity = 'medium';
                    }

                    notifications.push({
                        type: 'Vaccine',
                        itemId: vaccine._id,
                        message,
                        expiryDate: vaccine.expiryDate,
                        owner: vaccine.owner,
                        severity
                    });
                }
            }
        }

        return notifications;
    } catch (error) {
        console.error('Error checking expiring items:', error);
        throw error;
    }
};

module.exports = {
    checkExpiringItems
}; 