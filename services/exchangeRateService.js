/**
 * Exchange Rate Service
 *
 * Fetches USD → EGP rate from a configurable API with optional env fallback.
 */

const axios = require('axios');

const DEFAULT_TIMEOUT_MS = 5000;

const ERR_NO_API_OR_FALLBACK =
  'EXCHANGE_RATE_API_URL is not configured and no valid fallback exchange rate is available';
const ERR_API_FAILED_NO_FALLBACK =
  'Unable to fetch the USD to EGP exchange rate and no fallback rate is configured';

function getFallbackRate() {
  const raw = process.env.USD_TO_EGP_RATE;
  const rate = Number(raw);

  if (!raw || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }

  return rate;
}

function extractRateFromResponse(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidates = [
    data.rate,
    data.usdToEgpRate,
    data.USD_TO_EGP,
    data.result,
    data.conversion_rate,
    data.conversionRate,
    data?.rates?.EGP,
    data?.data?.rate,
    data?.data?.usdToEgpRate,
  ];

  for (const candidate of candidates) {
    const rate = Number(candidate);
    if (Number.isFinite(rate) && rate > 0) {
      return rate;
    }
  }

  return null;
}

function resolveFallbackRate() {
  const fallbackRate = getFallbackRate();

  if (fallbackRate == null) {
    return null;
  }

  return {
    rate: fallbackRate,
    source: 'fallback',
  };
}

async function fetchRateFromApi(apiUrl, apiKey) {
  const headers = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const response = await axios.get(apiUrl, {
    headers,
    timeout: DEFAULT_TIMEOUT_MS,
  });

  const rate = extractRateFromResponse(response.data);

  if (!rate) {
    throw new Error('Exchange rate API response did not contain a valid USD to EGP rate');
  }

  return rate;
}

/**
 * Fetch USD → EGP rate from API, falling back to env on failure.
 * @returns {Promise<{ rate: number, source: 'api' | 'fallback', fetchedAt: Date }>}
 */
async function getUsdToEgpRate() {
  const apiUrl = process.env.EXCHANGE_RATE_API_URL;
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const fetchedAt = new Date();

  if (!apiUrl) {
    const fallback = resolveFallbackRate();
    if (!fallback) {
      throw new Error(ERR_NO_API_OR_FALLBACK);
    }

    return {
      rate: fallback.rate,
      source: fallback.source,
      fetchedAt,
    };
  }

  try {
    const rate = await fetchRateFromApi(apiUrl, apiKey);

    return {
      rate,
      source: 'api',
      fetchedAt,
    };
  } catch (error) {
    const safeMessage = error.response?.status
      ? `HTTP ${error.response.status}`
      : error.message;

    console.error('[exchangeRateService] Failed to fetch exchange rate:', safeMessage);

    const fallback = resolveFallbackRate();
    if (!fallback) {
      throw new Error(ERR_API_FAILED_NO_FALLBACK);
    }

    return {
      rate: fallback.rate,
      source: fallback.source,
      fetchedAt,
    };
  }
}

module.exports = {
  getUsdToEgpRate,
  getFallbackRate,
  extractRateFromResponse,
  ERR_NO_API_OR_FALLBACK,
  ERR_API_FAILED_NO_FALLBACK,
};
