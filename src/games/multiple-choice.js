import { el, shuffle, pickRandom } from '../core/util.js';
import { getDeck, recordCardResult } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';
import { playCardAudio, speakerButton, detectDeckLang, stopAudio, prefetchCardAudio } from '../core/audio.js';
import { startSession } from '../core/sessionLoop.js';
import { openSessionEndModal } from '../ui/sessionEndModal.js';
import { floatingXp } from '../ui/xpCounter.js';
import { revisionButton } from '../ui/revisionButton.js';
import { ensureDeckList } from '../core/reviewList.js';

export async function renderMultipleChoice(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length < 4) {
    root.appendChild(topbar({ showBack: true }));
    root.appendChild(el('div', { class: 'empty' }, [
      el('h2', {}, ['Precisa de 4+ cartas']),
      el('p', {}, ['Múltipla escolha requer pelo menos 4 cartas no deck.'])
    ]));
    return;
  }

  const cards = shuffle(deck.cards);
  const deckLang = detectDeckLang(deck);
  let i = 0, correct = 0, wrong = 0, locked = false;
  let currentOptions = [];
  let currentCorrectIdx = -1;
  let currentRevBtn = null;
  const totalDeckCards = deck.cards.length;
  const errors = [];

  ensureDeckList(deckId).catch(() => {});

  let session = null;
  const sessionOpts = deck.__revisionMode ? { source: 'revision' } : {};
  try { session = await startSession(deckId, 'multiple', sessionOpts); } catch {}
  registerCleanup(() => { try { session && session.abort && session.abort(); } catch {} });

  async function playPrompt() {
    if (i >= cards.length) return;
    await playCardAudio(deckId, cards[i].id, 'front', deckLang?.front);
  }

  root.appendChild(topbar({ showBack: true, title: `${deck.name} · Múltipla escolha` }));
  const stage = el('div', { class: 'stack stack-4' });
  root.appendChild(stage);

  function buildRound() {
    const card = cards[i];
    const distractors = pickRandom(
      deck.cards.filter(c => c.id !== card.id).map(c => c.back),
      3
    );
    const opts = shuffle([card.back, ...distractors]);
    currentOptions = opts;
    currentCorrectIdx = opts.indexOf(card.back);
  }

  function choose(idx) {
    if (locked) return;
    locked = true;
    const isCorrect = idx === currentCorrectIdx;
    const card = cards[i];
    recordCardResult(deckId, card.id, isCorrect);
    if (isCorrect) {
      correct++;
      if (session) session.onCorrect(card.id, { cardStats: card.stats });
      const optNode = stage.querySelectorAll('.mc-option')[idx];
      if (optNode) {
        const rect = optNode.getBoundingClientRect();
        floatingXp({ x: rect.right - 50, y: rect.top + 8, value: 10 });
      }
    } else {
      wrong++;
      if (session) session.onWrong(card.id);
      errors.push({ front: card.front, correct: card.back, given: currentOptions[idx] || '' });
    }
    rerender(idx);
    setTimeout(() => {
      i++;
      locked = false;
      if (i < cards.length) { buildRound(); rerender(); }
      else finishSession();
    }, 850);
  }

  async function finishSession() {
    if (!session) {
      stage.innerHTML = '';
      stage.appendChild(renderFallback({ deckId, correct, total: cards.length }));
      return;
    }
    const result = await session.finish({ cardsTotal: cards.length, totalDeckCards });
    stage.innerHTML = '';
    stage.appendChild(el('div', { class: 'panel center muted' }, ['Sessão concluída.']));
    openSessionEndModal({
      summary: result.summary, finishResponse: result.finishResponse,
      onReplay: () => replay(), onBack: () => go(`/deck/${deckId}`),
      deckId, mode: 'multiple', errors
    });
  }

  function prefetchNext() {
    const cur = cards[i];
    if (cur) prefetchCardAudio(deckId, cur.id, 'front', deckLang?.front);
    const next = cards[i + 1];
    if (next) prefetchCardAudio(deckId, next.id, 'front', deckLang?.front);
  }

  function rerender(selectedIdx = -1) {
    stage.innerHTML = '';
    if (i >= cards.length) return; // já iniciou finishSession
    const card = cards[i];
    prefetchNext();
    stage.appendChild(el('div', { class: 'row-between' }, [
      el('div', { class: 'fc-counter' }, [`${i + 1} / ${cards.length}`]),
      el('div', { class: 'row gap-2' }, [
        el('span', { class: 'pill pill-good' }, [`✓ ${correct}`]),
        el('span', { class: 'pill pill-bad' }, [`✕ ${wrong}`])
      ])
    ]));
    const promptRow = el('div', { class: 'mc-prompt-row' }, [
      el('div', { class: 'mc-prompt' }, [card.front])
    ]);
    promptRow.appendChild(speakerButton(playPrompt));
    stage.appendChild(promptRow);
    stage.appendChild(el('div', { class: 'mc-options' },
      currentOptions.map((opt, idx) => {
        const cls = ['mc-option'];
        if (selectedIdx !== -1) {
          if (idx === currentCorrectIdx) cls.push('correct', 'flash-correct');
          else if (idx === selectedIdx) cls.push('wrong');
        }
        return el('button', {
          class: cls.join(' '),
          onClick: () => choose(idx),
          disabled: selectedIdx !== -1,
          attrs: { 'data-testid': `mc-opt-${idx}` }
        }, [
          el('div', { class: 'mc-key' }, [String(idx + 1)]),
          el('div', {}, [opt])
        ]);
      })
    ));
    if (selectedIdx !== -1) {
      currentRevBtn = revisionButton({ card, deck });
      currentRevBtn.classList.add('revision-btn-inline-row');
      const rowRev = el('div', { class: 'mc-revision-row' }, [currentRevBtn]);
      stage.appendChild(rowRev);
    } else {
      currentRevBtn = null;
    }
    stage.appendChild(el('div', { class: 'fc-hint center' }, ['Atalhos: ', el('span', { class: 'kbd' }, ['1']), ' ', el('span', { class: 'kbd' }, ['2']), ' ', el('span', { class: 'kbd' }, ['3']), ' ', el('span', { class: 'kbd' }, ['4']), ' · ', el('span', { class: 'kbd' }, ['S']), ' ouvir · ', el('span', { class: 'kbd' }, ['R']), ' revisar']));
  }

  function onKey(e) {
    if (i >= cards.length) return;
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); playPrompt().catch(() => {}); return; }
    if ((e.key === 'r' || e.key === 'R') && locked && currentRevBtn) {
      e.preventDefault();
      currentRevBtn.toggle();
      return;
    }
    if (locked) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) choose(n - 1);
  }
  window.addEventListener('keydown', onKey);
  registerCleanup(() => { window.removeEventListener('keydown', onKey); stopAudio(); });

  buildRound();
  rerender();
}

function renderFallback({ deckId, correct, total }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return el('div', { class: 'panel result stack stack-4' }, [
    el('div', { class: 'result-emoji' }, [pct >= 80 ? '🎯' : '💪']),
    el('h2', {}, ['Resultado']),
    el('div', { class: 'score-big' }, [`${pct}%`]),
    el('div', { class: 'muted' }, [`${correct} de ${total}`]),
    el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar']),
      el('button', { class: 'btn btn-primary', onClick: replay }, ['De novo'])
    ])
  ]);
}
