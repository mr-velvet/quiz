import { el, shuffle, fmtTime } from '../core/util.js';
import { getDeck, recordGameScore } from '../core/store.js';
import { topbar } from '../ui/topbar.js';
import { go, replay, registerCleanup } from '../ui/router.js';

// Match grid — foco do user.
// 6 pares por rodada (12 tiles). Se deck tem menos de 6 cartas, usa o que tem.
// Clica par: se casar, somem com animação. Se não casar, shake.
// Timer cronometra do primeiro clique até zerar.

const PAIRS_PER_ROUND = 6;

export function renderMatch(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length < 2) {
    root.appendChild(topbar({ showBack: true }));
    root.appendChild(el('div', { class: 'empty' }, [
      el('h2', {}, ['Precisa de 2+ cartas']),
      el('p', {}, ['Match precisa de pelo menos 2 cartas no deck.'])
    ]));
    return;
  }

  const n = Math.min(PAIRS_PER_ROUND, deck.cards.length);
  const chosen = shuffle(deck.cards).slice(0, n);

  // Tiles: cada par vira 2 tiles (front e back), com pairId compartilhado.
  let tiles = [];
  for (const c of chosen) {
    tiles.push({ id: c.id + ':f', pairId: c.id, label: c.front, matched: false });
    tiles.push({ id: c.id + ':b', pairId: c.id, label: c.back, matched: false });
  }
  tiles = shuffle(tiles);

  let selected = null; // tile object
  let startTime = 0;
  let elapsed = 0;
  let timerId = null;
  let mistakes = 0;
  let finished = false;

  root.appendChild(topbar({ showBack: true, title: `${deck.name} · Match` }));

  const stage = el('div', { class: 'stack stack-4' });
  root.appendChild(stage);

  function startTimer() {
    if (startTime) return;
    startTime = performance.now();
    timerId = setInterval(() => {
      elapsed = performance.now() - startTime;
      const tEl = stage.querySelector('[data-timer]');
      if (tEl) tEl.textContent = fmtTime(elapsed);
    }, 53);
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function checkComplete() {
    if (tiles.every(t => t.matched)) {
      finished = true;
      stopTimer();
      const finalTime = performance.now() - startTime;
      const prev = deck.records?.match;
      const isRecord = !prev || finalTime < prev.timeMs;
      recordGameScore(deckId, 'match', { timeMs: Math.round(finalTime), mistakes });
      setTimeout(() => rerenderResult(finalTime, isRecord), 400);
    }
  }

  function onTileClick(tile, node) {
    if (finished || tile.matched) return;
    startTimer();

    if (!selected) {
      selected = tile;
      node.classList.add('selected');
      return;
    }
    if (selected.id === tile.id) {
      // clicou mesmo tile, deseleciona
      node.classList.remove('selected');
      selected = null;
      return;
    }
    // Tem 2 tiles selecionados
    const prevNode = stage.querySelector(`[data-tile-id="${CSS.escape(selected.id)}"]`);
    if (selected.pairId === tile.pairId) {
      // par!
      tile.matched = true;
      selected.matched = true;
      node.classList.add('flash-correct');
      prevNode?.classList.add('flash-correct');
      setTimeout(() => {
        node.classList.add('matched');
        prevNode?.classList.add('matched');
      }, 320);
      selected = null;
      checkComplete();
    } else {
      mistakes++;
      node.classList.add('flash-wrong');
      prevNode?.classList.add('flash-wrong');
      const sel = selected;
      const selNode = prevNode;
      selected = null;
      setTimeout(() => {
        node.classList.remove('flash-wrong');
        selNode?.classList.remove('flash-wrong', 'selected');
      }, 420);
    }
  }

  // Atalhos por tecla, posicionais (grid 4 colunas × 3 linhas).
  const KEYS = ['1','2','3','4','q','w','e','r','a','s','d','f'];

  function rerenderGrid() {
    stage.innerHTML = '';
    const prev = deck.records?.match;
    stage.appendChild(el('div', { class: 'row-between' }, [
      el('div', { class: 'match-timer', attrs: { 'data-timer': '1' } }, [fmtTime(elapsed)]),
      el('div', { class: 'row gap-2' }, [
        prev ? el('span', { class: 'pill' }, [`Recorde: ${fmtTime(prev.timeMs)}`]) : null,
        el('span', { class: 'pill pill-bad' }, [`Erros: ${mistakes}`])
      ])
    ]));

    const grid = el('div', { class: 'match-grid' });
    tiles.forEach((t, idx) => {
      const node = el('button', {
        class: 'match-tile' + (t.matched ? ' matched' : ''),
        attrs: { 'data-tile-id': t.id, 'data-testid': 'match-tile', 'data-key': KEYS[idx] || '' },
      }, [
        KEYS[idx] ? el('span', { class: 'mc-key', style: { position: 'absolute', top: '6px', right: '6px' } }, [KEYS[idx].toUpperCase()]) : null,
        el('div', {}, [t.label])
      ]);
      node.style.position = 'relative';
      node.addEventListener('click', () => onTileClick(t, node));
      grid.appendChild(node);
    });
    stage.appendChild(grid);
    stage.appendChild(el('div', { class: 'fc-hint center' }, ['Clique pares de termo e definição, ou use teclas ', el('span', { class: 'kbd' }, ['1-4 Q-R A-F']), '.']));
  }

  function onKey(e) {
    if (finished) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    const idx = KEYS.indexOf(key);
    if (idx === -1 || idx >= tiles.length) return;
    const tile = tiles[idx];
    if (tile.matched) return;
    const node = stage.querySelector(`[data-tile-id="${CSS.escape(tile.id)}"]`);
    if (node) onTileClick(tile, node);
  }
  window.addEventListener('keydown', onKey);
  registerCleanup(() => window.removeEventListener('keydown', onKey));

  function rerenderResult(finalTime, isRecord) {
    stage.innerHTML = '';
    stage.appendChild(el('div', { class: 'panel result stack stack-4' }, [
      el('div', { class: 'result-emoji' }, [isRecord ? '🏆' : '🧩']),
      el('h2', {}, [isRecord ? 'Novo recorde!' : 'Match completo']),
      el('div', { class: 'score-big' }, [fmtTime(finalTime)]),
      el('div', { class: 'muted' }, [`${n} pares · ${mistakes} erros`]),
      el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
        el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar ao deck']),
        el('button', { class: 'btn btn-primary', onClick: replay }, ['Jogar de novo'])
      ])
    ]));
  }

  registerCleanup(() => stopTimer());

  rerenderGrid();
}
