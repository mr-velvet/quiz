// Tela /eu — perfil/santuário do user.
// Header + heatmap 30d + medalhas + decks dominados.

import { el } from '../core/util.js';
import { topbar } from './topbar.js';
import { getStats, getMedals, loadStats, loadMedals } from '../core/stats.js';
import { heatmap } from './heatmap.js';
import { formatNumber } from './xpCounter.js';
import { go } from './router.js';

export async function renderMe(root) {
  root.appendChild(topbar({ showBack: true, title: 'Eu' }));

  const container = el('div', {
    class: 'me-page stack stack-6',
    attrs: { 'data-testid': 'me-page' }
  });
  root.appendChild(container);

  // Skeleton enquanto carrega
  container.appendChild(el('div', { class: 'me-loading muted center' }, ['Carregando...']));

  // Garante dados fresh
  await Promise.all([loadStats(), loadMedals()]);
  // Carrega top decks separado
  let topDecks = [];
  try {
    const r = await fetch('/api/me/decks-top', { credentials: 'include' });
    if (r.ok) topDecks = await r.json();
  } catch {}

  container.innerHTML = '';
  const stats = getStats();
  const medals = getMedals();

  // ----- Header -----
  const pct = stats.level_progress ? Math.max(0, Math.min(1, stats.level_progress.pct)) : 0;
  const xpInLv = stats.level_progress ? stats.level_progress.xpInLevel : 0;
  const xpForNext = stats.level_progress ? stats.level_progress.xpForNext : 100;

  container.appendChild(el('div', { class: 'me-header panel' }, [
    el('div', { class: 'me-header-top' }, [
      el('div', { class: 'me-level-big' }, [
        el('div', { class: 'me-level-num' }, [String(stats.level)]),
        el('div', { class: 'me-level-title tiny muted' }, [stats.level_title || '—'])
      ]),
      el('div', { class: 'me-header-info stack stack-2 grow' }, [
        el('div', { class: 'me-xp-line' }, [
          el('span', { class: 'me-xp-big' }, [`${formatNumber(stats.xp_total)}`]),
          el('span', { class: 'tiny muted' }, [' XP total'])
        ]),
        el('div', { class: 'me-level-bar' }, [
          el('div', { class: 'me-level-bar-fill', style: { width: `${pct * 100}%` } })
        ]),
        el('div', { class: 'tiny muted' }, [
          stats.level_progress && stats.level_progress.isCap
            ? 'Nível máximo atingido'
            : `${xpInLv} / ${xpForNext} XP até nv ${stats.level + 1}`
        ])
      ]),
      el('div', { class: 'me-streak-big' }, [
        el('div', { class: 'me-streak-flame' }, [stats.current_streak > 0 ? '🔥' : '○']),
        el('div', { class: 'me-streak-num' }, [String(stats.current_streak)]),
        el('div', { class: 'tiny muted' }, [stats.current_streak === 1 ? 'dia' : 'dias'])
      ])
    ]),
    el('div', { class: 'me-header-stats row gap-4' }, [
      kv('Recorde streak', `${stats.longest_streak} dia(s)`),
      kv('Sessões', `${stats.totals.sessions}`),
      kv('Acertos', `${stats.totals.correct}`),
      kv('Erros', `${stats.totals.wrong}`)
    ])
  ]));

  // ----- Heatmap -----
  container.appendChild(el('section', { class: 'me-section' }, [
    el('h3', { class: 'me-section-title' }, ['Últimos 30 dias']),
    heatmap(stats.heatmap || [], { days: 30 })
  ]));

  // ----- Medalhas -----
  const earnedCount = (medals.all || []).filter(m => m.earned).length;
  container.appendChild(el('section', {
    class: 'me-section',
    attrs: { 'data-testid': 'me-medals' }
  }, [
    el('div', { class: 'row-between' }, [
      el('h3', { class: 'me-section-title' }, [`Medalhas (${earnedCount}/${(medals.all || []).length})`])
    ]),
    el('div', { class: 'medals-grid' }, (medals.all || []).map(m => el('div', {
      class: `medal-card medal-tier-${m.tier}` + (m.earned ? ' medal-earned' : ' medal-locked'),
      attrs: { title: m.description, 'data-medal-code': m.code }
    }, [
      el('div', { class: 'medal-card-icon' }, [m.icon || '🏅']),
      el('div', { class: 'medal-card-name' }, [m.name]),
      el('div', { class: 'medal-card-desc tiny muted' }, [m.description])
    ])))
  ]));

  // ----- Top decks -----
  if (topDecks.length) {
    container.appendChild(el('section', {
      class: 'me-section',
      attrs: { 'data-testid': 'me-decks-list' }
    }, [
      el('h3', { class: 'me-section-title' }, ['Decks que você joga']),
      el('div', { class: 'me-decks' }, topDecks.map(d => el('div', {
        class: 'me-deck-row',
        onClick: () => go(`/deck/${d.deck_id}`)
      }, [
        el('div', { class: 'me-deck-row-name' }, [d.name]),
        el('div', { class: 'me-deck-row-meta tiny muted' }, [
          `Nv ${d.mastery_level} · ${d.mastery_title} · ${formatNumber(d.xp_deck)} XP · ${d.sessions_count} sessões`
        ])
      ])))
    ]));
  }
}

function kv(label, value) {
  return el('div', { class: 'me-kv' }, [
    el('div', { class: 'tiny muted' }, [label]),
    el('div', { class: 'me-kv-value' }, [value])
  ]);
}
