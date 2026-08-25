const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../auth');

const router = express.Router();

/* ======================================================================
   Minimal version of the "Business Dashboard" (spec section 31). Returns
   real aggregates from revenue_transactions — which, until you configure
   real commercial terms in src/revenueEngine.js, will honestly show
   commission/markup/profit as 0. is_configured tells you which rows (if
   any) reflect real signed terms vs. structural placeholders.
====================================================================== */
router.get('/api/admin/revenue/summary', requireAuth, requireAdmin, (req, res) => {
  const totals = db.prepare(`
    SELECT
      COUNT(*) as booking_count,
      COALESCE(SUM(customer_price), 0) as gmv,
      COALESCE(SUM(commission), 0) as total_commission,
      COALESCE(SUM(markup), 0) as total_markup,
      COALESCE(SUM(service_fee), 0) as total_service_fee,
      COALESCE(SUM(gross_revenue), 0) as total_gross_revenue,
      COALESCE(SUM(payment_fee), 0) as total_payment_fee,
      COALESCE(SUM(refund_amount), 0) as total_refunds,
      COALESCE(SUM(net_revenue), 0) as total_net_revenue,
      COALESCE(SUM(net_profit), 0) as total_net_profit,
      COALESCE(SUM(is_configured), 0) as configured_transaction_count
    FROM revenue_transactions
  `).get();

  const byDestination = db.prepare(`
    SELECT b.destination, COUNT(*) as bookings, COALESCE(SUM(rt.customer_price), 0) as gmv, COALESCE(SUM(rt.net_profit), 0) as net_profit
    FROM revenue_transactions rt
    JOIN bookings b ON b.id = rt.booking_id
    GROUP BY b.destination
    ORDER BY gmv DESC
  `).all();

  res.json({
    ok: true,
    data: {
      totals,
      byDestination,
      note: totals.configured_transaction_count === 0
        ? 'כל העסקאות עדיין ללא תנאים מסחריים מוגדרים — commission/markup/profit אמיתיים יופיעו כאן רק אחרי שתמלאו PROVIDER_COMMERCIAL_TERMS ב-src/revenueEngine.js עם הסכם אמיתי.'
        : `${totals.configured_transaction_count} מתוך ${totals.booking_count} עסקאות עם תנאים מסחריים מוגדרים.`,
    },
  });
});

router.get('/api/admin/bookings', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT b.id, b.booking_number, b.destination, b.hotel, b.airline, b.tier, b.total, b.created_at,
           u.name as customer_name, u.email as customer_email,
           rt.provider_cost, rt.commission, rt.markup, rt.service_fee, rt.net_profit, rt.is_configured
    FROM bookings b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN revenue_transactions rt ON rt.booking_id = b.id
    ORDER BY b.created_at DESC
    LIMIT 200
  `).all();
  res.json({ ok: true, data: rows });
});

module.exports = router;
