// Rotas de decks e cards.
//
// Regras:
// - Listagem só do user atual (sem user → []).
// - GET de deck individual: público vê só públicos não deletados; dono vê o seu.
// - Mutações: só dono. 404 quando privado-e-não-dono (não vazar existência).
// - Soft delete via deleted_at. Toda leitura filtra deleted_at IS NULL.
// - Clone: snapshot dos cards. Origem pode ser pública ou do próprio user.
// - Rate limit: anônimo 20/dia, logado 100/dia (por user).
// - Cap de 2000 cards por deck.

const { Router } = require('express');
const { query, withTx, isAvailable } = require('../db');
const { detectDeckLangs } = require('../langDetect');

const router = Router();

const MAX_CARDS_PER_DECK = 2000;
const MAX_CARDS_PER_ADD = 2000;
const MAX_NAME_LEN = 200;
const MAX_TEXT_LEN = 2000; // por lado de card

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function sanitizeCards(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const c of input) {
    if (!c || typeof c !== 'object') continue;
    const front = trimStr(c.front, MAX_TEXT_LEN);
    const back = trimStr(c.back, MAX_TEXT_LEN);
    if (!front || !back) continue;
    out.push({ front, back });
  }
  return out;
}

// Limite diário de criação. Considera tanto decks novos quanto clones.
async function checkRateLimit(userKind, userId) {
  const limit = userKind === 'logged' ? 100 : 20;
  const r = await query(
    "SELECT count(*)::int AS n FROM decks WHERE owner_id = $1 AND created_at > now() - interval '1 day'",
    [userId]
  );
  return r.rows[0].n < limit;
}

