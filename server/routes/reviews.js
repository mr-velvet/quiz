// Rotas da lista de revisão por (user, deck).
//
// Vínculo é DO USER: funciona tanto em deck próprio quanto em deck público
// de outro. Operações idempotentes — marcar/desmarcar 2× é no-op.
//
// Visibilidade: leitura só retorna cards se o deck ainda é acessível ao user
// (público + não removido OU dono). Se o deck virou privado de outro, a lista
// fica preservada no banco mas some da UI até voltar (ver spec §2.3).
//
// Endpoints:
//   POST   /api/cards/:cardId/review     marcar (body opcional { deckId, source })
//   DELETE /api/cards/:cardId/review     desmarcar (idempotente)
//   GET    /api/decks/:deckId/review     lista cards marcados do deck
//   GET    /api/decks/:deckId/review/count  só contagem
//   GET    /api/me/review-counts         contagem por deck (todos com ≥1)

const { Router } = require('express');
const { query, isAvailable } = require('../db');
const { ensureUser } = require('../auth');

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_LEN = 40;

function isUuid(s) { return typeof s === 'string' && UUID_RE.test(s); }
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

// Carrega card + ownership/visibilidade do deck pai. Mesma lógica de cards.js
// mas com visibilidade pública também (não só owner — revisão funciona em deck
// público de outro).
async function loadCardVisible(cardId, userId) {
  const r = await query(
    `SELECT c.id, c.deck_id,
            d.owner_id, d.is_public, d.removed_by_admin, d.deleted_at
     FROM cards c
     JOIN decks d ON d.id = c.deck_id
     WHERE c.id = $1`,
    [cardId]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (row.deleted_at) return null;
  const isOwner = row.owner_id === userId;
  if (!isOwner && (!row.is_public || row.removed_by_admin)) return null;
  return { card: row, isOwner };
}

function mapCardRow(row) {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    position: row.position,
    audio: row.audio || null,
    stats: row.stats || { correct: 0, wrong: 0, lastSeenAt: 0 }
  };
}

// ---------- POST /api/cards/:cardId/review ----------
// Marca card pra revisão. Body opcional: { deckId, source }.
// Se deckId omitido, lê do próprio card. Idempotente via ON CONFLICT.
router.post('/cards/:cardId/review', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const cardId = req.params.cardId;
  if (!isUuid(cardId)) return res.status(404).json({ error: 'not_found' });

  const body = req.body || {};
  const bodyDeckId = body.deckId;
  if (bodyDeckId !== undefined && bodyDeckId !== null && !isUuid(bodyDeckId)) {
    return res.status(400).json({ error: 'invalid_deck_id' });
  }
  let source = null;
  if (typeof body.source === 'string') {
    const s = body.source.trim().slice(0, MAX_SOURCE_LEN);
    if (s) source = s;
  }

  try {
    const loaded = await loadCardVisible(cardId, user.id);
    if (!loaded) return res.status(404).json({ error: 'not_found' });

    // Se body trouxe deckId, validar que bate com o do card. Evita inconsistência.
    if (bodyDeckId && bodyDeckId !== loaded.card.deck_id) {
      return res.status(400).json({ error: 'deck_card_mismatch' });
    }
    const deckId = loaded.card.deck_id;

    await query(
      `INSERT INTO card_reviews (user_id, card_id, deck_id, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, card_id) DO NOTHING`,
      [user.id, cardId, deckId, source]
    );
    res.json({ added: true });
  } catch (e) {
    console.error('[reviews add] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- DELETE /api/cards/:cardId/review ----------
// Remove da revisão. Idempotente: não erra se já não estava marcado.
router.delete('/cards/:cardId/review', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const cardId = req.params.cardId;
  if (!isUuid(cardId)) return res.status(404).json({ error: 'not_found' });

  try {
    await query(
      `DELETE FROM card_reviews WHERE user_id = $1 AND card_id = $2`,
      [user.id, cardId]
    );
    res.json({ removed: true });
  } catch (e) {
    console.error('[reviews remove] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/decks/:deckId/review ----------
// Lista cards de revisão do user nesse deck. Mesma shape dos cards normais.
// Respeita visibilidade do deck (deck virou privado de terceiro → 404).
router.get('/decks/:deckId/review', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const deckId = req.params.deckId;
  if (!isUuid(deckId)) return res.status(404).json({ error: 'not_found' });

  try {
    const dr = await query(
      `SELECT id, owner_id, is_public, removed_by_admin, deleted_at
       FROM decks WHERE id = $1`,
      [deckId]
    );
    const d = dr.rows[0];
    if (!d || d.deleted_at) return res.status(404).json({ error: 'not_found' });
    const isOwner = d.owner_id === user.id;
    if (!isOwner && (!d.is_public || d.removed_by_admin)) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Join card_reviews × cards. Ordenado por added_at ASC ("mais antigos primeiro"),
    // consistente com spec §2.1.
    const r = await query(
      `SELECT c.id, c.front, c.back, c.position, c.audio, c.stats, cr.added_at
       FROM card_reviews cr
       JOIN cards c ON c.id = cr.card_id
       WHERE cr.user_id = $1 AND cr.deck_id = $2
       ORDER BY cr.added_at ASC`,
      [user.id, deckId]
    );
    res.json({ cards: r.rows.map(mapCardRow) });
  } catch (e) {
    console.error('[reviews list] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/decks/:deckId/review/count ----------
// Só contagem. Pro CTA "Revisar marcados (N)" e badges.
// Respeita visibilidade do deck (mesma regra do listing).
router.get('/decks/:deckId/review/count', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  const deckId = req.params.deckId;
  if (!isUuid(deckId)) return res.status(404).json({ error: 'not_found' });

  try {
    const dr = await query(
      `SELECT id, owner_id, is_public, removed_by_admin, deleted_at
       FROM decks WHERE id = $1`,
      [deckId]
    );
    const d = dr.rows[0];
    if (!d || d.deleted_at) return res.status(404).json({ error: 'not_found' });
    const isOwner = d.owner_id === user.id;
    if (!isOwner && (!d.is_public || d.removed_by_admin)) {
      return res.status(404).json({ error: 'not_found' });
    }

    const r = await query(
      `SELECT count(*)::int AS n FROM card_reviews
       WHERE user_id = $1 AND deck_id = $2`,
      [user.id, deckId]
    );
    res.json({ count: r.rows[0].n });
  } catch (e) {
    console.error('[reviews count] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/me/review-counts ----------
// Contagem por deck pra todos os decks do user com ≥1 card marcado.
// Filtra decks não visíveis (deletados ou removed_by_admin sem ser dono).
// Privado-de-outro: vínculo no banco fica, mas count na resposta é omitido
// (deck não é mais visível pra esse user).
router.get('/me/review-counts', async (req, res) => {
  if (!requireDb(res)) return;
  const user = await userOrFail(req, res);
  if (!user) return;

  try {
    const r = await query(
      `SELECT cr.deck_id, count(*)::int AS n
       FROM card_reviews cr
       JOIN decks d ON d.id = cr.deck_id
       WHERE cr.user_id = $1
         AND d.deleted_at IS NULL
         AND (d.owner_id = $1 OR (d.is_public = TRUE AND d.removed_by_admin = FALSE))
       GROUP BY cr.deck_id`,
      [user.id]
    );
    const counts = {};
    for (const row of r.rows) counts[row.deck_id] = row.n;
    res.json({ counts });
  } catch (e) {
    console.error('[reviews counts] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
