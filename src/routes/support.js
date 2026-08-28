const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

/* ======================================================================
   Customer-facing endpoints — a logged-in user can open a support ticket
   (optionally tied to one of their own bookings) and see their own
   ticket history. They never see other customers' tickets.
====================================================================== */

router.post('/api/support/messages', requireAuth, (req, res) => {
  const { subject, message, bookingId } = req.body || {};
  if (!subject || !message || !subject.trim() || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }

  // If a bookingId was given, it must actually belong to this user —
  // otherwise a ticket could be opened "about" someone else's booking.
  if (bookingId) {
    const booking = db.prepare('SELECT id FROM bookings WHERE id = ? AND user_id = ?').get(bookingId, req.user.id);
    if (!booking) return res.status(403).json({ ok: false, error: 'booking_not_yours' });
  }

  const row = {
    id: uuidv4(),
    user_id: req.user.id,
    booking_id: bookingId || null,
    subject: subject.trim(),
    message: message.trim(),
    status: 'open',
    created_at: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO support_messages (id, user_id, booking_id, subject, message, status, created_at)
    VALUES (@id, @user_id, @booking_id, @subject, @message, @status, @created_at)
  `).run(row);

  res.json({ ok: true, data: row });
});

router.get('/api/support/messages', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, booking_id, subject, message, status, admin_reply, replied_at, created_at
    FROM support_messages
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ ok: true, data: rows });
});

/* ======================================================================
   Admin-facing endpoints — see and answer every open ticket.
====================================================================== */

router.get('/api/admin/support/messages', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT sm.id, sm.subject, sm.message, sm.status, sm.admin_reply, sm.replied_at, sm.created_at,
           sm.booking_id, b.booking_number, b.destination,
           u.name as customer_name, u.email as customer_email
    FROM support_messages sm
    LEFT JOIN users u ON u.id = sm.user_id
    LEFT JOIN bookings b ON b.id = sm.booking_id
    ORDER BY
      CASE sm.status WHEN 'open' THEN 0 ELSE 1 END,
      sm.created_at DESC
  `).all();
  res.json({ ok: true, data: rows });
});

router.post('/api/admin/support/messages/:id/reply', requireAuth, requireAdmin, (req, res) => {
  const { reply } = req.body || {};
  if (!reply || !reply.trim()) return res.status(400).json({ ok: false, error: 'invalid_input' });

  const ticket = db.prepare('SELECT id FROM support_messages WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ ok: false, error: 'not_found' });

  db.prepare(`
    UPDATE support_messages SET admin_reply = ?, status = 'answered', replied_at = ? WHERE id = ?
  `).run(reply.trim(), new Date().toISOString(), req.params.id);

  res.json({ ok: true });
});

router.post('/api/admin/support/messages/:id/close', requireAuth, requireAdmin, (req, res) => {
  const ticket = db.prepare('SELECT id FROM support_messages WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ ok: false, error: 'not_found' });
  db.prepare(`UPDATE support_messages SET status = 'closed' WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
