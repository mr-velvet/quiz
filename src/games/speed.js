import { el, shuffle, pickRandom } from '../core/util.js';
import { getDeck, recordCardResult, recordGameScore } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';
import { startSession } from '../core/sessionLoop.js';
import { openSessionEndModal } from '../ui/sessionEndModal.js';
import { floatingXp } from '../ui/xpCounter.js';

const ROUND_MS = 60_000;

export async function renderSpeed(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length < 4) {
    root.appendChild(topbar({ showBack: true }));
    root.appendChild(el('div', { class: 'empty' }, [
      el('h2', {}, ['Precisa de 4+ cartas']),
      el('p', {}, ['Speed round precisa de pelo menos 4 cartas.'])
    ]));
    return;
  }

  let session = null;

  let started = false;
  let startAt = 0;
  let timerId = null;
  let correct = 0, wrong = 0;
  let queue = [];
  let current = null;
  let opts = [];
  let correctIdx = -1;
  let locked = false;
  let finished = false;

  root.appendChild(topbar({ showBack: true, title: `${deck.name} · Speed round` }));
  const stage = el('div', { class: 'stack stack-4' });
  root.appendChild(stage);

  function nextRound() {
    if (!queue.length) queue = shuffle(deck.cards.slice());
    current = queue.pop();
    const distractors = pickRandom(deck.cards.filter(c => c.id !== current.id).map(c => c.back), 3);
    opts = shuffle([current.back, ...distractors]);
    correctIdx = opts.indexOf(current.back);
    locked = false;
    renderPlay();
  }

  function choose(idx) {
    if (locked || finished) return;
    locked = true;
    const ok = idx === correctIdx;
    recordCardResult(deckId, current.id, ok);
    if (ok) {
      correct++;
      if (session) session.onCorrect(current.id, { cardStats: current.stats });
      const node = stage.querySelectorAll('.mc-option')[idx];
      if (node) {
        const rect = node.getBoundingClientRect();
        floatingXp({ x: rect.right - 50, y: rect.top + 8, value: 6 });
      }
    } else {
      wrong++;
      if (session) session.onWrong(current.id);
    }
    renderPlay(idx);
    setTimeout(() => { if (!finished) nextRound(); }, 500);
  }

  async function start() {
    started = true;
    startAt = performance.now();
    try { session = await startSession(deckId, 'speed'); } catch {}
    registerCleanup(() => { try { session && session.abort && session.abort(); } catch {} });
    timerId = setInterval(() => {
      const remaining = Math.max(0, ROUND_MS - (performance.now() - startAt));
      const tEl = stage.querySelector('[data-timer]');
      if (tEl) tEl.textContent = (remaining / 1000).toFixed(1) + 's';
      if (remaining <= 0) finish();
    }, 80);
    nextRound();
  }

  async function finish() {
    finished = true;
    clearInterval(timerId);
    const prev = deck.records?.speed;
    const isRecord = !prev || correct > prev.correct;
    recordGameScore(deckId, 'speed', { correct, wrong });

    if (!session) {
      stage.innerHTML = '';
      stage.appendChild(el('div', { class: 'panel result stack stack-4' }, [
        el('div', { class: 'result-emoji' }, [isRecord ? '🏆' : '⚡']),
        el('h2', {}, [isRecord ? 'Novo recorde!' : 'Tempo!']),
        el('div', { class: 'score-big' }, [String(correct)]),
        el('div', { class: 'muted' }, [`acertos em 60s · ${wrong} erros`]),
        el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
          el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar']),
          el('button', { class: 'btn btn-primary', onClick: replay }, ['De novo'])
        ])
      ]));
      return;
    }
    const result = await session.finish({ cardsTotal: correct + wrong, totalDeckCards: null });
    stage.innerHTML = '';
    stage.appendChild(el('div', { class: 'panel center muted' }, ['Speed round concluído.']));
    openSessionEndModal({
      summary: { ...result.summary, durationMs: ROUND_MS },
      finishResponse: result.finishResponse,
      onReplay: () => replay(), onBack: () => go(`/deck/${deckId}`),
      deckId, mode: 'speed'
    });
  }

  function renderStart() {
    stage.innerHTML = '';
    const prev = deck.records?.speed;
    stage.appendChild(el('div', { class: 'panel result stack stack-4' }, [
      el('div', { class: 'result-emoji' }, ['⚡']),
      el('h2', {}, ['Speed round']),
      el('p', { class: 'muted' }, ['60 segundos · múltipla escolha rápida · quantos você acerta?']),
      prev ? el('div', { class: 'pill' }, [`Seu recorde: ${prev.correct}`]) : null,
      el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
        el('button', { class: 'btn btn-primary btn-lg', onClick: start, attrs: { 'data-testid': 'speed-start' } }, ['Começar'])
      ])
    ]));
  }

  function renderPlay(selectedIdx = -1) {
    stage.innerHTML = '';
    const remaining = Math.max(0, ROUND_MS - (performance.now() - startAt));
    stage.appendChild(el('div', { class: 'row-between' }, [
      el('div', { class: 'match-timer', attrs: { 'data-timer': '1' } }, [(remaining / 1000).toFixed(1) + 's']),
      el('div', { class: 'row gap-2' }, [
        el('span', { class: 'pill pill-good' }, [`✓ ${correct}`]),
        el('span', { class: 'pill pill-bad' }, [`✕ ${wrong}`])
      ])
    ]));
    stage.appendChild(el('div', { class: 'mc-prompt' }, [current.front]));
    stage.appendChild(el('div', { class: 'mc-options' },
      opts.map((opt, idx) => {
        const cls = ['mc-option'];
        if (selectedIdx !== -1) {
          if (idx === correctIdx) cls.push('correct', 'flash-correct');
          else if (idx === selectedIdx) cls.push('wrong');
        }
        return el('button', {
          class: cls.join(' '),
          onClick: () => choose(idx),
          disabled: selectedIdx !== -1
        }, [
          el('div', { class: 'mc-key' }, [String(idx + 1)]),
          el('div', {}, [opt])
        ]);
      })
    ));
  }

  function onKey(e) {
    if (!started && !finished && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      start();
      return;
    }
    if (!started || finished || locked) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) choose(n - 1);
  }
  window.addEventListener('keydown', onKey);
  registerCleanup(() => {
    window.removeEventListener('keydown', onKey);
    clearInterval(timerId);
  });

  renderStart();
}
