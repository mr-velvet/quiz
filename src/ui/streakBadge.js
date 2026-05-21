// Badge de streak (chama + número). Hot acima de 7 dias.

import { el } from '../core/util.js';
import { iconFlame } from './icons.js';

export function streakBadge(streak, opts = {}) {
  const cls = ['streak-badge'];
  if (streak === 0) cls.push('streak-badge-zero');
  if (streak >= 7) cls.push('streak-badge-hot');
  if (streak >= 30) cls.push('streak-badge-fire');
  // gramática singular/plural
  const ariaLabel = streak === 0
    ? 'Sem ofensiva'
    : streak === 1
      ? '1 dia de ofensiva'
      : `${streak} dias de ofensiva`;
  const node = el('div', {
    class: cls.join(' '),
    attrs: {
      'data-testid': 'topbar-streak',
      title: streak === 0 ? 'Sem ofensiva — comece hoje' : ariaLabel,
      'aria-label': ariaLabel,
      role: 'button',
      tabindex: '0'
    },
    onClick: opts.onClick
  });
  const flame = el('span', { class: 'streak-badge-flame' });
  flame.appendChild(iconFlame(14));
  node.appendChild(flame);
  node.appendChild(el('span', { class: 'streak-badge-num', attrs: { 'data-testid': 'eu-stats-streak' } }, [String(streak)]));
  return node;
}
