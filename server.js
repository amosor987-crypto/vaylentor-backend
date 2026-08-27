require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/auth');
const tripRoutes = require('./src/routes/trips');
const bookingRoutes = require('./src/routes/bookings');
const adminRoutes = require('./src/routes/admin');

const app = express();

// Allow the deployed frontend origin(s) (and localhost during development).
// ADMIN_FRONTEND_URL is a second allowed origin for the separate admin
// dashboard site — it lives on its own domain by design (isolated from the
// main customer-facing site), so it needs its own entry here or every
// request from it fails as an opaque "network error" in the browser.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, server-to-server, Postman) and
      // any origin in the allow-list. Static HTML opened via file:// sends
      // no Origin header, so it's covered by the "no origin" case too.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'vaylentor-backend', status: 'running' });
});

// Self-check endpoint — visit this in a browser (or curl it) to see exactly
// what's configured without needing to read logs or guess. Never returns
// actual secret values, only whether each one is present.
app.get('/api/status', (req, res) => {
  const { isConfigured: amadeusConfigured } = require('./src/amadeus');
  res.json({
    ok: true,
    data: {
      jwtSecretSet: Boolean(process.env.JWT_SECRET),
      backendUrl: process.env.BACKEND_URL || null,
      frontendUrl: process.env.FRONTEND_URL || null,
      google: {
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        expectedRedirectUri: `${process.env.BACKEND_URL || 'http://localhost:4000'}/auth/google/callback`,
      },
      stripe: {
        configured: Boolean(process.env.STRIPE_SECRET_KEY),
        mode: process.env.STRIPE_SECRET_KEY ? (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'live' : 'test') : 'mock',
      },
      amadeus: {
        configured: amadeusConfigured(),
        env: process.env.AMADEUS_ENV === 'production' ? 'production' : 'test',
        useFlag: process.env.USE_AMADEUS !== 'false',
      },
      flightsSky: {
        configured: Boolean(process.env.RAPIDAPI_KEY),
      },
      googlePlaces: {
        configured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      },
      googleRoutes: {
        configured: Boolean(process.env.GOOGLE_PLACES_API_KEY), // same key/project as Places
      },
      aiChat: {
        configured: Boolean(process.env.ANTHROPIC_API_KEY),
      },
    },
  });
});

app.use(authRoutes);
app.use(tripRoutes);
app.use(bookingRoutes);
app.use(adminRoutes);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'server_error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`VAYLENTOR backend running on port ${PORT}`);
  console.log(`  Self-check: http://localhost:${PORT}/api/status`);
  if (!process.env.GOOGLE_CLIENT_ID) console.log('  (Google login not configured yet — see README)');
  if (!process.env.STRIPE_SECRET_KEY) console.log('  (Stripe not configured — checkout runs in mock mode)');
  if (!process.env.AMADEUS_CLIENT_ID) console.log('  (Amadeus not configured yet — /api/trips/plan uses curated demo data)');
  if (!process.env.GOOGLE_PLACES_API_KEY) console.log('  (Google Places not configured yet — hotel photos fall back to illustrations)');
  if (!process.env.ANTHROPIC_API_KEY) console.log('  (Anthropic AI chat not configured yet — /api/trips/plan uses keyword matching only)');
});
