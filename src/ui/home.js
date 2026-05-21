import { el } from '../core/util.js';
import {
  listDecks, listFolders, createDeck, createFolder
} from '../core/store.js';
import { topbar } from './topbar.js';
import { openModal } from './modal.js';
import { go } from './router.js';
import { tabs } from './tabs.js';
import { toggle } from './toggle.js';
import { dropdown } from './dropdown.js';
import { iconLock } from './icons.js';
import { deckGridSkeleton } from './skeleton.js';
import { importPicker } from './importPicker.js';

export function renderHome(root, { folderFilter = null } = {}) {
  root.appendChild(topbar());

  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'stack stack-2' }, [
      el('h1', {}, ['Seus estudos']),
      el('p', { class: 'muted' }, ['Cole texto pra criar um deck. Uma linha por carta — frente e verso separados.'])
    ]),
    tabs({
      items: [
        { label: 'Meus decks', href: '/' },
        { label: 'Explorar', href: '/explorar' },
        { label: 'Pastas', href: '/pastas' }
      ],
      active: '/'
    }),
    renderFolderChips(folderFilter),
    renderDeckGrid(folderFilter)
  ]));
}

function renderFolderChips(activeFolderId) {
  const folders = listFolders();
  if (!folders.length) return el('div', { class: 'spacer', style: { display: 'none' } });

  const items = [
    { id: null, label: 'Todas' },
    ...folders.map(f => ({ id: f.id, label: f.name }))
  ];
  return el('div', { class: 'chip-row' }, items.map(it => {
    const active = (activeFolderId || null) === (it.id || null);
    return el('button', {
      class: 'chip' + (active ? ' chip-active' : ''),
      attrs: { type: 'button' },
      onClick: () => go(it.id ? `/?folder=${encodeURIComponent(it.id)}` : '/')
    }, [it.label]);
  }));
}

function renderDeckGrid(folderFilter) {
  let decks = listDecks();
  if (folderFilter) decks = decks.filter(d => d.folderId === folderFilter);

  const grid = el('div', { class: 'deck-grid' });

  grid.appendChild(el('div', {
    class: 'deck-card deck-card-new',
    onClick: openCreate,
    attrs: { 'data-testid': 'create-deck' }
  }, [
    el('div', { style: { fontSize: '28px', marginBottom: '4px' } }, ['+']),
    el('div', {}, ['Criar deck'])
  ]));

  // Loading: se ainda não houve bootstrap (deckCache vazio E não-migrado),
  // mostrar skeletons só quando não há nada. Caso bem normal: lista vazia = só "criar deck".
  if (decks.length === 0) return grid;

  for (const deck of decks) {
    const total = (deck.cards && deck.cards.length) || deck.cardCount || 0;
    const seen = (deck.cards || []).filter(c => c.stats && c.stats.lastSeenAt > 0).length;
    const correct = (deck.cards || []).reduce((s, c) => s + ((c.stats && c.stats.correct) || 0), 0);
    const pct = total ? Math.round((seen / total) * 100) : 0;

    const card = el('div', {
      class: 'deck-card',
      onClick: () => go(`/deck/${deck.id}`),
      attrs: { 'data-testid': 'deck-card' }
    }, [
      el('div', { class: 'deck-card-title' }, [deck.name]),
      el('div', { class: 'deck-card-meta' }, [`${total} cartas · ${seen} vistas · ${correct} acertos`]),
      el('div', { class: 'deck-card-progress' }, [
        el('div', { style: { width: pct + '%' } })
      ])
    ]);

    // Badge "Privado" só em deck próprio privado. Público não polui.
    if (deck.isMine && deck.isPublic === false) {
      const badge = el('span', { class: 'deck-card-badge', attrs: { title: 'Privado' } }, []);
      badge.appendChild(iconLock(11));
      badge.appendChild(document.createTextNode('Privado'));
      card.appendChild(badge);
    }

    grid.appendChild(card);
  }

  return grid;
}

// Versão exportada do skeleton — usada por router enquanto bootstrap roda.
export function renderHomeLoading(root) {
  root.appendChild(topbar());
  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'stack stack-2' }, [
      el('h1', {}, ['Seus estudos']),
      el('p', { class: 'muted' }, ['Carregando…'])
    ]),
    deckGridSkeleton(6)
  ]));
}

