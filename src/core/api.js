// REST client pro backend Flashy.
// Wrapper fino sobre fetch — sempre `credentials: 'include'` (cookie flashy_aid),
// sempre JSON.
//
// Convenção de erros: lança `ApiError { status, code, message, data }`.
// Quem chama decide se renderiza toast, 404-redirect, etc.

const BASE = '/api';

export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message || code || `HTTP ${status}`);
    this.status = status;
    this.code = code || null;
    this.data = data || null;
  }
}

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch (netErr) {
    throw new ApiError(0, 'network', 'Sem conexão.');
  }

  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch {}
  }

  if (!res.ok) {
    const code = data && data.error ? data.error : null;
    throw new ApiError(res.status, code, code || `HTTP ${res.status}`, data);
  }
  return data;
}

// ---------- Identidade ----------
export function me() {
  return request('GET', '/me');
}

// ---------- Decks ----------
export function listDecks() {
  return request('GET', '/decks');
}

export function getDeck(id) {
  return request('GET', `/decks/${encodeURIComponent(id)}`);
}

export function createDeck({ name, cards = [], isPublic = true, folderId = null }) {
  return request('POST', '/decks', {
    name,
    cards,
    is_public: isPublic,
    folder_id: folderId
  });
}

export function patchDeck(id, fields) {
  // fields: { name?, isPublic?, folderId?, langFront?, langBack? }
  const body = {};
  if (fields.name !== undefined) body.name = fields.name;
  if (fields.isPublic !== undefined) body.is_public = fields.isPublic;
  if (fields.folderId !== undefined) body.folder_id = fields.folderId;
  if (fields.langFront !== undefined) body.lang_front = fields.langFront;
  if (fields.langBack !== undefined) body.lang_back = fields.langBack;
  return request('PATCH', `/decks/${encodeURIComponent(id)}`, body);
}

export function deleteDeck(id) {
  return request('DELETE', `/decks/${encodeURIComponent(id)}`);
}

export function cloneDeck(id) {
  return request('POST', `/decks/${encodeURIComponent(id)}/clone`);
}

export function addCards(deckId, cards) {
  return request('POST', `/decks/${encodeURIComponent(deckId)}/cards`, { cards });
}

export function reportDeck(id, reason, detail) {
  return request('POST', `/decks/${encodeURIComponent(id)}/report`, { reason, detail });
}

// ---------- Cards ----------
export function patchCard(id, fields) {
  const body = {};
  if (fields.front !== undefined) body.front = fields.front;
  if (fields.back !== undefined) body.back = fields.back;
  return request('PATCH', `/cards/${encodeURIComponent(id)}`, body);
}

export function setCardAudio(id, side, audio) {
  return request('POST', `/cards/${encodeURIComponent(id)}/audio`, { side, audio });
}

export function recordCardResult(id, correct) {
  return request('POST', `/cards/${encodeURIComponent(id)}/result`, { correct: !!correct });
}

// ---------- Explore ----------
export function explore({ sort = 'popular', q = '', page = 1 } = {}) {
  const params = new URLSearchParams();
  if (sort) params.set('sort', sort);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return request('GET', `/explore${qs ? '?' + qs : ''}`);
}

// ---------- Folders ----------
export function listFolders() {
  return request('GET', '/folders');
}

export function createFolder(name) {
  return request('POST', '/folders', { name });
}

export function patchFolder(id, fields) {
  return request('PATCH', `/folders/${encodeURIComponent(id)}`, fields);
}

export function deleteFolder(id) {
  return request('DELETE', `/folders/${encodeURIComponent(id)}`);
}
