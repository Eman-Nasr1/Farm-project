const Treatment = require('../Models/treatment.model');
const Vaccine = require('../Models/vaccine.model');
const i18n = require('../i18n');

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
                const expireDateFormatted = treatment.expireDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
                
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
                const expireDateFormatted = vaccine.expiryDate.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
                
                // Notify if expired or expiring within 30 days
                if (daysUntilExpiry <= warningDays) {
                    let message;
                    let severity;

                    if (daysUntilExpiry <= 0) {
                        message = i18n.__('VACCINE_EXPIRED', {
                            name: vaccine.vaccineName,
                            date: expireDateFormatted
                        });
                        severity = 'high';
                    } else if (daysUntilExpiry <= 7) {
                        message = i18n.__('VACCINE_EXPIRE_SOON', {
                            name: vaccine.vaccineName,
                            days: daysUntilExpiry,
                            date: expireDateFormatted
                        });
                        severity = 'high';
                    } else {
                        message = i18n.__('VACCINE_EXPIRE_WARNING', {
                            name: vaccine.vaccineName,
                            days: daysUntilExpiry,
                            date: expireDateFormatted
                        });
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