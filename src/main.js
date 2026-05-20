// Boot. Garante user no backend, migra localStorage v1 se preciso,
// popula caches e arranca o router.

import { bootstrap, migrateLocalStorageIfNeeded } from './core/store.js';
import { start } from './ui/router.js';
import { bootStats } from './core/stats.js';
import { preload as preloadSfx } from './core/sfx.js';
import { mountGamificationOverlay } from './ui/gamificationOverlay.js';
import { mountInstallPrompt } from './ui/installPrompt.js';
import { registerSW } from './core/pwa.js';
import { installDebugHooks } from './core/debug.js';

(async () => {
  try {
    // Migração roda antes do bootstrap pra que a lista de decks já venha cheia.
    await migrateLocalStorageIfNeeded();
  } catch {
    // Falha de migração não bloqueia o app — o user continua com o que conseguir do backend.
  }
  try {
    await bootstrap();
  } catch {
    // idem
  }
  // Gamificação: carrega stats/medalhas em paralelo (não bloqueia render).
  bootStats().catch(() => {});
  preloadSfx();
  mountGamificationOverlay(document.body);
  mountInstallPrompt(document.body);
  registerSW();
  installDebugHooks();
  start();
})();
