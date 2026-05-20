# Decisões da sprint — Ownership / Público / Pastas / Explorar

Compilação final. Substitui qualquer divergência entre `PRODUCT-SPEC-ownership.md`
e `UX-SPEC-ownership.md`. **Dev segue este arquivo.**

Última atualização: 2026-05-20

---

## Decisões batidas com o user

| Tópico | Decisão |
|--------|---------|
| Anônimo pode publicar | **Sim.** App é uso doméstico por enquanto, sem preocupação com spam. |
| Default de visibilidade | **Público.** |
| Tela Explorar | **Entra nesta sprint.** Sem Explorar, "público" não significa nada. |
| Pastas | **Anônimo e logado, igual.** |
| Banner "faça login" | **Não mostrar agora.** Trazer só quando Logto entrar. |
| Migrar localStorage atual | **Sim, automaticamente no primeiro load pós-deploy.** |
| Decks seed (Capitais, Vocabulário) | **Públicos no banco, dono `system`.** Aparecem em Explorar, não em "Meus decks". |

## Decisões herdadas das specs (não foram questionadas)

- `anonymous_id` = UUID v4, cookie `flashy_aid` + localStorage `flashy:aid` (redundante).
- Lazy creation do anonymous_id — só ao primeiro POST.
- Um dono por deck. Sem co-ownership.
- Editar/deletar só o dono. Visitante de deck público = read-only.
- Clone = deck novo, do clonador. Snapshot dos cards, não referência.
- Atribuição cosmética "baseado em X por Y" por 30 dias após clone.
- Privado → URL direta retorna 404 (não 403).
- Pasta = label pessoal. Um deck em 0 ou 1 pasta. Deletar pasta não deleta decks.
- Rate limit: 20 decks/dia por aid, 50 por IP. Cards: máx 2000 por deck.
- Moderação reativa via botão Reportar. Decisão manual.
- Soft delete (flag `deleted_at`), retenção 30 dias.

## Cortes desta sprint

- Login Logto (sprint seguinte).
- Banner "criar conta".
- Ranking, comments, follow, categorias, co-own, subpastas.
- Lixeira via UI.
- Histórico de versões.
- Exportar/importar arquivo.
- Drag-and-drop em pastas.
- Sistema de username `@nome` — usuários logados ainda não existem.
  Em decks públicos hoje, autor aparece como "por anônimo" (todos são).
  Quando login entrar, virar `@nome`.

## Migração do localStorage existente

Quando o user com `flashy:v1` no localStorage abre o app pós-deploy:

1. Boot detecta `flashy:v1` no localStorage e ausência de `flashy:aid` em cookie/storage.
2. Gera `anonymous_id`, cria user anônimo no backend.
3. Para cada deck local, POST `/api/decks` com `is_public=true` (default).
   Exceção: se o deck tem o mesmo nome que um seed do sistema ("Capitais — América do Sul",
   "Vocabulário — Inglês ↔ Português"), **não migrar** — esses agora são seeds do sistema.
   Deletar do localStorage após confirmação de upload.
4. Marca `flashy:migrated_v1` = true no localStorage pra não repetir.
5. Mantém `flashy:v1` por mais 1 release como backup (não usa, só guarda).
   Próximo release remove.

Migrar mesmo cards com `card.audio` (URL do TTS no GCS) — preservar.

## Visual / UX (resumido)

Detalhes completos em `UX-SPEC-ownership.md`. Pontos críticos:

- **Tabs na Home:** `Meus decks` / `Explorar` / `Pastas`. Mesmo frame, URL muda.
- **Toggle público/privado** custom no modal criar deck. Default ON (público).
- **Badge mini "Privado"** no canto do card. Público não mostra badge (densidade).
- **Autor aparece só em deck de outro** (Explorar/detalhe). Em deck próprio, nunca.
- **Pastas = chips de filtro** na Home + dropdown no detalhe pra mover.
- **Skeleton com shimmer** pra loading. Sem spinner girando.
- **Componentes novos:** `icons.js`, `toggle.js`, `dropdown.js`, `tabs.js`, `toast.js`, `skeleton.js`.

## Backend (próximo agente)

`did.json` muda `"database": false` → `"database": true`. Deploy provisiona Postgres dedicado.

Schema (proposta inicial, Dev valida):

