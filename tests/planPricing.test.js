/**
 * Unit tests for USD/EGP plan pricing conversion.
 *
 * Run with: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  convertEnteredPrice,
  deriveLegacyPlanPricing,
  formatDisplayPriceUSD,
  formatDisplayPriceEGP,
  roundForDisplay,
} = require('../services/planPricingService');

const RATE = 50;

test('converts USD entered price to EGP using exchange rate', () => {
  const result = convertEnteredPrice(10, 'USD', RATE);

  assert.equal(result.enteredPrice, 10);
  assert.equal(result.enteredCurrency, 'USD');
  assert.equal(result.priceUSD, 10);
  assert.equal(result.priceEGP, 500);
});

test('converts EGP entered price to USD using exchange rate', () => {
  const result = convertEnteredPrice(500, 'EGP', RATE);

  assert.equal(result.enteredPrice, 500);
  assert.equal(result.enteredCurrency, 'EGP');
  assert.equal(result.priceEGP, 500);
  assert.equal(result.priceUSD, 10);
});

test('uses entered USD price as source of truth without reverse conversion drift', () => {
  const usdResult = convertEnteredPrice(19.99, 'USD', 48.75);

  assert.equal(usdResult.priceUSD, 19.99);
  assert.equal(usdResult.priceEGP, 19.99 * 48.75);

  const egpResult = convertEnteredPrice(974.3625, 'EGP', 48.75);
  assert.equal(egpResult.priceEGP, 974.3625);
  assert.equal(egpResult.priceUSD, 974.3625 / 48.75);
});

test('rejects non-positive entered price', () => {
  assert.throws(
    () => convertEnteredPrice(0, 'USD', RATE),
    /enteredPrice must be a number greater than zero/
  );
});

test('rejects non-positive exchange rate', () => {
  assert.throws(
    () => convertEnteredPrice(10, 'USD', 0),
    /Exchange rate must be greater than zero/
  );
});

test('deriveLegacyPlanPricing preserves both stored legacy currencies without conversion', () => {
  const plan = {
    prices: [
      { country: 'US', currency: 'USD', amount: 1000 },
      { country: 'EG', currency: 'EGP', amount: 50000 },
    ],
  };

  const result = deriveLegacyPlanPricing(plan, null);

  assert.equal(result.enteredPrice, 10);
  assert.equal(result.enteredCurrency, 'USD');
  assert.equal(result.priceUSD, 10);
  assert.equal(result.priceEGP, 500);
  assert.equal(result.exchangeRate, 50);
});

test('formats display prices to two decimal places', () => {
  assert.equal(formatDisplayPriceUSD(10), '$10.00');
  assert.equal(formatDisplayPriceEGP(500), 'EGP 500.00');
  assert.equal(formatDisplayPriceUSD(10.456), '$10.46');
  assert.equal(formatDisplayPriceEGP(500.789), 'EGP 500.79');
  assert.equal(roundForDisplay(10.456), 10.46);
});
