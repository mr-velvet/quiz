// Pill de nível global. "Lv 7 · 4.2k XP". Mobile: só ícone + número.
// Soma pending_xp (estimativa otimista durante sessão).

import { el } from '../core/util.js';
import { formatNumber } from './xpCounter.js';

export function levelBadge(stats, opts = {}) {
  const compact = opts.compact || false;
  const pending = stats.pending_xp || 0;
  const displayedXp = stats.xp_total + pending;
  const pct = stats.level_progress ? Math.max(0, Math.min(1, stats.level_progress.pct)) : 0;
  const ring = el('div', {
    class: 'level-badge-ring',
    style: { '--lv-pct': pct }
  });
  const text = compact
    ? el('span', { attrs: { 'data-testid': 'topbar-xp' } }, [`Nv ${stats.level}`])
    : el('span', { attrs: { 'data-testid': 'topbar-xp' } }, [`Nv ${stats.level} · ${formatNumber(displayedXp)} XP`]);
  return el('div', {
    class: 'level-badge' + (pending > 0 ? ' level-badge-pending' : ''),
    attrs: {
      'data-testid': 'topbar-level',
      title: `Nível ${stats.level} · ${displayedXp} XP${pending ? ` (+${pending} pendente)` : ''}`,
      'aria-label': `Nível ${stats.level}, ${displayedXp} XP`
    },
    onClick: opts.onClick
  }, [ring, text]);
}
