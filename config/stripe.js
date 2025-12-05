/**
 * Stripe Configuration
 * 
 * This file initializes and exports a configured Stripe client instance.
 * Make sure to set STRIPE_SECRET_KEY in your .env file.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('⚠️  Warning: STRIPE_SECRET_KEY is not set in environment variables');
}

module.exports = stripe;

