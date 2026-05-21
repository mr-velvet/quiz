// Storage layer — agora backed por backend REST (server/routes/*),
// com cache em memória pra leituras síncronas (UI e games dependem disso).
//
// Mantém a API histórica usada por games/UI:
//   listDecks(), getDeck(id), createDeck(name, cards), addCards(deckId, cards),
//   saveDeck(deck), recordCardResult(deckId, cardId, correct),
//   recordGameScore(deckId, gameKey, score), parseImport(text, sep?),
//   seedIfEmpty() — NOOP (seeds vivem no backend agora).
//
// Diferença importante: getDeck() devolve do cache, então:
//   - Decks do user atual: já populados por bootstrap().
//   - Decks de outros (vindos de Explorar): populados quando o usuário clica
//     e abrimos detalhe — chamadores que ainda não têm em cache devem usar
//     `fetchDeck(id)` (assíncrono) antes.
//
// `flashy:change` continua sendo o canal de invalidação reativa.

import * as api from './api.js';

const MIGRATED_KEY = 'flashy:migrated_v1';
const LEGACY_KEY = 'flashy:v1';

const SEED_NAMES = new Set([
  'Capitais — América do Sul',
  'Vocabulário — Inglês ↔ Português'
]);

// ---------- Estado em memória ----------

// Cache de decks completos (com cards). Chave = deck.id.
const deckCache = new Map();
// Lista ordenada de IDs dos meus decks (do mais recente ao mais antigo).
let myDeckOrder = [];
// User atual ({ id, kind }) após bootstrap.
let currentUser = null;
// Cache de folders ({ id, name, deck_count }).
let foldersCache = [];

function emit() {
  window.dispatchEvent(new CustomEvent('flashy:change'));
}

// Normaliza deck vindo do backend pra forma usada pelo client.
// Backend manda: { id, name, isPublic, folderId, createdAt, updatedAt, records,
//                  isMine, ownerId?, sourceDeckId, sourceName?, clonedAt,
//                  cloneCount?, cardCount?, cards? }
function normalizeDeck(remote, existing) {
  const cards = Array.isArray(remote.cards)
    ? remote.cards.map(normalizeCard)
    : (existing && existing.cards) || [];
  return {
    id: remote.id,
    name: remote.name,
    createdAt: remote.createdAt || (existing && existing.createdAt) || Date.now(),
    updatedAt: remote.updatedAt || null,
    isPublic: remote.isPublic !== false,
    isMine: !!remote.isMine,
    ownerId: remote.ownerId || (existing && existing.ownerId) || null,
    folderId: remote.folderId || null,
    sourceDeckId: remote.sourceDeckId || null,
    sourceName: remote.sourceName || null,
    clonedAt: remote.clonedAt || null,
    cloneCount: remote.cloneCount != null ? remote.cloneCount : (existing && existing.cloneCount) || 0,
    cardCount: remote.cardCount != null ? remote.cardCount : cards.length,
    records: remote.records || (existing && existing.records) || {},
    cards
  };
}

function normalizeCard(c) {
  return {
    id: c.id,
    front: c.front,
    back: c.back,
    position: c.position,
    audio: c.audio || null,
    stats: c.stats || { correct: 0, wrong: 0, lastSeenAt: 0 }
  };
}

// ---------- Bootstrap ----------

// Garante user atual e popula caches. Chamado no boot pelo main.js.
export async function bootstrap() {
  try {
    currentUser = await api.me();
    // Espelha o id em localStorage como backup (cookie é fonte de verdade,
    // mas se cookie for limpo num cenário onde localStorage sobrevive, dá pra
    // tentar recuperar manualmente).
    if (currentUser && currentUser.id) {
      try { localStorage.setItem('flashy:aid', currentUser.id); } catch {}
    }
  } catch (e) {
    // Sem user: degrada pra estado vazio. Não bloqueia o app.
    currentUser = null;
  }

  await reloadDecks();
  try {
    foldersCache = await api.listFolders();
  } catch {
    foldersCache = [];
  }
  emit();
}

export function getCurrentUser() {
  return currentUser;
}

