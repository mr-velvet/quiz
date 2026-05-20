// Pool Postgres compartilhado. A plataforma did.lu injeta DATABASE_URL.
// Em dev local sem DATABASE_URL, o pool fica inerte e qualquer query lança erro claro.

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

let pool = null;

if (connectionString) {
  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error:', err.message);
  });
  console.log('[db] pool initialized');
} else {
  console.warn('[db] DATABASE_URL not set — DB endpoints will return 503');
}

async function query(text, params) {
  if (!pool) throw new Error('db_unavailable');
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const dur = Date.now() - start;
    if (dur > 250) console.warn(`[db] slow query ${dur}ms: ${text.slice(0, 80)}`);
    return res;
  } catch (e) {
    console.error(`[db] query error: ${e.message} | sql: ${text.slice(0, 120)}`);
    throw e;
  }
}

// Helper: roda fn dentro de uma transação. Útil pra clone (deck + N cards).
async function withTx(fn) {
  if (!pool) throw new Error('db_unavailable');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

function isAvailable() {
  return !!pool;
}

module.exports = { query, withTx, isAvailable };
