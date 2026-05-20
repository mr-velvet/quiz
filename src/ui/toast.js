// Toast bottom-center, fade out 3s. Sem alert() do browser.

import { el } from '../core/util.js';

let host = null;

function ensureHost() {
  if (host && host.isConnected) return host;
  host = el('div', { class: 'toast-host' });
  document.body.appendChild(host);
  return host;
}

/**
 * toast(message, { kind?: 'success' | 'error' | 'info' (default), durationMs? })
 */
export function toast(message, { kind = 'info', durationMs = 3000 } = {}) {
  const root = ensureHost();
  const t = el('div', { class: `toast toast-${kind}` }, [message]);
  root.appendChild(t);
  // anima entrada
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  const remove = () => {
    t.classList.remove('toast-visible');
    t.classList.add('toast-leaving');
    setTimeout(() => { try { root.removeChild(t); } catch {} }, 220);
  };
  setTimeout(remove, durationMs);
  return remove; // permite cancelar
}
