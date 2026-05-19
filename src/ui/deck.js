import { el, escapeHTML } from '../core/util.js';
import { getDeck, deleteDeck, renameDeck, addCards, parseImport } from '../core/store.js';
import { topbar } from './topbar.js';
import { openModal, confirmModal } from './modal.js';
import { go } from './router.js';
import { playCardAudio, speakerButton, detectDeckLang } from '../core/audio.js';

const MODES = [
  { key: 'flashcards', icon: '🃏', title: 'Flashcards', desc: 'Vire as cartas, marque o que sabe.' },
  { key: 'multiple',   icon: '🎯', title: 'Múltipla escolha', desc: 'Escolha uma de 4 opções.' },
  { key: 'write',      icon: '✏️', title: 'Escrever', desc: 'Digite a resposta. Tolera typos.' },
  { key: 'match',      icon: '🧩', title: 'Match', desc: 'Pareie termos e definições contra o tempo.' },
  { key: 'speed',      icon: '⚡', title: 'Speed round', desc: '60 segundos. Quantos você acerta?' }
];

export function renderDeck(root, deckId) {
  const deck = getDeck(deckId);
  if (!deck) { go('/'); return; }

  root.appendChild(topbar({ showBack: true }));

  const total = deck.cards.length;
  const correct = deck.cards.reduce((s, c) => s + c.stats.correct, 0);
  const wrong = deck.cards.reduce((s, c) => s + c.stats.wrong, 0);

  root.appendChild(el('div', { class: 'stack stack-6' }, [
    // Header
    el('div', { class: 'row-between' }, [
      el('div', { class: 'stack stack-2' }, [
        el('h1', {}, [deck.name]),
        el('div', { class: 'row gap-2' }, [
          el('span', { class: 'pill' }, [`${total} cartas`]),
          el('span', { class: 'pill pill-good' }, [`✓ ${correct}`]),
          el('span', { class: 'pill pill-bad' }, [`✕ ${wrong}`]),
          deck.records?.match ? el('span', { class: 'pill' }, [`🧩 ${(deck.records.match.timeMs / 1000).toFixed(1)}s`]) : null,
          deck.records?.speed ? el('span', { class: 'pill' }, [`⚡ ${deck.records.speed.correct}`]) : null
        ])
      ]),
      el('div', { class: 'row gap-2' }, [
        el('button', { class: 'btn btn-sm', onClick: () => openAddCards(deck.id) }, ['+ Cartas']),
        el('button', { class: 'btn btn-sm', onClick: () => openRename(deck) }, ['Renomear']),
        el('button', { class: 'btn btn-sm btn-danger', onClick: () => onDelete(deck) }, ['Deletar'])
      ])
    ]),

    // Modos
    el('div', { class: 'stack stack-3' }, [
      el('h2', {}, ['Modos de estudo']),
      el('div', { class: 'mode-grid' },
        MODES.map(m => el('div', {
          class: 'mode-card',
          onClick: () => go(`/play/${deck.id}/${m.key}`),
          attrs: { 'data-testid': `mode-${m.key}` }
        }, [
          el('div', { class: 'mode-card-icon' }, [m.icon]),
          el('div', { class: 'mode-card-title' }, [m.title]),
          el('div', { class: 'mode-card-desc' }, [m.desc])
        ]))
      )
    ]),

    // Lista de cartas
    el('div', { class: 'stack stack-3' }, [
      el('h2', {}, [`Cartas (${total})`]),
      total === 0
        ? el('div', { class: 'empty' }, [
            el('h2', {}, ['Deck vazio']),
            el('p', {}, ['Adicione cartas pra começar.'])
          ])
        : el('div', { class: 'stack stack-2' },
            (() => {
              const lang = detectDeckLang(deck);
              return deck.cards.map((c, i) => el('div', {
                class: 'panel card-row',
                style: { padding: '12px 16px' }
              }, [
                el('div', { class: 'tiny muted card-row-idx' }, [String(i + 1).padStart(2, '0')]),
                el('div', { class: 'card-row-front' }, [c.front]),
                el('div', { class: 'card-row-front-audio' }, [speakerButton(() => playCardAudio(deck.id, c.id, 'front', lang?.front))]),
                el('div', { class: 'muted card-row-back' }, [c.back]),
                el('div', { class: 'card-row-back-audio' }, [speakerButton(() => playCardAudio(deck.id, c.id, 'back', lang?.back))]),
                el('div', { class: 'tiny muted card-row-stats' }, [`${c.stats.correct}/${c.stats.correct + c.stats.wrong}`])
              ]));
            })()
          )
    ])
  ]));
}

async function openRename(deck) {
  const input = el('input', { class: 'input', value: deck.name });
  setTimeout(() => { input.focus(); input.select(); }, 50);
  const ok = await openModal({
    title: 'Renomear deck',
    content: input,
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Salvar', value: true, variant: 'primary' }
    ]
  });
  if (ok) renameDeck(deck.id, input.value);
}

async function onDelete(deck) {
  const ok = await confirmModal('Deletar deck?', `"${deck.name}" e suas ${deck.cards.length} cartas serão removidos do navegador. Isso não pode ser desfeito.`);
  if (ok) { deleteDeck(deck.id); go('/'); }
}

async function openAddCards(deckId) {
  const ta = el('textarea', {
    class: 'textarea',
    placeholder: 'Cole linhas no formato frente⇥verso'
  });
  const preview = el('div', { class: 'tiny muted' }, ['0 cartas']);
  ta.addEventListener('input', () => {
    const cards = parseImport(ta.value);
    preview.textContent = `${cards.length} cartas`;
  });
  setTimeout(() => ta.focus(), 50);

  const ok = await openModal({
    title: 'Adicionar cartas',
    content: el('div', { class: 'stack stack-2' }, [preview, ta]),
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Adicionar', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return;
  const cards = parseImport(ta.value);
  if (cards.length) addCards(deckId, cards);
}
