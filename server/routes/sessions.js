// Rotas de sessões de estudo. Backend autoritativo do XP.
//
// Fluxo típico:
//   POST /api/sessions                → cria sessão pendente
//   POST /api/sessions/:id/event      → (opcional) flush periódico de eventos
//   POST /api/sessions/:id/finish     → fecha, calcula XP, devolve novas medalhas
//
// Convenção: cliente bufferiza eventos e envia em /finish (DEV-PLAN §3).

const { Router } = require('express');
const { query, withTx, isAvailable } = require('../db');
const { ensureUser } = require('../auth');
const G = require('../gamification');

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_MODES = new Set(['flashcards', 'multiple', 'write', 'match', 'speed']);
const VALID_EVENT_KINDS = new Set(['correct', 'wrong', 'combo_break', 'flush', 'session_end']);

function isUuid(s) { return typeof s === 'string' && UUID_RE.test(s); }
function requireDb(res) {
  if (!isAvailable()) { res.status(503).json({ error: 'db_unavailable' }); return false; }
  return true;
}

// Garante user em todas as rotas (criando se não tem cookie).
async function userOrFail(req, res) {
  if (req.user) return req.user;
  const u = await ensureUser(req, res);
  if (!u) { res.status(401).json({ error: 'no_user' }); return null; }
  return u;
}

