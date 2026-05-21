-- Idioma do deck (frente/verso) — detectado 1× na criação e persistido aqui.
-- Substitui a detecção redundante por card; agora todo card do deck assume
-- a mesma língua na face e no verso (mesmo deck = mesmas duas línguas).
-- NULL é permitido: significa "ainda não detectado" e o cliente faz fallback.

ALTER TABLE decks ADD COLUMN IF NOT EXISTS lang_front TEXT;
ALTER TABLE decks ADD COLUMN IF NOT EXISTS lang_back  TEXT;
