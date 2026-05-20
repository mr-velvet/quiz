// Roteador simples baseado em hash. Sem framework.
// Rotas:
//   #/                       → home (meus decks)
//   #/?folder=<id>           → home filtrada por pasta
//   #/explorar               → tela Explorar
//   #/pastas                 → tela Pastas
//   #/deck/:id               → detalhe do deck
//   #/play/:id/:mode         → modo de jogo

import { renderHome } from './home.js';
import { renderDeck } from './deck.js';
import { renderExplore } from './explore.js';
import { renderFolders } from './folders.js';
import { renderMe } from './me.js';
import { renderFlashcards } from '../games/flashcards.js';
import { renderMultipleChoice } from '../games/multiple-choice.js';
import { renderWrite } from '../games/write.js';
import { renderMatch } from '../games/match.js';
import { renderSpeed } from '../games/speed.js';
import { onChange } from '../core/util.js';
import { closeAllModals } from './modal.js';

const root = () => document.getElementById('app');

// Hash format: '#/path?query'. Parse separately.
function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) {
    for (const seg of queryPart.split('&')) {
      const [k, v] = seg.split('=');
      if (!k) continue;
      query[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
    }
  }
  return { parts, query };
}

export function go(path) {
  location.hash = path;
}

export function back() {
  if (history.length > 1) history.back();
  else go('/');
}

export function replay() {
  render();
}

const cleanups = [];
export function registerCleanup(fn) { cleanups.push(fn); }
function runCleanups() {
  while (cleanups.length) {
    try { cleanups.pop()(); } catch {}
  }
}

function render() {
  runCleanups();
  closeAllModals();
  const { parts, query } = parseHash();
  const app = root();
  app.innerHTML = '';
  // Invalida qualquer token de render assíncrono pendente (ver deck.js).
  app.__renderToken = null;

  if (parts.length === 0) {
    renderHome(app, { folderFilter: query.folder || null });
    return;
  }

  if (parts[0] === 'explorar') {
    renderExplore(app);
    return;
  }

  if (parts[0] === 'pastas') {
    renderFolders(app);
    return;
  }

  if (parts[0] === 'eu') {
    renderMe(app);
    return;
  }

  if (parts[0] === 'deck' && parts[1]) {
    renderDeck(app, parts[1]);
    return;
  }

  if (parts[0] === 'play' && parts[1] && parts[2]) {
    const [, deckId, mode] = parts;
    switch (mode) {
      case 'flashcards': return renderFlashcards(app, deckId);
      case 'multiple':   return renderMultipleChoice(app, deckId);
      case 'write':      return renderWrite(app, deckId);
      case 'match':      return renderMatch(app, deckId);
      case 'speed':      return renderSpeed(app, deckId);
      default:           go('/'); return;
    }
  }

  go('/');
}

export function start() {
  window.addEventListener('hashchange', render);
  onChange(() => {
    const { parts } = parseHash();
    // Re-render só pra telas que mostram lista (home, explore, pastas, deck).
    // Jogos têm estado interno e não devem reiniciar.
    if (parts.length === 0 || parts[0] === 'deck' || parts[0] === 'explorar' || parts[0] === 'pastas') render();
  });
  render();
}