// Monta o objeto de deck (sem cards) com source attribution se houver e < 30 dias.
function mapDeckRow(row, currentUserId) {
  const isMine = currentUserId && row.owner_id === currentUserId;
  const out = {
    id: row.id,
    name: row.name,
    isPublic: row.is_public,
    folderId: row.folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    records: row.records || {},
    isMine: !!isMine,
    ownerId: isMine ? row.owner_id : undefined,
    sourceDeckId: row.source_deck_id,
    clonedAt: row.cloned_at,
    sourceName: row.source_name || undefined,
    cloneCount: row.clone_count != null ? Number(row.clone_count) : undefined,
    cardCount: row.card_count != null ? Number(row.card_count) : undefined,
    langFront: row.lang_front || null,
    langBack: row.lang_back || null
  };
  // Atribuição "baseado em X" só aparece por 30 dias após clone.
  if (row.cloned_at) {
    const ageMs = Date.now() - new Date(row.cloned_at).getTime();
    if (ageMs > 30 * 24 * 60 * 60 * 1000) {
      out.sourceName = undefined;
      out.sourceDeckId = null;
    }
  }
  return out;
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

// ---------- GET /api/decks ----------
// Lista decks do user atual. Sem user → [].
router.get('/', async (req, res) => {
  if (!requireDb(res)) return;
  if (!req.user) return res.json([]);
  try {
    const r = await query(
      `SELECT d.id, d.owner_id, d.name, d.is_public, d.folder_id, d.created_at, d.updated_at,
              d.records, d.source_deck_id, d.cloned_at, d.lang_front, d.lang_back,
              src.name AS source_name,
              (SELECT count(*) FROM cards c WHERE c.deck_id = d.id) AS card_count
       FROM decks d
       LEFT JOIN decks src ON src.id = d.source_deck_id
       WHERE d.owner_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows.map(row => mapDeckRow(row, req.user.id)));
  } catch (e) {
    console.error('[decks list] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/decks ----------
// Body: { name, cards?: [{front, back}], is_public?: bool, folder_id?: uuid }
router.post('/', async (req, res) => {
  if (!requireDb(res)) return;
  // attachUser já criou o user em mutações; req.user garantido.
  if (!requireUser(req, res)) return;

  const body = req.body || {};
  const name = trimStr(body.name, MAX_NAME_LEN);
  if (!name) return res.status(400).json({ error: 'name_required' });

  const cards = sanitizeCards(body.cards);
  if (cards.length > MAX_CARDS_PER_DECK) {
    return res.status(400).json({ error: 'too_many_cards', max: MAX_CARDS_PER_DECK });
  }

  const isPublic = body.is_public === undefined ? true : !!body.is_public;
  const folderId = body.folder_id || null;
  if (folderId && !isUuid(folderId)) return res.status(400).json({ error: 'invalid_folder_id' });

  try {
    if (!(await checkRateLimit(req.user.kind, req.user.id))) {
      return res.status(429).json({ error: 'rate_limit_decks_per_day' });
    }

    // Se folder_id informado, garantir que pertence ao user.
    if (folderId) {
      const f = await query('SELECT id FROM folders WHERE id = $1 AND owner_id = $2', [folderId, req.user.id]);
      if (!f.rows[0]) return res.status(400).json({ error: 'invalid_folder_id' });
    }

    const langs = cards.length ? detectDeckLangs(cards) : { front: null, back: null };

    const result = await withTx(async (client) => {
      const dr = await client.query(
        `INSERT INTO decks (owner_id, name, is_public, folder_id, lang_front, lang_back)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, owner_id, name, is_public, folder_id, created_at, updated_at, records, source_deck_id, cloned_at, lang_front, lang_back`,
        [req.user.id, name, isPublic, folderId, langs.front, langs.back]
      );
      const deck = dr.rows[0];
      if (cards.length) {
        const fronts = cards.map(c => c.front);
        const backs = cards.map(c => c.back);
        const positions = cards.map((_, i) => i);
        await client.query(
          `INSERT INTO cards (deck_id, front, back, position)
           SELECT $1, f, b, p
           FROM UNNEST($2::text[], $3::text[], $4::int[]) AS t(f, b, p)`,
          [deck.id, fronts, backs, positions]
        );
      }
      return deck;
    });

    const out = mapDeckRow(result, req.user.id);
    out.cards = []; // cliente pode pedir o deck cheio se quiser
    out.cardCount = cards.length;
    res.status(201).json(out);
  } catch (e) {
    console.error('[decks create] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/decks/:id ----------
// Visível se: público + não-deletado, OU dono.
router.get('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  try {
    const r = await query(
      `SELECT d.id, d.owner_id, d.name, d.is_public, d.folder_id, d.created_at, d.updated_at,
              d.records, d.source_deck_id, d.cloned_at, d.removed_by_admin,
              d.lang_front, d.lang_back,
              src.name AS source_name
       FROM decks d
       LEFT JOIN decks src ON src.id = d.source_deck_id
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [id]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'not_found' });

    const isOwner = req.user && row.owner_id === req.user.id;
    // Privado ou removido por admin: só dono vê. Pra outros, 404 (não vazar).
    if ((!row.is_public || row.removed_by_admin) && !isOwner) {
      return res.status(404).json({ error: 'not_found' });
    }

    const cardsR = await query(
      'SELECT id, front, back, position, audio, stats FROM cards WHERE deck_id = $1 ORDER BY position ASC',
      [id]
    );

    const deck = mapDeckRow(row, req.user && req.user.id);
    deck.cards = cardsR.rows.map(mapCardRow);
    deck.cardCount = cardsR.rows.length;
    res.json(deck);
  } catch (e) {
    console.error('[decks get] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- PATCH /api/decks/:id ----------
// Só dono. Campos: name, is_public, folder_id.
router.patch('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const body = req.body || {};
  const updates = [];
  const params = [];

  if (body.name !== undefined) {
    const name = trimStr(body.name, MAX_NAME_LEN);
    if (!name) return res.status(400).json({ error: 'name_required' });
    params.push(name); updates.push(`name = $${params.length}`);
  }
  if (body.is_public !== undefined) {
    params.push(!!body.is_public); updates.push(`is_public = $${params.length}`);
  }
  if (body.folder_id !== undefined) {
    if (body.folder_id !== null && !isUuid(body.folder_id)) {
      return res.status(400).json({ error: 'invalid_folder_id' });
    }
    if (body.folder_id) {
      const f = await query('SELECT id FROM folders WHERE id = $1 AND owner_id = $2', [body.folder_id, req.user.id]);
      if (!f.rows[0]) return res.status(400).json({ error: 'invalid_folder_id' });
    }
    params.push(body.folder_id || null); updates.push(`folder_id = $${params.length}`);
  }
  if (body.lang_front !== undefined) {
    const v = body.lang_front ? String(body.lang_front).slice(0, 5).toLowerCase() : null;
    params.push(v); updates.push(`lang_front = $${params.length}`);
  }
  if (body.lang_back !== undefined) {
    const v = body.lang_back ? String(body.lang_back).slice(0, 5).toLowerCase() : null;
    params.push(v); updates.push(`lang_back = $${params.length}`);
  }

  if (!updates.length) return res.status(400).json({ error: 'no_fields' });

  // updated_at sempre
  updates.push(`updated_at = now()`);

  try {
    // Verifica ownership + deck existe antes
    const ownerR = await query(
      'SELECT owner_id, removed_by_admin FROM decks WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    const owner = ownerR.rows[0];
    if (!owner) return res.status(404).json({ error: 'not_found' });
    if (owner.owner_id !== req.user.id) return res.status(404).json({ error: 'not_found' });
    // Deck removido por admin não pode voltar pra público.
    if (owner.removed_by_admin && body.is_public === true) {
      return res.status(403).json({ error: 'removed_by_admin' });
    }

    params.push(id);
    const r = await query(
      `UPDATE decks SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, owner_id, name, is_public, folder_id, created_at, updated_at, records, source_deck_id, cloned_at, lang_front, lang_back`,
      params
    );
    res.json(mapDeckRow(r.rows[0], req.user.id));
  } catch (e) {
    console.error('[decks patch] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- DELETE /api/decks/:id ----------
// Soft delete.
router.delete('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  try {
    const r = await query(
      `UPDATE decks SET deleted_at = now()
       WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[decks delete] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/decks/:id/clone ----------
// Qualquer user (cria lazy se anônimo). Origem precisa ser pública OU do próprio user.
router.post('/:id/clone', async (req, res) => {
  if (!requireDb(res)) return;
  // attachUser já criou o user em POST.
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  try {
    if (!(await checkRateLimit(req.user.kind, req.user.id))) {
      return res.status(429).json({ error: 'rate_limit_decks_per_day' });
    }

    const sr = await query(
      `SELECT id, owner_id, name, is_public, removed_by_admin, lang_front, lang_back
       FROM decks WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    const src = sr.rows[0];
    if (!src) return res.status(404).json({ error: 'not_found' });
    const isMine = src.owner_id === req.user.id;
    if (!isMine && (!src.is_public || src.removed_by_admin)) {
      return res.status(404).json({ error: 'not_found' });
    }

    // Conta cards pra validar limite (não deveria estourar, mas defensivo).
    const cntR = await query('SELECT count(*)::int AS n FROM cards WHERE deck_id = $1', [id]);
    if (cntR.rows[0].n > MAX_CARDS_PER_DECK) {
      return res.status(400).json({ error: 'too_many_cards' });
    }

    const cloned = await withTx(async (client) => {
      const dr = await client.query(
        `INSERT INTO decks (owner_id, name, is_public, source_deck_id, cloned_at, lang_front, lang_back)
         VALUES ($1, $2, TRUE, $3, now(), $4, $5)
         RETURNING id, owner_id, name, is_public, folder_id, created_at, updated_at, records, source_deck_id, cloned_at, lang_front, lang_back`,
        [req.user.id, src.name, src.id, src.lang_front, src.lang_back]
      );
      const newDeck = dr.rows[0];
      // Snapshot dos cards (front/back/position/audio — stats reseta).
      await client.query(
        `INSERT INTO cards (deck_id, front, back, position, audio)
         SELECT $1, front, back, position, audio FROM cards WHERE deck_id = $2`,
        [newDeck.id, src.id]
      );
      return newDeck;
    });

    const out = mapDeckRow({ ...cloned, source_name: src.name }, req.user.id);
    res.status(201).json(out);
  } catch (e) {
    console.error('[decks clone] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/decks/:id/cards ----------
// Adicionar cards. Só dono. Body: { cards: [{front, back}] }
router.post('/:id/cards', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const cards = sanitizeCards((req.body || {}).cards);
  if (!cards.length) return res.status(400).json({ error: 'no_cards' });
  if (cards.length > MAX_CARDS_PER_ADD) {
    return res.status(400).json({ error: 'too_many_cards', max: MAX_CARDS_PER_ADD });
  }

  try {
    const dr = await query(
      'SELECT id, lang_front, lang_back FROM decks WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL',
      [id, req.user.id]
    );
    if (!dr.rows[0]) return res.status(404).json({ error: 'not_found' });
    const deckRow = dr.rows[0];

    const cntR = await query('SELECT count(*)::int AS n, COALESCE(max(position), -1)::int AS lastpos FROM cards WHERE deck_id = $1', [id]);
    const existing = cntR.rows[0].n;
    if (existing + cards.length > MAX_CARDS_PER_DECK) {
      return res.status(400).json({ error: 'too_many_cards', max: MAX_CARDS_PER_DECK });
    }
    const startPos = cntR.rows[0].lastpos + 1;

    const fronts = cards.map(c => c.front);
    const backs = cards.map(c => c.back);
    const positions = cards.map((_, i) => startPos + i);

    const ir = await query(
      `INSERT INTO cards (deck_id, front, back, position)
       SELECT $1, f, b, p
       FROM UNNEST($2::text[], $3::text[], $4::int[]) AS t(f, b, p)
       RETURNING id, front, back, position, audio, stats`,
      [id, fronts, backs, positions]
    );

    if (!deckRow.lang_front || !deckRow.lang_back) {
      const langs = detectDeckLangs(cards);
      const newFront = deckRow.lang_front || langs.front;
      const newBack  = deckRow.lang_back  || langs.back;
      if (newFront || newBack) {
        await query(
          'UPDATE decks SET lang_front = COALESCE(lang_front, $2), lang_back = COALESCE(lang_back, $3), updated_at = now() WHERE id = $1',
          [id, newFront, newBack]
        );
      } else {
        await query('UPDATE decks SET updated_at = now() WHERE id = $1', [id]);
      }
    } else {
      await query('UPDATE decks SET updated_at = now() WHERE id = $1', [id]);
    }

    res.status(201).json({ cards: ir.rows.map(mapCardRow) });
  } catch (e) {
    console.error('[decks add cards] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/decks/:id/report ----------
// Body: { reason, detail? }. Qualquer um (anônimo inclusive). Não revela ao dono.
router.post('/:id/report', async (req, res) => {
  if (!requireDb(res)) return;
  // attachUser cria user lazy aqui também — assumimos req.user.
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const reason = trimStr((req.body || {}).reason, 80);
  if (!reason) return res.status(400).json({ error: 'reason_required' });
  const detail = trimStr((req.body || {}).detail, 1000) || null;

  try {
    const dr = await query(
      `SELECT id FROM decks WHERE id = $1 AND deleted_at IS NULL AND is_public = TRUE AND removed_by_admin = FALSE`,
      [id]
    );
    if (!dr.rows[0]) return res.status(404).json({ error: 'not_found' });

    await query(
      'INSERT INTO reports (deck_id, reporter_id, reason, detail) VALUES ($1, $2, $3, $4)',
      [id, req.user ? req.user.id : null, reason, detail]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('[decks report] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- GET /api/decks/:id/records ----------
// Atalho conveniente — devolve só os records do deck (sem cards). Só dono.
// (Não está na spec, removido pra não inflar.)

module.exports = router;
