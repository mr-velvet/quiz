// Rotas de dev/QA. Gated por NODE_ENV !== 'production' OU header X-Dev-Token correto.
// NUNCA expor em produção sem token.

const { Router } = require('express');
const { query, isAvailable } = require('../db');

const router = Router();

function requireDevAccess(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next();
  const token = process.env.DEV_TOKEN;
  if (token && req.get('X-Dev-Token') === token) return next();
  return res.status(404).json({ error: 'not_found' });
}

router.post('/reset-stats', requireDevAccess, async (req, res) => {
  if (!isAvailable()) return res.status(503).json({ error: 'db_unavailable' });
  if (!req.user) return res.status(401).json({ error: 'no_user' });
  try {
    await query('DELETE FROM user_medals WHERE user_id = $1', [req.user.id]);
    await query('DELETE FROM session_events WHERE session_id IN (SELECT id FROM study_sessions WHERE user_id = $1)', [req.user.id]);
    await query('DELETE FROM study_sessions WHERE user_id = $1', [req.user.id]);
    await query('DELETE FROM deck_stats WHERE user_id = $1', [req.user.id]);
    await query('DELETE FROM user_stats WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[dev reset] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/grant-medal', requireDevAccess, async (req, res) => {
  if (!isAvailable()) return res.status(503).json({ error: 'db_unavailable' });
  if (!req.user) return res.status(401).json({ error: 'no_user' });
  const code = (req.body || {}).code;
  if (!code) return res.status(400).json({ error: 'code_required' });
  try {
    await query(
      `INSERT INTO user_medals (user_id, medal_code, context)
       VALUES ($1, $2, '{"debug":true}'::jsonb)
       ON CONFLICT (user_id, medal_code) DO NOTHING`,
      [req.user.id, code]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[dev grant] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/fast-forward', requireDevAccess, async (req, res) => {
  if (!isAvailable()) return res.status(503).json({ error: 'db_unavailable' });
  if (!req.user) return res.status(401).json({ error: 'no_user' });
  const days = Math.max(1, Math.min(365, parseInt((req.body || {}).days, 10) || 1));
  try {
    await query(
      `UPDATE user_stats SET last_active_date = last_active_date - ($2::int * interval '1 day')
       WHERE user_id = $1`,
      [req.user.id, days]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[dev ff] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
