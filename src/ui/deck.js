import { el } from '../core/util.js';
import {
  getDeck, fetchDeck, deleteDeck, renameDeck, addCards,
  setDeckVisibility, moveDeckToFolder, cloneDeck,
  listFolders, createFolder
} from '../core/store.js';
import { importPicker } from './importPicker.js';
import * as api from '../core/api.js';
import { topbar } from './topbar.js';
import { openModal, confirmModal } from './modal.js';
import { go } from './router.js';
import { playCardAudio, speakerButton, detectDeckLang } from '../core/audio.js';
import { toggle } from './toggle.js';
import { dropdown } from './dropdown.js';
import { toast } from './toast.js';
import { iconLock, iconGlobe, iconKebab } from './icons.js';
import { deckGridSkeleton } from './skeleton.js';
import { cardMenu } from './cardMenu.js';
import { revisionCta } from './revisionCta.js';
import { ensureDeckList } from '../core/reviewList.js';

const MODES = [
  { key: 'flashcards', icon: '🃏', title: 'Flashcards', desc: 'Vire as cartas, marque o que sabe.' },
  { key: 'multiple',   icon: '🎯', title: 'Múltipla escolha', desc: 'Escolha uma de 4 opções.' },
  { key: 'write',      icon: '✏️', title: 'Escrever', desc: 'Digite a resposta. Tolera typos.' },
  { key: 'match',      icon: '🧩', title: 'Match', desc: 'Pareie termos e definições contra o tempo.' },
  { key: 'speed',      icon: '⚡', title: 'Speed round', desc: '60 segundos. Quantos você acerta?' }
];

export function renderDeck(root, deckId) {
  // Render assíncrono. Marca o root com um token; se o user navegar pra
  // outra rota antes do fetch resolver, o router troca o conteúdo do root
  // e o token muda — então ignoramos o paint tardio (senão o detalhe
  // sobrescreve o modo de jogo que acabou de carregar).
  const token = Symbol('renderDeck');
  root.__renderToken = token;
  function isStale() { return root.__renderToken !== token; }

  const cached = getDeck(deckId);
  if (cached && cached.cards && cached.cards.length > 0) {
    paint(root, cached);
  } else {
    paintLoading(root);
  }
  fetchDeck(deckId).then(d => { if (!isStale()) paint(root, d); }).catch(err => {
    if (isStale()) return;
    if (err && err.status === 404) {
      go('/');
      toast('Esse deck não existe mais.', { kind: 'error' });
    } else {
      toast('Erro ao carregar deck.', { kind: 'error' });
    }
  });
}

function paintLoading(root) {
  root.innerHTML = '';
  root.appendChild(topbar({ showBack: true }));
  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'skeleton', style: { height: '36px', width: '60%' } }),
    deckGridSkeleton(3)
  ]));
}

