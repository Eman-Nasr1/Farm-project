/**
 * Test Paymob Authentication
 * 
 * Run this to verify your Paymob API credentials are correct
 * 
 * Usage: node test-paymob-auth.js
 */

const axios = require('axios');
require('dotenv').config();

const PAYMOB_API_BASE = 'https://accept.paymob.com/api';

async function testPaymobAuth() {
  console.log('🔍 Testing Paymob Authentication...\n');
  
  // Check environment variables
  const apiKey = process.env.PAYMOB_API_KEY;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  
  if (!apiKey) {
    console.error('❌ PAYMOB_API_KEY is not set in .env file');
    return;
  }
  
  if (!integrationId) {
    console.error('⚠️  PAYMOB_INTEGRATION_ID is not set in .env file');
  }
  
  console.log('✅ Environment variables found');
  console.log('   API Key:', apiKey.substring(0, 10) + '...');
  if (integrationId) {
    console.log('   Integration ID:', integrationId);
  }
  console.log('');
  
  // Test authentication
  try {
    console.log('📡 Attempting to authenticate with Paymob...');
    const response = await axios.post(`${PAYMOB_API_BASE}/auth/tokens`, {
      api_key: apiKey,
    });
    
    if (response.data && response.data.token) {
      console.log('✅ Authentication successful!');
      console.log('   Token:', response.data.token.substring(0, 20) + '...');
      console.log('');
      console.log('🎉 Your Paymob credentials are correct!');
    } else {
      console.error('❌ Authentication failed: Invalid response');
      console.error('   Response:', response.data);
    }
  } catch (error) {
    console.error('❌ Authentication failed!');
    console.error('');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data || error.message);
    console.error('');
    
    if (error.response?.status === 401) {
      console.error('💡 This usually means:');
      console.error('   - API Key is incorrect');
      console.error('   - API Key has expired');
      console.error('   - API Key is not activated in Paymob dashboard');
    } else if (error.response?.status === 400) {
      console.error('💡 This usually means:');
      console.error('   - Invalid request format');
      console.error('   - Missing required fields');
    }
  }
}

testPaymobAuth();

