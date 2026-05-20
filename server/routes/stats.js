// Leitura de stats / medalhas. Tudo cacheável no client.

const { Router } = require('express');
const { query, isAvailable } = require('../db');
const { ensureUser } = require('../auth');
const G = require('../gamification');

const router = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireDb(res) {
  if (!isAvailable()) { res.status(503).json({ error: 'db_unavailable' }); return false; }
  return true;
}

async function userOrFail(req, res) {
  if (req.user) return req.user;
  const u = await ensureUser(req, res);
  if (!u) { res.status(401).json({ error: 'no_user' }); return null; }
  return u;
}

function isUuid(s) { return typeof s === 'string' && UUID_RE.test(s); }

// ---------- GET /api/me/stats ----------
// Query: ?days=30 (default), ?debug=1
router.get('/me/stats', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

  try {
    // Garante row (caso user nunca tenha jogado)
    await query(
      `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [user.id]
    );
    const r = await query(`SELECT * FROM user_stats WHERE user_id = $1`, [user.id]);
    const us = r.rows[0];

    const progress = G.levelProgress(us.xp_total);
    const title = G.levelTitle(us.level);

    // Heatmap: XP por dia nos últimos N dias.
    const hmR = await query(
      `SELECT date_trunc('day', started_at AT TIME ZONE 'UTC')::date AS d,
              count(*)::int AS sessions,
              COALESCE(SUM(xp_earned), 0)::int AS xp
       FROM study_sessions
       WHERE user_id = $1 AND status = 'finished'
         AND started_at >= now() - ($2 || ' days')::interval
       GROUP BY d
       ORDER BY d ASC`,
      [user.id, days]
    );
    const heatmap = hmR.rows.map(row => ({
      date: typeof row.d === 'string' ? row.d : row.d.toISOString().slice(0, 10),
      sessions: row.sessions,
      xp: row.xp
    }));

    // Últimas sessões (só debug=1)
    let recent = null;
    if (req.query.debug === '1') {
      const rec = await query(
        `SELECT id, deck_id, mode, started_at, ended_at, duration_ms,
                correct, wrong, max_combo, xp_earned, status
         FROM study_sessions
         WHERE user_id = $1
         ORDER BY started_at DESC
         LIMIT 50`,
        [user.id]
      );
      recent = rec.rows;
    }

    res.json({
      xp_total: us.xp_total,
      level: us.level,
      level_title: title,
      level_progress: progress,
      current_streak: us.current_streak,
      longest_streak: us.longest_streak,
      last_active_date: us.last_active_date,
      totals: {
        sessions: us.total_sessions,
        correct: us.total_correct,
        wrong: us.total_wrong
      },
      heatmap,
      recent
    });
  } catch (e) {
    console.error('[stats me] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/me/medals ----------
router.get('/me/medals', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  try {
    const catR = await query(
      `SELECT code, name, description, icon, tier, category, sort_order
       FROM medals ORDER BY sort_order ASC`
    );
    const earnedR = await query(
      `SELECT medal_code, earned_at, context FROM user_medals WHERE user_id = $1`,
      [user.id]
    );
    const earnedMap = new Map(earnedR.rows.map(r => [r.medal_code, r]));
    const all = catR.rows.map(m => {
      const e = earnedMap.get(m.code);
      return {
        ...m,
        earned: !!e,
        earned_at: e ? e.earned_at : null,
        context: e ? e.context : null
      };
    });
    res.json({
      all,
      earned_count: earnedR.rows.length,
      total_count: catR.rows.length
    });
  } catch (e) {
    console.error('[stats medals] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/decks/:id/stats ----------
// Stats do deck pro user atual. Respeita visibilidade do deck.
router.get('/decks/:id/stats', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const deckId = req.params.id;
  if (!isUuid(deckId)) return res.status(404).json({ error: 'not_found' });

  try {
    // Visibilidade do deck
    const dr = await query(
      `SELECT id, owner_id, is_public, removed_by_admin, deleted_at FROM decks WHERE id = $1`,
      [deckId]
    );
    const d = dr.rows[0];
    if (!d || d.deleted_at) return res.status(404).json({ error: 'not_found' });
    const isOwner = d.owner_id === user.id;
    if (!isOwner && (!d.is_public || d.removed_by_admin)) {
      return res.status(404).json({ error: 'not_found' });
    }

    const sr = await query(
      `SELECT xp_deck, mastery_level, sessions_count, last_played_at
       FROM deck_stats WHERE user_id = $1 AND deck_id = $2`,
      [user.id, deckId]
    );
    const ds = sr.rows[0] || { xp_deck: 0, mastery_level: 1, sessions_count: 0, last_played_at: null };
    const progress = G.deckLevelProgress(ds.xp_deck);
    const title = G.deckLevelTitle(ds.mastery_level);

    // Top sessões recentes do user nesse deck
    const recR = await query(
      `SELECT mode, started_at, ended_at, duration_ms, correct, wrong, max_combo, xp_earned
       FROM study_sessions
       WHERE user_id = $1 AND deck_id = $2 AND status = 'finished'
       ORDER BY started_at DESC LIMIT 10`,
      [user.id, deckId]
    );

    res.json({
      xp_deck: ds.xp_deck,
      mastery_level: ds.mastery_level,
      mastery_title: title,
      progress,
      sessions_count: ds.sessions_count,
      last_played_at: ds.last_played_at,
      recent_sessions: recR.rows
    });
  } catch (e) {
    console.error('[stats deck] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/me/decks-top ----------
// Top decks do user por XP.
router.get('/me/decks-top', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;
  try {
    const r = await query(
      `SELECT ds.deck_id, ds.xp_deck, ds.mastery_level, ds.sessions_count, ds.last_played_at,
              d.name, d.owner_id
       FROM deck_stats ds
       JOIN decks d ON d.id = ds.deck_id AND d.deleted_at IS NULL
       WHERE ds.user_id = $1
       ORDER BY ds.xp_deck DESC
       LIMIT 12`,
      [user.id]
    );
    res.json(r.rows.map(row => ({
      deck_id: row.deck_id,
      name: row.name,
      xp_deck: row.xp_deck,
      mastery_level: row.mastery_level,
      mastery_title: G.deckLevelTitle(row.mastery_level),
      sessions_count: row.sessions_count,
      last_played_at: row.last_played_at,
      is_mine: row.owner_id === user.id
    })));
  } catch (e) {
    console.error('[stats decks-top] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
