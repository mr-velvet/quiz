// Boot. Garante user no backend, migra localStorage v1 se preciso,
// popula caches e arranca o router.

import { bootstrap, migrateLocalStorageIfNeeded } from './core/store.js';
import { start } from './ui/router.js';

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
  start();
})();
