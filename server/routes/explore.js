// GET /api/explore — listagem de decks públicos.
// Query params:
//   sort:  'popular' | 'recent'   (default: 'popular')
//   q:     string (ILIKE em name)
//   page:  1-based (default 1)
//
// Page size: 20.
//
// Filtro por idioma ainda não exposto aqui (decks têm lang_front/lang_back
// persistidos desde a sprint de áudio — basta acrescentar WHERE quando virar
// necessidade de produto).

const { Router } = require('express');
const { query, isAvailable } = require('../db');

const router = Router();

const PAGE_SIZE = 20;

router.get('/', async (req, res) => {
  if (!isAvailable()) return res.status(503).json({ error: 'db_unavailable' });

  const sort = (req.query.sort === 'recent') ? 'recent' : 'popular';
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const q = rawQ.length > 0 && rawQ.length <= 100 ? rawQ : '';
  let page = parseInt(req.query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 500) page = 500; // cap defensivo
  const offset = (page - 1) * PAGE_SIZE;

  const params = [];
  let whereExtra = '';
  if (q) {
    params.push(`%${q.replace(/[\\%_]/g, m => '\\' + m)}%`);
    whereExtra = ` AND d.name ILIKE $${params.length} ESCAPE '\\'`;
  }

  // popular = mais clones primeiro (subquery em source_deck_id).
  const orderClause = sort === 'recent'
    ? 'd.created_at DESC'
    : 'clone_count DESC, d.created_at DESC';

  params.push(PAGE_SIZE);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  try {
    // Inclui sempre clone_count e card_count.
    const sql = `
      SELECT d.id, d.owner_id, d.name, d.is_public, d.folder_id, d.created_at, d.updated_at,
             d.records, d.source_deck_id, d.cloned_at,
             (SELECT count(*)::int FROM decks c WHERE c.source_deck_id = d.id AND c.deleted_at IS NULL) AS clone_count,
             (SELECT count(*)::int FROM cards cc WHERE cc.deck_id = d.id) AS card_count
      FROM decks d
      WHERE d.deleted_at IS NULL
        AND d.is_public = TRUE
        AND d.removed_by_admin = FALSE
        ${whereExtra}
      ORDER BY ${orderClause}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;
    const r = await query(sql, params);

    const items = r.rows.map(row => ({
      id: row.id,
      name: row.name,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cloneCount: row.clone_count,
      cardCount: row.card_count,
      ownerId: row.owner_id, // exposto sem identificação humana — é só UUID
      isMine: req.user && row.owner_id === req.user.id,
      sourceDeckId: row.source_deck_id,
      clonedAt: row.cloned_at
    }));

    res.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      sort,
      q: q || undefined,
      hasMore: items.length === PAGE_SIZE
    });
  } catch (e) {
    console.error('[explore] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
