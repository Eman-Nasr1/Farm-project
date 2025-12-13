/**
 * Paymob Service
 * 
 * Handles Paymob payment gateway integration.
 * Supports multi-currency payments (EGP, SAR, USD).
 * 
 * Environment variables required:
 * - PAYMOB_API_KEY: Your Paymob API key
 * - PAYMOB_INTEGRATION_ID: Your Paymob integration ID
 * - PAYMOB_HMAC_SECRET: Secret for webhook signature verification (optional but recommended)
 */

const axios = require('axios');
const crypto = require('crypto');

// Paymob API base URL
const PAYMOB_API_BASE = 'https://accept.paymob.com/api';

/**
 * Authenticate with Paymob and get an auth token
 * @returns {Promise<string>} Authentication token
 */
async function authenticate() {
  try {
    const apiKey = process.env.PAYMOB_API_KEY;
    
    if (!apiKey) {
      throw new Error('PAYMOB_API_KEY environment variable is not set');
    }

    const response = await axios.post(`${PAYMOB_API_BASE}/auth/tokens`, {
      api_key: apiKey,
    });

    if (!response.data || !response.data.token) {
      throw new Error('Failed to authenticate with Paymob: Invalid response');
    }

    return response.data.token;
  } catch (error) {
    console.error('Paymob authentication error:', error.response?.data || error.message);
    throw new Error(`Paymob authentication failed: ${error.message}`);
  }
}

/**
 * Create an order in Paymob
 * @param {number} amount - Amount in the currency's smallest unit (e.g., piasters for EGP, cents for USD)
 * @param {string} currency - Currency code (EGP, SAR, USD)
 * @param {Object} user - User object
 * @param {Object} plan - Plan object
 * @returns {Promise<Object>} Order object with orderId
 */
async function createOrder(amount, currency, user, plan) {
  try {
    // Authenticate first
    const authToken = await authenticate();

    // Map currency to Paymob currency code
    // Paymob accepts currency as string codes (EGP, SAR, USD)
    const currencyMap = {
      'EGP': 'EGP', // Egyptian Pound
      'SAR': 'SAR', // Saudi Riyal
      'USD': 'USD', // US Dollar
    };

    const paymobCurrency = currencyMap[currency.toUpperCase()] || 'USD';
    
    // Validate required fields
    if (!user.email) {
      throw new Error('User email is required for Paymob order');
    }
    if (!user.phone) {
      throw new Error('User phone is required for Paymob order');
    }

    // Split name into first and last name (required by Paymob)
    const userName = user.name || 'Customer';
    const nameParts = userName.split(' ').filter(part => part.trim().length > 0);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User'; // Ensure last_name is never empty
    
    // Create order request
    // Ensure amount is a valid number
    const orderAmount = parseInt(amount, 10);
    
    if (isNaN(orderAmount) || orderAmount <= 0) {
      throw new Error(`Invalid amount: ${amount}. Amount must be a positive number.`);
    }
    
    const orderData = {
      auth_token: authToken,
      delivery_needed: 'false',
      amount_cents: orderAmount, // Amount in smallest unit (must be integer)
      currency: paymobCurrency,
      items: [
        {
          name: plan.name || 'Subscription Plan',
          amount_cents: orderAmount, // Must match order amount_cents
          description: `Subscription plan: ${plan.name}`,
          quantity: 1,
        },
      ],
      // Shipping data (required by Paymob)
      shipping_data: {
        apartment: 'NA',
        email: user.email || 'customer@example.com',
        floor: 'NA',
        first_name: firstName,
        street: 'NA',
        building: 'NA',
        phone_number: user.phone || '0000000000',
        postal_code: 'NA',
        city: 'NA',
        country: user.country || 'EG',
        last_name: lastName, // Paymob requires this field to be non-empty
        state: 'NA',
      },
    };

    const response = await axios.post(`${PAYMOB_API_BASE}/ecommerce/orders`, orderData);

    if (!response.data || !response.data.id) {
      console.error('Paymob order creation failed. Response:', response.data);
      throw new Error('Failed to create Paymob order: Invalid response');
    }

    return {
      orderId: response.data.id,
      amount: orderAmount,
      currency: currency,
    };
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('Paymob createOrder error:', errorDetails);
    console.error('Request data sent:', JSON.stringify(orderData, null, 2));
    
    // Provide more detailed error message
    if (error.response?.status === 400) {
      const paymobError = error.response.data?.detail || error.response.data?.message || JSON.stringify(errorDetails);
      throw new Error(`Paymob API Error (400): ${paymobError}. Check your API credentials and request format.`);
    }
    
    throw new Error(`Failed to create Paymob order: ${error.message}`);
  }
}

/**
 * Get payment key from Paymob for iframe integration
 * @param {number} orderId - Order ID from createOrder
 * @param {number} amount - Amount in the currency's smallest unit
 * @param {string} currency - Currency code
 * @param {Object} user - User object
 * @returns {Promise<Object>} Payment key and iframe URL
 */
