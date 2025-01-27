const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Breeding = require('../Models/breeding.model'); // Adjust path to your Breeding model

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'emannasr2001@gmail.com', // Replace with your email
        pass: 'oabb urgv ohae btvu'  // Replace with your app-specific password
    }
});

// Function to send email notifications
async function sendNotification(userEmail, birthEntry) {
    const mailOptions = {
        from: 'emannasr2001@gmail.com',
        to: userEmail,
        subject: 'Weaning Date Reminder',
        text: `Dear User,\n\nThis is a reminder that the weaning date for animal ${birthEntry.tagId} is coming up on ${birthEntry.expectedWeaningDate.toDateString()}. Please take necessary actions.\n\nThank you!`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Notification sent to ${userEmail}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

// Scheduled task to check for upcoming weaning dates
cron.schedule('0 0 * * *', async () => {
    console.log('Checking for upcoming weaning dates...');

    try {
        // Find birth entries with weaning dates one week away
        const today = new Date();
        const oneWeekLater = new Date();
        oneWeekLater.setDate(today.getDate() + 7);

        const breedings = await Breeding.find({
            'birthEntries.expectedWeaningDate': {
                $gte: today,
                $lte: oneWeekLater
            }
        }).populate('owner'); // Populate owner to get email

        // Send notifications for each relevant birth entry
        for (const breeding of breedings) {
            for (const entry of breeding.birthEntries) {
                if (
                    entry.expectedWeaningDate >= today &&
                    entry.expectedWeaningDate <= oneWeekLater
                ) {
                    const userEmail = breeding.owner.email; // Replace with the actual email field in your User model
                    await sendNotification(userEmail, entry);
                }
            }
        }
    } catch (error) {
        console.error('Error checking for weaning dates:', error);
    }
});
module.exports = cron;
