// Hooks de debug pra QA. Expostos em window.__flashyDebug.
//
// Uso típico no console:
//   window.__flashyDebug.resetStats()
//   window.__flashyDebug.grantMedal('combo_10')
//   window.__flashyDebug.fastForwardDay(3)
//   window.__flashyDebug.fireMedal('combo_25')   // só visual, não persiste
//
// Só ativos com `localStorage.setItem('flashy:debug', '1')` OU em hostname localhost.

import { emit } from './events.js';
import { refresh } from './stats.js';
import { getMedalMeta } from './medals.js';

function isDebugEnabled() {
  if (typeof window === 'undefined') return false;
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return true;
  try { return localStorage.getItem('flashy:debug') === '1'; } catch { return false; }
}

export function installDebugHooks() {
  if (!isDebugEnabled()) return;
  const hooks = {
    async resetStats() {
      const r = await fetch('/api/dev/reset-stats', {
        method: 'POST', credentials: 'include'
      });
      if (r.ok) { await refresh(); console.log('[debug] stats reset'); }
      else console.warn('[debug] reset failed:', r.status);
    },
    async grantMedal(code) {
      const r = await fetch('/api/dev/grant-medal', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      if (r.ok) { await refresh(); console.log('[debug] medal granted:', code); }
      else console.warn('[debug] grant failed:', r.status);
    },
    fireMedal(code) {
      const m = getMedalMeta(code);
      if (m) emit('medalEarned', m);
      else console.warn('[debug] medal not found:', code);
    },
    async fastForwardDay(days = 1) {
      const r = await fetch('/api/dev/fast-forward', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days })
      });
      if (r.ok) { await refresh(); console.log('[debug] fast-forwarded', days, 'days'); }
      else console.warn('[debug] ff failed:', r.status);
    }
  };
  window.__flashyDebug = hooks;
  console.log('[debug] window.__flashyDebug available');
}
