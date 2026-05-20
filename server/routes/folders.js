// Rotas de pastas pessoais.
// Pasta é um label do dono — não compartilhável, não pública.

const { Router } = require('express');
const { query, isAvailable } = require('../db');

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME_LEN = 80;

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

// ---------- GET /api/folders ----------
// Lista pastas do user atual. Sem user → [].
router.get('/', async (req, res) => {
  if (!requireDb(res)) return;
  if (!req.user) return res.json([]);
  try {
    const r = await query(
      `SELECT f.id, f.name, f.created_at,
              (SELECT count(*)::int FROM decks d
               WHERE d.folder_id = f.id AND d.deleted_at IS NULL) AS deck_count
       FROM folders f
       WHERE f.owner_id = $1
       ORDER BY f.created_at ASC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error('[folders list] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- POST /api/folders ----------
// Body: { name }
router.post('/', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;

  const name = trimStr((req.body || {}).name, MAX_NAME_LEN);
  if (!name) return res.status(400).json({ error: 'name_required' });

  try {
    const r = await query(
      `INSERT INTO folders (owner_id, name) VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [req.user.id, name]
    );
    res.status(201).json({ ...r.rows[0], deck_count: 0 });
  } catch (e) {
    console.error('[folders create] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- PATCH /api/folders/:id ----------
// Renomear. Só dono.
router.patch('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  const name = trimStr((req.body || {}).name, MAX_NAME_LEN);
  if (!name) return res.status(400).json({ error: 'name_required' });

  try {
    const r = await query(
      `UPDATE folders SET name = $1 WHERE id = $2 AND owner_id = $3
       RETURNING id, name, created_at`,
      [name, id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('[folders patch] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ---------- DELETE /api/folders/:id ----------
// Deleta pasta. Decks DENTRO viram folder_id = NULL (graças ao FK ON DELETE SET NULL).
router.delete('/:id', async (req, res) => {
  if (!requireDb(res)) return;
  if (!requireUser(req, res)) return;
  const id = req.params.id;
  if (!isUuid(id)) return res.status(404).json({ error: 'not_found' });

  try {
    const r = await query(
      'DELETE FROM folders WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[folders delete] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