function paint(root, deck) {
  root.innerHTML = '';
  root.appendChild(topbar({ showBack: true }));

  const cards = deck.cards || [];
  const total = cards.length;
  const correct = cards.reduce((s, c) => s + ((c.stats && c.stats.correct) || 0), 0);
  const wrong = cards.reduce((s, c) => s + ((c.stats && c.stats.wrong) || 0), 0);

  const isMine = !!deck.isMine;
  const isPublic = deck.isPublic !== false;

  // Linha de identidade — só pra deck de outro.
  const identityLine = !isMine
    ? el('div', { class: 'tiny muted' }, ['por anônimo'])
    : null;

  // Atribuição "baseado em X" (30 dias após clone — backend já filtra).
  const sourceLine = deck.sourceName
    ? el('div', { class: 'tiny muted' }, [`baseado em "${deck.sourceName}"`])
    : null;

  // Pills topo: badge visibilidade primeiro (se dono), depois stats.
  const pills = el('div', { class: 'row gap-2', style: { flexWrap: 'wrap' } });
  if (isMine) pills.appendChild(visibilityPill(deck));
  pills.appendChild(el('span', { class: 'pill' }, [`${total} cartas`]));
  pills.appendChild(el('span', { class: 'pill pill-good' }, [`✓ ${correct}`]));
  pills.appendChild(el('span', { class: 'pill pill-bad' }, [`✕ ${wrong}`]));
  if (deck.records?.match) pills.appendChild(el('span', { class: 'pill' }, [`🧩 ${(deck.records.match.timeMs / 1000).toFixed(1)}s`]));
  if (deck.records?.speed) pills.appendChild(el('span', { class: 'pill' }, [`⚡ ${deck.records.speed.correct}`]));

  // Pill de nível do deck — fetch async, atualiza in-place quando responder
  const levelPill = el('span', { class: 'pill deck-level-pill' }, ['Lv —']);
  pills.appendChild(levelPill);
  fetch(`/api/decks/${encodeURIComponent(deck.id)}/stats`, { credentials: 'include' })
    .then(r => r.ok ? r.json() : null)
    .then(s => {
      if (!s) return;
      levelPill.innerHTML = '';
      levelPill.appendChild(document.createTextNode(`Lv ${s.mastery_level} · ${s.mastery_title} · ${s.xp_deck} XP`));
      const bar = el('div', { class: 'deck-level-pill-bar' }, [
        el('div', { class: 'deck-level-pill-bar-fill', style: { width: `${Math.round((s.progress?.pct || 0) * 100)}%` } })
      ]);
      pills.appendChild(bar);
    })
    .catch(() => {});

  // Ações condicionais por ownership.
  const actions = isMine ? renderOwnerActions(deck) : renderVisitorActions(deck);

  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'row-between deck-header', style: { flexWrap: 'wrap', gap: '12px' } }, [
      el('div', { class: 'stack stack-2' }, [
        sourceLine,
        identityLine,
        el('h1', {}, [deck.name]),
        pills
      ]),
      actions
    ]),

    // Modos
    el('div', { class: 'stack stack-3' }, [
      el('h2', {}, ['Modos de estudo']),
      revisionCta({ deck }),
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
              // Garante cache de revisão pra esse deck antes de pintar
              // (o cardMenu lê o estado on/off via getter síncrono).
              ensureDeckList(deck.id).catch(() => {});
              return cards.map((c, i) => el('div', {
                class: 'panel card-row',
                style: { padding: '12px 16px' }
              }, [
                el('div', { class: 'tiny muted card-row-idx' }, [String(i + 1).padStart(2, '0')]),
                el('div', { class: 'card-row-front' }, [c.front]),
                el('div', { class: 'card-row-front-audio' }, [speakerButton(() => playCardAudio(deck.id, c.id, 'front', lang?.front))]),
                el('div', { class: 'muted card-row-back' }, [c.back]),
                el('div', { class: 'card-row-back-audio' }, [speakerButton(() => playCardAudio(deck.id, c.id, 'back', lang?.back))]),
                el('div', { class: 'tiny muted card-row-stats' }, [
                  isMine ? `${(c.stats && c.stats.correct) || 0}/${((c.stats && c.stats.correct) || 0) + ((c.stats && c.stats.wrong) || 0)}` : ''
                ]),
                el('div', { class: 'card-row-menu' }, [cardMenu({ card: c, deck, context: 'deck', lang })])
              ]));
            })()
          )
    ])
  ]));
}

function visibilityPill(deck) {
  const isPublic = deck.isPublic !== false;
  const pill = el('span', {
    class: 'pill',
    style: { cursor: 'pointer' },
    attrs: { title: 'Trocar visibilidade' },
    onClick: () => toggleVisibility(deck)
  });
  if (isPublic) {
    pill.appendChild(iconGlobe(11));
    pill.appendChild(document.createTextNode(' Público'));
  } else {
    pill.appendChild(iconLock(11));
    pill.appendChild(document.createTextNode(' Privado'));
  }
  return pill;
}