// ---------- POST /api/sessions ----------
// Body: { deck_id, mode, tz_offset_min? }
router.post('/', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const body = req.body || {};
  const deckId = body.deck_id;
  const mode = body.mode;
  const tzOffsetMin = Number.isFinite(body.tz_offset_min) ? body.tz_offset_min : 0;

  if (!isUuid(deckId)) return res.status(400).json({ error: 'invalid_deck_id' });
  if (!VALID_MODES.has(mode)) return res.status(400).json({ error: 'invalid_mode' });

  try {
    // Sanidade: deck existe e é visível pra esse user.
    const dr = await query(
      `SELECT id, owner_id, is_public, removed_by_admin, deleted_at
       FROM decks WHERE id = $1`,
      [deckId]
    );
    const d = dr.rows[0];
    if (!d || d.deleted_at) return res.status(404).json({ error: 'deck_not_found' });
    const isOwner = d.owner_id === user.id;
    if (!isOwner && (!d.is_public || d.removed_by_admin)) {
      return res.status(404).json({ error: 'deck_not_found' });
    }

    const sr = await query(
      `INSERT INTO study_sessions (user_id, deck_id, mode, status, meta)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id, started_at`,
      [user.id, deckId, mode, JSON.stringify({ tz_offset_min: tzOffsetMin })]
    );
    res.status(201).json({ id: sr.rows[0].id, started_at: sr.rows[0].started_at });
  } catch (e) {
    console.error('[sessions create] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/sessions/:id/event ----------
// Flush periódico de eventos pro server (defensivo). Cliente normal envia
// tudo em /finish.
// Body: { events: [{ kind, card_id?, combo?, time_ms?, delta_xp? }] }
router.post('/:id/event', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const sessId = req.params.id;
  if (!isUuid(sessId)) return res.status(404).json({ error: 'not_found' });

  const events = Array.isArray((req.body || {}).events) ? req.body.events : [];
  if (!events.length) return res.json({ ok: true, persisted: 0 });

  try {
    const sr = await query(
      `SELECT id, user_id, status FROM study_sessions WHERE id = $1`,
      [sessId]
    );
    const s = sr.rows[0];
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.user_id !== user.id) return res.status(404).json({ error: 'not_found' });
    if (s.status !== 'pending') return res.status(409).json({ error: 'already_finished' });

    let persisted = 0;
    for (const ev of events) {
      if (!VALID_EVENT_KINDS.has(ev.kind)) continue;
      const cardId = isUuid(ev.card_id) ? ev.card_id : null;
      const combo = Number.isFinite(ev.combo) ? Math.max(0, Math.min(999, ev.combo|0)) : null;
      const timeMs = Number.isFinite(ev.time_ms) ? Math.max(0, ev.time_ms|0) : null;
      const dx = Number.isFinite(ev.delta_xp) ? Math.max(0, Math.min(200, ev.delta_xp|0)) : 0;
      await query(
        `INSERT INTO session_events (session_id, kind, card_id, combo, time_ms, delta_xp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sessId, ev.kind, cardId, combo, timeMs, dx]
      );
      persisted++;
    }
    res.json({ ok: true, persisted });
  } catch (e) {
    console.error('[sessions event] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/sessions/:id/finish ----------
// Body:
//   { duration_ms, correct, wrong, max_combo, cards_total, total_deck_cards?,
//     tz_offset_min, events: [{ kind, card_id, combo, time_ms, card_stats? }] }
// Calcula XP server-side a partir dos eventos brutos, atualiza stats, retorna
// breakdown + medalhas novas.
router.post('/:id/finish', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const sessId = req.params.id;
  if (!isUuid(sessId)) return res.status(404).json({ error: 'not_found' });

  const body = req.body || {};
  const events = Array.isArray(body.events) ? body.events : [];
  const correct = Math.max(0, body.correct|0);
  const wrong   = Math.max(0, body.wrong|0);
  const maxCombo = Math.max(0, body.max_combo|0);
  const cardsTotal = Math.max(0, body.cards_total|0);
  const totalDeckCards = body.total_deck_cards ? Math.max(0, body.total_deck_cards|0) : null;
  const durationMs = Math.max(0, body.duration_ms|0);
  const tzOffsetMin = Number.isFinite(body.tz_offset_min) ? body.tz_offset_min : 0;
  const abandoned = !!body.abandoned;

  try {
    const sr = await query(
      `SELECT s.id, s.user_id, s.deck_id, s.mode, s.status, s.started_at, s.meta,
              d.removed_by_admin, d.deleted_at
       FROM study_sessions s
       JOIN decks d ON d.id = s.deck_id
       WHERE s.id = $1`,
      [sessId]
    );
    const s = sr.rows[0];
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.user_id !== user.id) return res.status(404).json({ error: 'not_found' });
    if (s.status !== 'pending') return res.status(409).json({ error: 'already_finished' });

    // Caminho "abandoned" — sai cedo, zera XP, marca status='abandoned'.
    if (abandoned) {
      await query(
        `UPDATE study_sessions
         SET status = 'abandoned', ended_at = now(), duration_ms = $2,
             correct = $3, wrong = $4, max_combo = $5, cards_total = $6,
             xp_earned = 0
         WHERE id = $1`,
        [sessId, durationMs, correct, wrong, maxCombo, cardsTotal]
      );
      return res.json({ session_id: sessId, abandoned: true, xp_earned: 0 });
    }

    // Sanidade. Sessão muito curta → registra mas zera XP.
    const cardCountR = await query(`SELECT count(*)::int AS n FROM cards WHERE deck_id = $1`, [s.deck_id]);
    const deckCardCount = cardCountR.rows[0].n;
    const sane = G.validFinish({ duration_ms: durationMs, correct, wrong, deck_card_count: deckCardCount });

    // Calcula XP por evento (server-side autoritativo).
    let xpRaw = 0;
    for (const ev of events) {
      if (ev.kind !== 'correct') continue;
      const xp = G.calcXpForCorrect({
        mode: s.mode,
        combo: ev.combo || 1,
        card_stats: ev.card_stats || null
      });
      xpRaw += xp;
    }
    if (!sane) xpRaw = 0;

    // Bônus por sessão limpa
    const bonus = sane ? G.sessionBonus({
      correct, wrong,
      cards_total: cardsTotal,
      total_deck_cards: totalDeckCards
    }) : 0;

    const xpEarned = G.clampSessionXp(xpRaw + bonus);

    // Tudo numa tx.
    const finishResult = await withTx(async (client) => {
      // Persiste eventos brutos (delta_xp recalculado).
      for (const ev of events) {
        if (!VALID_EVENT_KINDS.has(ev.kind)) continue;
        const cardId = isUuid(ev.card_id) ? ev.card_id : null;
        const combo = Number.isFinite(ev.combo) ? Math.max(0, Math.min(999, ev.combo|0)) : null;
        const timeMs = Number.isFinite(ev.time_ms) ? Math.max(0, ev.time_ms|0) : null;
        let delta = 0;
        if (ev.kind === 'correct' && sane) {
          delta = G.calcXpForCorrect({
            mode: s.mode, combo: combo || 1, card_stats: ev.card_stats || null
          });
        }
        await client.query(
          `INSERT INTO session_events (session_id, kind, card_id, combo, time_ms, delta_xp)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [sessId, ev.kind, cardId, combo, timeMs, delta]
        );
      }

      // Fecha sessão.
      await client.query(
        `UPDATE study_sessions
         SET status = 'finished', ended_at = now(), duration_ms = $2,
             correct = $3, wrong = $4, max_combo = $5, cards_total = $6,
             xp_earned = $7
         WHERE id = $1`,
        [sessId, durationMs, correct, wrong, maxCombo, cardsTotal, xpEarned]
      );

      // user_stats: garante row + atualiza.
      await client.query(
        `INSERT INTO user_stats (user_id, tz_offset_min) VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, tzOffsetMin]
      );
      const usPrevR = await client.query(
        `SELECT * FROM user_stats WHERE user_id = $1 FOR UPDATE`,
        [user.id]
      );
      const usPrev = usPrevR.rows[0];

      // Streak update — só conta se sessão "válida" pelo critério Produto:
      // ≥10 acertos. Sessão flopada não conta no streak.
      const sessionDate = G.localDateString(new Date(), tzOffsetMin);
      let streakNew;
      let streakChanged = false;
      if (sane && correct >= 10) {
        const updated = G.updateStreak(usPrev, sessionDate);
        streakChanged = updated.marker !== 'same_day' && updated.marker !== null;
        streakNew = updated;
      } else {
        streakNew = {
          current_streak: usPrev.current_streak,
          longest_streak: usPrev.longest_streak,
          last_active_date: usPrev.last_active_date
        };
      }

      const newXp = usPrev.xp_total + xpEarned;
      const newLevel = G.levelFromXp(newXp);
      const levelUp = newLevel > usPrev.level;

      await client.query(
        `UPDATE user_stats
         SET xp_total = $2, level = $3,
             current_streak = $4, longest_streak = $5, last_active_date = $6,
             total_sessions = total_sessions + 1,
             total_correct  = total_correct + $7,
             total_wrong    = total_wrong   + $8,
             tz_offset_min  = $9,
             updated_at = now()
         WHERE user_id = $1`,
        [user.id, newXp, newLevel,
         streakNew.current_streak, streakNew.longest_streak, streakNew.last_active_date,
         correct, wrong, tzOffsetMin]
      );

      // deck_stats: garante row + atualiza
      await client.query(
        `INSERT INTO deck_stats (user_id, deck_id) VALUES ($1, $2)
         ON CONFLICT (user_id, deck_id) DO NOTHING`,
        [user.id, s.deck_id]
      );
      const dsPrevR = await client.query(
        `SELECT * FROM deck_stats WHERE user_id = $1 AND deck_id = $2 FOR UPDATE`,
        [user.id, s.deck_id]
      );
      const dsPrev = dsPrevR.rows[0];
      const newDeckXp = dsPrev.xp_deck + xpEarned;
      const newDeckLevel = G.deckLevelFromXp(newDeckXp);
      const deckLevelUp = newDeckLevel > dsPrev.mastery_level;
      await client.query(
        `UPDATE deck_stats
         SET xp_deck = $3, mastery_level = $4, sessions_count = sessions_count + 1,
             last_played_at = now()
         WHERE user_id = $1 AND deck_id = $2`,
        [user.id, s.deck_id, newDeckXp, newDeckLevel]
      );

      // Lifetime write correct (pra medalha typist_100)
      let lifetimeWrite = 0;
      if (s.mode === 'write') {
        const r = await client.query(
          `SELECT COALESCE(SUM(correct), 0)::int AS n FROM study_sessions
           WHERE user_id = $1 AND mode = 'write' AND status = 'finished'`,
          [user.id]
        );
        lifetimeWrite = r.rows[0].n;
      }

      // decks_owned: contagem de decks ativos
      const ownedR = await client.query(
        `SELECT count(*)::int AS n FROM decks
         WHERE owner_id = $1 AND deleted_at IS NULL`,
        [user.id]
      );
      const decksOwned = ownedR.rows[0].n;

      // max_deck_level: maior mastery_level entre todos os decks do user
      const maxDeckLvlR = await client.query(
        `SELECT COALESCE(MAX(mastery_level), 0)::int AS lv FROM deck_stats WHERE user_id = $1`,
        [user.id]
      );
      const maxDeckLevel = maxDeckLvlR.rows[0].lv;

      // Avalia medalhas
      const earnedR = await client.query(
        `SELECT medal_code FROM user_medals WHERE user_id = $1`,
        [user.id]
      );
      const earned = new Set(earnedR.rows.map(r => r.medal_code));

      const userStatsForMedals = {
        xp_total: newXp,
        level: newLevel,
        current_streak: streakNew.current_streak,
        longest_streak: streakNew.longest_streak,
        total_sessions: usPrev.total_sessions + 1,
        total_correct: usPrev.total_correct + correct,
        total_wrong: usPrev.total_wrong + wrong,
        lifetime_write_correct: lifetimeWrite,
        decks_owned: decksOwned,
        max_deck_level: maxDeckLevel
      };
      const deckStatsForMedals = {
        mastery_level: newDeckLevel,
        xp_deck: newDeckXp
      };
      const sessionForMedals = {
        mode: s.mode,
        correct, wrong,
        cards_total: cardsTotal,
        max_combo: maxCombo,
        total_deck_cards: totalDeckCards
      };
      const newMedalCodes = G.evaluateMedals({
        userStats: userStatsForMedals,
        session: sessionForMedals,
        deckStats: deckStatsForMedals,
        earned
      });

      // Insere medalhas novas
      for (const code of newMedalCodes) {
        await client.query(
          `INSERT INTO user_medals (user_id, medal_code, context)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, medal_code) DO NOTHING`,
          [user.id, code, JSON.stringify({ session_id: sessId, deck_id: s.deck_id, mode: s.mode })]
        );
      }

      return {
        session_id: sessId,
        xp_earned: xpEarned,
        xp_raw: xpRaw,
        bonus,
        sane,
        level_up: levelUp ? { from: usPrev.level, to: newLevel } : null,
        deck_level_up: deckLevelUp ? { from: dsPrev.mastery_level, to: newDeckLevel } : null,
        new_medals: newMedalCodes,
        streak_marker: streakChanged ? streakNew.marker : null,
        stats: {
          xp_total: newXp,
          level: newLevel,
          current_streak: streakNew.current_streak,
          longest_streak: streakNew.longest_streak,
          last_active_date: streakNew.last_active_date
        },
        deck_stats: {
          xp_deck: newDeckXp,
          mastery_level: newDeckLevel
        }
      };
    });

    res.json(finishResult);
  } catch (e) {
    console.error('[sessions finish] error:', e.message, e.stack);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/sessions/:id ----------
// Debug. Devolve sessão + eventos. Só dono.
router.get('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const sessId = req.params.id;
  if (!isUuid(sessId)) return res.status(404).json({ error: 'not_found' });

  try {
    const sr = await query(
      `SELECT * FROM study_sessions WHERE id = $1 AND user_id = $2`,
      [sessId, user.id]
    );
    const s = sr.rows[0];
    if (!s) return res.status(404).json({ error: 'not_found' });

    let events = null;
    if (req.query.debug === '1') {
      const er = await query(
        `SELECT kind, card_id, combo, time_ms, delta_xp, at
         FROM session_events WHERE session_id = $1 ORDER BY at ASC`,
        [sessId]
      );
      events = er.rows;
    }
    res.json({ session: s, events });
  } catch (e) {
    console.error('[sessions get] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- Cleanup de sessões abandonadas ----------
// Roda a cada 1h dentro do processo Node. Marca pending > 2h como abandoned.
function startCleanupLoop() {
  if (!isAvailable()) return;
  const tick = async () => {
    try {
      const r = await query(
        `UPDATE study_sessions
         SET status = 'abandoned', ended_at = now()
         WHERE status = 'pending' AND started_at < now() - interval '2 hours'
         RETURNING id`
      );
      if (r.rowCount > 0) console.log(`[sessions cleanup] abandoned ${r.rowCount} stale sessions`);
    } catch (e) {
      console.error('[sessions cleanup] error:', e.message);
    }
  };
  setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 60 * 1000); // primeira passagem após 1min
}

module.exports = router;
module.exports.startCleanupLoop = startCleanupLoop;
