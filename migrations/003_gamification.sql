-- Sprint gamificação: stats agregados + event log + medalhas.
--
-- Híbrido snapshot (user_stats/deck_stats) + log (study_sessions/session_events)
-- pra permitir reconstrução e auditoria do XP.
-- Backend autoritativo: tudo passa por POST /api/sessions/:id/finish.

-- ---------- user_stats ----------
-- Snapshot agregado por user. 1:1 com users. Reconstruível a partir de study_sessions.
CREATE TABLE IF NOT EXISTS user_stats (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp_total          INTEGER NOT NULL DEFAULT 0,
  level             INTEGER NOT NULL DEFAULT 1,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_active_date  DATE,
  total_sessions    INTEGER NOT NULL DEFAULT 0,
  total_correct     INTEGER NOT NULL DEFAULT 0,
  total_wrong       INTEGER NOT NULL DEFAULT 0,
  tz_offset_min     INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- deck_stats ----------
-- XP/maestria por (user, deck). Permite "Lv 4 · Conhecendo" no detalhe.
CREATE TABLE IF NOT EXISTS deck_stats (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id        UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  xp_deck        INTEGER NOT NULL DEFAULT 0,
  mastery_level  INTEGER NOT NULL DEFAULT 1,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, deck_id)
);
CREATE INDEX IF NOT EXISTS idx_deck_stats_user ON deck_stats(user_id);

-- ---------- medals ----------
-- Catálogo. Povoado abaixo. Tier pra colorir UI.
CREATE TABLE IF NOT EXISTS medals (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT,
  tier         TEXT NOT NULL DEFAULT 'bronze',
  category     TEXT NOT NULL DEFAULT 'misc',
  criteria     JSONB NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- ---------- user_medals ----------
-- Conquistadas. context guarda dado da hora do desbloqueio (combo, deck etc).
CREATE TABLE IF NOT EXISTS user_medals (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medal_code  TEXT NOT NULL REFERENCES medals(code) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  context     JSONB,
  PRIMARY KEY (user_id, medal_code)
);
CREATE INDEX IF NOT EXISTS idx_user_medals_user ON user_medals(user_id, earned_at DESC);

-- ---------- study_sessions ----------
-- 1 row por partida. Fonte de verdade histórica.
CREATE TABLE IF NOT EXISTS study_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id         UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INTEGER,
  correct         INTEGER NOT NULL DEFAULT 0,
  wrong           INTEGER NOT NULL DEFAULT 0,
  max_combo       INTEGER NOT NULL DEFAULT 0,
  cards_total     INTEGER NOT NULL DEFAULT 0,
  xp_earned       INTEGER NOT NULL DEFAULT 0,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON study_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_deck    ON study_sessions(user_id, deck_id);
CREATE INDEX IF NOT EXISTS idx_sessions_pending      ON study_sessions(status, started_at) WHERE status = 'pending';

-- ---------- session_events ----------
-- Granular. Permite QA conferir XP card-a-card.
CREATE TABLE IF NOT EXISTS session_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  card_id     UUID,
  combo       INTEGER,
  time_ms     INTEGER,
  delta_xp    INTEGER NOT NULL DEFAULT 0,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id, at);

-- ---------- catálogo de medalhas (18) ----------
-- ON CONFLICT permite re-rodar migration pra atualizar texto/ícone.

INSERT INTO medals (code, name, description, icon, tier, category, criteria, sort_order) VALUES
  ('first_session',  'Primeira vez',     'Concluir sua primeira sessão de estudo (≥10 cards).', '🎯', 'bronze',    'onboarding',   '{"type":"first_session","min_cards":10}'::jsonb,                1),
  ('first_deck',     'Caçula do deck',   'Criar seu primeiro deck.',                              '📦', 'bronze',    'onboarding',   '{"type":"first_deck"}'::jsonb,                                  2),
  ('big_importer',   'Importador',       'Criar um deck com 50 ou mais cards de uma vez.',        '📥', 'silver',    'creation',     '{"type":"deck_with_n_cards","min":50}'::jsonb,                  3),
  ('librarian',      'Bibliotecário',    'Ter 5 decks ativos.',                                   '📚', 'silver',    'creation',     '{"type":"decks_owned","min":5}'::jsonb,                         4),
  ('curator',        'Curador',          'Ter 10 decks ativos.',                                  '🗂', 'gold',      'creation',     '{"type":"decks_owned","min":10}'::jsonb,                        5),
  ('flawless_20',    'Sem deslizes',     'Sessão 100% acerto com ≥20 cards.',                     '✨', 'silver',    'performance',  '{"type":"flawless","min_cards":20}'::jsonb,                     6),
  ('flawless_50',    'Imbatível',        'Sessão 100% acerto com ≥50 cards.',                     '💎', 'gold',      'performance',  '{"type":"flawless","min_cards":50}'::jsonb,                     7),
  ('combo_10',       'Combo 10',         'Atingir combo 10 em qualquer modo.',                    '🔟', 'bronze',    'combo',        '{"type":"combo","min":10}'::jsonb,                              8),
  ('combo_25',       'Combo 25',         'Atingir combo 25 em qualquer modo.',                    '🚀', 'silver',    'combo',        '{"type":"combo","min":25}'::jsonb,                              9),
  ('combo_50',       'Combo 50',         'Atingir combo 50 em qualquer modo.',                    '🔥', 'gold',      'combo',        '{"type":"combo","min":50}'::jsonb,                             10),
  ('speedster_30',   'Velocista',        'Bater 30 acertos em uma rodada de Speed.',              '⚡', 'silver',    'mode',         '{"type":"speed_correct","min":30}'::jsonb,                     11),
  ('typist_100',     'Datilógrafo',      'Acertar 100 cards em modo Escrever (lifetime).',        '⌨',  'silver',    'mode',         '{"type":"lifetime_write_correct","min":100}'::jsonb,           12),
  ('deck_lv5',       'Olho clínico',     'Atingir nível 5 de qualquer deck.',                     '🔍', 'silver',    'mastery',      '{"type":"deck_level","min":5}'::jsonb,                         13),
  ('deck_lv8',       'Mestre do deck',   'Atingir nível 8 de qualquer deck.',                     '🎓', 'gold',      'mastery',      '{"type":"deck_level","min":8}'::jsonb,                         14),
  ('deck_lv10',      'Lenda do deck',    'Atingir nível 10 de qualquer deck.',                    '👑', 'legendary', 'mastery',      '{"type":"deck_level","min":10}'::jsonb,                        15),
  ('streak_7',       'Streak 7',         'Manter ofensiva por 7 dias.',                           '🔥', 'silver',    'streak',       '{"type":"streak","min":7}'::jsonb,                             16),
  ('streak_30',      'Streak 30',        'Manter ofensiva por 30 dias.',                          '🌟', 'gold',      'streak',       '{"type":"streak","min":30}'::jsonb,                            17),
  ('streak_100',     'Streak 100',       'Manter ofensiva por 100 dias.',                         '🏆', 'legendary', 'streak',       '{"type":"streak","min":100}'::jsonb,                           18)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      tier        = EXCLUDED.tier,
      category    = EXCLUDED.category,
      criteria    = EXCLUDED.criteria,
      sort_order  = EXCLUDED.sort_order;