// Recarrega lista de decks do user atual. Mantém caches de decks visitados.
export async function reloadDecks() {
  try {
    const remote = await api.listDecks();
    myDeckOrder = remote.map(d => d.id);
    for (const d of remote) {
      // Lista não traz cards — preserva cards de cache se já tínhamos.
      const existing = deckCache.get(d.id);
      deckCache.set(d.id, normalizeDeck(d, existing));
    }
  } catch {
    myDeckOrder = [];
  }
}

// ---------- Migração localStorage ----------

// Lê o estado legado pra migrar pro backend na primeira vez.
function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function migrateLocalStorageIfNeeded() {
  if (localStorage.getItem(MIGRATED_KEY)) return { skipped: 'already_migrated' };
  const legacy = readLegacyState();
  if (!legacy || !legacy.decks) {
    localStorage.setItem(MIGRATED_KEY, 'true');
    return { skipped: 'no_legacy' };
  }
  const order = Array.isArray(legacy.order) && legacy.order.length
    ? legacy.order
    : Object.keys(legacy.decks);

  const migrated = [];
  const skipped = [];
  for (const id of order) {
    const d = legacy.decks[id];
    if (!d) continue;
    if (SEED_NAMES.has(d.name)) { skipped.push(d.name); continue; }
    const cards = (d.cards || [])
      .map(c => ({ front: c.front, back: c.back }))
      .filter(c => c.front && c.back);
    try {
      const created = await api.createDeck({ name: d.name, cards, isPublic: true });
      // Recarrega pra ter cards com IDs do backend e preservar audio quando houver.
      try {
        const full = await api.getDeck(created.id);
        // Mapeia audio dos cards legados pelos cards do backend, pareando por (front, back).
        const audioByPair = new Map();
        for (const c of (d.cards || [])) {
          if (c.audio) audioByPair.set(`${c.front}\x1f${c.back}`, c.audio);
        }
        for (const remoteCard of (full.cards || [])) {
          const key = `${remoteCard.front}\x1f${remoteCard.back}`;
          const audio = audioByPair.get(key);
          if (audio && (audio.front || audio.back)) {
            for (const side of ['front', 'back']) {
              const entry = audio[side];
              if (entry && entry.url) {
                try { await api.setCardAudio(remoteCard.id, side, entry); } catch {}
              }
            }
          }
        }
      } catch {}
      migrated.push(d.name);
    } catch (e) {
      skipped.push(d.name + ' (erro)');
    }
  }
  localStorage.setItem(MIGRATED_KEY, 'true');
  // Mantém flashy:v1 como backup por 1 release (decisão de produto).
  return { migrated, skipped };
}

// ---------- API pública (compat games/UI) ----------

export function listDecks() {
  return myDeckOrder.map(id => deckCache.get(id)).filter(Boolean);
}

// Retorna deck do cache, ou null. Chamadores assíncronos devem usar fetchDeck().
export function getDeck(id) {
  return deckCache.get(id) || null;
}

// Versão assíncrona — busca do backend, atualiza cache. Útil pra detalhe do deck
// quando vem de Explorar (não estava no cache de "meus").
// NÃO emite por padrão: chamado a cada render do detalhe, emitir causa loop
// (onChange → render → fetchDeck → emit → onChange → ...).
// Mutations explícitas (create/delete/etc) emitem por conta própria.
export async function fetchDeck(id) {
  const remote = await api.getDeck(id);
  const existing = deckCache.get(id);
  const norm = normalizeDeck(remote, existing);
  deckCache.set(id, norm);
  // Se passou a ser meu (clone, etc.) e ainda não está na order, registra
  // — só emite se a order mudou de verdade (evita loop em detalhe).
  if (norm.isMine && !myDeckOrder.includes(id)) {
    myDeckOrder = [id, ...myDeckOrder];
    emit();
  }
  return norm;
}

export function listFolders() {
  return foldersCache.slice();
}

export async function reloadFolders() {
  try { foldersCache = await api.listFolders(); }
  catch { foldersCache = []; }
  emit();
  return foldersCache;
}

