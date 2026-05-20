import { el, shuffle, isCloseEnough } from '../core/util.js';
import { getDeck, recordCardResult } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';
import { playCardAudio, speakerButton, detectDeckLang, stopAudio } from '../core/audio.js';
import { startSession } from '../core/sessionLoop.js';
import { openSessionEndModal } from '../ui/sessionEndModal.js';
import { floatingXp } from '../ui/xpCounter.js';

export async function renderWrite(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length === 0) { go(`/deck/${deckId}`); return; }

  const cards = shuffle(deck.cards);
  const deckLang = detectDeckLang(deck);
  let i = 0, correct = 0, wrong = 0, locked = false;
  const totalDeckCards = deck.cards.length;

  let session = null;
  try { session = await startSession(deckId, 'write'); } catch {}

  async function playPrompt() {
    if (i >= cards.length) return;
    await playCardAudio(deckId, cards[i].id, 'front', deckLang?.front);
  }
  async function playAnswer() {
    if (i >= cards.length) return;
    await playCardAudio(deckId, cards[i].id, 'back', deckLang?.back);
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if ((e.key === 's' || e.key === 'S') && e.altKey) {
        e.preventDefault();
        (locked ? playAnswer() : playPrompt()).catch(() => {});
      }
      return;
    }
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      (locked ? playAnswer() : playPrompt()).catch(() => {});
    }
  }
  window.addEventListener('keydown', onKey);
  registerCleanup(() => { window.removeEventListener('keydown', onKey); stopAudio(); });

  root.appendChild(topbar({ showBack: true, title: `${deck.name} · Escrever` }));
  const stage = el('div', { class: 'stack stack-4' });
  root.appendChild(stage);

  function rerender(state = 'idle', userText = '') {
    stage.innerHTML = '';
    if (i >= cards.length) {
      finishSession();
      return;
    }
    const card = cards[i];
    stage.appendChild(el('div', { class: 'row-between' }, [
      el('div', { class: 'fc-counter' }, [`${i + 1} / ${cards.length}`]),
      el('div', { class: 'row gap-2' }, [
        el('span', { class: 'pill pill-good' }, [`✓ ${correct}`]),
        el('span', { class: 'pill pill-bad' }, [`✕ ${wrong}`])
      ])
    ]));
    const promptRow = el('div', { class: 'write-prompt-row' }, [
      el('div', { class: 'write-prompt' }, [card.front])
    ]);
    promptRow.appendChild(speakerButton(playPrompt));
    stage.appendChild(promptRow);

    const input = el('input', {
      class: 'write-input' + (state === 'correct' ? ' correct flash-correct' : state === 'wrong' ? ' wrong' : ''),
      placeholder: 'Sua resposta…',
      attrs: { 'data-testid': 'write-input', autocomplete: 'off', spellcheck: 'false' },
      value: userText,
      disabled: locked
    });

    const feedback = el('div', { class: 'write-feedback' }, [
      state === 'correct' ? 'Certo! +20 XP' :
      state === 'wrong' ? el('span', {}, ['Resposta: ', el('strong', {}, [card.back])]) :
      'Pressione Enter pra enviar · Alt+S ouvir'
    ]);
    if (state === 'wrong' || state === 'correct') {
      const ansAudioBtn = speakerButton(playAnswer);
      ansAudioBtn.classList.add('speaker-btn-sm');
      feedback.appendChild(ansAudioBtn);
    }

    const form = el('form', {
      class: 'write-input-wrap',
      onSubmit: (e) => {
        e.preventDefault();
        if (locked) {
          i++; locked = false; rerender();
          return;
        }
        const ans = input.value;
        const ok = isCloseEnough(ans, card.back);
        recordCardResult(deckId, card.id, ok);
        if (ok) {
          correct++;
          if (session) session.onCorrect(card.id, { cardStats: card.stats });
          const rect = input.getBoundingClientRect();
          floatingXp({ x: rect.right - 60, y: rect.top, value: 20 });
        } else {
          wrong++;
          if (session) session.onWrong(card.id);
        }
        locked = true;
        rerender(ok ? 'correct' : 'wrong', ans);
        setTimeout(() => stage.querySelector('input')?.focus(), 30);
      }
    }, [input, feedback]);

    stage.appendChild(form);
    stage.appendChild(el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      locked
        ? el('button', { class: 'btn btn-primary', onClick: () => { i++; locked = false; rerender(); } }, ['Próxima', el('span', { class: 'kbd' }, ['Enter'])])
        : el('button', { class: 'btn', onClick: () => {
            const card = cards[i];
            recordCardResult(deckId, card.id, false);
            if (session) session.onWrong(card.id);
            wrong++;
            locked = true;
            rerender('wrong', '');
          } }, ['Não sei'])
    ]));

    if (!locked) setTimeout(() => input.focus(), 30);
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
      deckId, mode: 'write'
    });
  }

  rerender();
}

function renderFallback({ deckId, correct, total }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return el('div', { class: 'panel result stack stack-4' }, [
    el('div', { class: 'result-emoji' }, [pct >= 80 ? '🏆' : '💪']),
    el('h2', {}, ['Resultado']),
    el('div', { class: 'score-big' }, [`${pct}%`]),
    el('div', { class: 'muted' }, [`${correct} de ${total}`]),
    el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar']),
      el('button', { class: 'btn btn-primary', onClick: replay }, ['De novo'])
    ])
  ]);
}
