// Fórmulas puras de gamificação. Backend autoritativo.
//
// Tudo o que diz respeito ao "quanto XP", "qual nível", "qual medalha" mora aqui.
// Hardcoded num único arquivo pra tweak rápido — produto pediu (PRODUCT-SPEC §8.4).

// ---------- XP por modo (PRODUCT §3.1) ----------
const XP_BASE = {
  flashcards: 5,
  multiple:   10,
  match:      8,
  speed:      6,
  write:      20
};

// ---------- modificador de dificuldade do card (PRODUCT §3.2) ----------
// Recebe stats do card { correct, wrong } e devolve fator.
function difficultyFactor(stats) {
  if (!stats) return 1.0;
  const correct = stats.correct | 0;
  const wrong   = stats.wrong   | 0;
  // Card "dominado" = 3+ acertos seguidos. Como não temos histórico de streak por card,
  // aproximamos: correct >= 3 e wrong == 0.
  if (correct >= 3 && wrong === 0) return 0.5;
  // "Aprendendo" = errou recentemente. Aproximação: wrong > 0 nos últimos.
  // Sem histórico granular usamos wrong >= 1 e correct < wrong*2.
  if (wrong >= 1 && correct < wrong * 2) return 1.5;
  return 1.0; // novo / neutro
}

// ---------- combo multiplier (PRODUCT §3.3, cap ×2.0) ----------
function comboMultiplier(combo) {
  if (combo >= 30) return 2.0;
  if (combo >= 20) return 1.75;
  if (combo >= 10) return 1.5;
  if (combo >= 5)  return 1.25;
  return 1.0;
}

// XP de UM acerto. event = { mode, combo, card_stats? }
function calcXpForCorrect(event) {
  const base = XP_BASE[event.mode] || 5;
  const diff = difficultyFactor(event.card_stats);
  const combo = comboMultiplier(event.combo || 1);
  return Math.round(base * diff * combo);
}

// ---------- curva de nível global (PRODUCT §3.6) ----------
// XP acumulado pra atingir cada nível. Exponencial leve.
const GLOBAL_LEVEL_CURVE = [
  0,        // Nv1
  100,      // Nv2
  250,      // Nv3
  500,      // Nv4
  1000,     // Nv5
  2000,     // Nv6
  4000,     // Nv7
  7000,     // Nv8
  11000,    // Nv9
  16000,    // Nv10
  22000,    // Nv11
  29000,    // Nv12
  37000,    // Nv13
  43000,    // Nv14
  50000,    // Nv15
  60000,    // Nv16
  72000,    // Nv17
  86000,    // Nv18
  102000,   // Nv19
  120000,   // Nv20
  140000,   // Nv21
  163000,   // Nv22
  189000,   // Nv23
  218000,   // Nv24
  250000,   // Nv25
  290000,   // Nv26
  335000,   // Nv27
  385000,   // Nv28
  440000,   // Nv29
  500000,   // Nv30
  580000,   // Nv31
  670000,   // Nv32
  770000,   // Nv33
  880000,   // Nv34
  1000000,  // Nv35
  1040000,  // Nv36
  1080000,  // Nv37
  1120000,  // Nv38
  1160000,  // Nv39
  1200000,  // Nv40
  1450000,  // Nv41
  1700000,  // Nv42
  1950000,  // Nv43
  2200000,  // Nv44
  2400000,  // Nv45
  2600000,  // Nv46
  2750000,  // Nv47
  2850000,  // Nv48
  2950000,  // Nv49
  3000000   // Nv50
];

function levelFromXp(xp) {
  if (xp < 0) return 1;
  for (let i = GLOBAL_LEVEL_CURVE.length - 1; i >= 0; i--) {
    if (xp >= GLOBAL_LEVEL_CURVE[i]) return i + 1;
  }
  return 1;
}

// Progresso pro próximo nível: { level, xp, xpInLevel, xpForNext, pct }
function levelProgress(xp) {
  const level = levelFromXp(xp);
  const cap = GLOBAL_LEVEL_CURVE.length;
  if (level >= cap) {
    return { level, xp, xpInLevel: 0, xpForNext: 0, pct: 1, isCap: true };
  }
  const floor = GLOBAL_LEVEL_CURVE[level - 1];
  const next  = GLOBAL_LEVEL_CURVE[level];
  const xpInLevel = xp - floor;
  const xpForNext = next - floor;
  return { level, xp, xpInLevel, xpForNext, pct: xpInLevel / xpForNext, isCap: false };
}

