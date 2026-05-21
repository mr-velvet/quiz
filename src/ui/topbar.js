// Topbar com gamificação. Streak + nível + mute + atalho pra /eu.
//
// Reactiva: re-renderiza chunk-da-direita ao receber 'statsChange'.
// Container fica vivo entre renderizações de página (re-criado a cada render
// de tela, mas re-attacha listeners por instância).

import { el } from '../core/util.js';
import { go, back, registerCleanup } from './router.js';
import { getStats } from '../core/stats.js';
import { onKind } from '../core/events.js';
import { streakBadge } from './streakBadge.js';
import { levelBadge } from './levelBadge.js';
import { isMuted, toggleMute } from '../core/sfx.js';
import { iconSpeakerOn, iconSpeakerOff, iconUser } from './icons.js';

export function topbar({ showBack = false, title = '', compactStats = false } = {}) {
  const left = showBack
    ? el('button', { class: 'btn btn-ghost', onClick: back, attrs: { 'aria-label': 'Voltar' } }, ['← Voltar'])
    : el('div', { class: 'brand', onClick: () => go('/') }, [
        el('div', { class: 'brand-mark' }, ['F']),
        el('span', {}, ['Flashy'])
      ]);

  const right = el('div', { class: 'topbar-right' });
  renderRight(right, compactStats);

  // Re-render no statsChange. Cleanup ao re-renderizar de página via router.
  const unsubscribe = onKind('statsChange', () => {
    if (document.body.contains(right)) renderRight(right, compactStats);
    else { try { unsubscribe(); } catch {} }
  });
  registerCleanup(() => { try { unsubscribe(); } catch {} });

  return el('div', { class: 'topbar' }, [
    left,
    title ? el('div', { class: 'topbar-title' }, [title]) : null,
    right
  ]);
}

function renderRight(container, compactStats) {
  container.innerHTML = '';
  const stats = getStats();
  const isCompact = compactStats || window.innerWidth < 700;

  const muteBtn = el('button', {
    class: 'topbar-mute' + (isMuted() ? ' topbar-mute-off' : ''),
    attrs: {
      'data-testid': 'topbar-mute',
      'aria-label': isMuted() ? 'Som desligado' : 'Som ligado',
      title: isMuted() ? 'Som desligado (M)' : 'Som ligado (M)',
      type: 'button'
    },
    onClick: () => {
      toggleMute();
      renderRight(container, compactStats);
    }
  });
  muteBtn.appendChild(isMuted() ? iconSpeakerOff(18) : iconSpeakerOn(18));

  const streak = streakBadge(stats.current_streak, { onClick: () => go('/eu') });
  const level = levelBadge(stats, { compact: isCompact, onClick: () => go('/eu') });
  const meBtn = el('button', {
    class: 'topbar-me',
    attrs: { 'aria-label': 'Meu perfil', title: 'Meu perfil', type: 'button' },
    onClick: () => go('/eu')
  });
  meBtn.appendChild(iconUser(18));

  container.append(streak, level, muteBtn, meBtn);
}

// Atalho global M pra mute. Instalado uma vez.
let shortcutInstalled = false;
function installMuteShortcut() {
  if (shortcutInstalled) return;
  shortcutInstalled = true;
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'm' || e.key === 'M') {
      toggleMute();
      // Força refresh do topbar atual
      document.querySelectorAll('.topbar-mute').forEach(btn => {
        const off = isMuted();
        btn.classList.toggle('topbar-mute-off', off);
        btn.innerHTML = '';
        btn.appendChild(off ? iconSpeakerOff(18) : iconSpeakerOn(18));
        btn.setAttribute('aria-label', off ? 'Som desligado' : 'Som ligado');
      });
    }
  });
}
installMuteShortcut();
