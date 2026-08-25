/* ======================================================================
   Google Routes API — real travel-time/distance between two points (e.g.
   "how far is the hotel from this restaurant, walking?"). Same Google
   Cloud project + billing as googlePlaces.js — just enable "Routes API"
   in the same project (APIs & Services -> Library -> Routes API -> Enable).
   No separate business approval needed, unlike Duffel/Hotelbeds.
====================================================================== */

function isConfigured() {
  // Deliberately reuses the same key as Places — one Google Cloud project,
  // one billing account, multiple APIs enabled on it. No new env var needed.
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

const TRAVEL_MODES = ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'];

/**
 * origin/destination: { lat, lng } OR a place resource name like
 * "places/ChIJ..." (from googlePlaces.js's search results).
 * travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT'
 * Returns { distanceMeters, durationSeconds, durationText } or throws.
 */
async function computeRoute(origin, destination, travelMode = 'WALK') {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('google_routes_not_configured');
  if (!TRAVEL_MODES.includes(travelMode)) throw new Error(`invalid_travel_mode: ${travelMode}`);

  const toWaypoint = (p) =>
    typeof p === 'string' ? { placeId: p.replace(/^places\//, '') } : { location: { latLng: { latitude: p.lat, longitude: p.lng } } };

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // Basic tier field mask only (cheapest pricing tier — see README) —
      // this is all an itinerary needs: how far, how long.
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { waypoint: toWaypoint(origin) },
      destination: { waypoint: toWaypoint(destination) },
      travelMode,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`routes_request_failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) return null;

  const durationSeconds = parseInt(String(route.duration || '0s').replace('s', ''), 10);
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds,
    durationText: formatDuration(durationSeconds),
  };
}

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} דקות`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h} שעות ${m} דקות` : `${h} שעות`;
}

module.exports = { isConfigured, computeRoute, TRAVEL_MODES };
