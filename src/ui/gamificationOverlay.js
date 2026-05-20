// Host único pros overlays globais de gamificação: combo + toasts de medalha.
// Montado uma vez em main.js após bootstrap.

import { el } from '../core/util.js';
import { mountComboOverlay } from './comboOverlay.js';
import { mountMedalToast } from './medalToast.js';

export function mountGamificationOverlay(parent) {
  // Combo
  mountComboOverlay(parent);
  // Toast de medalha
  mountMedalToast(parent);
}
