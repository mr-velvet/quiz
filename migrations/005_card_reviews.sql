-- Sprint Revisão: lista manual de cards pra revisar depois.
--
-- Intent: para cada par (user, deck) o user mantém uma lista de cards marcados
-- pra praticar de novo. A sessão de revisão reusa os 5 modos existentes,
-- apenas passando subset = cards marcados. Vínculo é do user, não do deck —
-- funciona em deck próprio E em deck público de outro.
--
-- Decisões deliberadas (ver specs/DECISIONS-sprint-revision.md):
-- - 1 lista por (user_id, deck_id). Many-to-many entre users e decks.
-- - PK composta (user_id, card_id) → idempotente. Marcar 2× é no-op.
-- - deck_id denormalizado pra index/contagem rápida sem JOIN com cards.
-- - source opcional pra telemetria (manual_deck, session_wrong, etc.).
-- - CASCADE em card e deck — vínculo some silenciosamente.
--
-- Ajuste de escopo (decisão do agente de produto): adicionar coluna explícita
-- `source` em study_sessions pra marcar sessões de revisão. A spec sugeria
-- JSONB meta.source mas coluna explícita é mais robusta pra query/medalha.

-- ---------- card_reviews ----------
CREATE TABLE IF NOT EXISTS card_reviews (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id     UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id     UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source      TEXT,
  PRIMARY KEY (user_id, card_id)
);

-- Query principal: "quais cards desse deck eu marquei?" e contagem N pra CTA.
CREATE INDEX IF NOT EXISTS idx_card_reviews_user_deck ON card_reviews(user_id, deck_id);
-- Limpeza/agregação por deck.
CREATE INDEX IF NOT EXISTS idx_card_reviews_deck      ON card_reviews(deck_id);

-- ---------- study_sessions.source ----------
-- Marca sessões de revisão. NULL = sessão normal. 'revision' = sessão jogando
-- a lista de revisão (subset dos cards do deck). Outros valores reservados
-- pra futuros tipos de sessão derivada.
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user_source
  ON study_sessions(user_id, source)
  WHERE source IS NOT NULL;

-- ---------- medalha nova: revision_master ----------
-- Critério (spec PRODUCT-SPEC-revision.md §4.1 + DECISIONS): completar
-- 50 cards de revisão lifetime acertando todos. Soma de `correct` em
-- study_sessions onde source='revision' E wrong=0, ≥ 50.
INSERT INTO medals (code, name, description, icon, tier, category, criteria, sort_order) VALUES
  ('revision_master', 'Mestre da revisão', 'Completar 50 cards de revisão acertando todos.', '🎯', 'gold', 'performance', '{"type":"revision_lifetime_correct","min":50,"requires":"wrong=0"}'::jsonb, 19)
ON CONFLICT (code) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      icon        = EXCLUDED.icon,
      tier        = EXCLUDED.tier,
      category    = EXCLUDED.category,
      criteria    = EXCLUDED.criteria,
      sort_order  = EXCLUDED.sort_order;
