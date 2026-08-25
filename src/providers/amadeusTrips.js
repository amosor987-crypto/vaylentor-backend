const { amadeusGet, isConfigured } = require('../amadeus');
const { DEST_LIB: MOCK_DEST_LIB, detectDestination } = require('../mockData');
const { isConfigured: googlePlacesConfigured, findPlacePhoto } = require('../googlePlaces');

/* ======================================================================
   Maps our 5 demo destinations to real IATA city codes Amadeus expects.
   City codes (not airport codes) are used where possible so flight search
   considers every airport serving that city (e.g. PAR covers CDG + ORY).
====================================================================== */
const CITY_CODES = {
  greece: 'JTR',
  thailand: 'HKT',
  italy: 'ROM',
  portugal: 'LIS',
  paris: 'PAR',
};
const ORIGIN = 'TLV';

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// --- Flights -----------------------------------------------------------
async function searchFlights(destCityCode, departureDate, returnDate, adults) {
  const data = await amadeusGet('/v2/shopping/flight-offers', {
    originLocationCode: ORIGIN,
    destinationLocationCode: destCityCode,
    departureDate,
    returnDate,
    adults,
    max: 5,
    currencyCode: 'ILS',
  });
  const offers = data?.data || [];
  const dictionaries = data?.dictionaries || {};
  return offers.map((offer) => {
    const price = Number(offer?.price?.total || 0);
    const legs = (offer?.itineraries || []).map((itin) => {
      const segments = itin?.segments || [];
      const first = segments[0];
      const last = segments[segments.length - 1];
      const carrierCode = first?.carrierCode;
      const carrierName = dictionaries?.carriers?.[carrierCode] || carrierCode || 'Unknown';
      return {
        carrier: carrierName,
        flightNumber: `${carrierCode || ''} ${first?.number || ''}`.trim(),
        dep: first?.departure?.at,
        arr: last?.arrival?.at,
        stops: Math.max(0, segments.length - 1),
      };
    });
    return { price, outbound: legs[0], inbound: legs[1] };
  });
}

// --- Hotels --------------------------------------------------------------
async function searchHotels(cityCode, checkInDate, checkOutDate, adults) {
  // Step 1: which hotels exist in this city at all (this endpoint returns
  // hotelIds + names, not prices or photos).
  const listData = await amadeusGet('/v1/reference-data/locations/hotels/by-city', { cityCode });
  const hotelIds = (listData?.data || []).slice(0, 8).map((h) => h.hotelId).filter(Boolean);
  if (hotelIds.length === 0) return [];

  // Step 2: live offers (price) for those specific hotels.
  // NOTE: this self-service endpoint does not reliably return photo URLs —
  // if `hotel.media` isn't present in your account's response, that's
  // expected on the free tier; the caller falls back to an illustration.
  const offersData = await amadeusGet('/v3/shopping/hotel-offers', {
    hotelIds: hotelIds.join(','),
    adults,
    checkInDate,
    checkOutDate,
    roomQuantity: 1,
    currency: 'ILS',
  });
  const results = offersData?.data || [];
  return results
    .map((item) => ({
      name: item?.hotel?.name,
      hotelId: item?.hotel?.hotelId,
      photoUrl: item?.hotel?.media?.[0]?.uri || null,
      price: Number(item?.offers?.[0]?.price?.total || 0),
    }))
    .filter((h) => h.name && h.price > 0)
    .sort((a, b) => a.price - b.price);
}

