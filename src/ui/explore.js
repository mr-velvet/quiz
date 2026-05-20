import { el } from '../core/util.js';
import { topbar } from './topbar.js';
import { tabs } from './tabs.js';
import { dropdown } from './dropdown.js';
import { iconSearch } from './icons.js';
import { deckGridSkeleton } from './skeleton.js';
import { explore as apiExplore } from '../core/api.js';
import { go } from './router.js';
import { toast } from './toast.js';

// Estado da tela mantido no closure de render — recarregar a rota
// (re-instanciar o módulo) reseta tudo, que é o que queremos.
export function renderExplore(root) {
  root.appendChild(topbar());

  let sort = 'popular';
  let q = '';
  let page = 1;
  let hasMore = false;
  let items = [];
  let loading = false;
  let searchDebounceId = null;

  const grid = el('div', { class: 'deck-grid' });
  const moreWrap = el('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '12px' } });

  // Trigger do dropdown de ordenação.
  const sortLabel = el('span', {}, ['Populares']);
  const sortTrigger = el('button', { class: 'btn btn-sm dropdown-trigger', attrs: { type: 'button' } }, [sortLabel]);
  const sortDropdown = dropdown({
    trigger: sortTrigger,
    align: 'right',
    getItems: () => [
      {
        label: 'Populares', value: 'popular',
        active: sort === 'popular',
        onSelect: () => { sort = 'popular'; sortLabel.textContent = 'Populares'; reset(); }
      },
      {
        label: 'Recentes', value: 'recent',
        active: sort === 'recent',
        onSelect: () => { sort = 'recent'; sortLabel.textContent = 'Recentes'; reset(); }
      }
    ]
  });

  // Input de busca com debounce.
  const searchInput = el('input', {
    class: 'input',
    attrs: { type: 'text', placeholder: 'Buscar por nome ou tema…', 'data-testid': 'explore-search' }
  });
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceId);
    searchDebounceId = setTimeout(() => {
      q = searchInput.value.trim();
      reset();
    }, 300);
  });

  const searchWrap = el('div', { class: 'input-search' }, [
    el('span', { class: 'input-search-icon' }, [iconSearch(14)]),
    searchInput
  ]);

  root.appendChild(el('div', { class: 'stack stack-6' }, [
    el('div', { class: 'stack stack-2' }, [
      el('h1', {}, ['Explorar']),
      el('p', { class: 'muted' }, ['Decks públicos da galera. Duplique pro seu pra estudar com suas próprias stats.'])
    ]),
    tabs({
      items: [
        { label: 'Meus decks', href: '/' },
        { label: 'Explorar', href: '/explorar' },
        { label: 'Pastas', href: '/pastas' }
      ],
      active: '/explorar'
    }),
    el('div', { class: 'row gap-3', style: { flexWrap: 'wrap' } }, [
      searchWrap,
      sortDropdown
    ]),
    grid,
    moreWrap
  ]));

  function reset() {
    items = [];
    page = 1;
    hasMore = false;
    render();
    load();
  }

  function render() {
    grid.innerHTML = '';
    moreWrap.innerHTML = '';
    if (loading && items.length === 0) {
      const sk = deckGridSkeleton(6);
      // sk é um deck-grid também — copia filhos.
      while (sk.firstChild) grid.appendChild(sk.firstChild);
      return;
    }
    if (!items.length) {
      grid.appendChild(el('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, [
        el('h2', {}, ['Nada encontrado por aqui.']),
        el('p', {}, ['Tente outro termo ou ordenação.'])
      ]));
      return;
    }
    for (const d of items) grid.appendChild(renderCard(d));
    if (hasMore) {
      moreWrap.appendChild(el('button', {
        class: 'btn',
        onClick: () => { page++; load(/* append */ true); }
      }, [loading ? 'Carregando…' : 'Carregar mais']));
    }
  }

  function renderCard(d) {
    return el('div', {
      class: 'deck-card',
      onClick: () => go(`/deck/${d.id}`),
      attrs: { 'data-testid': 'explore-card' }
    }, [
      el('div', { class: 'deck-card-author' }, [d.isMine ? 'por você' : 'por anônimo']),
      el('div', { class: 'deck-card-title' }, [d.name]),
      el('div', { class: 'deck-card-meta' }, [
        `${d.cardCount || 0} carta${d.cardCount === 1 ? '' : 's'}`,
        ` · usado por ${d.cloneCount || 0}`
      ])
    ]);
  }

  async function load(append = false) {
    loading = true;
    render();
    try {
      const res = await apiExplore({ sort, q, page });
      const newItems = res.items || [];
      items = append ? [...items, ...newItems] : newItems;
      hasMore = !!res.hasMore;
    } catch (e) {
      toast('Erro ao buscar. Tente de novo.', { kind: 'error' });
      hasMore = false;
    } finally {
      loading = false;
      render();
    }
  }

  load();
}
