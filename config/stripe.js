/**
 * Stripe Configuration
 *
 * This file initializes and exports a configured Stripe client instance.
 * Make sure to set STRIPE_SECRET_KEY in your .env file.
 */

require('dotenv').config();

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error(
    'STRIPE_SECRET_KEY is missing. Your .env file is empty or unsaved. ' +
      'Add STRIPE_SECRET_KEY=sk_test_... to .env, save the file, then run again.'
  );
}

const stripe = require('stripe')(secretKey);

module.exports = stripe;

