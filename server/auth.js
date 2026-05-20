// Middleware de identidade. Lê cookie flashy_aid → user.
// Cria user anônimo lazy em mutações (POST/PATCH/DELETE) quando não há cookie.
//
// req.user = { id, kind } quando existe identidade resolvida.
// req.user = null em GETs públicos sem cookie.
//
// Cookies:
//   nome:     flashy_aid
//   max-age:  10 anos
//   SameSite: Lax (queremos que sobreviva navegação interna mas não envio cross-site agressivo)
//   Secure:   em prod (req.secure ou X-Forwarded-Proto=https)
//   httpOnly: false — frontend também lê em localStorage redundante (decisão de produto)

const { query, isAvailable } = require('./db');

const COOKIE_NAME = 'flashy_aid';
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

// Regex simples pra validar UUID v4-ish (qualquer UUID na real — não validar versão).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isMutation(method) {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

function isSecureRequest(req) {
  if (req.secure) return true;
  const proto = (req.headers['x-forwarded-proto'] || '').toString().toLowerCase();
  return proto === 'https' || process.env.NODE_ENV === 'production';
}

function setAidCookie(res, req, aid) {
  res.cookie(COOKIE_NAME, aid, {
    maxAge: TEN_YEARS_MS,
    httpOnly: false,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/'
  });
}

async function findUserById(id) {
  const r = await query('SELECT id, kind FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function createAnonymousUser() {
  const r = await query(
    "INSERT INTO users (kind) VALUES ('anonymous') RETURNING id, kind"
  );
  return r.rows[0];
}

// Middleware principal. Anexa req.user e, em mutações sem aid, cria lazy.
async function attachUser(req, res, next) {
  if (!isAvailable()) {
    // DB indisponível: deixa req.user=null. Cada rota decide se quebra ou degrada.
    req.user = null;
    return next();
  }

  try {
    const raw = req.cookies ? req.cookies[COOKIE_NAME] : null;

    if (raw && UUID_RE.test(raw)) {
      const user = await findUserById(raw);
      if (user) {
        req.user = user;
        return next();
      }
      // Cookie aponta pra user que não existe (banco resetou, etc.). Tratar como novo.
    }

    if (isMutation(req.method)) {
      const fresh = await createAnonymousUser();
      setAidCookie(res, req, fresh.id);
      req.user = fresh;
      return next();
    }

    req.user = null;
    return next();
  } catch (e) {
    console.error('[auth] attachUser error:', e.message);
    req.user = null;
    return next();
  }
}

// Helper pra rotas que SEMPRE precisam de user (mesmo GET): força criação.
// Ex.: GET /api/me.
async function ensureUser(req, res) {
  if (req.user) return req.user;
  if (!isAvailable()) return null;
  const fresh = await createAnonymousUser();
  setAidCookie(res, req, fresh.id);
  req.user = fresh;
  return fresh;
}

module.exports = { attachUser, ensureUser, COOKIE_NAME };
