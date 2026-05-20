// Barra de tabs. Border-bottom no ativo, scroll horizontal em mobile.

import { el } from '../core/util.js';
import { go } from './router.js';

/**
 * tabs({ items: [{ label, href }], active })
 *   `active` é o href que deve estar ativo. Clique navega via router.go.
 */
export function tabs({ items = [], active = '/' } = {}) {
  return el('div', { class: 'tabs' },
    items.map(it => {
      const isActive = it.href === active;
      return el('button', {
        class: 'tab' + (isActive ? ' tab-active' : ''),
        attrs: { type: 'button' },
        onClick: () => go(it.href)
      }, [it.label]);
    })
  );
}
