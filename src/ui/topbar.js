import { el } from '../core/util.js';
import { go, back } from './router.js';

export function topbar({ showBack = false, title = '' } = {}) {
  const left = showBack
    ? el('button', { class: 'btn btn-ghost', onClick: back, attrs: { 'aria-label': 'Voltar' } }, ['← Voltar'])
    : el('div', { class: 'brand', onClick: () => go('/') }, [
        el('div', { class: 'brand-mark' }, ['F']),
        el('span', {}, ['Flashy'])
      ]);

  const right = el('div', { class: 'row gap-2' }, [
    el('span', { class: 'tiny muted' }, ['Anônimo · local'])
  ]);

  return el('div', { class: 'topbar' }, [
    left,
    title ? el('div', { class: 'muted tiny' }, [title]) : null,
    right
  ]);
}