async function getPaymentKey(orderId, amount, currency, user) {
  try {
    // Authenticate first
    const authToken = await authenticate();

    // Get integration ID based on currency (support multiple integration IDs)
    const currencyUpper = currency.toUpperCase();
    
    // Try currency-specific integration ID first, then fallback to default
    let integrationId = 
      (currencyUpper === 'EGP' && process.env.PAYMOB_INTEGRATION_ID_EGP) ? process.env.PAYMOB_INTEGRATION_ID_EGP :
      (currencyUpper === 'SAR' && process.env.PAYMOB_INTEGRATION_ID_SAR) ? process.env.PAYMOB_INTEGRATION_ID_SAR :
      (currencyUpper === 'USD' && process.env.PAYMOB_INTEGRATION_ID_USD) ? process.env.PAYMOB_INTEGRATION_ID_USD :
      process.env.PAYMOB_INTEGRATION_ID; // Fallback to default
    
    if (!integrationId) {
      throw new Error(
        `PAYMOB_INTEGRATION_ID is not set. ` +
        `Please set PAYMOB_INTEGRATION_ID in .env file, or set PAYMOB_INTEGRATION_ID_${currencyUpper} for currency-specific integration.`
      );
    }

    // Map currency to Paymob currency code
    // Paymob accepts currency as uppercase string codes
    // currencyUpper is already defined above
    const currencyMap = {
      'EGP': 'EGP',
      'SAR': 'SAR',
      'USD': 'USD',
    };

    const paymobCurrency = currencyMap[currencyUpper] || 'USD';
    
    // Validate currency
    if (!currencyMap[currencyUpper]) {
      console.warn(`Currency ${currencyUpper} not in map, using USD as default`);
    }

    // Split name into first and last name for billing data
    const userName = user.name || 'Customer';
    const nameParts = userName.split(' ').filter(part => part.trim().length > 0);
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || 'User'; // Ensure last_name is never empty
    
    // Create payment key request
    // Ensure amount matches order amount
    const paymentAmount = parseInt(amount, 10);
    
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error(`Invalid amount: ${amount}. Amount must be a positive number.`);
    }
    
    const paymentKeyData = {
      auth_token: authToken,
      amount_cents: paymentAmount, // Must match order amount_cents exactly
      expiration: 3600, // 1 hour expiration
      order_id: orderId,
      billing_data: {
        apartment: 'NA',
        email: user.email,
        floor: 'NA',
        first_name: firstName,
        street: 'NA',
        building: 'NA',
        phone_number: user.phone || '',
        postal_code: 'NA',
        city: 'NA',
        country: user.country || 'EG',
        last_name: lastName, // Paymob requires this field to be non-empty
        state: 'NA',
      },
      currency: paymobCurrency,
      integration_id: parseInt(integrationId),
    };

    const response = await axios.post(`${PAYMOB_API_BASE}/acceptance/payment_keys`, paymentKeyData);

    if (!response.data || !response.data.token) {
      throw new Error('Failed to get Paymob payment key: Invalid response');
    }

    // Construct payment URL
    // Paymob supports multiple URL formats:
    // 1. Iframe URL: https://accept.paymob.com/api/acceptance/iframes/{iframe_id}?payment_token={token}
    // 2. Redirect URL: https://accept.paymob.com/api/acceptance/payments/pay?payment_token={token}
    
    // Check if we should use redirect URL instead of iframe
    const useRedirectUrl = process.env.PAYMOB_USE_REDIRECT === 'true' || process.env.PAYMOB_USE_REDIRECT === '1';
    
    let paymentUrl;
    
    if (useRedirectUrl) {
      // Use redirect URL with amount parameter
      paymentUrl = `https://accept.paymob.com/api/acceptance/payments/pay?payment_token=${response.data.token}&amount_cents=${amount}`;
    } else {
      // Try iframe URL with amount parameter
      const iframeId = process.env.PAYMOB_IFRAME_ID || integrationId;
      // Some Paymob integrations require amount in URL
      paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${response.data.token}&amount_cents=${amount}`;
    }

    return {
      paymentKey: response.data.token,
      iframeUrl: paymentUrl,
      redirectUrl: paymentUrl, // Same URL for both
      orderId: orderId,
    };
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('Paymob getPaymentKey error:', errorDetails);
    console.error('Payment key request data:', {
      amount_cents: amount,
      currency: currency,
      order_id: orderId,
      integration_id: process.env.PAYMOB_INTEGRATION_ID,
    });
    
    // Provide more detailed error message
    if (error.response?.status === 400) {
      const paymobError = error.response.data?.message || error.response.data?.detail || JSON.stringify(errorDetails);
      
      // Check if it's a currency error
      if (paymobError.includes('currency') || paymobError.includes('Invalid currency')) {
        throw new Error(
          `Paymob Currency Error: ${paymobError}. ` +
          `The Integration ID (${integrationId}) may be configured for a different currency. ` +
          `Current currency: ${paymobCurrency}. ` +
          `Make sure your Paymob Integration ID supports ${paymobCurrency} currency.`
        );
      }
      
      throw new Error(`Paymob API Error (400): ${paymobError}. Check currency format and integration ID.`);
    }
    
    throw new Error(`Failed to get Paymob payment key: ${error.message}`);
  }
}

/**
 * Verify Paymob webhook HMAC signature
 * @param {Object} webhookData - The webhook payload
 * @param {string} receivedHmac - The HMAC received in headers
 * @returns {boolean} True if signature is valid
 */
function verifyWebhookSignature(webhookData, receivedHmac) {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  
  if (!hmacSecret) {
    console.warn('PAYMOB_HMAC_SECRET not set, skipping webhook verification');
    return true; // Allow if secret is not configured (for development)
  }

  try {
    // Paymob sends HMAC in a specific format
    // You may need to adjust this based on Paymob's actual HMAC format
    const calculatedHmac = crypto
      .createHmac('sha512', hmacSecret)
      .update(JSON.stringify(webhookData))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(receivedHmac),
      Buffer.from(calculatedHmac)
    );
  } catch (error) {
    console.error('Error verifying Paymob webhook signature:', error);
    return false;
  }
}

module.exports = {
  createOrder,
  getPaymentKey,
  verifyWebhookSignature,
};

