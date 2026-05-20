// Overlay de combo no canto da tela durante o jogo.
// Aparece em combo >= 5, sai quando combo cai a 0.
// Não bloqueia clique nem leitura do card.

import { el } from '../core/util.js';
import { onKind } from '../core/events.js';

let host = null;
let textEl = null;
let multEl = null;
let prefersReducedMotion = false;

export function mountComboOverlay(parent) {
  if (host) return host;
  host = el('div', {
    class: 'combo-overlay',
    attrs: { 'data-testid': 'combo-overlay', 'aria-hidden': 'true' }
  }, [
    textEl = el('div', { class: 'combo-overlay-num' }, ['']),
    multEl = el('div', { class: 'combo-overlay-mult' }, [''])
  ]);
  parent.appendChild(host);

  try { prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}

  // Reactive a eventos
  onKind('correct', (p) => {
    const c = p.combo;
    if (c >= 5) show(c);
    else hide();
  });
  onKind('wrong', () => hide());
  onKind('sessionEnd', () => hide());
  onKind('sessionStart', () => hide());
  return host;
}

function multiplier(c) {
  if (c >= 30) return '×2.0';
  if (c >= 20) return '×1.75';
  if (c >= 10) return '×1.5';
  if (c >= 5)  return '×1.25';
  return '×1.0';
}

function tier(c) {
  if (c >= 30) return 'combo-30';
  if (c >= 20) return 'combo-20';
  if (c >= 10) return 'combo-10';
  if (c >= 5)  return 'combo-5';
  return '';
}

let pulseTimer = null;
function show(c) {
  if (!host) return;
  textEl.textContent = `Combo ${c}`;
  multEl.textContent = multiplier(c);
  host.classList.add('combo-overlay-visible');
  host.classList.remove('combo-5', 'combo-10', 'combo-20', 'combo-30');
  const t = tier(c);
  if (t) host.classList.add(t);
  if (!prefersReducedMotion) {
    host.classList.remove('combo-pulse');
    void host.offsetWidth; // force reflow
    host.classList.add('combo-pulse');
  }
  if (pulseTimer) clearTimeout(pulseTimer);
}

function hide() {
  if (!host) return;
  host.classList.remove('combo-overlay-visible');
}
