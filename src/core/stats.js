// Cache em memória de user_stats + medalhas. Source-of-truth é o backend.
// Sincronizado no boot e após cada finish.

import { emit } from './events.js';

let cache = {
  xp_total: 0,
  level: 1,
  level_title: 'Iniciante',
  level_progress: { level: 1, xp: 0, xpInLevel: 0, xpForNext: 100, pct: 0, isCap: false },
  current_streak: 0,
  longest_streak: 0,
  last_active_date: null,
  totals: { sessions: 0, correct: 0, wrong: 0 },
  heatmap: [],
  loaded: false
};

let medalsCache = {
  all: [],
  earned_count: 0,
  total_count: 0,
  loaded: false
};

export function getStats() { return cache; }
export function getMedals() { return medalsCache; }
export function isLoaded() { return cache.loaded; }

export async function loadStats() {
  try {
    const res = await fetch('/api/me/stats', { credentials: 'include' });
    if (!res.ok) throw new Error('stats_failed');
    const data = await res.json();
    cache = { ...data, loaded: true };
    emit('statsChange', cache);
    return cache;
  } catch (e) {
    cache.loaded = true;
    return cache;
  }
}

export async function loadMedals() {
  try {
    const res = await fetch('/api/me/medals', { credentials: 'include' });
    if (!res.ok) throw new Error('medals_failed');
    const data = await res.json();
    medalsCache = { ...data, loaded: true };
    return medalsCache;
  } catch (e) {
    medalsCache.loaded = true;
    return medalsCache;
  }
}

// Chamado após cada finish. response = body de POST /sessions/:id/finish.
export function applyFinishResponse(finishResp) {
  if (!finishResp || !finishResp.stats) return;
  cache = {
    ...cache,
    xp_total: finishResp.stats.xp_total,
    level: finishResp.stats.level,
    current_streak: finishResp.stats.current_streak,
    longest_streak: finishResp.stats.longest_streak,
    last_active_date: finishResp.stats.last_active_date
  };
  // Não temos level_title aqui; refetch leve.
  emit('statsChange', cache);
  // Refetch full pra puxar heatmap atualizado.
  loadStats().catch(() => {});
  if (finishResp.new_medals && finishResp.new_medals.length) {
    // Atualiza catálogo
    loadMedals().catch(() => {});
  }
}

export async function refresh() {
  await Promise.all([loadStats(), loadMedals()]);
}

// Boot inicial. Chamado por main.js após bootstrap dos decks.
export async function bootStats() {
  await Promise.all([loadStats(), loadMedals()]);
}
