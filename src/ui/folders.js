import { el } from '../core/util.js';
import { topbar } from './topbar.js';
import { tabs } from './tabs.js';
import { openModal, confirmModal } from './modal.js';
import {
  listFolders, createFolder, renameFolder, deleteFolder, reloadFolders
} from '../core/store.js';
import { iconFolder } from './icons.js';
import { go } from './router.js';
import { toast } from './toast.js';

export function renderFolders(root) {
  root.appendChild(topbar());

  const listWrap = el('div', { class: 'stack stack-2' });

  const newBtn = el('button', {
    class: 'btn btn-primary btn-sm',
    onClick: onCreate
  }, ['+ Nova pasta']);

  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'row-between' }, [
      el('h1', {}, ['Pastas']),
      newBtn
    ]),
    tabs({
      items: [
        { label: 'Meus decks', href: '/' },
        { label: 'Explorar', href: '/explorar' },
        { label: 'Pastas', href: '/pastas' }
      ],
      active: '/pastas'
    }),
    listWrap
  ]));

  function render() {
    listWrap.innerHTML = '';
    const folders = listFolders();
    if (!folders.length) {
      listWrap.appendChild(el('div', { class: 'empty' }, [
        el('h2', {}, ['Nenhuma pasta ainda.']),
        el('p', {}, ['Pastas agrupam seus decks por tema.'])
      ]));
      return;
    }
    for (const f of folders) listWrap.appendChild(renderRow(f));
  }

  function renderRow(folder) {
    const iconSlot = el('span', { class: 'folder-row-icon' });
    iconSlot.appendChild(iconFolder(16));

    const main = el('div', {
      class: 'folder-row-main',
      onClick: () => go(`/?folder=${encodeURIComponent(folder.id)}`)
    }, [
      iconSlot,
      el('div', { class: 'folder-row-name' }, [folder.name]),
      el('div', { class: 'folder-row-count' }, [`· ${folder.deck_count || 0} deck${folder.deck_count === 1 ? '' : 's'}`])
    ]);

    return el('div', { class: 'panel folder-row' }, [
      main,
      el('button', {
        class: 'btn btn-sm',
        onClick: (e) => { e.stopPropagation(); onRename(folder); }
      }, ['Renomear']),
      el('button', {
        class: 'btn btn-sm btn-danger',
        onClick: (e) => { e.stopPropagation(); onDelete(folder); }
      }, ['Deletar'])
    ]);
  }

  async function onCreate() {
    const name = await promptText('Nova pasta', 'Nome da pasta');
    if (!name) return;
    try {
      await createFolder(name);
      render();
    } catch {
      toast('Erro ao criar.', { kind: 'error' });
    }
  }

  async function onRename(folder) {
    const name = await promptText('Renomear pasta', 'Novo nome', folder.name);
    if (!name) return;
    try {
      await renameFolder(folder.id, name);
      render();
    } catch {
      toast('Erro ao renomear.', { kind: 'error' });
    }
  }

  async function onDelete(folder) {
    const ok = await confirmModal('Deletar pasta?', `Os decks dentro dela voltam pra "Sem pasta". Não vão ser deletados.`);
    if (!ok) return;
    try {
      await deleteFolder(folder.id);
      render();
    } catch {
      toast('Erro ao deletar.', { kind: 'error' });
    }
  }

  // Renderiza inicial; também reage a flashy:change (store atualizou).
  render();
  // Garantir dados frescos.
  reloadFolders().then(render).catch(() => {});
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
