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
 * toast(message, { kind?: 'success' | 'error' | 'info' (default), durationMs?, action? })
 *
 * - `action`: { label: string, onClick: () => void } — renderiza botão à
 *   direita do texto. Clicar dispara `onClick` E fecha o toast. Quando há
 *   action, `durationMs` default sobe pra 4000 (mais tempo pra clicar).
 *
 * Retorna função `dismiss()` pra fechar manualmente.
 */
export function toast(message, opts = {}) {
  const { kind = 'info', action } = opts;
  const durationMs = opts.durationMs != null ? opts.durationMs : (action ? 4000 : 3000);
  const root = ensureHost();

  const t = el('div', { class: `toast toast-${kind}` });

  // Texto sempre vem primeiro. Aceita string ou Element.
  const text = el('span', { class: 'toast-text' });
  if (typeof message === 'string') text.textContent = message;
  else if (message != null) text.appendChild(message);
  t.appendChild(text);

  let cancelled = false;
  let timerId = null;

  const remove = () => {
    if (cancelled) return;
    cancelled = true;
    if (timerId) { clearTimeout(timerId); timerId = null; }
    t.classList.remove('toast-visible');
    t.classList.add('toast-leaving');
    setTimeout(() => { try { root.removeChild(t); } catch {} }, 220);
  };

  if (action && typeof action.label === 'string' && typeof action.onClick === 'function') {
    const btn = el('button', {
      class: 'toast-action',
      attrs: { type: 'button' },
      onClick: (e) => {
        e.preventDefault();
        try { action.onClick(); } catch (err) { console.error(err); }
        remove();
      }
    }, [action.label]);
    t.appendChild(btn);
  }

  root.appendChild(t);
  // anima entrada
  requestAnimationFrame(() => t.classList.add('toast-visible'));
  timerId = setTimeout(remove, durationMs);
  return remove; // permite cancelar
}
