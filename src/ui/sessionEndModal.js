// Tela de fim de sessão. Componente reutilizado pelos 5 modos.
// Substitui os renderResult particulares dos games.
//
// API: open({ summary, finishResponse, onReplay, onBack, deckId, mode })
// Modal custom (closeAllModals do router já cobre).

import { el } from '../core/util.js';
import { animateNumber, formatNumber } from './xpCounter.js';
import { burst, rain } from './confetti.js';
import { getMedalMeta } from '../core/medals.js';
import { go } from './router.js';
import { fmtTime } from '../core/util.js';

export function openSessionEndModal({ summary, finishResponse, onReplay, onBack, deckId, mode }) {
  // Fecha qualquer modal aberto antes
  document.querySelectorAll('.modal-backdrop').forEach(n => n.remove());

  const xp = finishResponse ? finishResponse.xp_earned : 0;
  const bonus = finishResponse ? finishResponse.bonus : 0;
  const newMedals = finishResponse ? (finishResponse.new_medals || []) : [];
  const levelUp = finishResponse ? finishResponse.level_up : null;
  const deckLevelUp = finishResponse ? finishResponse.deck_level_up : null;
  const streakMarker = finishResponse ? finishResponse.streak_marker : null;

  const accuracy = summary.accuracy;
  const isClean = summary.cardsTotal >= 10 && summary.wrong === 0;

  const xpNode = el('div', {
    class: 'session-end-xp',
    attrs: { 'data-testid': 'session-end-xp' }
  }, ['0']);

  const backdrop = el('div', { class: 'modal-backdrop session-end-backdrop' }, [
    el('div', {
      class: 'modal session-end-modal' + (isClean ? ' session-end-clean' : ''),
      attrs: { 'data-testid': 'session-end-modal' }
    }, [
      // Header
      el('div', { class: 'session-end-header' }, [
        el('div', { class: 'session-end-emoji' }, [
          accuracy >= 90 ? '🎯' : accuracy >= 70 ? '💪' : accuracy >= 40 ? '📚' : '🌱'
        ]),
        el('h2', {}, [isClean ? 'Sessão limpa!' : 'Sessão concluída']),
        el('div', { class: 'muted' }, [
          isClean ? '100% de acerto' : `${accuracy}% de acerto`
        ])
      ]),

      // XP grandão (anima 0 → xp)
      el('div', { class: 'session-end-xp-wrap' }, [
        xpNode,
        el('div', { class: 'session-end-xp-label' }, ['XP nesta sessão'])
      ]),

      // Breakdown
      el('div', { class: 'session-end-stats' }, [
        statItem('Acertos', `${summary.correct} / ${summary.cardsTotal}`),
        statItem('Melhor combo', `${summary.maxCombo}`),
        statItem('Tempo', fmtTime(summary.durationMs)),
        bonus > 0 ? statItem('Bônus', `+${bonus} XP`, 'good') : null
      ].filter(Boolean)),

      // Level up banner
      levelUp ? el('div', {
        class: 'session-end-levelup',
        attrs: { 'data-testid': 'level-up-banner' }
      }, [
        el('div', { class: 'session-end-levelup-icon' }, ['⬆']),
        el('div', {}, [
          el('div', { class: 'session-end-levelup-title' }, [`Subiu pro nível ${levelUp.to}!`]),
          el('div', { class: 'tiny muted' }, [`Antes: Nv ${levelUp.from}`])
        ])
      ]) : null,

      // Deck level up
      deckLevelUp ? el('div', { class: 'session-end-levelup session-end-levelup-deck' }, [
        el('div', { class: 'session-end-levelup-icon' }, ['📖']),
        el('div', {}, [
          el('div', { class: 'session-end-levelup-title' }, [`Nível ${deckLevelUp.to} no deck`])
        ])
      ]) : null,

      // Streak marker
      streakMarker && streakMarker !== 'same_day' ? el('div', { class: 'session-end-streak' }, [
        el('span', {}, ['🔥']),
        el('span', {}, [streakMessage(streakMarker, finishResponse.stats.current_streak)])
      ]) : null,

      // Medalhas
      newMedals.length ? el('div', { class: 'session-end-medals' }, [
        el('div', { class: 'session-end-medals-title' }, [
          newMedals.length === 1 ? 'Medalha conquistada' : `${newMedals.length} medalhas conquistadas`
        ]),
        el('div', { class: 'session-end-medals-grid' }, newMedals.map(code => {
          const meta = getMedalMeta(code);
          if (!meta) return null;
          return el('div', {
            class: `session-end-medal medal-tier-${meta.tier}`,
            attrs: { 'data-testid': `session-end-medal-${code}` }
          }, [
            el('div', { class: 'session-end-medal-icon' }, [meta.icon || '🏅']),
            el('div', { class: 'session-end-medal-name' }, [meta.name])
          ]);
        }).filter(Boolean))
      ]) : null,

      // Ações
      el('div', { class: 'session-end-actions' }, [
        el('button', {
          class: 'btn',
          onClick: () => { backdrop.remove(); if (onBack) onBack(); else go(`/deck/${deckId}`); }
        }, ['Voltar ao deck']),
        el('button', {
          class: 'btn btn-primary',
          onClick: () => { backdrop.remove(); if (onReplay) onReplay(); }
        }, ['Jogar de novo'])
      ])
    ])
  ]);

  // Fecha clicando fora
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  // ESC fecha
  const onKey = (e) => { if (e.key === 'Escape') { backdrop.remove(); window.removeEventListener('keydown', onKey); } };
  window.addEventListener('keydown', onKey);

  document.body.appendChild(backdrop);

  // Anima XP número subindo
  setTimeout(() => animateNumber(xpNode, 0, xp, 1100), 80);

  // Confetti se mereceu
  if (isClean && xp > 0) {
    setTimeout(() => rain({ duration: 1500 }), 200);
  } else if (xp >= 100) {
    setTimeout(() => burst({ size: 'normal' }), 250);
  }
  if (newMedals.length) {
    setTimeout(() => burst({ size: newMedals.length >= 2 ? 'big' : 'normal' }), 600);
  }

  return backdrop;
}

function statItem(label, value, tone) {
  return el('div', { class: 'session-end-stat' + (tone ? ` session-end-stat-${tone}` : '') }, [
    el('div', { class: 'tiny muted' }, [label]),
    el('div', { class: 'session-end-stat-value' }, [value])
  ]);
}

function streakMessage(marker, streak) {
  if (marker === 'continue') return `Dia ${streak} da ofensiva`;
  if (marker === 'grace')    return `Dia ${streak} (com 1 dia de folga)`;
  if (marker === 'new')      return `Ofensiva iniciada — dia 1`;
  if (marker === 'reset')    return `Nova ofensiva — dia 1`;
  return `Dia ${streak} da ofensiva`;
}
