import { el } from '../core/util.js';
import { listDecks, createDeck, parseImport } from '../core/store.js';
import { topbar } from './topbar.js';
import { openModal } from './modal.js';
import { go } from './router.js';

export function renderHome(root) {
  root.appendChild(topbar());

  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'stack stack-2' }, [
      el('h1', {}, ['Seus estudos']),
      el('p', { class: 'muted' }, ['Cole texto pra criar um deck. Uma linha por carta — frente e verso separados.'])
    ]),
    renderDeckGrid()
  ]));
}

function renderDeckGrid() {
  const decks = listDecks();
  const grid = el('div', { class: 'deck-grid' });

  // Botão criar (primeiro)
  grid.appendChild(el('div', {
    class: 'deck-card deck-card-new',
    onClick: openCreate,
    attrs: { 'data-testid': 'create-deck' }
  }, [
    el('div', { style: { fontSize: '28px', marginBottom: '4px' } }, ['+']),
    el('div', {}, ['Criar deck'])
  ]));

  if (decks.length === 0) return grid;

  for (const deck of decks) {
    const total = deck.cards.length;
    const seen = deck.cards.filter(c => c.stats.lastSeenAt > 0).length;
    const correct = deck.cards.reduce((s, c) => s + c.stats.correct, 0);
    const pct = total ? Math.round((seen / total) * 100) : 0;

    grid.appendChild(el('div', {
      class: 'deck-card',
      onClick: () => go(`/deck/${deck.id}`),
      attrs: { 'data-testid': 'deck-card' }
    }, [
      el('div', { class: 'deck-card-title' }, [deck.name]),
      el('div', { class: 'deck-card-meta' }, [`${total} cartas · ${seen} vistas · ${correct} acertos`]),
      el('div', { class: 'deck-card-progress' }, [
        el('div', { style: { width: pct + '%' } })
      ])
    ]));
  }

  return grid;
}

async function openCreate() {
  const nameInput = el('input', {
    class: 'input',
    placeholder: 'Nome do deck (ex.: Verbos irregulares)',
    attrs: { 'data-testid': 'deck-name' }
  });
  const textarea = el('textarea', {
    class: 'textarea',
    placeholder: 'exemplo\texample\nbiblioteca\tlibrary\nfoguete\trocket',
    attrs: { 'data-testid': 'deck-text' }
  });
  const preview = el('div', { class: 'tiny muted' }, ['0 cartas detectadas']);
  const example = el('div', { class: 'tiny muted', style: { lineHeight: '1.5' } }, [
    'Cada linha vira uma carta. Separadores aceitos automaticamente: ',
    el('span', { class: 'kbd' }, ['Tab']), ' ',
    el('span', { class: 'kbd' }, [';']), ' ',
    el('span', { class: 'kbd' }, [' - ']), '. ',
    'Se você copia direto do Quizlet ou de uma planilha, funciona.'
  ]);

  textarea.addEventListener('input', () => {
    const cards = parseImport(textarea.value);
    preview.textContent = `${cards.length} carta${cards.length === 1 ? '' : 's'} detectada${cards.length === 1 ? '' : 's'}`;
  });

  const content = el('div', { class: 'stack stack-3' }, [
    el('div', { class: 'stack stack-2' }, [
      el('div', { class: 'label' }, ['Nome']),
      nameInput
    ]),
    el('div', { class: 'stack stack-2' }, [
      el('div', { class: 'row-between' }, [
        el('div', { class: 'label' }, ['Cartas']),
        preview
      ]),
      textarea,
      example
    ])
  ]);

  // Focar no nome ao abrir
  setTimeout(() => nameInput.focus(), 50);

  const ok = await openModal({
    title: 'Novo deck',
    content,
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Criar', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return;

  const cards = parseImport(textarea.value);
  if (cards.length === 0) {
    await openModal({
      title: 'Sem cartas',
      content: 'Cole pelo menos uma linha no formato "frente⇥verso" (TAB entre os lados).',
      actions: [{ label: 'OK', value: true }]
    });
    return openCreate();
  }
  const deck = createDeck(nameInput.value || 'Sem título', cards);
  go(`/deck/${deck.id}`);
}
