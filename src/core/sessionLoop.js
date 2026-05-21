// Wrapper de sessão. Cada modo de jogo cria UM SessionLoop por partida.
//
//   const s = await startSession(deckId, mode);
//   s.onCorrect(cardId, { timeMs, cardStats });
//   s.onWrong(cardId);
//   const result = await s.finish({ cardsTotal, totalDeckCards });
//
// Cliente bufferiza eventos e envia tudo no finish (DEV-PLAN §3).
// Sessions >5min fazem flush periódico defensivo (a cada 60s).

import { emit } from './events.js';
import { applyFinishResponse, addPendingXp } from './stats.js';
import { maybeAnticipateCombo, resetAnticipated } from './medals.js';
import { play as playSfx } from './sfx.js';

const XP_BASE_PER_MODE = { flashcards: 5, multiple: 10, match: 8, speed: 6, write: 20 };
function comboMult(combo) {
  if (combo >= 30) return 2.0;
  if (combo >= 20) return 1.75;
  if (combo >= 10) return 1.5;
  if (combo >= 5)  return 1.25;
  return 1.0;
}

const FLUSH_AFTER_MS = 5 * 60 * 1000;
const FLUSH_INTERVAL_MS = 60 * 1000;

const COMBO_SOUND_MILESTONES = [5, 10, 20, 30];

// Track de qual session é a "ativa" no momento. Eventos de session abortada
// são silenciados pra não poluir UI (combo overlay, sons, etc).
let activeSessionId = null;
export function isActiveSession(id) { return id === activeSessionId; }