// Faixa simbólica (label) por nível.
function levelTitle(level) {
  if (level >= 30) return 'Lenda';
  if (level >= 20) return 'Mestre';
  if (level >= 10) return 'Veterano';
  if (level >= 7)  return 'Estudante';
  if (level >= 4)  return 'Aprendiz';
  return 'Iniciante';
}

// ---------- curva de nível por deck (PRODUCT §3.7) ----------
const DECK_LEVEL_CURVE = [
  0, 50, 150, 400, 800, 1500, 2500, 4000, 6500, 10000
];

function deckLevelFromXp(xp) {
  if (xp < 0) return 1;
  for (let i = DECK_LEVEL_CURVE.length - 1; i >= 0; i--) {
    if (xp >= DECK_LEVEL_CURVE[i]) return i + 1;
  }
  return 1;
}

function deckLevelProgress(xp) {
  const level = deckLevelFromXp(xp);
  const cap = DECK_LEVEL_CURVE.length;
  if (level >= cap) return { level, xp, xpInLevel: 0, xpForNext: 0, pct: 1, isCap: true };
  const floor = DECK_LEVEL_CURVE[level - 1];
  const next  = DECK_LEVEL_CURVE[level];
  return { level, xp, xpInLevel: xp - floor, xpForNext: next - floor, pct: (xp - floor) / (next - floor), isCap: false };
}

function deckLevelTitle(level) {
  if (level >= 10) return 'Lenda do deck';
  if (level >= 8)  return 'Mestre do deck';
  if (level >= 6)  return 'Dominando';
  if (level >= 4)  return 'Conhecendo';
  if (level >= 2)  return 'Aprendendo';
  return 'Novo';
}

