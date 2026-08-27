const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken, requireAuth, buildGoogleClient } = require('../auth');

const router = express.Router();

// Lets a specific set of emails become admin just by signing up or logging
// in with that address — set ADMIN_EMAILS in Render as a comma-separated
// list (e.g. "you@example.com,partner@example.com"). Avoids needing raw
// SQL/shell access to the database to grant the first admin account.
function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes((email || '').toLowerCase());
}
function promoteIfAdminEmail(userId, email) {
  if (isAdminEmail(email)) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
  }
}

/* ---------------- email + password ---------------- */

router.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 4) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }
  const existing = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);

  // An account that signed up via Google has no password_hash at all.
  // Rather than blocking them with "email taken" forever, this lets that
  // same person add a password to their existing account — useful for
  // logging into a second surface (like the admin dashboard) that only
  // supports email+password, not Google OAuth.
  // NOTE: this doesn't verify the requester actually owns the Google
  // account first (no email verification exists yet anywhere on this
  // site) — acceptable for now while testing, but add email verification
  // before this matters for real, unrelated users.
  if (existing && !existing.password_hash) {
    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, existing.id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(existing.id);
    promoteIfAdminEmail(user.id, email);
    const token = signToken(user);
    return res.json({ ok: true, data: { token, user: { id: user.id, name: user.name, email: user.email } } });
  }
  if (existing) return res.status(409).json({ ok: false, error: 'email_taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: uuidv4(), name, email, password_hash: passwordHash, created_at: new Date().toISOString() };
  db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (@id, @name, @email, @password_hash, @created_at)').run(user);
  promoteIfAdminEmail(user.id, email);

  const token = signToken(user);
  res.json({ ok: true, data: { token, user: { id: user.id, name: user.name, email: user.email } } });
});

router.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ ok: false, error: 'invalid_input' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.password_hash) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
  promoteIfAdminEmail(user.id, user.email);

  const token = signToken(user);
  res.json({ ok: true, data: { token, user: { id: user.id, name: user.name, email: user.email } } });
});

router.get('/api/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, is_admin FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ ok: false, error: 'not_found' });
  res.json({ ok: true, data: user });
});

/* ---------------- Google OAuth ----------------
   Flow:
   1. Frontend links to  GET {BACKEND_URL}/auth/google
   2. We redirect the browser to Google's consent screen
   3. Google redirects back to GET {BACKEND_URL}/auth/google/callback?code=...
   4. We exchange the code for an ID token, upsert the user, sign our own JWT,
      and redirect the browser to {FRONTEND_URL}?token=...
   5. The frontend reads ?token= from the URL, stores it, and calls /api/me.
------------------------------------------------------------------------ */

router.get('/auth/google', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).send('Google login is not configured on this server yet — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env (see README).');
  }
  const client = buildGoogleClient();
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
  try {
    const { code, error: googleError } = req.query;
    if (googleError) throw new Error(`google_denied_or_error: ${googleError}`);
    if (!code) throw new Error('missing_code');

    const client = buildGoogleClient();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, email_verified } = payload;

    if (!email || !email_verified) throw new Error('unverified_email');

    let user = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(googleId, email);
    if (!user) {
      user = { id: uuidv4(), name: name || email.split('@')[0], email, google_id: googleId, created_at: new Date().toISOString() };
      db.prepare('INSERT INTO users (id, name, email, google_id, created_at) VALUES (@id, @name, @email, @google_id, @created_at)').run(user);
    } else if (!user.google_id) {
      db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id);
    }
    promoteIfAdminEmail(user.id, email);

    const token = signToken(user);
    res.redirect(`${frontendUrl}?token=${encodeURIComponent(token)}`);
  } catch (err) {
    // Two error classes show up before we even get here and are worth
    // knowing about while debugging (they never reach this catch block —
    // Google shows its own error page instead):
    //   - redirect_uri_mismatch: the callback URL doesn't EXACTLY match
    //     what's registered in Google Cloud Console (scheme/host/port/path).
    //   - access_blocked / testing mode: if the OAuth consent screen is in
    //     "Testing" publishing status, only emails added as test users can
    //     complete login. Add yourself under OAuth consent screen -> Test users.
    console.error('[auth/google/callback]', err.message);
    res.redirect(`${frontendUrl}?authError=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
