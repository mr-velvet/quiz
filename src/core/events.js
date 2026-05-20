// Bus de eventos isolado pra gamificação.
//
// Por que não window.dispatchEvent('flashy:change')? Loop infinito conhecido
// — onChange dispara render que chama fetchDeck que emite change. (PROGRESS.md)
//
// Aqui usamos um Set próprio. Quem se inscreve passa { kind, payload } sempre.
// Listeners idempotentes; comparar valor anterior antes de re-render fica a cargo
// de quem consome.
//
// Eventos:
//   'correct'        { deckId, cardId, mode, combo, timeMs, deltaXp? }
//   'wrong'          { deckId, cardId, mode }
//   'comboMilestone' { combo: 5|10|20|30 }
//   'sessionStart'   { sessionId, deckId, mode }
//   'sessionEnd'     { sessionId, summary, finishResponse }
//   'medalEarned'    { code, name, ... }
//   'levelUp'        { from, to, kind: 'global'|'deck' }
//   'statsChange'    { snapshot }         // user_stats atualizado
//   'streakMarker'   { current_streak, marker }

const listeners = new Set();

export function on(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(kind, payload = null) {
  for (const fn of listeners) {
    try { fn({ kind, payload }); } catch (e) { console.error('[events listener]', e); }
  }
  // Debug opcional
  if (localStorage.getItem('flashy:debug') === '1') {
    console.debug('[flashy:gamification]', kind, payload);
  }
}

// Atalho pra subscrever um único kind.
export function onKind(kind, fn) {
  return on(e => { if (e.kind === kind) fn(e.payload); });
}