async function toggleVisibility(deck) {
  const target = !(deck.isPublic !== false); // toggle
  const wantPublic = target;
  // Confirm leve.
  const title = wantPublic ? 'Tornar deck público?' : 'Tornar privado?';
  const body = wantPublic
    ? 'Qualquer um vai poder achar, estudar e duplicar. Você ainda controla a edição.'
    : 'Some da busca. Quem já duplicou mantém a cópia.';
  const ok = await openModal({
    title,
    content: body,
    actions: [
      { label: 'Cancelar', value: false },
      { label: wantPublic ? 'Tornar público' : 'Tornar privado', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return;
  try {
    await setDeckVisibility(deck.id, wantPublic);
    toast(wantPublic ? 'Agora é público.' : 'Agora é privado.', { kind: 'success' });
  } catch {
    toast('Erro ao atualizar.', { kind: 'error' });
  }
}

function renderOwnerActions(deck) {
  // Em mobile, condensa ações em kebab. Em desktop, mostra inline.
  const isMobile = window.matchMedia('(max-width: 600px)').matches;

  if (isMobile) {
    const kebabBtn = el('button', { class: 'btn btn-sm btn-icon', attrs: { type: 'button', 'aria-label': 'Mais ações' } });
    kebabBtn.appendChild(iconKebab(16));
    const kebab = dropdown({
      trigger: kebabBtn,
      align: 'right',
      getItems: () => [
        { label: '+ Cartas', onSelect: () => openAddCards(deck.id) },
        { label: 'Renomear', onSelect: () => openRename(deck) },
        { label: 'Mover pra pasta', onSelect: () => openMoveFolder(deck) },
        { separator: true },
        { label: 'Deletar', onSelect: () => onDelete(deck) }
      ]
    });
    return kebab;
  }

  return el('div', { class: 'row gap-2', style: { flexWrap: 'wrap' } }, [
    el('button', { class: 'btn btn-sm', onClick: () => openAddCards(deck.id) }, ['+ Cartas']),
    el('button', { class: 'btn btn-sm', onClick: () => openRename(deck) }, ['Renomear']),
    el('button', { class: 'btn btn-sm', onClick: () => openMoveFolder(deck) }, ['Mover']),
    el('button', { class: 'btn btn-sm btn-danger', onClick: () => onDelete(deck) }, ['Deletar'])
  ]);
}

function renderVisitorActions(deck) {
  return el('div', { class: 'row gap-2', style: { flexWrap: 'wrap' } }, [
    el('button', {
      class: 'btn btn-primary btn-sm',
      onClick: () => onClone(deck)
    }, ['Duplicar pro meu']),
    el('button', {
      class: 'btn btn-sm',
      onClick: () => onReport(deck)
    }, ['Reportar'])
  ]);
}

async function onClone(deck) {
  try {
    const cloned = await cloneDeck(deck.id);
    toast('Deck duplicado pra você.', { kind: 'success' });
    go(`/deck/${cloned.id}`);
  } catch (e) {
    if (e && e.status === 429) {
      toast('Limite diário de novos decks atingido. Tente amanhã.', { kind: 'error' });
    } else {
      toast('Erro ao duplicar.', { kind: 'error' });
    }
  }
}

async function onReport(deck) {
  const reasonInput = el('input', { class: 'input', placeholder: 'spam, ofensivo, plágio…' });
  const detailInput = el('textarea', { class: 'textarea', style: { minHeight: '100px' }, placeholder: 'Detalhes (opcional)' });
  setTimeout(() => reasonInput.focus(), 50);
  const ok = await openModal({
    title: 'Reportar deck',
    content: el('div', { class: 'stack stack-3' }, [
      el('div', { class: 'stack stack-2' }, [el('div', { class: 'label' }, ['Motivo']), reasonInput]),
      el('div', { class: 'stack stack-2' }, [el('div', { class: 'label' }, ['Detalhes']), detailInput])
    ]),
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Enviar', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return;
  if (!reasonInput.value.trim()) return;
  try {
    await api.reportDeck(deck.id, reasonInput.value.trim(), detailInput.value.trim());
    toast('Reporte enviado. Obrigado.', { kind: 'success' });
  } catch {
    toast('Erro ao reportar.', { kind: 'error' });
  }
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
  if (!ok) return;
  try {
    await renameDeck(deck.id, input.value);
  } catch {
    toast('Erro ao renomear.', { kind: 'error' });
  }
}

async function openMoveFolder(deck) {
  const folders = listFolders();
  if (!folders.length) {
    // Sem pastas: pede pra criar uma na hora.
    const name = await promptText('Nova pasta', 'Nome da pasta');
    if (!name) return;
    try {
      const f = await createFolder(name);
      await moveDeckToFolder(deck.id, f.id);
      toast(`Movido pra "${name}".`, { kind: 'success' });
    } catch {
      toast('Erro ao mover.', { kind: 'error' });
    }
    return;
  }

  // Modal com lista de pastas.
  const items = [
    { id: null, name: 'Sem pasta' },
    ...folders
  ];
  // Construímos lista de botões.
  let pick = deck.folderId || null;
  const list = el('div', { class: 'stack stack-2' });
  function rebuild() {
    list.innerHTML = '';
    for (const it of items) {
      const isActive = (it.id || null) === (pick || null);
      list.appendChild(el('button', {
        class: 'btn ' + (isActive ? 'btn-primary' : ''),
        style: { justifyContent: 'flex-start', width: '100%' },
        onClick: () => { pick = it.id; rebuild(); }
      }, [it.name]));
    }
  }
  rebuild();

  const ok = await openModal({
    title: 'Mover deck',
    content: list,
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Mover', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return;
  try {
    await moveDeckToFolder(deck.id, pick || null);
    toast('Movido.', { kind: 'success' });
  } catch {
    toast('Erro ao mover.', { kind: 'error' });
  }
}

async function onDelete(deck) {
  const ok = await confirmModal('Deletar deck?', `"${deck.name}" e suas ${deck.cards.length} cartas serão removidos. Isso não pode ser desfeito.`);
  if (!ok) return;
  try {
    await deleteDeck(deck.id);
    go('/');
  } catch {
    toast('Erro ao deletar.', { kind: 'error' });
  }
}

async function openAddCards(deckId) {
  const picker = importPicker({
    placeholder: 'Cole linhas no formato frente\tverso'
  });
  setTimeout(() => picker.focus(), 50);

  const ok = await openModal({
    title: 'Adicionar cartas',
    content: picker.node,
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Adicionar', value: true, variant: 'primary' }
    ]
  });
  if (!ok) return;
  const cards = picker.getCards();
  if (!cards.length) return;
  try {
    await addCards(deckId, cards);
  } catch {
    toast('Erro ao adicionar.', { kind: 'error' });
  }
}

async function promptText(title, label, initial = '') {
  const input = el('input', { class: 'input', value: initial });
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