/* ======================================================================
   Main entry point — same return shape as mockData.buildPackages(), so
   routes/trips.js can call this first and fall back to the mock builder
   on any failure without the rest of the app knowing the difference.
====================================================================== */
async function buildPackagesFromAmadeus(userText, preferences) {
  if (!isConfigured()) throw new Error('amadeus_not_configured');

  // Reuse the existing keyword detection from the mock module so typed
  // free text ("חופשה ביוון...") still resolves to a destination.
  const destKey = detectDestination(userText);
  const cityCode = CITY_CODES[destKey] || CITY_CODES.greece;
  const mockDest = MOCK_DEST_LIB[destKey] || MOCK_DEST_LIB.greece;

  const travelers = (preferences && preferences.travelers) || 2;
  const departureDate = (preferences?.dates?.out) || todayPlusDays(45);
  const returnDate = (preferences?.dates?.ret) || todayPlusDays(52);

  const [flights, hotels] = await Promise.all([
    searchFlights(cityCode, departureDate, returnDate, Math.max(1, travelers)),
    searchHotels(cityCode, departureDate, returnDate, Math.max(1, travelers)),
  ]);

  if (flights.length === 0 || hotels.length === 0) {
    // Real API reachable but no live test-environment data for this
    // route/city today — fall back rather than return an empty page.
    throw new Error('amadeus_no_results');
  }

  const cheapestFlight = flights.sort((a, b) => a.price - b.price)[0];
  const tierHotels = [
    hotels[0],
    hotels[Math.floor(hotels.length / 2)],
    hotels[hotels.length - 1],
  ];

  // Enrich with a real Google Places photo when Amadeus itself didn't
  // include one. This only makes sense here because tierHotels[].name is
  // a REAL hotel name (it came from Amadeus's real hotel search) — never
  // do this with the fictional demo hotel names in mockData.js.
  if (googlePlacesConfigured()) {
    await Promise.all(tierHotels.map(async (h) => {
      if (h.photoUrl) return; // Amadeus already gave us one
      try {
        const found = await findPlacePhoto(h.name, mockDest.label);
        if (found) h.photoUrl = found.photoUrl;
      } catch (err) {
        console.warn('[amadeusTrips] Google Places photo lookup failed for', h.name, ':', err.message);
        // leave h.photoUrl as null — frontend falls back to the illustration
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
      id: `amadeus-${destKey}-${idx}-${Date.now()}`,
      tier: meta.tier,
      tierLabel: meta.label,
      cabin: meta.cabin,
      baggage: meta.baggage,
      destination: mockDest.label,
      code: cityCode,
      destKey,
      hotel_name: tierHotels[idx].name,
      hotel_photo_url: tierHotels[idx].photoUrl, // real photo if Amadeus or Places found one, else null (frontend falls back to illustration)
      airlines: [{
        name: cheapestFlight.outbound?.carrier || 'Unknown',
        priceDelta: 0,
        out: {
          num: cheapestFlight.outbound?.flightNumber,
          dep: cheapestFlight.outbound?.dep,
          arr: cheapestFlight.outbound?.arr,
          dur: cheapestFlight.outbound?.stops === 0 ? 'ישיר' : `${cheapestFlight.outbound?.stops} עצירות`,
        },
        ret: {
          num: cheapestFlight.inbound?.flightNumber,
          dep: cheapestFlight.inbound?.dep,
          arr: cheapestFlight.inbound?.arr,
          dur: cheapestFlight.inbound?.stops === 0 ? 'ישיר' : `${cheapestFlight.inbound?.stops} עצירות`,
        },
      }],
      airlineIndex: 0,
      airline_name: cheapestFlight.outbound?.carrier || 'Unknown',
      terminal: 'נתב"ג · טרמינל 3',
      itinerary: mockDest.itinerary, // day-by-day content stays curated (Amadeus has no equivalent)
      nights: Math.round((new Date(returnDate) - new Date(departureDate)) / 86400000),
      travelers,
      dates: `${departureDate} – ${returnDate}`,
      total, marketTotal: Math.round(total * 1.16),
      flight_price: flightPrice, hotel_price: hotelPrice, transfer_price: transfer, activities_price: activities,
      baseFlightPrice: flightPrice,
      personalNotes: [],
      reasoning: 'מבוסס על מחירי טיסות ומלונות אמיתיים מ-Amadeus, נכון לרגע החיפוש.',
      source: 'amadeus',
    };
  });

  return {
    id: `amadeus-trip-${Date.now()}`,
    userText, budget: null, travelers,
    nights: options[0].nights,
    destination: mockDest.label,
    options,
  };
}

module.exports = { buildPackagesFromAmadeus };
