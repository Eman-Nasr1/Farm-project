/**
 * Contact Controller
 * 
 * Handles contact form submissions and sends emails to support
 */

const nodemailer = require('nodemailer');
const AppError = require('../utilits/AppError');
const httpstatustext = require('../utilits/httpstatustext');
const asyncwrapper = require('../middleware/asyncwrapper');

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.SUPPORT_EMAIL || 'support@mazraaonline.com',
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

/**
 * Send contact form email to support
 * POST /api/contact
 * 
 * Public endpoint - no authentication required
 */
const sendContactEmail = asyncwrapper(async (req, res, next) => {
  const { name, email, subject, message, phone } = req.body;

  // Validation
  if (!name || !email || !subject || !message) {
    return next(AppError.create('Name, email, subject, and message are required', 400, httpstatustext.FAIL));
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(AppError.create('Please provide a valid email address', 400, httpstatustext.FAIL));
  }

  // Validate name length
  if (name.trim().length < 2) {
    return next(AppError.create('Name must be at least 2 characters', 400, httpstatustext.FAIL));
  }

  // Validate message length
  if (message.trim().length < 10) {
    return next(AppError.create('Message must be at least 10 characters', 400, httpstatustext.FAIL));
  }

  // Create transporter
  const transporter = createTransporter();

  // Support email address
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@mazraaonline.com';

  // Email to support team
  const mailToSupport = {
    from: supportEmail,
    to: supportEmail,
    replyTo: email, // Allow support to reply directly to the user
    subject: `[Contact Form] ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">New Contact Form Submission</h2>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p style="margin: 5px 0;"><strong>From:</strong> ${name}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          ${phone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${phone}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
        </div>
        
        <div style="margin-top: 20px;">
          <h3 style="color: #2c3e50;">Message:</h3>
          <div style="background-color: #fff; padding: 15px; border-left: 4px solid #3498db; margin: 10px 0;">
            <p style="white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #7f8c8d; font-size: 12px;">
          This email was sent from the Mazraa Online contact form.<br>
          Received at: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })}
        </p>
      </div>
    `,
  };

  // Confirmation email to the user
  const mailToUser = {
    from: supportEmail,
    to: email,
    subject: 'We received your message - Mazraa Online',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">Thank you for contacting us!</h2>
        
        <p style="color: #34495e; line-height: 1.6;">
          Dear ${name},
        </p>
        
        <p style="color: #34495e; line-height: 1.6;">
          We have received your message and will get back to you as soon as possible. 
          Our support team typically responds within 24-48 hours.
        </p>
        
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #2c3e50; margin-top: 0;">Your Message Summary:</h3>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
          <p style="margin: 5px 0;"><strong>Message:</strong></p>
          <p style="background-color: #fff; padding: 10px; border-radius: 3px; white-space: pre-wrap;">${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
        </div>
        
        <p style="color: #34495e; line-height: 1.6;">
          If you have any urgent matters, please don't hesitate to send another message.
        </p>
        
        <p style="color: #34495e; line-height: 1.6;">
          Best regards,<br>
          <strong>Mazraa Online Support Team</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
          Mazraa Online - Farm Management System<br>
          <a href="https://mazraaonline.com" style="color: #3498db;">www.mazraaonline.com</a>
        </p>
      </div>
    `,
  };

  try {
    // Send email to support
    await transporter.sendMail(mailToSupport);

    // Send confirmation to user (don't fail if this one fails)
    try {
      await transporter.sendMail(mailToUser);
    } catch (userEmailError) {
      console.error('Failed to send confirmation email to user:', userEmailError.message);
      // Continue anyway - the main email to support was sent
    }

    res.status(200).json({
      status: httpstatustext.SUCCESS,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      data: null,
    });
  } catch (error) {
    console.error('Failed to send contact email:', error.message);
    console.error('Full error:', error);
    
    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      return next(AppError.create('Email authentication failed. Please check email configuration.', 500, httpstatustext.ERROR));
    }
    if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
      return next(AppError.create('Could not connect to email server. Please try again later.', 500, httpstatustext.ERROR));
    }
    
    return next(AppError.create('Failed to send email. Please try again later.', 500, httpstatustext.ERROR));
  }
});

module.exports = {
  sendContactEmail,
};
