-- Schema inicial do Flashy.
-- Suporta users anônimos + (futuramente) logados via Logto, ownership de decks,
-- visibilidade pública/privada, pastas pessoais, cards com TTS e stats, clones,
-- reports e soft delete.
--
-- Extensão pgcrypto pra gen_random_uuid(). UUID v4 nativo do Postgres.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- users ----------
-- 'anonymous': criado lazy no primeiro POST. Identificado por cookie flashy_aid.
-- 'logged':    futuro (Logto). logto_id preenchido.
-- 'system':    UUID fixo (00000000-0000-0000-0000-000000000001), dono dos decks seed.
-- claimed_by: quando anônimo vira logado, aponta pro novo user e fica desativo.
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('anonymous', 'logged', 'system')),
  logto_id    TEXT UNIQUE,
  claimed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_logto ON users(logto_id) WHERE logto_id IS NOT NULL;

-- ---------- folders ----------
-- Pasta pessoal. Não tem visibilidade. Pertence a um user.
-- Deletar pasta: SET NULL em decks.folder_id (não cascade — decks ficam órfãos da pasta).
CREATE TABLE IF NOT EXISTS folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);

-- ---------- decks ----------
-- is_public default TRUE (decisão de produto).
-- source_deck_id: se foi clonado de outro, aponta pro original. SET NULL se original sumir.
-- cloned_at: usado pra expirar atribuição "baseado em X" depois de 30 dias.
-- records: JSONB com { match, speed } (recordes locais do dono, herdado do localStorage).
-- deleted_at: soft delete. Filtrar em todas as queries de leitura.
-- removed_by_admin: deck removido por moderação reativa. Vira privado forçado.
CREATE TABLE IF NOT EXISTS decks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id         UUID REFERENCES folders(id) ON DELETE SET NULL,
  name              TEXT NOT NULL CHECK (length(trim(name)) > 0),
  is_public         BOOLEAN NOT NULL DEFAULT TRUE,
  source_deck_id    UUID REFERENCES decks(id) ON DELETE SET NULL,
  cloned_at         TIMESTAMPTZ,
  records           JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at        TIMESTAMPTZ,
  removed_by_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices pra patterns frequentes:
-- - listar decks do user (home / "Meus decks")
-- - listar públicos ordenados por data (Explorar recent)
-- - filtrar por pasta
-- - resolver clones (subquery em source_deck_id pra "popular")
CREATE INDEX IF NOT EXISTS idx_decks_owner          ON decks(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_decks_public_recent  ON decks(created_at DESC) WHERE deleted_at IS NULL AND is_public = TRUE AND removed_by_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_decks_folder         ON decks(folder_id) WHERE deleted_at IS NULL AND folder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decks_source         ON decks(source_deck_id) WHERE source_deck_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decks_owner_created  ON decks(owner_id, created_at) WHERE deleted_at IS NULL;

-- ---------- cards ----------
-- position: ordem dentro do deck (0..N-1).
-- audio: { front: {url, lang, hash, generatedAt}, back: {...} }
-- stats: { correct, wrong, lastSeenAt }
CREATE TABLE IF NOT EXISTS cards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id     UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front       TEXT NOT NULL,
  back        TEXT NOT NULL,
  position    INTEGER NOT NULL,
  audio       JSONB,
  stats       JSONB NOT NULL DEFAULT '{"correct":0,"wrong":0,"lastSeenAt":0}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_position ON cards(deck_id, position);

-- ---------- reports ----------
-- Moderação reativa. Reporter pode ser anônimo (qualquer um clica Reportar).
-- ON DELETE SET NULL no reporter pra não cair em cascade caso user suma.
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id      UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  reporter_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  reason       TEXT NOT NULL,
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_deck ON reports(deck_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