export async function startSession(deckId, mode) {
  const tzOffsetMin = -new Date().getTimezoneOffset();
  const r = await fetch('/api/sessions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deck_id: deckId, mode, tz_offset_min: tzOffsetMin })
  });
  if (!r.ok) throw new Error('session_create_failed');
  const { id: sessionId } = await r.json();

  const startedAt = Date.now();
  const events = []; // buffer
  let combo = 0;
  let maxCombo = 0;
  let correct = 0;
  let wrong = 0;
  let pendingFlush = [];
  let aborted = false;
  let finalized = false;
  resetAnticipated();

  // Cancela qualquer session anterior em vôo e marca essa como ativa.
  activeSessionId = sessionId;

  emit('sessionStart', { sessionId, deckId, mode });

  const onCorrect = (cardId, opts = {}) => {
    if (aborted || finalized) return;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    correct++;
    const ev = {
      kind: 'correct',
      card_id: cardId || null,
      combo,
      time_ms: opts.timeMs || null,
      card_stats: opts.cardStats || null
    };
    events.push(ev);
    pendingFlush.push(ev);
    // Sons de combo conforme cruza milestones
    if (combo === 5)       playSfx('combo5');
    else if (combo === 10) playSfx('combo10');
    else if (combo === 20) playSfx('combo20');
    else if (combo === 30) playSfx('combo20');
    else                   playSfx('correct');

    // XP estimado client-side pra atualizar topbar real-time.
    // Pode divergir levemente do server (que aplica diff factor exato), mas
    // applyFinishResponse reconcilia no fim.
    const baseXp = XP_BASE_PER_MODE[mode] || 5;
    const estXp = Math.round(baseXp * comboMult(combo));
    addPendingXp(estXp);

    // Eventos — incluem sessionId pra UI distinguir
    emit('correct', { sessionId, deckId, cardId, mode, combo, timeMs: opts.timeMs, deltaXp: estXp });
    for (const m of COMBO_SOUND_MILESTONES) {
      if (combo === m) {
        emit('comboMilestone', { sessionId, combo: m });
        break;
      }
    }
    maybeAnticipateCombo(combo);
  };

  const onWrong = (cardId) => {
    if (aborted || finalized) return;
    const hadCombo = combo;
    combo = 0;
    wrong++;
    const ev = { kind: 'wrong', card_id: cardId || null, combo: 0, time_ms: null };
    events.push(ev);
    pendingFlush.push(ev);
    playSfx('wrong');
    emit('wrong', { sessionId, deckId, cardId, mode });
    if (hadCombo >= 5) emit('comboBreak', { sessionId, from: hadCombo });
  };

  // Flush periódico só pra sessões longas (defensivo). Não bloqueia jogo.
  const flushTimer = setInterval(async () => {
    if (Date.now() - startedAt < FLUSH_AFTER_MS) return;
    if (!pendingFlush.length) return;
    const batch = pendingFlush;
    pendingFlush = [];
    try {
      await fetch(`/api/sessions/${sessionId}/event`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch })
      });
    } catch {
      // descartado se falha — finish carrega o buffer completo de 'events' mesmo assim.
    }
  }, FLUSH_INTERVAL_MS);

  // beforeunload — best effort de marcar abandoned
  const onUnload = () => {
    try {
      navigator.sendBeacon && navigator.sendBeacon(
        `/api/sessions/${sessionId}/finish`,
        new Blob([JSON.stringify({
          duration_ms: Date.now() - startedAt,
          correct, wrong, max_combo: maxCombo,
          cards_total: correct + wrong,
          tz_offset_min: tzOffsetMin,
          events: events.slice(-50) // últimas só
        })], { type: 'application/json' })
      );
    } catch {}
  };
  window.addEventListener('beforeunload', onUnload);

  // Abort cancela a sessão sem fechar no backend. Usado quando user navega
  // pra outra rota sem terminar. Backend tem cleanup que marca pending > 2h
  // como abandoned, mas marcamos imediatamente também via beacon.
  const abort = () => {
    if (finalized || aborted) return;
    aborted = true;
    clearInterval(flushTimer);
    window.removeEventListener('beforeunload', onUnload);
    if (activeSessionId === sessionId) activeSessionId = null;
    // Fire-and-forget: marca abandonada no backend
    try {
      navigator.sendBeacon && navigator.sendBeacon(
        `/api/sessions/${sessionId}/finish`,
        new Blob([JSON.stringify({
          duration_ms: Date.now() - startedAt,
          correct, wrong, max_combo: maxCombo,
          cards_total: correct + wrong,
          tz_offset_min: tzOffsetMin,
          events: [],
          abandoned: true
        })], { type: 'application/json' })
      );
    } catch {}
  };

  const finish = async (opts = {}) => {
    if (aborted || finalized) {
      // Devolve summary local sem chamar backend novamente.
      return {
        summary: {
          sessionId, deckId, mode,
          correct, wrong, maxCombo,
          cardsTotal: opts.cardsTotal != null ? opts.cardsTotal : (correct + wrong),
          durationMs: Date.now() - startedAt,
          accuracy: 0, offline: true
        },
        finishResponse: null
      };
    }
    finalized = true;
    clearInterval(flushTimer);
    window.removeEventListener('beforeunload', onUnload);
    const durationMs = Date.now() - startedAt;
    const cardsTotal = opts.cardsTotal != null ? opts.cardsTotal : (correct + wrong);
    const totalDeckCards = opts.totalDeckCards || null;
    try {
      const r = await fetch(`/api/sessions/${sessionId}/finish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_ms: durationMs,
          correct, wrong, max_combo: maxCombo,
          cards_total: cardsTotal,
          total_deck_cards: totalDeckCards,
          tz_offset_min: tzOffsetMin,
          events
        })
      });
      if (!r.ok) throw new Error('finish_failed');
      const finishResp = await r.json();
      applyFinishResponse(finishResp);
      const summary = {
        sessionId, deckId, mode,
        correct, wrong, maxCombo,
        cardsTotal,
        durationMs,
        accuracy: cardsTotal ? Math.round((correct / cardsTotal) * 100) : 0
      };
      emit('sessionEnd', { sessionId, summary, finishResponse: finishResp });

      // Sons macro
      if (finishResp.xp_earned > 0) {
        if (cardsTotal >= 10 && wrong === 0) playSfx('finish');
        else playSfx('finish');
      }
      if (finishResp.level_up) {
        setTimeout(() => playSfx('levelUp'), 700);
        emit('levelUp', { ...finishResp.level_up, kind: 'global' });
      }
      if (finishResp.deck_level_up) {
        emit('levelUp', { ...finishResp.deck_level_up, kind: 'deck' });
      }
      for (const code of finishResp.new_medals || []) {
        // Pula medalha que já antecipamos visualmente nessa sessão (evita duplicar toast).
        // O componente medalToast vai deduplicar por code também.
        setTimeout(() => playSfx('medal'), 800);
        emit('medalEarned', { code });
      }
      return { summary, finishResponse: finishResp };
    } catch (e) {
      // Falha de rede no finish — devolve summary local. Cliente ainda renderiza fim de sessão.
      const summary = {
        sessionId, deckId, mode,
        correct, wrong, maxCombo,
        cardsTotal,
        durationMs,
        accuracy: cardsTotal ? Math.round((correct / cardsTotal) * 100) : 0,
        offline: true
      };
      emit('sessionEnd', { sessionId, summary, finishResponse: null });
      return { summary, finishResponse: null };
    }
  };

  return {
    sessionId,
    onCorrect, onWrong, finish, abort,
    get combo() { return combo; },
    get correct() { return correct; },
    get wrong() { return wrong; },
    get maxCombo() { return maxCombo; },
    get aborted() { return aborted; }
  };
}
