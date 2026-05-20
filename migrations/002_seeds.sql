-- Seeds: user 'system' + 2 decks públicos (Capitais SA e Vocabulário en↔pt).
-- UUID fixo do system pra ser referenciável em qualquer ambiente.
-- Os decks usam IDs determinísticos pra serem idempotentes em re-execução
-- (a tabela _migrations da plataforma só roda uma vez, mas idempotência é higiene).

INSERT INTO users (id, kind) VALUES
  ('00000000-0000-0000-0000-000000000001', 'system')
ON CONFLICT (id) DO NOTHING;

-- Deck 1: Capitais — América do Sul
INSERT INTO decks (id, owner_id, name, is_public)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Capitais — América do Sul',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cards (deck_id, front, back, position) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Brasil',    'Brasília',     0),
  ('00000000-0000-0000-0000-000000000010', 'Argentina', 'Buenos Aires', 1),
  ('00000000-0000-0000-0000-000000000010', 'Uruguai',   'Montevidéu',   2),
  ('00000000-0000-0000-0000-000000000010', 'Chile',     'Santiago',     3),
  ('00000000-0000-0000-0000-000000000010', 'Peru',      'Lima',         4),
  ('00000000-0000-0000-0000-000000000010', 'Colômbia',  'Bogotá',       5),
  ('00000000-0000-0000-0000-000000000010', 'Venezuela', 'Caracas',      6),
  ('00000000-0000-0000-0000-000000000010', 'Equador',   'Quito',        7),
  ('00000000-0000-0000-0000-000000000010', 'Bolívia',   'Sucre',        8),
  ('00000000-0000-0000-0000-000000000010', 'Paraguai',  'Assunção',     9),
  ('00000000-0000-0000-0000-000000000010', 'Guiana',    'Georgetown',  10),
  ('00000000-0000-0000-0000-000000000010', 'Suriname',  'Paramaribo',  11)
ON CONFLICT DO NOTHING;

-- Deck 2: Vocabulário — Inglês ↔ Português
INSERT INTO decks (id, owner_id, name, is_public)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'Vocabulário — Inglês ↔ Português',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cards (deck_id, front, back, position) VALUES
  ('00000000-0000-0000-0000-000000000011', 'ephemeral',    'efêmero',         0),
  ('00000000-0000-0000-0000-000000000011', 'serendipity',  'serendipidade',   1),
  ('00000000-0000-0000-0000-000000000011', 'cumbersome',   'incômodo',        2),
  ('00000000-0000-0000-0000-000000000011', 'mundane',      'comum',           3),
  ('00000000-0000-0000-0000-000000000011', 'whim',         'capricho',        4),
  ('00000000-0000-0000-0000-000000000011', 'foster',       'fomentar',        5),
  ('00000000-0000-0000-0000-000000000011', 'plight',       'dificuldade',     6),
  ('00000000-0000-0000-0000-000000000011', 'akin',         'semelhante',      7),
  ('00000000-0000-0000-0000-000000000011', 'thorough',     'minucioso',       8),
  ('00000000-0000-0000-0000-000000000011', 'fleeting',     'passageiro',      9),
  ('00000000-0000-0000-0000-000000000011', 'cumber',       'onerar',         10),
  ('00000000-0000-0000-0000-000000000011', 'glimpse',      'vislumbre',      11)
ON CONFLICT DO NOTHING;
