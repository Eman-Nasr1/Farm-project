const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD,
    },
  });
}

/**
 * Send course-related emails without blocking the main request.
 * Failures are logged safely (no passwords / secrets / private URLs).
 */
async function sendCourseEmail({ to, subject, text, html }) {
  if (!to) return;

  if (!process.env.EMAIL_USER || !(process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD)) {
    console.warn('[course-email] EMAIL_USER/EMAIL_PASS not configured — skipping email');
    return;
  }

  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: html || text,
    });
  } catch (error) {
    console.error('[course-email] Failed to send email:', {
      to,
      subject,
      message: error.message,
    });
  }
}

function notifyAccountCreated(student) {
  return sendCourseEmail({
    to: student.email,
    subject: 'Course account created',
    text: `Hello ${student.fullName},\n\nYour course account has been created successfully.\nYou can now complete your registration and payment.\n`,
  });
}

function notifyRegistrationCreated(student, registration) {
  return sendCourseEmail({
    to: student.email,
    subject: `Course registration created — ${registration.bookingCode}`,
    text: `Hello ${student.fullName},\n\nYour course registration (${registration.bookingCode}) was created.\nCategory amount: ${registration.amount} EGP.\nPlease complete payment to confirm your seat.\n`,
  });
}

function notifyReceiptSubmitted(student, registration) {
  return sendCourseEmail({
    to: student.email,
    subject: 'Payment receipt received',
    text: `Hello ${student.fullName},\n\nWe received your payment receipt for booking ${registration.bookingCode}.\nYour payment is under review.\n`,
  });
}

function notifyPaymentApproved(student, registration) {
  return sendCourseEmail({
    to: student.email,
    subject: 'Payment confirmed',
    text: `Hello ${student.fullName},\n\nYour payment for booking ${registration.bookingCode} has been approved.\nYou now have access to published course lectures.\n`,
  });
}

function notifyPaymentRejected(student, registration, reason) {
  return sendCourseEmail({
    to: student.email,
    subject: 'Payment receipt rejected',
    text: `Hello ${student.fullName},\n\nYour payment receipt for booking ${registration.bookingCode} was rejected.\nReason: ${reason || 'Not specified'}\nPlease upload a new receipt from your dashboard.\n`,
  });
}

function notifyRegistrationConfirmed(student, registration) {
  return sendCourseEmail({
    to: student.email,
    subject: 'Course registration confirmed',
    text: `Hello ${student.fullName},\n\nYour registration ${registration.bookingCode} is confirmed.\n`,
  });
}

function notifyLecturePublished(student, lecture) {
  return sendCourseEmail({
    to: student.email,
    subject: `New lecture published: ${lecture.title}`,
    text: `Hello ${student.fullName},\n\nA new lecture is available: ${lecture.title}.\nOpen your course dashboard to access the link.\n`,
  });
}

module.exports = {
  sendCourseEmail,
  notifyAccountCreated,
  notifyRegistrationCreated,
  notifyReceiptSubmitted,
  notifyPaymentApproved,
  notifyPaymentRejected,
  notifyRegistrationConfirmed,
  notifyLecturePublished,
};