export async function createFolder(name) {
  const f = await api.createFolder(name);
  foldersCache = [...foldersCache, { ...f, deck_count: 0 }];
  emit();
  return f;
}

export async function renameFolder(id, name) {
  const f = await api.patchFolder(id, { name });
  foldersCache = foldersCache.map(x => x.id === id ? { ...x, name: f.name } : x);
  emit();
  return f;
}

export async function deleteFolder(id) {
  await api.deleteFolder(id);
  foldersCache = foldersCache.filter(x => x.id !== id);
  // Decks que estavam nessa pasta viram folder_id=null — recarrega lista.
  await reloadDecks();
  emit();
}

// Cria deck. Aceita assinatura legada `createDeck(name, cards)` E nova `createDeck({...})`.
// Retorna o deck completo (com cards).
export async function createDeck(nameOrOpts, cards) {
  const opts = (typeof nameOrOpts === 'object' && nameOrOpts !== null)
    ? nameOrOpts
    : { name: nameOrOpts, cards: cards || [] };
  const created = await api.createDeck({
    name: opts.name,
    cards: opts.cards || [],
    isPublic: opts.isPublic !== undefined ? opts.isPublic : true,
    folderId: opts.folderId || null
  });
  // Backend só devolve metadados em POST (sem cards). Refaz GET pra trazer cards.
  let full;
  try { full = await api.getDeck(created.id); }
  catch { full = created; }
  const norm = normalizeDeck(full);
  deckCache.set(norm.id, norm);
  if (!myDeckOrder.includes(norm.id)) myDeckOrder = [norm.id, ...myDeckOrder];
  emit();
  return norm;
}

export async function deleteDeck(id) {
  await api.deleteDeck(id);
  deckCache.delete(id);
  myDeckOrder = myDeckOrder.filter(x => x !== id);
  emit();
}

export async function renameDeck(id, name) {
  const updated = await api.patchDeck(id, { name });
  const existing = deckCache.get(id);
  deckCache.set(id, normalizeDeck(updated, existing));
  emit();
}

export async function setDeckVisibility(id, isPublic) {
  const updated = await api.patchDeck(id, { isPublic });
  const existing = deckCache.get(id);
  deckCache.set(id, normalizeDeck(updated, existing));
  emit();
}

export async function moveDeckToFolder(id, folderId) {
  const updated = await api.patchDeck(id, { folderId });
  const existing = deckCache.get(id);
  deckCache.set(id, normalizeDeck(updated, existing));
  // Atualiza contagem de pastas.
  reloadFolders().catch(() => {});
  emit();
}

export async function addCards(deckId, cards) {
  const r = await api.addCards(deckId, cards);
  const deck = deckCache.get(deckId);
  if (deck) {
    deck.cards = [...deck.cards, ...(r.cards || []).map(normalizeCard)];
    deck.cardCount = deck.cards.length;
    deckCache.set(deckId, deck);
  }
  emit();
}

export async function cloneDeck(id) {
  const cloned = await api.cloneDeck(id);
  // Backend não devolve cards do clone — refetch.
  const full = await api.getDeck(cloned.id);
  const norm = normalizeDeck(full);
  deckCache.set(norm.id, norm);
  if (!myDeckOrder.includes(norm.id)) myDeckOrder = [norm.id, ...myDeckOrder];
  emit();
  return norm;
}

// Salva mutação local de card.audio (legado — TTS chamava saveDeck pra cachear URL).
// Agora: identifica diff vs cache e dispara setCardAudio pros que mudaram.
// Mantida pra compat se algo no client ainda chamar — mas audio.js já foi migrado
// pra chamar `setCardAudio` direto.
export async function saveDeck(deck) {
  if (!deck || !deck.id) return;
  const remote = deckCache.get(deck.id);
  if (!remote) return;
  for (const card of deck.cards || []) {
    if (!card.audio) continue;
    const remoteCard = remote.cards.find(c => c.id === card.id);
    if (!remoteCard) continue;
    for (const side of ['front', 'back']) {
      const a = card.audio[side];
      const ra = remoteCard.audio && remoteCard.audio[side];
      if (a && a.url && (!ra || ra.url !== a.url)) {
        try { await api.setCardAudio(card.id, side, a); } catch {}
        remoteCard.audio = { ...(remoteCard.audio || {}), [side]: a };
      }
    }
  }
  deckCache.set(deck.id, remote);
  emit();
}