```sql
-- users: anônimos e logados (Logto vem depois)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('anonymous', 'logged', 'system')),
  logto_id TEXT UNIQUE,           -- null pra anônimos/system
  claimed_by UUID REFERENCES users(id),  -- anônimo que virou logado aponta
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE folders (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE decks (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  source_deck_id UUID REFERENCES decks(id),  -- pra clones, atribuição 30d
  cloned_at TIMESTAMPTZ,                      -- quando virou clone (pra expirar atribuição)
  records JSONB DEFAULT '{}'::jsonb,          -- { match, speed } (antigo)
  deleted_at TIMESTAMPTZ,                     -- soft delete
  removed_by_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cards (
  id UUID PRIMARY KEY,
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  position INT NOT NULL,
  audio JSONB,                                -- { front: {url, lang, hash, generatedAt}, back: {...} }
  stats JSONB DEFAULT '{"correct":0,"wrong":0,"lastSeenAt":0}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_decks_owner ON decks(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_decks_public ON decks(is_public, created_at DESC) WHERE deleted_at IS NULL AND is_public = TRUE;
CREATE INDEX idx_decks_folder ON decks(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_deck ON cards(deck_id, position);

CREATE TABLE reports (
  id UUID PRIMARY KEY,
  deck_id UUID NOT NULL REFERENCES decks(id),
  reporter_id UUID REFERENCES users(id),
  reason TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Endpoints (REST sob `/api`):

- `GET  /api/me` → `{ id, kind }` (cria anônimo lazy se não tem cookie)
- `GET  /api/decks` → meus decks (do user atual)
- `POST /api/decks` → cria deck
- `GET  /api/decks/:id` → um deck (se público OU se dono)
- `PATCH /api/decks/:id` → editar (só dono)
- `DELETE /api/decks/:id` → soft delete (só dono)
- `POST /api/decks/:id/clone` → cria deck novo a partir desse (qualquer um, se origem público)
- `POST /api/decks/:id/cards` → adicionar cards
- `PATCH /api/cards/:id` → editar card (só dono do deck)
- `POST /api/cards/:id/audio` → patch do audio (URL TTS gerado)
- `POST /api/cards/:id/result` → registrar acerto/erro (só dono do deck)
- `GET  /api/explore?sort=popular|recent&q=&page=&lang=` → decks públicos
- `GET  /api/folders` → minhas pastas
- `POST /api/folders` / `PATCH` / `DELETE`
- `POST /api/decks/:id/report` → reportar
- `POST /api/tts` → mantém o que existe

Auth: middleware lê cookie `flashy_aid` → encontra `users.id`. Cria lazy quando rota é POST e não tem aid.

Seeds: migration final cria user `system` (hardcoded UUID) e os 2 decks públicos atuais.

## Próximos passos da Dev

1. Schema + migrations + seeds em `migrations/001_init.sql`.
2. `did.json` → `"database": true`.
3. Estrutura `server/db.js` (pool pg), `server/auth.js` (middleware aid), `server/routes/decks.js`, `server/routes/folders.js`, `server/routes/explore.js`, `server/routes/me.js`.
4. Refactor `src/core/store.js` → `src/core/api.js` (fetch-based) + camada cache leve em memória.
5. Implementar componentes UI novos (`icons.js`, `toggle.js`, `dropdown.js`, `tabs.js`, `toast.js`, `skeleton.js`).
6. Adaptar `home.js`, `deck.js`, `topbar.js`. Criar `explore.js`, `folders.js`.
7. Migração localStorage → backend no boot.
8. Deploy via `did.ps1 deploy quiz`.
9. QA Playwright com 2-3 anônimos diferentes.

## QA — roteiro mínimo

1. Anônimo A cria deck público → fecha browser → reabre → deck ainda lá (vem do DB).
2. Anônimo B (browser limpo) abre quiz.did.lu → vê deck do A em Explorar.
3. Anônimo B clona → vira deck dele.
4. A torna o deck privado → some do Explorar pro B, continua no detalhe pro A.
5. A acessa URL do deck B (que clonou do A) → 404 (privado do B é privado, mesmo se "veio" do A).
   Errata: o clone do B é público por default → A vê em Explorar. Confirmar.
6. A cria pasta "Idiomas", move 2 decks pra lá → ao recarregar, pasta + decks persistem.
7. A deleta pasta → decks voltam pra "Sem pasta", não somem.
8. Limpar cookies de A → vira anônimo novo, perde decks. Aceitado e documentado.
9. Migração: user com localStorage v1 abre app → todos os decks aparecem no Explorar
   (default público) + na home dele.
