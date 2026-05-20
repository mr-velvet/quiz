// Skeleton placeholders pra loading. Sem spinner girando.

import { el } from '../core/util.js';

export function deckCardSkeleton() {
  return el('div', { class: 'deck-card deck-card-skeleton' }, [
    el('div', { class: 'skeleton skeleton-line skeleton-title' }),
    el('div', { class: 'skeleton skeleton-line skeleton-meta' }),
    el('div', { class: 'skeleton skeleton-bar' })
  ]);
}

export function deckGridSkeleton(count = 6) {
  const grid = el('div', { class: 'deck-grid' });
  for (let i = 0; i < count; i++) grid.appendChild(deckCardSkeleton());
  return grid;
}
