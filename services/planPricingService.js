/**
 * Plan Pricing Service
 *
 * Converts entered plan prices between USD and EGP using a fetched exchange rate.
 * The entered price/currency pair is always the source of truth.
 */

const exchangeRateService = require('./exchangeRateService');

const SUPPORTED_CURRENCIES = ['USD', 'EGP'];

function normalizeCurrency(currency) {
  return String(currency || '').trim().toUpperCase();
}

function roundForDisplay(value) {
  return Math.round(Number(value) * 100) / 100;
}

function formatDisplayPriceUSD(amount) {
  return `$${roundForDisplay(amount).toFixed(2)}`;
}

function formatDisplayPriceEGP(amount) {
  return `EGP ${roundForDisplay(amount).toFixed(2)}`;
}

/**
 * Convert from the admin-entered price using the supplied rate.
 * @param {number} enteredPrice
 * @param {'USD'|'EGP'} enteredCurrency
 * @param {number} usdToEgpRate
 */
function convertEnteredPrice(enteredPrice, enteredCurrency, usdToEgpRate) {
  const price = Number(enteredPrice);
  const currency = normalizeCurrency(enteredCurrency);
  const rate = Number(usdToEgpRate);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('enteredPrice must be a number greater than zero');
  }

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error('enteredCurrency must be USD or EGP');
  }

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Exchange rate must be greater than zero');
  }

  if (currency === 'USD') {
    return {
      enteredPrice: price,
      enteredCurrency: 'USD',
      priceUSD: price,
      priceEGP: price * rate,
    };
  }

  return {
    enteredPrice: price,
    enteredCurrency: 'EGP',
    priceUSD: price / rate,
    priceEGP: price,
  };
}

function toSmallestUnit(majorAmount, currency) {
  return Math.round(Number(majorAmount) * 100);
}

function buildPaymobPrices(priceUSD, priceEGP) {
  return [
    {
      country: 'US',
      currency: 'USD',
      amount: toSmallestUnit(priceUSD, 'USD'),
    },
    {
      country: 'EG',
      currency: 'EGP',
      amount: toSmallestUnit(priceEGP, 'EGP'),
    },
  ];
}

/**
 * Build persisted pricing fields for create/update operations.
 * @param {number} enteredPrice
 * @param {'USD'|'EGP'} enteredCurrency
 */
async function buildPlanPricingFields(enteredPrice, enteredCurrency) {
  const { rate, fetchedAt } = await exchangeRateService.getUsdToEgpRate();
  const converted = convertEnteredPrice(enteredPrice, enteredCurrency, rate);

  return {
    ...converted,
    exchangeRate: rate,
    exchangeRateUpdatedAt: fetchedAt,
    prices: buildPaymobPrices(converted.priceUSD, converted.priceEGP),
  };
}

/**
 * Preview pricing without persisting.
 */
async function previewPlanPricing(enteredPrice, enteredCurrency) {
  const pricing = await buildPlanPricingFields(enteredPrice, enteredCurrency);
  return formatPlanPricingResponse(pricing);
}

function formatPlanPricingResponse(pricing) {
  const priceUSD = Number(pricing.priceUSD);
  const priceEGP = Number(pricing.priceEGP);

  return {
    enteredPrice: pricing.enteredPrice,
    enteredCurrency: pricing.enteredCurrency,
    priceUSD,
    priceEGP,
    displayPriceUSD: formatDisplayPriceUSD(priceUSD),
    displayPriceEGP: formatDisplayPriceEGP(priceEGP),
    exchangeRate: pricing.exchangeRate,
    exchangeRateUpdatedAt: pricing.exchangeRateUpdatedAt,
  };
}

function formatPlanForResponse(plan) {
  const plainPlan = typeof plan.toObject === 'function' ? plan.toObject() : { ...plan };

  if (
    plainPlan.priceUSD == null &&
    plainPlan.priceEGP == null &&
    Array.isArray(plainPlan.prices) &&
    plainPlan.prices.length > 0
  ) {
    const usdEntry = plainPlan.prices.find((entry) => entry.currency === 'USD');
    const egpEntry = plainPlan.prices.find((entry) => entry.currency === 'EGP');

    if (usdEntry) {
      plainPlan.priceUSD = usdEntry.amount / 100;
    }

    if (egpEntry) {
      plainPlan.priceEGP = egpEntry.amount / 100;
    }
  }

  if (plainPlan.priceUSD != null && plainPlan.priceEGP != null) {
    Object.assign(plainPlan, formatPlanPricingResponse(plainPlan));
  }

  return plainPlan;
}

function getPaymentAmounts(plan) {
  if (plan.priceUSD != null && plan.priceEGP != null) {
    return {
      displayAmount: toSmallestUnit(plan.priceUSD, 'USD'),
      displayCurrency: 'USD',
      paymentAmount: toSmallestUnit(plan.priceEGP, 'EGP'),
      paymentCurrency: 'EGP',
      priceUSD: Number(plan.priceUSD),
      priceEGP: Number(plan.priceEGP),
    };
  }

  const usdEntry = plan.prices?.find((entry) => entry.currency === 'USD');
  const egpEntry = plan.prices?.find((entry) => entry.currency === 'EGP');

  return {
    displayAmount: usdEntry?.amount || 0,
    displayCurrency: 'USD',
    paymentAmount: egpEntry?.amount || 0,
    paymentCurrency: 'EGP',
    priceUSD: usdEntry ? usdEntry.amount / 100 : null,
    priceEGP: egpEntry ? egpEntry.amount / 100 : null,
  };
}

/**
 * Derive new pricing fields from legacy plan data.
 * When both USD and EGP exist, preserves stored values without conversion.
 * When only one currency exists, requires a fallback exchange rate.
 */
function deriveLegacyPlanPricing(plan, fallbackRate) {
  const usdEntry = plan.prices?.find((entry) => entry.currency === 'USD');
  const egpEntry = plan.prices?.find((entry) => entry.currency === 'EGP');
  const usdMajor = usdEntry?.amount > 0 ? usdEntry.amount / 100 : null;
  const egpMajor = egpEntry?.amount > 0 ? egpEntry.amount / 100 : null;

  if (usdMajor && egpMajor) {
    return {
      enteredPrice: usdMajor,
      enteredCurrency: 'USD',
      priceUSD: usdMajor,
      priceEGP: egpMajor,
      exchangeRate: egpMajor / usdMajor,
    };
  }

  if (usdMajor && fallbackRate) {
    return convertEnteredPrice(usdMajor, 'USD', fallbackRate);
  }

  if (egpMajor && fallbackRate) {
    return convertEnteredPrice(egpMajor, 'EGP', fallbackRate);
  }

  if (plan.amount && plan.currency && fallbackRate) {
    const enteredPrice = plan.amount / 100;
    const enteredCurrency = String(plan.currency).toUpperCase() === 'EGP' ? 'EGP' : 'USD';
    return convertEnteredPrice(enteredPrice, enteredCurrency, fallbackRate);
  }

  return null;
}

module.exports = {
  SUPPORTED_CURRENCIES,
  normalizeCurrency,
  convertEnteredPrice,
  buildPaymobPrices,
  buildPlanPricingFields,
  previewPlanPricing,
  formatPlanPricingResponse,
  formatPlanForResponse,
  formatDisplayPriceUSD,
  formatDisplayPriceEGP,
  getPaymentAmounts,
  deriveLegacyPlanPricing,
  toSmallestUnit,
  roundForDisplay,
};
