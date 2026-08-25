/* ======================================================================
   Google Places API (New) client — used ONLY to fetch a real photo URL for
   a REAL, named place. This only makes sense when the name you're
   searching for is a real business (e.g. a hotel name that came back from
   Amadeus's real hotel search) — searching for a made-up/fictional name
   (like the demo hotels in src/mockData.js) will return either nothing or
   an unrelated business, which would be misleading. See amadeusTrips.js
   for where this is actually wired in, and README.md section 8 for why.

   Setup (you do this — it needs your own Google Cloud billing account):
     1. https://console.cloud.google.com -> create/select a project.
     2. APIs & Services -> Library -> enable "Places API (New)".
     3. Billing -> link a billing account (Google gives a recurring free
        monthly credit, but a card must be on file — this is Google's
        requirement, not something we can bypass).
     4. APIs & Services -> Credentials -> Create Credentials -> API key.
        Restrict it to "Places API (New)" only, and ideally by IP address
        (Application restrictions) since this key is used server-side.
     5. Put it in .env as GOOGLE_PLACES_API_KEY.
====================================================================== */

function isConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

// Text Search (New) — find the place itself (id, display name, photo refs).
async function searchPlace(query) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('google_places_not_configured');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.photos',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`places_search_failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data?.places?.[0] || null;
}

// Place Photo (New) — resolve a photo resource name into an actual, stable
// image URL (using skipHttpRedirect so we get JSON back with a googleusercontent.com
// URL, rather than embedding our API key in a client-facing <img src>).
async function resolvePhotoUrl(photoName, maxWidthPx = 800) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`places_photo_failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data?.photoUri || null;
}

// Main entry point: given a real place name + a location hint (city/area),
// return { photoUrl, attribution, placeName, address } or null if nothing
// usable was found. Never throws for "not found" — only for real API/config errors.
async function findPlacePhoto(name, locationHint) {
  if (!isConfigured()) throw new Error('google_places_not_configured');
  const query = locationHint ? `${name}, ${locationHint}` : name;
  const place = await searchPlace(query);
  if (!place || !place.photos || place.photos.length === 0) return null;

  const photoUrl = await resolvePhotoUrl(place.photos[0].name);
  if (!photoUrl) return null;

  const attribution = place.photos[0].authorAttributions?.[0]?.displayName || null;
  return {
    photoUrl,
    attribution,
    placeName: place.displayName?.text || name,
    address: place.formattedAddress || null,
  };
}

module.exports = { isConfigured, searchPlace, resolvePhotoUrl, findPlacePhoto };
