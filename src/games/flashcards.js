import { el } from '../core/util.js';
import { getDeck, recordCardResult } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';
import { shuffle } from '../core/util.js';

export function renderFlashcards(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length === 0) { go(`/deck/${deckId}`); return; }

  const cards = shuffle(deck.cards);
  let i = 0;
  let flipped = false;
  let known = 0, unknown = 0;

  root.appendChild(topbar({ showBack: true, title: `${deck.name} · Flashcards` }));

  const stage = el('div', { class: 'fc-stage' });
  root.appendChild(stage);

  function flip() {
    flipped = !flipped;
    rerender();
  }

  function answer(correct) {
    if (!flipped) {
      // Não dá pra responder sem ver o verso — flipa e avisa.
      flip();
      const card = stage.querySelector('.fc-card');
      if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
      }
      return;
    }
    recordCardResult(deckId, cards[i].id, correct);
    if (correct) known++; else unknown++;
    i++;
    flipped = false;
    rerender();
  }

  function rerender() {
    stage.innerHTML = '';
    if (i >= cards.length) {
      stage.appendChild(renderResult({ deckId, known, unknown, total: cards.length }));
      return;
    }
    const card = cards[i];
    stage.appendChild(el('div', { class: 'fc-counter' }, [`Carta ${i + 1} de ${cards.length} · ${known} sabidas · ${unknown} a revisar`]));
    stage.appendChild(el('div', { class: 'fc-card' + (flipped ? ' flipped' : ''), onClick: flip, attrs: { 'data-testid': 'fc-card' } }, [
      el('div', { class: 'fc-card-inner' }, [
        el('div', { class: 'fc-face' }, [
          el('div', { class: 'fc-face-label' }, ['Frente']),
          el('div', {}, [card.front])
        ]),
        el('div', { class: 'fc-face fc-face-back' }, [
          el('div', { class: 'fc-face-label' }, ['Verso']),
          el('div', {}, [card.back])
        ])
      ])
    ]));
    stage.appendChild(el('div', { class: 'fc-controls' }, [
      el('button', { class: 'btn btn-danger btn-lg', onClick: () => answer(false), attrs: { 'data-testid': 'fc-unknown' } }, ['Não sei', el('span', { class: 'kbd' }, ['1'])]),
      el('button', { class: 'btn btn-lg', onClick: flip }, ['Virar', el('span', { class: 'kbd' }, ['Espaço'])]),
      el('button', { class: 'btn btn-primary btn-lg', onClick: () => answer(true), attrs: { 'data-testid': 'fc-known' } }, ['Sei', el('span', { class: 'kbd' }, ['2'])])
    ]));
    stage.appendChild(el('div', { class: 'fc-hint' }, ['Atalho: ', el('span', { class: 'kbd' }, ['espaço']), ' vira · ', el('span', { class: 'kbd' }, ['1']), ' não sei · ', el('span', { class: 'kbd' }, ['2']), ' sei · ', el('span', { class: 'kbd' }, ['←/→']), ' navegar']));
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (i >= cards.length) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (e.key === '1') answer(false);
    else if (e.key === '2') answer(true);
    else if (e.key === 'ArrowRight' && i < cards.length - 1) { i++; flipped = false; rerender(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; flipped = false; rerender(); }
  }
  window.addEventListener('keydown', onKey);
  registerCleanup(() => window.removeEventListener('keydown', onKey));

  rerender();
}

function renderResult({ deckId, known, unknown, total }) {
  const pct = total ? Math.round((known / total) * 100) : 0;
  return el('div', { class: 'panel result stack stack-4' }, [
    el('div', { class: 'result-emoji' }, [pct >= 80 ? '🎯' : pct >= 50 ? '💪' : '📚']),
    el('h2', {}, ['Sessão concluída']),
    el('div', { class: 'score-big' }, [`${pct}%`]),
    el('div', { class: 'muted' }, [`${known} sabidas · ${unknown} a revisar · ${total} cartas`]),
    el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar ao deck']),
      el('button', { class: 'btn btn-primary', onClick: replay }, ['Estudar de novo'])
    ])
  ]);
}
