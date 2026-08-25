const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('[auth] WARNING: JWT_SECRET is not set — set it in .env before deploying.');
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email },
    JWT_SECRET || 'dev-only-insecure-secret',
    { expiresIn: '30d' }
  );
}

// Express middleware — requires a valid "Authorization: Bearer <token>" header.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'missing_token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET || 'dev-only-insecure-secret');
    req.user = { id: payload.sub, name: payload.name, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'invalid_token' });
  }
}

// Chain AFTER requireAuth. Checks the DB live (not a JWT claim) so revoking
// admin access takes effect immediately instead of waiting for a 30-day
// token to expire. To make your own account an admin:
//   sqlite3 data.db "UPDATE users SET is_admin = 1 WHERE email = 'you@example.com';"
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'missing_token' });
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
  if (!row || !row.is_admin) return res.status(403).json({ ok: false, error: 'admin_required' });
  next();
}

// Google OAuth2 client — used both to build the consent-screen redirect URL
// and to exchange the returned code for an ID token in the callback route.
function buildGoogleClient() {
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/auth/google/callback`;
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

module.exports = { signToken, requireAuth, requireAdmin, buildGoogleClient };