// ---------- streak (PRODUCT §3.5) ----------
// Política:
// - Considera a "data" no fuso do user (offset em minutos, vindo do cliente).
// - Corte 04:00: subtraímos 4h antes de derivar a data.
// - Grace 1 dia/semana: se gap == 2 dias (i.e., pulou 1 dia), mantém streak.
// - Gap > 2 dias quebra streak.
//
// localDate(now, tzOffsetMin) → "YYYY-MM-DD" considerando corte 04:00 local.
function localDateString(now, tzOffsetMin) {
  // tzOffsetMin é "minutos de offset em relação ao UTC" no formato JS (negativo a oeste).
  // Recriamos o "now local" e subtraímos 4h pra empurrar pré-04:00 pro dia anterior.
  const localMs = now.getTime() + tzOffsetMin * 60 * 1000;
  const localShifted = new Date(localMs - 4 * 60 * 60 * 1000);
  const y = localShifted.getUTCFullYear();
  const m = String(localShifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localShifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(a, b) {
  // a, b: "YYYY-MM-DD"
  const da = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const db = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((db - da) / (24 * 3600 * 1000));
}

// Atualiza streak. Retorna { current_streak, longest_streak, last_active_date, marker? }
// marker = 'new', 'continue', 'grace', 'reset', 'same_day'
function updateStreak(prev, sessionDate) {
  const last = prev.last_active_date ? String(prev.last_active_date) : null;
  const current = prev.current_streak || 0;
  const longest = prev.longest_streak || 0;

  if (!last) {
    return { current_streak: 1, longest_streak: Math.max(1, longest), last_active_date: sessionDate, marker: 'new' };
  }

  const gap = daysBetween(last, sessionDate);
  if (gap <= 0) return { current_streak: current, longest_streak: longest, last_active_date: last, marker: 'same_day' };

  if (gap === 1) {
    const cs = current + 1;
    return { current_streak: cs, longest_streak: Math.max(longest, cs), last_active_date: sessionDate, marker: 'continue' };
  }

  if (gap === 2) {
    // Grace: pular 1 dia mantém streak (incrementa como se fosse continuidade).
    const cs = current + 1;
    return { current_streak: cs, longest_streak: Math.max(longest, cs), last_active_date: sessionDate, marker: 'grace' };
  }

  return { current_streak: 1, longest_streak: Math.max(longest, 1), last_active_date: sessionDate, marker: 'reset' };
}

// ---------- bônus de sessão (PRODUCT §3.4) ----------
// session: { correct, wrong, cards_total, total_deck_cards }
function sessionBonus(session) {
  const total = (session.correct || 0) + (session.wrong || 0);
  if (total < 10) return 0;
  if ((session.wrong || 0) > 0) return 0;
  // 100% num deck inteiro = +100. 100% numa sessão >=10 = +50.
  if (session.total_deck_cards && session.cards_total >= session.total_deck_cards) {
    return 100;
  }
  return 50;
}

// ---------- anti-cheat MVP (DEV-PLAN §2) ----------
const MAX_XP_PER_SESSION = 5000;
const MIN_DURATION_MS    = 1000;

function clampSessionXp(xp) {
  if (!Number.isFinite(xp) || xp < 0) return 0;
  return Math.min(MAX_XP_PER_SESSION, Math.round(xp));
}

// Aceita finish válido?
function validFinish({ duration_ms, correct, wrong, deck_card_count }) {
  if (!Number.isFinite(duration_ms) || duration_ms < MIN_DURATION_MS) return false;
  const total = (correct | 0) + (wrong | 0);
  if (deck_card_count && total > deck_card_count * 3) return false;
  return true;
}

// ---------- avaliação de medalhas (PRODUCT §3.8) ----------
// Recebe state pós-finish (já com snapshots atualizados) e contexto da sessão.
// Devolve lista de medal_codes que devem ser concedidos AGORA.
// O caller dedupa contra user_medals (UNIQUE).
//
// Parâmetros:
//   userStats:  { xp_total, level, current_streak, longest_streak,
//                 total_sessions, total_correct, total_wrong,
//                 lifetime_write_correct, decks_owned, max_deck_level, ... }
//   session:    { mode, correct, wrong, cards_total, max_combo, total_deck_cards }
//   earned:     Set<string> de medal_codes já conquistados (pra não retornar)
function evaluateMedals({ userStats, session, deckStats, earned }) {
  const out = [];
  const want = (code) => { if (!earned.has(code)) out.push(code); };

  // first_session: primeira sessão concluída (≥10 cards)
  if (userStats.total_sessions >= 1 && session.cards_total >= 10) want('first_session');

  // first_deck: já criou pelo menos 1 deck
  if (userStats.decks_owned >= 1) want('first_deck');

  // big_importer: criou deck com ≥50 cards de uma vez — avaliado em outra trilha
  // (no create deck). Aqui não tem como.

  // librarian / curator: decks_owned
  if (userStats.decks_owned >= 5)  want('librarian');
  if (userStats.decks_owned >= 10) want('curator');

  // flawless 20/50
  if ((session.wrong || 0) === 0 && session.cards_total >= 20) want('flawless_20');
  if ((session.wrong || 0) === 0 && session.cards_total >= 50) want('flawless_50');

  // combo
  if ((session.max_combo || 0) >= 10) want('combo_10');
  if ((session.max_combo || 0) >= 25) want('combo_25');
  if ((session.max_combo || 0) >= 50) want('combo_50');

  // speedster_30: 30 acertos em uma rodada de speed
  if (session.mode === 'speed' && (session.correct || 0) >= 30) want('speedster_30');

  // typist_100: lifetime write correct
  if ((userStats.lifetime_write_correct || 0) >= 100) want('typist_100');

  // revision_master: 50 acertos lifetime em sessões de revisão "limpas" (wrong=0).
  // O caller só popula lifetime_revision_clean_correct quando a sessão atual é
  // de revisão (otimização). Sessões normais nunca disparam essa medalha.
  if ((userStats.lifetime_revision_clean_correct || 0) >= 50) want('revision_master');

  // deck mastery
  if (deckStats && deckStats.mastery_level >= 5)  want('deck_lv5');
  if (deckStats && deckStats.mastery_level >= 8)  want('deck_lv8');
  if (deckStats && deckStats.mastery_level >= 10) want('deck_lv10');

  // streak
  if (userStats.current_streak >= 7)   want('streak_7');
  if (userStats.current_streak >= 30)  want('streak_30');
  if (userStats.current_streak >= 100) want('streak_100');

  return out;
}

module.exports = {
  XP_BASE,
  MAX_XP_PER_SESSION,
  MIN_DURATION_MS,
  difficultyFactor,
  comboMultiplier,
  calcXpForCorrect,
  levelFromXp,
  levelProgress,
  levelTitle,
  deckLevelFromXp,
  deckLevelProgress,
  deckLevelTitle,
  localDateString,
  updateStreak,
  sessionBonus,
  clampSessionXp,
  validFinish,
  evaluateMedals
};
