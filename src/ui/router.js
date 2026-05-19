// Roteador simples baseado em hash. Sem framework.
// Rotas:
//   #/                       → home
//   #/deck/:id               → tela do deck
//   #/play/:id/:mode         → modo de jogo

import { renderHome } from './home.js';
import { renderDeck } from './deck.js';
import { renderFlashcards } from '../games/flashcards.js';
import { renderMultipleChoice } from '../games/multiple-choice.js';
import { renderWrite } from '../games/write.js';
import { renderMatch } from '../games/match.js';
import { renderSpeed } from '../games/speed.js';
import { onChange } from '../core/util.js';

const root = () => document.getElementById('app');

function parseHash() {
  const h = (location.hash || '#/').slice(1);
  const parts = h.split('/').filter(Boolean);
  return parts;
}

export function go(path) {
  location.hash = path;
}

export function back() {
  if (history.length > 1) history.back();
  else go('/');
}

// Re-renderiza a tela atual sem mudar a URL.
// Útil pra "jogar de novo" — re-instancia o jogo do zero sem reload do navegador.
export function replay() {
  render();
}

// Cleanup callbacks registrados pela tela atual.
const cleanups = [];
export function registerCleanup(fn) { cleanups.push(fn); }
function runCleanups() {
  while (cleanups.length) {
    try { cleanups.pop()(); } catch {}
  }
}

function render() {
  runCleanups();
  const parts = parseHash();
  const app = root();
  app.innerHTML = '';

  if (parts.length === 0 || parts[0] === '') {
    renderHome(app);
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
  // Re-renderiza tela atual quando store muda (deck criado, card editado, etc.)
  onChange(() => {
    // Só re-renderiza home/deck — jogos têm estado interno e não devem reiniciar.
    const parts = parseHash();
    if (parts.length === 0 || parts[0] === 'deck') render();
  });
  render();
}
