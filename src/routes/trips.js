const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../auth');
const { buildPackages } = require('../mockData');
const { buildPackagesFromAmadeus } = require('../providers/amadeusTrips');
const { isConfigured: amadeusConfigured } = require('../amadeus');
const { buildPackagesFromFlightsSky, isConfigured: flightsSkyConfigured } = require('../providers/flightsSkyTrips');
const { isConfigured: aiConfigured, parseUserRequest, mergeExtractedIntoPreferences, buildEnrichedText } = require('../aiParser');
const { calculateRevenue } = require('../revenueEngine');
const { isConfigured: googleRoutesConfigured, computeRoute } = require('../googleRoutes');

const router = express.Router();

// In-memory trip cache. Trips are cheap to regenerate and short-lived
// (one shopping session), so they don't need a DB table — bookings do.
const trips = new Map();

let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

router.post('/api/trips/plan', async (req, res) => {
  const { message, preferences } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'missing_message' });
  }

  // Real free-text understanding, when configured — this is what lets the
  // chat understand things beyond the fixed quiz options (a specific city,
  // an unusual request, anything phrased in the person's own words).
  let effectiveMessage = message;
  let effectivePreferences = preferences;
  let aiUnderstood = false;
  if (aiConfigured()) {
    try {
      const extracted = await parseUserRequest(message);
      effectivePreferences = mergeExtractedIntoPreferences(extracted, preferences);
      effectiveMessage = buildEnrichedText(message, extracted);
      aiUnderstood = true;
    } catch (err) {
      console.warn('[trips/plan] AI understanding failed, falling back to keyword parsing:', err.message);
      // fall through — effectiveMessage/effectivePreferences stay as originally given
    }
  }

  let trip = null;
  let usedAmadeus = false;
  let usedFlightsSky = false;

  if (amadeusConfigured() && process.env.USE_AMADEUS !== 'false') {
    try {
      trip = await buildPackagesFromAmadeus(effectiveMessage, effectivePreferences);
      usedAmadeus = true;
    } catch (err) {
      // Real API reachable-but-empty, misconfigured, sandbox route not in
      // the test data set, rate limited, etc. — never break the page for
      // this; just fall through to the next option below.
      console.warn('[trips/plan] Amadeus lookup failed, falling back:', err.message);
    }
  }

  if (!trip && flightsSkyConfigured()) {
    try {
      trip = await buildPackagesFromFlightsSky(effectiveMessage, effectivePreferences);
      usedFlightsSky = true;
    } catch (err) {
      console.warn('[trips/plan] Flights-Sky lookup failed, falling back to mock data:', err.message);
    }
  }

  if (!trip) {
    trip = buildPackages(effectiveMessage, effectivePreferences);
  }

  trips.set(trip.id, trip);
  res.json({ ok: true, data: trip, meta: { source: usedAmadeus ? 'amadeus' : (usedFlightsSky ? 'flights-sky' : 'mock'), aiUnderstood } });
});

router.get('/api/trips/:tripId', (req, res) => {
  const trip = trips.get(req.params.tripId);
  if (!trip) return res.status(404).json({ ok: false, error: 'trip_not_found' });
  res.json({ ok: true, data: trip });
});

function findOption(tripId, optionId) {
  const trip = trips.get(tripId);
  if (!trip) return { trip: null, option: null };
  const option = trip.options.find((o) => o.id === optionId);
  return { trip, option };
}

router.post('/api/trips/:tripId/options/:optionId/checkout/intent', requireAuth, async (req, res) => {
  const { trip, option } = findOption(req.params.tripId, req.params.optionId);
  if (!trip || !option) return res.status(404).json({ ok: false, error: 'option_not_found' });

  if (!stripe) {
    // No Stripe key configured — demo/mock mode, matches the frontend's fallback path.
    return res.json({ ok: true, data: { mode: 'mock', amount: option.total } });
  }

  try {
    const amountAgorot = Math.round(option.total * 100);
    const intent = await stripe.paymentIntents.create({
      amount: amountAgorot,
      currency: 'ils',
      metadata: { tripId: trip.id, optionId: option.id, userId: req.user.id },
    });
    res.json({ ok: true, data: { mode: 'stripe', clientSecret: intent.client_secret, amount: option.total } });
  } catch (err) {
    console.error('[checkout/intent]', err.message);
    res.status(500).json({ ok: false, error: 'stripe_error' });
  }
});

