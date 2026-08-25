/* ======================================================================
   Amadeus Self-Service API client.
   Docs: https://developers.amadeus.com/self-service
   Auth: OAuth2 client_credentials grant (NOT the user-login flow — this
   authenticates YOUR APP to Amadeus, not a traveler; no consent screen).

   Sign-up is instant and free for the test environment:
     1. https://developers.amadeus.com -> Register -> confirm email.
     2. My Self-Service Workspace -> Create new app.
     3. Copy the "API Key" and "API Secret" shown there into .env as
        AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET.
   The test environment uses Amadeus's own limited test data set (a fixed
   set of routes/hotels), NOT full live inventory — that only unlocks after
   moving an app to production, which still uses these same free-tier
   self-service endpoints, just against live data and a monthly quota.
====================================================================== */

const BASE_URL = process.env.AMADEUS_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com'; // default: safe sandbox host

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let inFlightTokenRequest = null;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt - 30_000) {
    return cachedToken; // reuse until ~30s before real expiry
  }
  // Flight search and hotel search run in parallel (Promise.all) and both
  // need a token — without this, a cold start fires two token requests at
  // once and wastes one against the free monthly quota. Share the same
  // in-flight request instead.
  if (inFlightTokenRequest) return inFlightTokenRequest;

  inFlightTokenRequest = (async () => {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('amadeus_not_configured');
    }

    const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`amadeus_auth_failed: ${res.status} ${body}`);
    }

    const data = await res.json();
    cachedToken = data.access_token;
    cachedTokenExpiresAt = Date.now() + (data.expires_in || 1800) * 1000;
    return cachedToken;
  })();

  try {
    return await inFlightTokenRequest;
  } finally {
    inFlightTokenRequest = null;
  }
}

// Low-level authenticated GET. Path should start with '/', e.g.
// '/v2/shopping/flight-offers'. Params is a plain object of query params.
async function amadeusGet(path, params = {}) {
  const token = await getAccessToken();
  const url = new URL(BASE_URL + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`amadeus_request_failed: ${res.status} ${path} ${body}`);
  }
  return res.json();
}

function isConfigured() {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

module.exports = { getAccessToken, amadeusGet, isConfigured, BASE_URL };
