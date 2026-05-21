import { el } from '../core/util.js';
import { getDeck, recordCardResult } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';
import { shuffle } from '../core/util.js';
import { playCardAudio, speakerButton, detectDeckLang, stopAudio, prefetchCardAudio } from '../core/audio.js';
import { startSession } from '../core/sessionLoop.js';
import { openSessionEndModal } from '../ui/sessionEndModal.js';
import { floatingXp } from '../ui/xpCounter.js';
import { revisionButton } from '../ui/revisionButton.js';
import { ensureDeckList } from '../core/reviewList.js';

export async function renderFlashcards(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length === 0) { go(`/deck/${deckId}`); return; }

  const cards = shuffle(deck.cards);
  const deckLang = detectDeckLang(deck);
  let i = 0;
  let flipped = false;
  let answered = false; // verdadeiro entre answer() e troca de carta
  let known = 0, unknown = 0;
  let currentRevBtn = null;
  const totalDeckCards = deck.cards.length;
  const errors = [];

  // Prefetch da lista de revisão pra que o botão "+ Revisão" reflita estado on/off correto.
  ensureDeckList(deckId).catch(() => {});

  let session = null;
  const sessionOpts = deck.__revisionMode ? { source: 'revision' } : {};
  try { session = await startSession(deckId, 'flashcards', sessionOpts); }
  catch { /* sem session — modo offline */ }
  // Aborta sessão se user navegar pra outra rota antes do finish.
  registerCleanup(() => { try { session && session.abort && session.abort(); } catch {} });

  async function playCurrent() {
    if (i >= cards.length) return;
    const side = flipped ? 'back' : 'front';
    const lang = flipped ? deckLang?.back : deckLang?.front;
    await playCardAudio(deckId, cards[i].id, side, lang);
  }

  root.appendChild(topbar({ showBack: true, title: `${deck.name} · Flashcards` }));

  const stage = el('div', { class: 'fc-stage' });
  root.appendChild(stage);

  function flip() {
    flipped = !flipped;
    rerender();
  }

  function answer(correct) {
    if (!flipped) {
      flip();
      const card = stage.querySelector('.fc-card');
      if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
      }
      return;
    }
    const card = cards[i];
    recordCardResult(deckId, card.id, correct);
    if (correct) {
      known++;
      if (session) session.onCorrect(card.id, { cardStats: card.stats });
      // Floating +XP no canto do card
      const node = stage.querySelector('.fc-card');
      if (node) {
        const rect = node.getBoundingClientRect();
        floatingXp({ x: rect.right - 60, y: rect.top + 16, value: 5 });
      }
    } else {
      unknown++;
      if (session) session.onWrong(card.id);
      errors.push({ front: card.front, correct: card.back, given: '' });
    }
    answered = true;
    // Re-renderiza com botão + Revisão visível antes de avançar.
    rerender();
    setTimeout(() => {
      i++;
      flipped = false;
      answered = false;
      currentRevBtn = null;
      rerender();
    }, 850);
  }

  function prefetchNeighbors() {
    // Prepara back da carta atual (vai precisar ao virar) e front da próxima.
    const cur = cards[i];
    if (cur) prefetchCardAudio(deckId, cur.id, 'back', deckLang?.back);
    const next = cards[i + 1];
    if (next) prefetchCardAudio(deckId, next.id, 'front', deckLang?.front);
  }

  function rerender() {
    stage.innerHTML = '';
    if (i >= cards.length) {
      stage.appendChild(renderLoading());
      finishSession();
      return;
    }
    const card = cards[i];
    prefetchNeighbors();
    stage.appendChild(el('div', { class: 'fc-counter' }, [`Carta ${i + 1} de ${cards.length} · ${known} sabidas · ${unknown} a revisar`]));
    const cardEl = el('div', { class: 'fc-card' + (flipped ? ' flipped' : ''), onClick: flip, attrs: { 'data-testid': 'fc-card' } }, [
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
    ]);
    cardEl.appendChild(speakerButton(playCurrent));
    if (answered) {
      currentRevBtn = revisionButton({ card, deck });
      currentRevBtn.classList.add('revision-btn-inline');
      cardEl.appendChild(currentRevBtn);
    } else {
      currentRevBtn = null;
    }
    stage.appendChild(cardEl);
    stage.appendChild(el('div', { class: 'fc-controls' }, [
      el('button', { class: 'btn btn-danger btn-lg', onClick: () => answer(false), attrs: { 'data-testid': 'fc-unknown' } }, ['Não sei', el('span', { class: 'kbd' }, ['1'])]),
      el('button', { class: 'btn btn-lg', onClick: flip }, ['Virar', el('span', { class: 'kbd' }, ['Espaço'])]),
      el('button', { class: 'btn btn-primary btn-lg', onClick: () => answer(true), attrs: { 'data-testid': 'fc-known' } }, ['Sei', el('span', { class: 'kbd' }, ['2'])])
    ]));
    stage.appendChild(el('div', { class: 'fc-hint' }, ['Atalho: ', el('span', { class: 'kbd' }, ['espaço']), ' vira · ', el('span', { class: 'kbd' }, ['1']), ' não sei · ', el('span', { class: 'kbd' }, ['2']), ' sei · ', el('span', { class: 'kbd' }, ['S']), ' ouvir · ', el('span', { class: 'kbd' }, ['←/→']), ' navegar']));
  }

  async function finishSession() {
    if (!session) {
      // Sem sessão: usa renderResult legado
      stage.innerHTML = '';
      stage.appendChild(renderFallbackResult({ deckId, known, unknown, total: cards.length }));
      return;
    }
    const result = await session.finish({ cardsTotal: cards.length, totalDeckCards });
    stage.innerHTML = '';
    stage.appendChild(el('div', { class: 'panel center muted' }, ['Sessão concluída — abra resumo abaixo.']));
    openSessionEndModal({
      summary: result.summary,
      finishResponse: result.finishResponse,
      onReplay: () => replay(),
      onBack: () => go(`/deck/${deckId}`),
      deckId,
      mode: 'flashcards',
      errors
    });
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (i >= cards.length) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
    else if (e.key === '1') answer(false);
    else if (e.key === '2') answer(true);
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); playCurrent().catch(() => {}); }
    else if ((e.key === 'r' || e.key === 'R') && answered && currentRevBtn) {
      e.preventDefault();
      currentRevBtn.toggle();
    }
    else if (e.key === 'ArrowRight' && i < cards.length - 1) { i++; flipped = false; rerender(); }
    else if (e.key === 'ArrowLeft' && i > 0) { i--; flipped = false; rerender(); }
  }
  window.addEventListener('keydown', onKey);
  registerCleanup(() => { window.removeEventListener('keydown', onKey); stopAudio(); });

  rerender();
}

function renderLoading() {
  return el('div', { class: 'panel result stack stack-4' }, [
    el('div', { class: 'result-emoji' }, ['⏳']),
    el('div', { class: 'muted' }, ['Calculando XP...'])
  ]);
}

function renderFallbackResult({ deckId, known, unknown, total }) {
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
