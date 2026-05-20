// GET /api/me — retorna user atual. Se não tem cookie, cria lazy.

const { Router } = require('express');
const { ensureUser } = require('../auth');
const { isAvailable } = require('../db');

const router = Router();

router.get('/', async (req, res) => {
  if (!isAvailable()) return res.status(503).json({ error: 'db_unavailable' });
  try {
    const user = await ensureUser(req, res);
    if (!user) return res.status(503).json({ error: 'db_unavailable' });
    res.json({ id: user.id, kind: user.kind });
  } catch (e) {
    console.error('[me] error:', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
