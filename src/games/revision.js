// Entrypoint da sessão de REVISÃO.
//
// A sessão de revisão NÃO é um modo novo: reusa os 5 modos existentes
// (flashcards, multiple, write, match, speed) com um conjunto reduzido de
// cards (a lista de revisão do user no deck).
//
// Estratégia: como os modos leem `deck.cards` do cache síncrono de `store.js`,
// fazemos snapshot dos cards originais, substituímos por subset filtrado,
// chamamos o renderer apropriado, e registramos cleanup que restaura.
//
// `source='revision'` é injetado em `study_sessions.meta` via `sessionLoop`
// (TODO incremental — sessionLoop precisa aceitar opts.source).

import { el } from '../core/util.js';
import { getDeck } from '../core/store.js';
import { ensureDeckList, getDeckCardIds } from '../core/reviewList.js';
import { topbar } from '../ui/topbar.js';
import { go, registerCleanup, replay } from '../ui/router.js';
import { renderFlashcards } from './flashcards.js';
import { renderMultipleChoice } from './multiple-choice.js';
import { renderWrite } from './write.js';
import { renderMatch } from './match.js';
import { renderSpeed } from './speed.js';

const RENDERERS = {
  flashcards: renderFlashcards,
  multiple:   renderMultipleChoice,
  write:      renderWrite,
  match:      renderMatch,
  speed:      renderSpeed
};

export async function renderRevisionMode(root, deckId, mode) {
  const renderer = RENDERERS[mode];
  if (!renderer) { go(`/deck/${deckId}`); return; }

  // Garante cache local da lista de revisão.
  try {
    await ensureDeckList(deckId);
  } catch {
    // Falhou: degrada pra mensagem amigável.
    paintEmpty(root, deckId, 'Erro ao carregar lista de revisão.');
    return;
  }

  const deck = getDeck(deckId);
  if (!deck) {
    paintEmpty(root, deckId, 'Deck não disponível.');
    return;
  }
  const markedIds = getDeckCardIds(deckId);
  const filtered = (deck.cards || []).filter(c => markedIds.has(c.id));

  if (filtered.length === 0) {
    paintEmpty(root, deckId, 'Lista de revisão vazia. Marque cards primeiro.');
    return;
  }

  // Snapshot e substituição.
  const originalCards = deck.cards;
  deck.cards = filtered.slice(); // shallow clone — modos podem reordenar via shuffle
  // Flag pra sessionLoop / outros componentes saberem que estamos em revisão.
  deck.__revisionMode = true;
  // Restauração no cleanup (mesmo se o user volta no meio da sessão).
  registerCleanup(() => {
    if (deck.cards !== originalCards) {
      deck.cards = originalCards;
    }
    delete deck.__revisionMode;
  });

  return renderer(root, deckId);
}

function paintEmpty(root, deckId, msg) {
  root.innerHTML = '';
  root.appendChild(topbar({ showBack: true }));
  root.appendChild(el('div', { class: 'empty' }, [
    el('h2', {}, ['Sessão de revisão']),
    el('p', {}, [msg]),
    el('div', { class: 'row gap-2', style: { justifyContent: 'center' } }, [
      el('button', { class: 'btn', onClick: () => go(`/deck/${deckId}`) }, ['Voltar ao deck'])
    ])
  ]));
}
