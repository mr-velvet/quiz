// Cache em memória + sync com backend da lista de revisão.
// Modelo: por (user, deck) existe uma lista de card_ids marcados.
//
// API:
//   - ensureDeckList(deckId): garante que o cache local pra esse deck tá em sync.
//   - isMarked(deckId, cardId): leitura síncrona (após ensureDeckList).
//   - getDeckCount(deckId): contagem síncrona.
//   - getDeckCardIds(deckId): Set<string> síncrono.
//   - addLocal(deckId, cardId) / removeLocal(deckId, cardId): mutações otimistas.
//   - markCard(deckId, cardId, source?) → Promise — POST + cache update.
//   - unmarkCard(deckId, cardId) → Promise — DELETE + cache update.
//
// Emite evento `flashy:review-change` no window quando muda — listeners podem
// reagir (ex: CTA do deck atualiza contador).

import * as api from './api.js';

// Map<deckId, Set<cardId>>
const cache = new Map();
// Map<deckId, Promise> pra deduplicar fetches em vôo.
const inFlight = new Map();

function emitChange(deckId) {
  try {
    window.dispatchEvent(new CustomEvent('flashy:review-change', { detail: { deckId } }));
  } catch {}
}

export async function ensureDeckList(deckId) {
  if (!deckId) return new Set();
  if (cache.has(deckId)) return cache.get(deckId);
  if (inFlight.has(deckId)) return inFlight.get(deckId);

  const p = api.fetchDeckReviewCards(deckId)
    .then(res => {
      const set = new Set((res && res.cards) ? res.cards.map(c => c.id) : []);
      cache.set(deckId, set);
      inFlight.delete(deckId);
      emitChange(deckId);
      return set;
    })
    .catch((err) => {
      inFlight.delete(deckId);
      // Em caso de erro, cache vazio (não quebra a UI).
      const empty = new Set();
      cache.set(deckId, empty);
      throw err;
    });

  inFlight.set(deckId, p);
  return p;
}

export function isMarked(deckId, cardId) {
  const set = cache.get(deckId);
  if (!set) return false;
  return set.has(cardId);
}

export function getDeckCount(deckId) {
  const set = cache.get(deckId);
  return set ? set.size : 0;
}

export function getDeckCardIds(deckId) {
  return cache.get(deckId) || new Set();
}

function addLocal(deckId, cardId) {
  let set = cache.get(deckId);
  if (!set) { set = new Set(); cache.set(deckId, set); }
  set.add(cardId);
  emitChange(deckId);
}

function removeLocal(deckId, cardId) {
  const set = cache.get(deckId);
  if (!set) return;
  set.delete(cardId);
  emitChange(deckId);
}

/**
 * markCard(deckId, cardId, source?) — otimista: marca local antes do request,
 * faz rollback se o servidor falhar com 4xx/5xx.
 *
 * Resolve com `true` em sucesso (incluindo no-op idempotente), reject em falha.
 */
export async function markCard(deckId, cardId, source) {
  if (!cardId) throw new Error('cardId obrigatório');
  const alreadyMarked = isMarked(deckId, cardId);
  if (!alreadyMarked) addLocal(deckId, cardId);
  try {
    await api.addCardToReview(cardId, deckId);
    return true;
  } catch (err) {
    // Rollback se a gente acabou de adicionar localmente.
    if (!alreadyMarked) removeLocal(deckId, cardId);
    throw err;
  }
}

export async function unmarkCard(deckId, cardId) {
  if (!cardId) throw new Error('cardId obrigatório');
  const wasMarked = isMarked(deckId, cardId);
  if (wasMarked) removeLocal(deckId, cardId);
  try {
    await api.removeCardFromReview(cardId);
    return true;
  } catch (err) {
    if (wasMarked) addLocal(deckId, cardId);
    throw err;
  }
}

// Helper de listener com cleanup automático no estilo do resto do projeto.
export function onReviewChange(listener) {
  const wrap = (e) => listener(e.detail || {});
  window.addEventListener('flashy:review-change', wrap);
  return () => window.removeEventListener('flashy:review-change', wrap);
}

// Invalidar o cache de um deck (forçar refetch na próxima leitura).
export function invalidate(deckId) {
  if (deckId) cache.delete(deckId);
  else cache.clear();
}
