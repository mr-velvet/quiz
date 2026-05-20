// Áudio de gamificação. Lazy load. Pool de 3 por som pra overlap (speed mode).
//
// Preferências em localStorage (única exceção a "tudo no backend"):
//   flashy:sfx-muted   '1' | '0'
//   flashy:sfx-volume  '0.0' .. '1.0'
//
// Default: ON em desktop, OFF em mobile (PRODUCT §4.11 / DECISIONS round 2).

const SOUNDS = {
  correct:  '/sounds/correct.wav',
  wrong:    '/sounds/wrong.wav',
  combo5:   '/sounds/combo5.wav',
  combo10:  '/sounds/combo10.wav',
  combo20:  '/sounds/combo20.wav',
  levelUp:  '/sounds/level-up.wav',
  medal:    '/sounds/medal.wav',
  record:   '/sounds/record.wav',
  finish:   '/sounds/finish.wav'
};

const POOL_SIZE = 3;
const pools = new Map(); // key -> Audio[]
const poolIdx = new Map(); // key -> number

const VOL_KEY = 'flashy:sfx-volume';
const MUTE_KEY = 'flashy:sfx-muted';

function isMobile() {
  try { return window.matchMedia('(pointer:coarse)').matches; } catch { return false; }
}

function defaultMuted() {
  return isMobile() ? '1' : '0';
}

function loadVolume() {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw === null) return 0.6;
    const v = parseFloat(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6;
  } catch { return 0.6; }
}

function loadMuted() {
  try {
    const raw = localStorage.getItem(MUTE_KEY);
    if (raw === null) {
      localStorage.setItem(MUTE_KEY, defaultMuted());
      return defaultMuted() === '1';
    }
    return raw === '1';
  } catch { return false; }
}

let volume = loadVolume();
let muted = loadMuted();

function ensurePool(key) {
  if (pools.has(key)) return pools.get(key);
  const src = SOUNDS[key];
  if (!src) return null;
  const arr = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const a = new Audio(src);
    a.preload = 'auto';
    a.volume = volume;
    arr.push(a);
  }
  pools.set(key, arr);
  poolIdx.set(key, 0);
  return arr;
}

export function play(key) {
  if (muted) return;
  const pool = ensurePool(key);
  if (!pool) return;
  const idx = poolIdx.get(key);
  const a = pool[idx];
  poolIdx.set(key, (idx + 1) % pool.length);
  try {
    a.currentTime = 0;
    a.volume = volume;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => {}); // autoplay bloqueado → silêncio
  } catch {}
}

export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
}

export function isMuted() { return muted; }
export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(VOL_KEY, String(volume)); } catch {}
  for (const arr of pools.values()) {
    for (const a of arr) a.volume = volume;
  }
}

export function getVolume() { return volume; }

// Preload básico no boot (só correct/wrong — os mais frequentes).
export function preload() {
  ensurePool('correct');
  ensurePool('wrong');
}
