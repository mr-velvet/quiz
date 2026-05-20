// Toast de medalha desbloqueada. Empilha fila (max 3 visíveis simultâneos),
// resto consolidado em 1 banner "+N medalhas".
//
// Disparado por evento 'medalEarned'. Dedupa por code dentro da mesma sessão
// (anticipated + server).

import { el } from '../core/util.js';
import { onKind } from '../core/events.js';
import { getMedalMeta } from '../core/medals.js';

const MAX_VISIBLE = 3;
const SHOWN_MS = 3000;

let host = null;
const visible = []; // {code, node, timer}
const queue = [];
const seenThisSession = new Set();

export function mountMedalToast(parent) {
  if (host) return host;
  host = el('div', { class: 'medal-toast-host' });
  parent.appendChild(host);

  onKind('medalEarned', (p) => {
    if (!p || !p.code) return;
    if (seenThisSession.has(p.code)) return; // dedupa
    seenThisSession.add(p.code);
    enqueue(p.code);
  });
  // Limpa "seen" no início de cada nova sessão pra não acumular pra sempre.
  onKind('sessionStart', () => { seenThisSession.clear(); });

  return host;
}

function enqueue(code) {
  if (visible.length < MAX_VISIBLE) {
    showOne(code);
  } else {
    queue.push(code);
    refreshConsolidated();
  }
}

function showOne(code) {
  const meta = getMedalMeta(code);
  if (!meta) return;
  const node = el('div', {
    class: `medal-toast medal-tier-${meta.tier}`,
    attrs: { 'data-testid': `medal-toast-${code}`, role: 'alert' }
  }, [
    el('div', { class: 'medal-toast-icon' }, [meta.icon || '🏅']),
    el('div', { class: 'medal-toast-body' }, [
      el('div', { class: 'medal-toast-title' }, ['Medalha desbloqueada']),
      el('div', { class: 'medal-toast-name' }, [meta.name]),
      el('div', { class: 'medal-toast-desc' }, [meta.description])
    ])
  ]);
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('medal-toast-visible'));
  const entry = { code, node, timer: null };
  visible.push(entry);
  entry.timer = setTimeout(() => dismiss(entry), SHOWN_MS);
}

function dismiss(entry) {
  if (entry.timer) clearTimeout(entry.timer);
  entry.node.classList.add('medal-toast-leaving');
  setTimeout(() => {
    entry.node.remove();
    const idx = visible.indexOf(entry);
    if (idx >= 0) visible.splice(idx, 1);
    if (queue.length) {
      const next = queue.shift();
      showOne(next);
      refreshConsolidated();
    }
  }, 220);
}

let consolidatedNode = null;
function refreshConsolidated() {
  if (queue.length === 0) {
    if (consolidatedNode) { consolidatedNode.remove(); consolidatedNode = null; }
    return;
  }
  if (!consolidatedNode) {
    consolidatedNode = el('div', { class: 'medal-toast medal-toast-bulk' }, [
      el('div', { class: 'medal-toast-icon' }, ['+']),
      el('div', { class: 'medal-toast-body' }, [
        el('div', { class: 'medal-toast-name' }, [`+${queue.length} medalhas`]),
        el('div', { class: 'medal-toast-desc' }, ['Ver tudo em /eu'])
      ])
    ]);
    host.appendChild(consolidatedNode);
    requestAnimationFrame(() => consolidatedNode.classList.add('medal-toast-visible'));
  } else {
    consolidatedNode.querySelector('.medal-toast-name').textContent = `+${queue.length} medalhas`;
  }
}
