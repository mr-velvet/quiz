// Pill de nível global. "Lv 7 · 4.2k XP". Mobile: só ícone + número.

import { el } from '../core/util.js';
import { formatNumber } from './xpCounter.js';

export function levelBadge(stats, opts = {}) {
  const compact = opts.compact || false;
  const pct = stats.level_progress ? Math.max(0, Math.min(1, stats.level_progress.pct)) : 0;
  const ring = el('div', {
    class: 'level-badge-ring',
    style: { '--lv-pct': pct }
  });
  const text = compact
    ? el('span', {}, [`Nv ${stats.level}`])
    : el('span', {}, [`Nv ${stats.level} · ${formatNumber(stats.xp_total)} XP`]);
  return el('div', {
    class: 'level-badge',
    attrs: {
      'data-testid': 'topbar-level',
      title: `Nível ${stats.level} · ${stats.xp_total} XP total`,
      'aria-label': `Nível ${stats.level}, ${stats.xp_total} XP`
    },
    onClick: opts.onClick
  }, [ring, text]);
}