async function openCreate({ initialName = '', initialText = '' } = {}) {
  const nameInput = el('input', {
    class: 'input',
    placeholder: 'Nome do deck (ex.: Verbos irregulares)',
    attrs: { 'data-testid': 'deck-name' },
    value: initialName
  });
  const picker = importPicker({
    placeholder: 'exemplo\texample\nbiblioteca\tlibrary\nfoguete\trocket',
    initialText
  });

  // Toggle visibilidade — default ON (Público).
  const visibilityToggle = toggle({
    checked: true,
    labels: { on: 'Público', off: 'Privado' },
    description: (on) => on ? 'Qualquer um pode estudar e duplicar.' : 'Só você vê e edita.'
  });

  // Pasta selecionada (opcional). Anônimo/logado igual nesta sprint.
  const folders = listFolders();
  let selectedFolderId = null;
  const folderTriggerLabel = el('span', {}, ['Sem pasta']);
  const folderTrigger = el('button', {
    class: 'btn btn-sm dropdown-trigger',
    attrs: { type: 'button' }
  }, [folderTriggerLabel]);

  function setFolder(id) {
    selectedFolderId = id || null;
    const f = folders.find(x => x.id === id);
    folderTriggerLabel.textContent = f ? f.name : 'Sem pasta';
  }

  const folderDropdown = dropdown({
    trigger: folderTrigger,
    getItems: () => {
      const its = [
        { label: 'Sem pasta', value: null, active: !selectedFolderId, onSelect: () => setFolder(null) },
        ...folders.map(f => ({
          label: f.name, value: f.id,
          active: selectedFolderId === f.id,
          onSelect: () => setFolder(f.id)
        })),
        { separator: true },
        {
          label: '+ Nova pasta…',
          onSelect: async () => {
            const newName = await promptText('Nova pasta', 'Nome da pasta', '');
            if (!newName) return;
            try {
              const f = await createFolder(newName);
              folders.push({ ...f, deck_count: 0 });
              setFolder(f.id);
            } catch {
              // silencioso — usuário tenta de novo
            }
          }
        }
      ];
      return its;
    }
  });

  const visibilityRow = el('div', { class: 'row gap-3', style: { flexWrap: 'wrap', alignItems: 'flex-start' } }, [
    visibilityToggle,
    el('div', { class: 'stack stack-2', style: { gap: '4px' } }, [
      el('div', { class: 'label' }, ['Pasta']),
      folderDropdown
    ])
  ]);

  const content = el('div', { class: 'stack stack-3' }, [
    el('div', { class: 'stack stack-2' }, [
      el('div', { class: 'label' }, ['Nome']),
      nameInput
    ]),
    picker.node,
    visibilityRow
  ]);

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

  const cards = picker.getCards();
  if (cards.length === 0) {
    const text = picker.getText();
    const hasContent = text && text.trim().length > 0;
    await openModal({
      title: 'Sem cartas',
      content: hasContent
        ? 'Nenhuma linha tem frente e verso. Verifique o separador (Tab, Vírgula, …) ou — se tiver mais de 2 colunas — escolha quais usar como frente e verso.'
        : 'Cole pelo menos uma linha com frente e verso (ex.: "hello⇥olá").',
      actions: [{ label: 'OK', value: true }]
    });
    return openCreate({ initialName: nameInput.value, initialText: text });
  }
  try {
    const deck = await createDeck({
      name: nameInput.value || 'Sem título',
      cards,
      isPublic: visibilityToggle.getChecked(),
      folderId: selectedFolderId
    });
    go(`/deck/${deck.id}`);
  } catch (e) {
    await openModal({
      title: 'Erro ao criar',
      content: humanizeApiError(e),
      actions: [{ label: 'OK', value: true }]
    });
    // Preserva o que o usuário digitou pra ele poder tentar de novo sem perder tudo.
    return openCreate({ initialName: nameInput.value, initialText: picker.getText() });
  }
}

// Traduz códigos de erro do backend (api.js → ApiError com .code) pra mensagens
// úteis em pt-BR. Fallback no .message bruto pra erros que ainda não mapeamos.
function humanizeApiError(e) {
  if (!e) return 'Tente de novo.';
  const code = e.code || '';
  const map = {
    'name_required': 'Dê um nome ao deck antes de criar.',
    'rate_limit_decks_per_day': 'Você atingiu o limite diário de criação de decks. Tente de novo amanhã.',
    'too_many_cards': 'Esse deck tem cartas demais (máximo 2000 por deck).',
    'no_cards': 'Nenhuma carta válida foi enviada.',
    'invalid_folder_id': 'Pasta inválida. Tente sem pasta ou selecione outra.',
    'network': 'Sem conexão. Verifique sua internet e tente de novo.',
    'no_user': 'Sessão expirada. Recarregue a página.',
    'db_unavailable': 'Banco de dados temporariamente indisponível. Tente em alguns segundos.',
    'internal': 'Erro no servidor. Tente de novo.'
  };
  if (map[code]) return map[code];
  return e.message || 'Tente de novo.';
}

// Mini modal pra capturar texto (usado pra "+ Nova pasta…" dentro do dropdown).
async function promptText(title, label, initial) {
  const input = el('input', { class: 'input', value: initial || '' });
  setTimeout(() => { input.focus(); input.select(); }, 50);
  const ok = await openModal({
    title,
    content: el('div', { class: 'stack stack-2' }, [
      el('div', { class: 'label' }, [label]),
      input
    ]),
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'OK', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return null;
  return input.value.trim() || null;
}
