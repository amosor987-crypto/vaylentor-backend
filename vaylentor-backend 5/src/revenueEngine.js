/* ======================================================================
   REVENUE ENGINE — structural skeleton only.

   This file deliberately contains NO real commission rates, markup
   percentages, or service fees. Every number in PROVIDER_COMMERCIAL_TERMS
   below is a placeholder (0) until you have an actual signed agreement
   with a supplier (Amadeus, a hotel consolidator, etc.) or have decided on
   your own service fee. Filling in a "reasonable-sounding" percentage here
   would mean every dollar figure this engine reports is fiction — so it
   doesn't happen. Update PROVIDER_COMMERCIAL_TERMS yourself once you have
   real numbers; nothing else in this file needs to change.
====================================================================== */

// Fill these in once you have a real agreement. Until then, every
// calculation below correctly returns zero commission/markup/fee rather
// than a guessed number.
const PROVIDER_COMMERCIAL_TERMS = {
  // Example shape (commented out — not active):
  // amadeus_flight: { type: 'percentage', rate: 0 },     // TODO: real rate from your Amadeus agreement
  // amadeus_hotel:  { type: 'percentage', rate: 0 },      // TODO: real rate from your Amadeus agreement
};

// Your own service fee, if/when you decide to charge one. 0 = not active.
const SERVICE_FEE_CONFIG = {
  type: 'fixed', // 'fixed' | 'percentage'
  amount: 0,     // TODO: decide your actual service fee, in ILS
};

// Real payment-processor fee schedule, once you have a live account.
// Stripe's typical published rate is a starting point ONLY — verify against
// your actual account before using this for real financial reporting.
const PAYMENT_FEE_CONFIG = {
  type: 'percentage',
  rate: 0, // TODO: fill in from your actual payment provider agreement
  fixedPerTransaction: 0,
};

function getCommercialTerms(providerId, productType) {
  return PROVIDER_COMMERCIAL_TERMS[`${providerId}_${productType}`] || { type: 'percentage', rate: 0 };
}

function applyTerm(baseAmount, term) {
  if (!term) return 0;
  if (term.type === 'percentage') return Math.round(baseAmount * (term.rate || 0));
  if (term.type === 'fixed') return term.amount || 0;
  return 0;
}

/**
 * Computes the full revenue/profit breakdown for a single booking item.
 * providerCost: what you actually pay the supplier (from their real quote).
 * customerPrice: what the customer actually paid.
 * Every derived field is computed from real configured terms — if no term
 * is configured for this provider/product, the corresponding revenue line
 * is honestly 0, not a guess.
 */
function calculateRevenue({ providerId, productType, providerCost, customerPrice, refundAmount = 0 }) {
  // providerCost is only meaningful once you have a real supplier quote
  // (e.g. Amadeus's actual price for that flight/hotel). Our current mock
  // pricing is OUR OWN estimate shown to the customer, not a real supplier
  // cost — so until that distinction exists in the data, we honestly leave
  // commission/markup at 0 rather than computing them against a number
  // that isn't a real cost.
  const hasRealProviderCost = typeof providerCost === 'number';
  const term = getCommercialTerms(providerId, productType);
  const commission = hasRealProviderCost ? applyTerm(providerCost, term) : 0;
  const markup = hasRealProviderCost ? Math.max(0, customerPrice - providerCost - commission) : 0;
  const serviceFee = applyTerm(customerPrice, SERVICE_FEE_CONFIG);
  const grossRevenue = commission + markup + serviceFee;
  const paymentFee = Math.round(customerPrice * (PAYMENT_FEE_CONFIG.rate || 0)) + (PAYMENT_FEE_CONFIG.fixedPerTransaction || 0);
  const netRevenue = grossRevenue - paymentFee - refundAmount;
  const grossProfit = grossRevenue; // no COGS beyond providerCost, which is already excluded from grossRevenue by construction
  const netProfit = netRevenue;

  return {
    providerId, productType,
    provider_cost: hasRealProviderCost ? providerCost : null,
    customer_price: customerPrice,
    commission,
    markup,
    service_fee: serviceFee,
    gross_revenue: grossRevenue,
    payment_fee: paymentFee,
    refund_amount: refundAmount,
    net_revenue: netRevenue,
    gross_profit: grossProfit,
    net_profit: netProfit,
    currency: 'ILS',
    // Explicit flag so admin dashboards can visually distinguish "real
    // configured revenue" from "structurally zero because nothing is
    // configured yet" — critical so nobody mistakes $0 for actual data.
    is_configured: hasRealProviderCost && (Boolean(PROVIDER_COMMERCIAL_TERMS[`${providerId}_${productType}`]) || SERVICE_FEE_CONFIG.amount > 0),
  };
}

module.exports = { calculateRevenue, getCommercialTerms, PROVIDER_COMMERCIAL_TERMS, SERVICE_FEE_CONFIG, PAYMENT_FEE_CONFIG };
