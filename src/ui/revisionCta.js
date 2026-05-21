// Bloco CTA "Revisar marcados (N)" na tela do deck.
//
// Comportamento:
//   - Fetch da contagem ao montar; esconde-se se N=0.
//   - Atualiza in-place quando `flashy:review-change` é disparado pro deck.
//   - Click abre picker de modo (modal) e navega pra rota de revisão.
//
// API:
//   revisionCta({ deck, onStart? }) → Element
//
// `onStart(mode)` opcional: se passado, é chamado em vez da navegação padrão.

import { el } from '../core/util.js';
import * as api from '../core/api.js';
import { ensureDeckList, getDeckCount, onReviewChange } from '../core/reviewList.js';
import { openModal } from './modal.js';
import { go } from './router.js';

const MODES = [
  { key: 'flashcards', icon: '🃏', title: 'Flashcards' },
  { key: 'multiple',   icon: '🎯', title: 'Múltipla escolha' },
  { key: 'write',      icon: '✏️', title: 'Escrever' },
  { key: 'match',      icon: '🧩', title: 'Match' },
  { key: 'speed',      icon: '⚡', title: 'Speed' }
];

function fmtN(n) {
  if (n >= 100) return '99+';
  return String(n);
}

export function revisionCta({ deck, onStart } = {}) {
  if (!deck) return el('span');
  const deckId = deck.id;

  // Container começa escondido até decidirmos se há cards.
  const wrap = el('div', { class: 'revision-cta hidden' });

  const counterEl = el('span', { class: 'revision-cta-counter' }, ['(0)']);
  const titleEl = el('div', { class: 'revision-cta-title' }, [
    el('span', { class: 'revision-cta-diamond' }, ['◆']),
    el('span', {}, [' Revisar marcados ']),
    counterEl
  ]);
  const subtitleEl = el('div', { class: 'revision-cta-subtitle' }, [
    'Sua lista pessoal de cartas nesse deck'
  ]);
  const startBtn = el('button', {
    class: 'btn btn-primary btn-sm',
    attrs: { type: 'button' }
  }, ['Iniciar →']);

  const inner = el('div', { class: 'revision-cta-inner' }, [
    el('div', { class: 'revision-cta-text' }, [titleEl, subtitleEl]),
    startBtn
  ]);
  wrap.appendChild(inner);

  function setCount(n) {
    counterEl.textContent = `(${fmtN(n)})`;
    if (n <= 0) wrap.classList.add('hidden');
    else wrap.classList.remove('hidden');
  }

  function refresh() {
    setCount(getDeckCount(deckId));
  }

  // 1) Tenta primeiro o endpoint leve de count (resposta menor).
  //    Depois (em segundo plano) carrega a lista completa pro cache, pra
  //    que os kebabs já saibam o estado on/off sem novo fetch.
  api.fetchDeckReviewCount(deckId).then(res => {
    setCount(res?.count || 0);
  }).catch(() => {});

  ensureDeckList(deckId).then(refresh).catch(() => {});

  const off = onReviewChange(({ deckId: changedDeckId }) => {
    if (changedDeckId === deckId) refresh();
  });
  // Limpa o listener se o nó for removido do DOM (best effort).
  const obs = new MutationObserver(() => {
    if (!wrap.isConnected) { off(); obs.disconnect(); }
  });
  // Observa o body — barato, e o nó pode ser removido por qualquer ancestral.
  setTimeout(() => {
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
  }, 0);

  function openPicker() {
    const count = getDeckCount(deckId);
    if (count <= 0) return;
    const grid = el('div', { class: 'mode-grid revision-mode-grid' });
    for (const m of MODES) {
      grid.appendChild(el('div', {
        class: 'mode-card',
        attrs: { 'data-testid': `revision-pick-${m.key}` },
        onClick: () => {
          // Fecha o modal (resolve com null e cleanup).
          document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
          if (onStart) onStart(m.key);
          else go(`/play/${deckId}/${m.key}?source=revision`);
        }
      }, [
        el('div', { class: 'mode-card-icon' }, [m.icon]),
        el('div', { class: 'mode-card-title' }, [m.title])
      ]));
    }
    openModal({
      title: `Treinar com ${count} carta${count === 1 ? '' : 's'} marcada${count === 1 ? '' : 's'}`,
      content: grid,
      actions: [
        { label: 'Cancelar', value: false }
      ]
    });
  }

  wrap.addEventListener('click', (e) => {
    // Só intercepta cliques no bloco em si — não em outros componentes (defensivo).
    if (e.target.closest('button') && e.target !== startBtn) return;
    e.preventDefault();
    openPicker();
  });
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPicker();
  });

  return wrap;
}
