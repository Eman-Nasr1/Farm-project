/**
 * Unit tests for exchange rate service behavior.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const {
  extractRateFromResponse,
  getFallbackRate,
  getUsdToEgpRate,
  ERR_NO_API_OR_FALLBACK,
  ERR_API_FAILED_NO_FALLBACK,
} = require('../services/exchangeRateService');

const originalRate = process.env.USD_TO_EGP_RATE;
const originalApiUrl = process.env.EXCHANGE_RATE_API_URL;
const originalApiKey = process.env.EXCHANGE_RATE_API_KEY;
const originalAxiosGet = axios.get;

function restoreEnv() {
  if (originalRate === undefined) {
    delete process.env.USD_TO_EGP_RATE;
  } else {
    process.env.USD_TO_EGP_RATE = originalRate;
  }

  if (originalApiUrl === undefined) {
    delete process.env.EXCHANGE_RATE_API_URL;
  } else {
    process.env.EXCHANGE_RATE_API_URL = originalApiUrl;
  }

  if (originalApiKey === undefined) {
    delete process.env.EXCHANGE_RATE_API_KEY;
  } else {
    process.env.EXCHANGE_RATE_API_KEY = originalApiKey;
  }
}

test.after(() => {
  restoreEnv();
  axios.get = originalAxiosGet;
});

test('extractRateFromResponse reads common API payload shapes', () => {
  assert.equal(extractRateFromResponse({ rate: 49.5 }), 49.5);
  assert.equal(extractRateFromResponse({ rates: { EGP: 50.25 } }), 50.25);
  assert.equal(extractRateFromResponse({ data: { usdToEgpRate: 51 } }), 51);
  assert.equal(extractRateFromResponse({ invalid: true }), null);
});

test('getFallbackRate returns configured env value', () => {
  process.env.USD_TO_EGP_RATE = '48.5';
  assert.equal(getFallbackRate(), 48.5);
});

test('getFallbackRate returns null for missing or invalid env value', () => {
  delete process.env.USD_TO_EGP_RATE;
  assert.equal(getFallbackRate(), null);

  process.env.USD_TO_EGP_RATE = '0';
  assert.equal(getFallbackRate(), null);

  process.env.USD_TO_EGP_RATE = 'invalid';
  assert.equal(getFallbackRate(), null);
});

test('getUsdToEgpRate uses successful API response', async () => {
  process.env.EXCHANGE_RATE_API_URL = 'https://example.com/rates';
  delete process.env.USD_TO_EGP_RATE;

  axios.get = async () => ({
    data: { rates: { EGP: 49.75 } },
  });

  const result = await getUsdToEgpRate();

  assert.equal(result.rate, 49.75);
  assert.equal(result.source, 'api');
  assert.ok(result.fetchedAt instanceof Date);
});

test('getUsdToEgpRate uses fallback when API request fails', async () => {
  process.env.EXCHANGE_RATE_API_URL = 'https://example.com/rates';
  process.env.USD_TO_EGP_RATE = '50';

  axios.get = async () => {
    const error = new Error('Network error');
    error.response = { status: 503 };
    throw error;
  };

  const result = await getUsdToEgpRate();

  assert.equal(result.rate, 50);
  assert.equal(result.source, 'fallback');
});

test('getUsdToEgpRate throws when API fails and no fallback exists', async () => {
  process.env.EXCHANGE_RATE_API_URL = 'https://example.com/rates';
  delete process.env.USD_TO_EGP_RATE;

  axios.get = async () => {
    throw new Error('Network error');
  };

  await assert.rejects(
    () => getUsdToEgpRate(),
    (error) => error.message === ERR_API_FAILED_NO_FALLBACK
  );
});

test('getUsdToEgpRate uses fallback when API URL is missing', async () => {
  delete process.env.EXCHANGE_RATE_API_URL;
  process.env.USD_TO_EGP_RATE = '48';

  const result = await getUsdToEgpRate();

  assert.equal(result.rate, 48);
  assert.equal(result.source, 'fallback');
});

test('getUsdToEgpRate throws when API URL and fallback are missing', async () => {
  delete process.env.EXCHANGE_RATE_API_URL;
  delete process.env.USD_TO_EGP_RATE;

  await assert.rejects(
    () => getUsdToEgpRate(),
    (error) => error.message === ERR_NO_API_OR_FALLBACK
  );
});
