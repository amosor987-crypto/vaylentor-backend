const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    booking_number TEXT NOT NULL,
    destination TEXT NOT NULL,
    hotel TEXT,
    airline TEXT,
    tier TEXT,
    nights INTEGER,
    travelers INTEGER,
    total INTEGER NOT NULL,
    passengers_json TEXT,
    special_requests TEXT,
    stripe_payment_intent_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Financial transaction ledger (spec section 40). Every booking gets a
  -- row here via revenueEngine.calculateRevenue(). Values are honestly
  -- zero until PROVIDER_COMMERCIAL_TERMS in src/revenueEngine.js is filled
  -- with real, signed commercial terms — see is_configured below.
  CREATE TABLE IF NOT EXISTS revenue_transactions (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    provider_id TEXT,
    product_type TEXT,
    provider_cost INTEGER,
    customer_price INTEGER,
    commission INTEGER,
    markup INTEGER,
    service_fee INTEGER,
    gross_revenue INTEGER,
    payment_fee INTEGER,
    refund_amount INTEGER,
    net_revenue INTEGER,
    gross_profit INTEGER,
    net_profit INTEGER,
    currency TEXT,
    is_configured INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  );
`);

// Lightweight migration for databases created before passengers_json /
// special_requests existed — safe to run every startup (no-op if present).
const bookingCols = db.prepare("PRAGMA table_info(bookings)").all().map((c) => c.name);
if (!bookingCols.includes('passengers_json')) {
  db.exec('ALTER TABLE bookings ADD COLUMN passengers_json TEXT');
}
if (!bookingCols.includes('special_requests')) {
  db.exec('ALTER TABLE bookings ADD COLUMN special_requests TEXT');
}
const userCols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userCols.includes('is_admin')) {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

module.exports = db;
