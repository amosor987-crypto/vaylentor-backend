
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../auth');
const { buildPackages } = require('../mockData');
const { buildPackagesFromAmadeus } = require('../providers/amadeusTrips');
const { isConfigured: amadeusConfigured } = require('../amadeus');
// Loaded defensively — if this file isn't present in the deployed repo yet,
// the server should still start and simply skip this provider, not crash.
let buildPackagesFromFlightsSky = null;
let flightsSkyConfigured = () => false;
try {
  const flightsSky = require('../providers/flightsSkyTrips');
  buildPackagesFromFlightsSky = flightsSky.buildPackagesFromFlightsSky;
  flightsSkyConfigured = flightsSky.isConfigured;
} catch (err) {
  console.warn('[trips.js] flightsSkyTrips provider not found, skipping:', err.message);
}
const { isConfigured: aiConfigured, parseUserRequest, mergeExtractedIntoPreferences, buildEnrichedText } = require('../aiParser');
const { isConfigured: googlePlacesConfigured, findPlacePhoto } = require('../googlePlaces');
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

// Builds one real day-trip day to another city in the same country, using
// live Google Places searches — three distinct, targeted queries rather
// than one generic one, since Text Search returns a single best match per
// call. Returns null (never throws) if Places isn't configured or none of
// the three searches turned up anything usable, so the caller can fall
// back to repeating a curated day instead.
async function buildDayTripDay(cityQuery) {
  if (!googlePlacesConfigured()) return null;
  const queries = [
    { icon: '🏛️', time: '10:00', search: `האטרקציה המפורסמת ביותר ב${cityQuery}` },
    { icon: '🖼️', time: '13:00', search: `מוזיאון מרכזי ב${cityQuery}` },
    { icon: '🍽️', time: '19:30', search: `מסעדה מקומית מומלצת ב${cityQuery}` },
  ];
  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const found = await findPlacePhoto(q.search, cityQuery);
        if (!found) return null;
        return [q.icon, q.time, found.placeName, `יום טיול ל${cityQuery}.`, found];
      } catch (err) {
        console.warn('[trips/plan] day-trip search failed for', q.search, ':', err.message);
        return null;
      }
    })
  );
  const items = results.filter(Boolean);
  if (items.length === 0) return null;
  items.unshift(['🚗', '08:30', `נסיעה ל${cityQuery}`, 'יום טיול ליעד נוסף באותה מדינה.']);
  items.push(['🌙', '22:00', 'חזרה למלון', '']);
  return items;
}

// The curated itinerary content for each destination only covers 5 days
// (arrival, activity days, departure). For longer stays, days between the
// real arrival and departure first try to become a genuine day trip to
// another city in the same country (real Places results, when configured
// and nearbyCities is available for this destination) — repeating a
// curated activity day only when that isn't possible, so a long trip
// doesn't quietly become 25 identical days.
async function buildExtendedItinerary(baseItinerary, totalNights, nearbyCities) {
  const baseDays = Object.keys(baseItinerary).map(Number).sort((a, b) => a - b);
  if (totalNights <= baseDays.length) {
    return Object.fromEntries(Object.entries(baseItinerary).slice(0, totalNights));
  }
  const arrivalDay = baseDays[0];
  const departureDay = baseDays[baseDays.length - 1];
  const middleDays = baseDays.slice(1, -1);
  const result = {};
  result[1] = baseItinerary[arrivalDay];
  let cycle = 0;
  let dayTripCityIdx = 0;
  for (let day = 2; day < totalNights; day++) {
    // Every 3rd day in a long stay becomes a day-trip attempt, cycling
    // through the destination's nearby cities in order.
    const isDayTripSlot = nearbyCities && nearbyCities.length > 0 && (day % 3 === 0);
    let dayContent = null;
    if (isDayTripSlot) {
      const city = nearbyCities[dayTripCityIdx % nearbyCities.length];
      dayTripCityIdx++;
      dayContent = await buildDayTripDay(city);
    }
    if (!dayContent) {
      const midIdx = middleDays.length ? (day - 2) % middleDays.length : 0;
      if (day - 2 > 0 && midIdx === 0) cycle++;
      const sourceDay = middleDays.length ? middleDays[midIdx] : arrivalDay;
      const items = (baseItinerary[sourceDay] || []).map((item) => [...item]);
      if (cycle > 0 && items.length && items[0][2]) {
        items[0] = [items[0][0], items[0][1], items[0][2] + ' (עוד יום לחקור באזור)', items[0][3]];
      }
      dayContent = items;
    }
    result[day] = dayContent;
  }
  result[totalNights] = baseItinerary[departureDay];
  return result;
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

  if (!trip && flightsSkyConfigured() && buildPackagesFromFlightsSky) {
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

  // For stays longer than the curated 5-day itinerary, extend it rather
  // than truncating the trip to 5 days regardless of how long it actually
  // is. Days 2..N-1 first try to become a real day trip to another city in
  // the same country (using nearbyCities + live Google Places search) —
  // only falling back to repeating a curated day when Places isn't
  // configured or a specific day trip's searches come back empty.
  const DEST_LIB = require('../mockData').DEST_LIB;
  const seenExtended = new Set();
  for (const option of trip.options || []) {
    if (!option.itinerary || seenExtended.has(option.itinerary)) continue;
    seenExtended.add(option.itinerary);
    if (option.nights && option.nights > Object.keys(option.itinerary).length) {
      const destInfo = DEST_LIB[option.destKey];
      const nearbyCities = (destInfo && destInfo.nearbyCities) || [];
      option.itinerary = await buildExtendedItinerary(option.itinerary, option.nights, nearbyCities);
    }
  }

  // Place photos + details: the itinerary content itself is always curated
  // (same shape/text regardless of which flight/hotel provider answered
  // above), so this runs once here rather than being duplicated inside
  // each provider. Each destination's itinerary object is shared by
  // reference across all 3 tiers, so we only need to enrich it once per
  // unique itinerary, not once per option.
  //
  // Only real, specifically-named places are worth searching — logistics
  // steps (flights, transfers, check-in/out) have no "place" to look up,
  // and generic phrasing ("מסעדה מומלצת", "זמן חופשי לקניות") has nothing
  // specific enough for Places to find correctly.
  const LOGISTICS_ICONS = new Set(['✈️', '🚐', '🧳', '🧺', '🚕', '🚗']);
  const GENERIC_PHRASES = ['מומלצת', 'זמן חופשי', 'ארוחת בוקר במלון', 'צ׳ק אין', 'צ׳ק אאוט'];
  if (googlePlacesConfigured()) {
    const seenItineraries = new Set();
    for (const option of trip.options || []) {
      if (!option.itinerary || seenItineraries.has(option.itinerary)) continue;
      seenItineraries.add(option.itinerary);
      const lookups = [];
      for (const dayItems of Object.values(option.itinerary)) {
        for (const item of dayItems) {
          const [icon, , title] = item;
          const isGeneric = GENERIC_PHRASES.some((phrase) => (title || '').includes(phrase));
          // Day-trip items (built by buildExtendedItinerary above) are
          // already real Places results with item[4] pre-filled — skip
          // re-searching those, they'd just waste a lookup re-finding
          // exactly what's already there.
          if (!LOGISTICS_ICONS.has(icon) && title && !isGeneric && !item[4]) {
            lookups.push(
              findPlacePhoto(title, option.destination)
                .then((found) => { if (found) item[4] = found; }) // { photoUrl, attribution, placeName, address, location }
                .catch((err) => console.warn('[trips/plan] place lookup failed for', title, ':', err.message))
            );
          }
        }
      }
      await Promise.all(lookups);
    }
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
