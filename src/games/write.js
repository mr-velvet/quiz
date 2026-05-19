import { el, shuffle, isCloseEnough } from '../core/util.js';
import { getDeck, recordCardResult } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';
import { playCardAudio, speakerButton, detectDeckLang, stopAudio } from '../core/audio.js';

export function renderWrite(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length === 0) { go(`/deck/${deckId}`); return; }

  const cards = shuffle(deck.cards);
  const deckLang = detectDeckLang(deck);
  let i = 0, correct = 0, wrong = 0, locked = false;

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
      // S no input só funciona com Alt (pra não bloquear digitação).
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
      stage.appendChild(renderResult({ deckId, correct, wrong, total: cards.length }));
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
      class: 'write-input' + (state === 'correct' ? ' correct' : state === 'wrong' ? ' wrong' : ''),
      placeholder: 'Sua resposta…',
      attrs: { 'data-testid': 'write-input', autocomplete: 'off', spellcheck: 'false' },
      value: userText,
      disabled: locked
    });

    const feedback = el('div', { class: 'write-feedback' }, [
      state === 'correct' ? 'Certo!' :
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
          // Avançar
          i++;
          locked = false;
          rerender();
          return;
        }
        const ans = input.value;
        const ok = isCloseEnough(ans, card.back);
        recordCardResult(deckId, card.id, ok);
        if (ok) correct++; else wrong++;
        locked = true;
        rerender(ok ? 'correct' : 'wrong', ans);
        // Foco mantém pra enter avançar
        setTimeout(() => stage.querySelector('input')?.focus(), 30);
      }
    }, [input, feedback]);

    stage.appendChild(form);
    stage.appendChild(el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      locked
        ? el('button', { class: 'btn btn-primary', onClick: () => { i++; locked = false; rerender(); } }, ['Próxima', el('span', { class: 'kbd' }, ['Enter'])])
        : el('button', { class: 'btn', onClick: () => {
            // "Não sei" — conta como erro
            const card = cards[i];
            recordCardResult(deckId, card.id, false);
            wrong++;
            locked = true;
            rerender('wrong', '');
          } }, ['Não sei'])
    ]));

    if (!locked) setTimeout(() => input.focus(), 30);
  }

  rerender();
}

function renderResult({ deckId, correct, wrong, total }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  return el('div', { class: 'panel result stack stack-4' }, [
    el('div', { class: 'result-emoji' }, [pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '📚']),
    el('h2', {}, ['Resultado']),
    el('div', { class: 'score-big' }, [`${pct}%`]),
    el('div', { class: 'muted' }, [`${correct} de ${total} corretas`]),
    el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar ao deck']),
      el('button', { class: 'btn btn-primary', onClick: replay }, ['Jogar de novo'])
    ])
  ]);
}
