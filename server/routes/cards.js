// Rotas de cards individuais. Sempre verificam ownership pelo deck pai.

const { Router } = require('express');
const { query, isAvailable } = require('../db');

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT_LEN = 2000;

function requireDb(res) {
  if (!isAvailable()) { res.status(503).json({ error: 'db_unavailable' }); return false; }
  return true;
}
function requireUser(req, res) {
  if (!req.user) { res.status(401).json({ error: 'no_user' }); return false; }
  return true;
}
function isUuid(s) { return typeof s === 'string' && UUID_RE.test(s); }
function trimStr(v, max) {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

// Lê card + ownership do deck pai. Retorna { card, isOwner } ou null.
async function loadCardForOwner(cardId, userId) {
  const r = await query(
    `SELECT c.id, c.deck_id, c.front, c.back, c.position, c.audio, c.stats,
            d.owner_id, d.deleted_at
     FROM cards c
     JOIN decks d ON d.id = c.deck_id
     WHERE c.id = $1`,
    [cardId]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.deleted_at) return null;
  return { row, isOwner: row.owner_id === userId };
}

// ---------- PATCH /api/cards/:id ----------
// Body: { front?, back? }. Só dono.
router.patch('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const body = req.body || {};
  const updates = [];
  const params = [];

  if (body.front !== undefined) {
    const v = trimStr(body.front, MAX_TEXT_LEN);
    if (!v) return res.status(400).json({ error: 'front_required' });
    params.push(v); updates.push(`front = $${params.length}`);
  }
  if (body.back !== undefined) {
    const v = trimStr(body.back, MAX_TEXT_LEN);
    if (!v) return res.status(400).json({ error: 'back_required' });
    params.push(v); updates.push(`back = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'no_fields' });

  try {
    const loaded = await loadCardForOwner(id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'not_found' });
    if (!loaded.isOwner) return res.status(404).json({ error: 'not_found' });

    params.push(id);
    const r = await query(
      `UPDATE cards SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, deck_id, front, back, position, audio, stats`,
      params
    );
    await query('UPDATE decks SET updated_at = now() WHERE id = $1', [loaded.row.deck_id]);
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[cards patch] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/cards/:id/audio ----------
// Body: { side: 'front'|'back', audio: { url, lang, hash, generatedAt } }.
// Patcha card.audio JSONB. Só dono.
router.post('/:id/audio', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const body = req.body || {};
  const side = body.side;
  const audio = body.audio;
  if (side !== 'front' && side !== 'back') return res.status(400).json({ error: 'invalid_side' });
  if (!audio || typeof audio !== 'object' || typeof audio.url !== 'string') {
    return res.status(400).json({ error: 'invalid_audio' });
  }
  // Sanitiza shape esperado.
  const clean = {
    url: String(audio.url).slice(0, 500),
    lang: audio.lang ? String(audio.lang).slice(0, 10) : null,
    hash: audio.hash ? String(audio.hash).slice(0, 64) : null,
    generatedAt: typeof audio.generatedAt === 'number' ? audio.generatedAt : Date.now()
  };

  try {
    const loaded = await loadCardForOwner(id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'not_found' });
    if (!loaded.isOwner) return res.status(404).json({ error: 'not_found' });

    // jsonb_set cria a chave se não existir. Audio começa NULL → COALESCE.
    const r = await query(
      `UPDATE cards
       SET audio = jsonb_set(
         COALESCE(audio, '{}'::jsonb),
         $2::text[],
         $3::jsonb,
         true
       )
       WHERE id = $1
       RETURNING audio`,
      [id, [side], JSON.stringify(clean)]
    );
    res.json({ audio: r.rows[0].audio });
  } catch (e) {
    console.error('[cards audio] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/cards/:id/result ----------
// Body: { correct: bool }. Só dono.
router.post('/:id/result', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const correct = !!(req.body || {}).correct;

  try {
    const loaded = await loadCardForOwner(id, req.user.id);
    if (!loaded) return res.status(404).json({ error: 'not_found' });
    if (!loaded.isOwner) return res.status(404).json({ error: 'not_found' });

    // Incrementa contador correto/wrong e atualiza lastSeenAt. Tudo no JSONB.
    const field = correct ? 'correct' : 'wrong';
    const r = await query(
      `UPDATE cards SET stats =
        jsonb_set(
          jsonb_set(
            COALESCE(stats, '{}'::jsonb),
            $2::text[],
            to_jsonb(COALESCE((stats->>$3)::int, 0) + 1),
            true
          ),
          '{lastSeenAt}'::text[],
          to_jsonb($4::bigint),
          true
        )
       WHERE id = $1
       RETURNING stats`,
      [id, [field], field, Date.now()]
    );
    res.json({ stats: r.rows[0].stats });
  } catch (e) {
    console.error('[cards result] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
