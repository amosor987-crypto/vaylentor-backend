const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.get('/api/bookings/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.id);

  const data = rows.map((r) => ({
    bookingNumber: r.booking_number,
    destination: r.destination,
    hotel: r.hotel,
    airline: r.airline,
    tier: r.tier,
    nights: r.nights,
    travelers: r.travelers,
    total: r.total,
    passengers: r.passengers_json ? JSON.parse(r.passengers_json) : [],
    specialRequests: r.special_requests || null,
    date: new Date(r.created_at).toLocaleDateString('he-IL'),
  }));

  res.json({ ok: true, data });
});

module.exports = router;
