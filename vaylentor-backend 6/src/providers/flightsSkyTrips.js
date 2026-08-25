const https = require('https');
const { DEST_LIB: MOCK_DEST_LIB, detectDestination } = require('../mockData');
const { isConfigured: googlePlacesConfigured, findPlacePhoto } = require('../googlePlaces');

/* ======================================================================
   FLIGHTS-SKY (via RapidAPI) — an alternative to Amadeus, used because
   Amadeus's self-service portal shut down on 17 July 2026 and its
   registration form doesn't currently list Israel as a country of
   incorporation. This wraps a RapidAPI-hosted Skyscanner-data API
   instead: https://rapidapi.com (search "Flights Scraper Sky").

   IMPORTANT: field names below are based on the publicly documented
   endpoint shape at the time of writing, NOT independently verified
   against a live response. Run `npm run test:flights-sky` after adding
   your key and check the raw output — if any field names below don't
   match what actually comes back, they need adjusting here.
====================================================================== */

const RAPIDAPI_HOST = 'flights-sky.p.rapidapi.com';

function isConfigured() {
  return Boolean(process.env.RAPIDAPI_KEY);
}

function rapidApiGet(path, params) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams(params).toString();
    const options = {
      method: 'GET',
      hostname: RAPIDAPI_HOST,
      path: `${path}?${query}`,
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(`flights-sky ${res.statusCode}: ${body.slice(0, 300)}`));
          } else {
            resolve(json);
          }
        } catch (err) {
          reject(new Error(`flights-sky: could not parse response — ${body.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/* ------------------------------------------------------------------
   City -> Skyscanner "entityId"/"skyId" codes. These are DIFFERENT
   from IATA airport codes — they're Skyscanner's own internal IDs.
   The ones below are placeholders and must be confirmed by calling
   the airport-search endpoint once (see scripts/test-flights-sky.js)
   and copying the real values back in here.
------------------------------------------------------------------ */
const CITY_SKY_IDS = {
  greece: { skyId: 'JTR', entityId: '' },
  thailand: { skyId: 'HKT', entityId: '' },
  italy: { skyId: 'ROM', entityId: '' },
  portugal: { skyId: 'LIS', entityId: '' },
  paris: { skyId: 'CDG', entityId: '' },
};
const ORIGIN = { skyId: 'TLV', entityId: '' };

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- Flights -------------------------------------------------------------
async function searchFlights(dest, departureDate, returnDate, adults) {
  const data = await rapidApiGet('/api/v1/flights/searchFlights', {
    originSkyId: ORIGIN.skyId,
    destinationSkyId: dest.skyId,
    originEntityId: ORIGIN.entityId,
    destinationEntityId: dest.entityId,
    date: departureDate,
    returnDate,
    adults,
    currency: 'ILS',
    market: 'he-IL',
    countryCode: 'IL',
  });
  const itineraries = data?.data?.itineraries || [];
  return itineraries.map((it) => {
    const leg = it?.legs?.[0];
    const carrier = leg?.carriers?.marketing?.[0]?.name || 'Unknown';
    return {
      price: Number(it?.price?.raw || 0),
      carrier,
      flightNumber: leg?.flightNumber || '',
      dep: leg?.departure,
      arr: leg?.arrival,
      stops: leg?.stopCount ?? 0,
    };
  });
}

// --- Hotels ----------------------------------------------------------------
async function searchHotels(cityName, checkInDate, checkOutDate, adults) {
  const data = await rapidApiGet('/api/v1/hotels/searchHotels', {
    query: cityName,
    checkin: checkInDate,
    checkout: checkOutDate,
    adults,
    currency: 'ILS',
    market: 'he-IL',
  });
  const results = data?.data?.results || [];
  return results
    .map((h) => ({
      name: h?.name,
      hotelId: h?.id,
      photoUrl: h?.image || null,
      price: Number(h?.price?.raw || 0),
    }))
    .filter((h) => h.name && h.price > 0)
    .sort((a, b) => a.price - b.price);
}

/* ======================================================================
   Same return shape as buildPackagesFromAmadeus() / mockData's
   buildPackages() — routes/trips.js can try this, Amadeus, and the mock
   builder in whatever order makes sense, and the rest of the app never
   needs to know which one actually answered.
====================================================================== */
async function buildPackagesFromFlightsSky(userText, preferences) {
  if (!isConfigured()) throw new Error('flights_sky_not_configured');

  const destKey = detectDestination(userText);
  const destSkyIds = CITY_SKY_IDS[destKey] || CITY_SKY_IDS.greece;
  const mockDest = MOCK_DEST_LIB[destKey] || MOCK_DEST_LIB.greece;

  const travelers = (preferences && preferences.travelers) || 2;
  const departureDate = (preferences?.dates?.out) || todayPlusDays(45);
  const returnDate = (preferences?.dates?.ret) || todayPlusDays(52);

  const [flights, hotels] = await Promise.all([
    searchFlights(destSkyIds, departureDate, returnDate, Math.max(1, travelers)),
    searchHotels(mockDest.label, departureDate, returnDate, Math.max(1, travelers)),
  ]);

  if (flights.length === 0 || hotels.length === 0) {
    throw new Error('flights_sky_no_results');
  }

  const cheapestFlight = flights.sort((a, b) => a.price - b.price)[0];
  const tierHotels = [
    hotels[0],
    hotels[Math.floor(hotels.length / 2)],
    hotels[hotels.length - 1],
  ];

  if (googlePlacesConfigured()) {
    await Promise.all(tierHotels.map(async (h) => {
      if (h.photoUrl) return;
      try {
        const found = await findPlacePhoto(h.name, mockDest.label);
        if (found) h.photoUrl = found.photoUrl;
      } catch (err) {
        console.warn('[flightsSkyTrips] Google Places photo lookup failed for', h.name, ':', err.message);
      }
    }));
  }

  const TIER_META = [
    { tier: 'value', label: '💰 חסכוני', cabin: 'אקונומי', baggage: 'מזוודה 1×20 ק"ג' },
    { tier: 'recommended', label: '⭐ מומלץ', cabin: 'אקונומי פלוס', baggage: 'מזוודה 1×23 ק"ג + טרולי' },
    { tier: 'premium', label: '👑 פרימיום', cabin: 'ביזנס', baggage: '2 מזוודות 23 ק"ג + עדיפות בעליה' },
  ];

  const options = TIER_META.map((meta, idx) => {
    const hotelPrice = tierHotels[idx].price;
    const flightPrice = Math.round(cheapestFlight.price);
    const transfer = Math.round((flightPrice + hotelPrice) * 0.06);
    const activities = Math.round((flightPrice + hotelPrice) * 0.1);
    const total = flightPrice + hotelPrice + transfer + activities;
    return {
      id: `flights-sky-${destKey}-${idx}-${Date.now()}`,
      tier: meta.tier,
      tierLabel: meta.label,
      cabin: meta.cabin,
      baggage: meta.baggage,
      destination: mockDest.label,
      code: destSkyIds.skyId,
      destKey,
      hotel_name: tierHotels[idx].name,
      hotel_photo_url: tierHotels[idx].photoUrl,
      airlines: [{
        name: cheapestFlight.carrier,
        priceDelta: 0,
        out: { num: cheapestFlight.flightNumber, dep: cheapestFlight.dep, arr: cheapestFlight.arr, dur: cheapestFlight.stops === 0 ? 'ישיר' : `${cheapestFlight.stops} עצירות` },
        ret: { num: cheapestFlight.flightNumber, dep: cheapestFlight.dep, arr: cheapestFlight.arr, dur: cheapestFlight.stops === 0 ? 'ישיר' : `${cheapestFlight.stops} עצירות` },
      }],
      airlineIndex: 0,
      airline_name: cheapestFlight.carrier,
      terminal: 'נתב"ג · טרמינל 3',
      itinerary: mockDest.itinerary,
      nights: Math.round((new Date(returnDate) - new Date(departureDate)) / 86400000),
      travelers,
      dates: `${departureDate} – ${returnDate}`,
      total, marketTotal: Math.round(total * 1.16),
      flight_price: flightPrice, hotel_price: hotelPrice, transfer_price: transfer, activities_price: activities,
      baseFlightPrice: flightPrice,
      personalNotes: [],
      reasoning: 'מבוסס על מחירי טיסות ומלונות אמיתיים (Skyscanner data via RapidAPI), נכון לרגע החיפוש.',
      source: 'flights-sky',
    };
  });

  return {
    id: `flights-sky-trip-${Date.now()}`,
    userText, budget: null, travelers,
    nights: options[0].nights,
    destination: mockDest.label,
    options,
  };
}

module.exports = { buildPackagesFromFlightsSky, isConfigured };