router.post('/api/trips/:tripId/options/:optionId/checkout/confirm', requireAuth, async (req, res) => {
  const { trip, option } = findOption(req.params.tripId, req.params.optionId);
  if (!trip || !option) return res.status(404).json({ ok: false, error: 'option_not_found' });

  const { paymentIntentId, passengers, specialRequests } = req.body || {};

  if (stripe && paymentIntentId) {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        return res.status(402).json({ ok: false, error: 'payment_not_completed' });
      }
    } catch (err) {
      console.error('[checkout/confirm]', err.message);
      return res.status(500).json({ ok: false, error: 'stripe_error' });
    }
  }
  // If Stripe isn't configured, we trust the mock flow (this endpoint is
  // still auth-gated, so at minimum a logged-in user made the request).

  const bookingNumber = 'VY-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const booking = {
    id: uuidv4(),
    user_id: req.user.id,
    booking_number: bookingNumber,
    destination: option.destination,
    hotel: option.hotel_name,
    airline: option.airline_name,
    tier: option.tierLabel,
    nights: option.nights,
    travelers: option.travelers,
    total: option.total,
    passengers_json: JSON.stringify(passengers || []),
    special_requests: specialRequests || null,
    stripe_payment_intent_id: paymentIntentId || null,
    created_at: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO bookings (id, user_id, booking_number, destination, hotel, airline, tier, nights, travelers, total, passengers_json, special_requests, stripe_payment_intent_id, created_at)
     VALUES (@id, @user_id, @booking_number, @destination, @hotel, @airline, @tier, @nights, @travelers, @total, @passengers_json, @special_requests, @stripe_payment_intent_id, @created_at)`
  ).run(booking);

  // Financial ledger entry (spec section 40). providerCost is intentionally
  // omitted — our current pricing is our own estimate, not a real supplier
  // quote, so calculateRevenue() correctly records zero commission/markup
  // rather than a fabricated one. This still creates the auditable row
  // structure real supplier-cost data will flow into later.
  const revenue = calculateRevenue({
    providerId: option.source || 'mock',
    productType: 'package',
    providerCost: undefined,
    customerPrice: option.total,
    refundAmount: 0,
  });
  db.prepare(
    `INSERT INTO revenue_transactions (id, booking_id, provider_id, product_type, provider_cost, customer_price, commission, markup, service_fee, gross_revenue, payment_fee, refund_amount, net_revenue, gross_profit, net_profit, currency, is_configured, created_at)
     VALUES (@id, @booking_id, @provider_id, @product_type, @provider_cost, @customer_price, @commission, @markup, @service_fee, @gross_revenue, @payment_fee, @refund_amount, @net_revenue, @gross_profit, @net_profit, @currency, @is_configured, @created_at)`
  ).run({
    id: uuidv4(),
    booking_id: booking.id,
    provider_id: revenue.providerId,
    product_type: revenue.productType,
    provider_cost: revenue.provider_cost,
    customer_price: revenue.customer_price,
    commission: revenue.commission,
    markup: revenue.markup,
    service_fee: revenue.service_fee,
    gross_revenue: revenue.gross_revenue,
    payment_fee: revenue.payment_fee,
    refund_amount: revenue.refund_amount,
    net_revenue: revenue.net_revenue,
    gross_profit: revenue.gross_profit,
    net_profit: revenue.net_profit,
    currency: revenue.currency,
    is_configured: revenue.is_configured ? 1 : 0,
    created_at: new Date().toISOString(),
  });

  res.json({ ok: true, data: { bookingNumber, booking } });
});

// Real distance/duration between two itinerary stops (spec section 15/59:
// "Show routes", "sync map with itinerary"). Falls back to null gracefully
// if Google Routes isn't configured — the frontend just won't show a
// distance badge for that stop rather than breaking.
router.post('/api/routes', async (req, res) => {
  const { origin, destination, travelMode } = req.body || {};
  if (!origin || !destination) return res.status(400).json({ ok: false, error: 'missing_origin_or_destination' });
  if (!googleRoutesConfigured()) return res.json({ ok: true, data: null, meta: { configured: false } });
  try {
    const route = await computeRoute(origin, destination, travelMode || 'WALK');
    res.json({ ok: true, data: route, meta: { configured: true } });
  } catch (err) {
    console.warn('[api/routes]', err.message);
    res.json({ ok: true, data: null, meta: { configured: true, error: err.message } });
  }
});

module.exports = router;