// Compat com games: chama backend, atualiza cache otimisticamente.
// Backend POST /api/cards/:id/result só aceita se user é dono do deck.
// Pra evitar 404 ruído em deck público de outro user, só dispara API se isMine.
export function recordCardResult(deckId, cardId, correct) {
  const deck = deckCache.get(deckId);
  let isMine = false;
  if (deck) {
    isMine = !!deck.isMine;
    const card = deck.cards.find(c => c.id === cardId);
    if (card) {
      if (!card.stats) card.stats = { correct: 0, wrong: 0, lastSeenAt: 0 };
      if (correct) card.stats.correct++;
      else card.stats.wrong++;
      card.stats.lastSeenAt = Date.now();
    }
  }
  if (!isMine) return; // deck público de outro user — não tenta gravar stats per-card
  api.recordCardResult(cardId, correct).catch(() => {});
}

// `records` é por-deck. Backend tem coluna JSONB `records` mas só dono escreve.
// PATCH não suporta — mantemos otimista no cache só. (Persistência fica pra sprint
// futura quando ranking entrar.) Mantemos a função pra não quebrar os jogos.
export function recordGameScore(deckId, gameKey, score) {
  const deck = deckCache.get(deckId);
  if (!deck) return;
  if (!deck.records) deck.records = {};
  const prev = deck.records[gameKey];
  if (gameKey === 'match') {
    if (!prev || score.timeMs < prev.timeMs) deck.records[gameKey] = { ...score, at: Date.now() };
  } else if (gameKey === 'speed') {
    if (!prev || score.correct > prev.correct) deck.records[gameKey] = { ...score, at: Date.now() };
  } else {
    deck.records[gameKey] = { ...score, at: Date.now() };
  }
  emit();
}

// Parse texto importado em uma estrutura intermediária (linhas x colunas).
// Use parseImportTable() pra ter acesso a todas as colunas; use parseImport()
// pra retorno simplificado de cartas (front/back) já materializadas.
//
// `sepHint`: 'auto' | '\t' | ',' | ';' | ' - '
// Em 'auto', a primeira linha não vazia escolhe o separador.
export function detectSeparator(text) {
  if (!text) return '\t';
  const sample = (text.split(/\r?\n/).find(l => l.trim()) || '');
  if (sample.includes('\t')) return '\t';
  if (sample.includes(';')) return ';';
  if (/ - /.test(sample)) return ' - ';
  if (sample.includes(',')) return ',';
  return '\t';
}

export function parseImportTable(text, sepHint = 'auto') {
  if (!text) return { sep: '\t', rows: [], colCount: 0 };
  const lines = text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
  if (!lines.length) return { sep: '\t', rows: [], colCount: 0 };

  const sep = sepHint === 'auto' ? detectSeparator(text) : sepHint;
  let colCount = 0;
  const rows = lines.map(line => {
    const cells = line.split(sep).map(c => c.trim());
    if (cells.length > colCount) colCount = cells.length;
    return cells;
  });
  return { sep, rows, colCount };
}

// Mantém API histórica. Aceita sepHint OU objeto { sep, frontCol, backCol }.
export function parseImport(text, opts = 'auto') {
  if (!text) return [];
  const cfg = typeof opts === 'string' ? { sep: opts } : (opts || {});
  const { sep = 'auto', frontCol = 0, backCol = 1 } = cfg;
  const { rows } = parseImportTable(text, sep);
  const cards = [];
  for (const cells of rows) {
    const front = (cells[frontCol] || '').trim();
    const back = (cells[backCol] || '').trim();
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

// Seeds agora vivem no backend (migração SQL). Mantida como NOOP pra compat.
export function seedIfEmpty() { /* noop */ }

export function exportAll() {
  return JSON.stringify({
    user: currentUser,
    decks: Object.fromEntries(deckCache.entries()),
    order: myDeckOrder,
    folders: foldersCache
  }, null, 2);
}
