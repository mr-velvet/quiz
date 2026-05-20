// Badge de streak (🔥 N). Hot acima de 7 dias.

import { el } from '../core/util.js';

export function streakBadge(streak, opts = {}) {
  const cls = ['streak-badge'];
  if (streak === 0) cls.push('streak-badge-zero');
  if (streak >= 7) cls.push('streak-badge-hot');
  if (streak >= 30) cls.push('streak-badge-fire');
  return el('div', {
    class: cls.join(' '),
    attrs: {
      'data-testid': 'topbar-streak',
      title: streak === 0 ? 'Sem ofensiva — comece hoje' : `${streak} dia(s) de ofensiva`,
      'aria-label': streak === 0 ? 'Sem ofensiva' : `${streak} dias de ofensiva`
    },
    onClick: opts.onClick
  }, [
    el('span', { class: 'streak-badge-flame' }, [streak >= 7 ? '🔥' : streak > 0 ? '🔥' : '○']),
    el('span', { class: 'streak-badge-num' }, [String(streak)])
  ]);
}
