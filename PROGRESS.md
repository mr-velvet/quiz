# Flashy (quiz) — Progresso

Última atualização: 2026-05-20 (sprint ownership entregue)

> **Antes de qualquer trabalho neste repo, ler `CONCEPTS.md`** — visão de produto,
> princípios e decisões estratégicas. Este arquivo aqui é o estado operacional.
>
> Specs detalhadas da sprint atual em `specs/`:
> - `DECISIONS-sprint-ownership.md` — decisões batidas
> - `PRODUCT-SPEC-ownership.md` — visão de produto
> - `UX-SPEC-ownership.md` — desenho visual

## Produção

- **URL:** https://quiz.did.lu
- **Repo:** https://github.com/mr-velvet/quiz (branch `master`)
- **Porta interna:** 5034
- **Container:** Node 20 + Express + Postgres compartilhado da plataforma did.lu
- **Banco:** `quiz` no postgres da did.lu (criado via `CREATE DATABASE quiz` — `new-app.sh` não roda em app pré-existente que mudou de `database: false` pra `true`)
- **Health:** `GET /api/health` → `{"status":"ok","service":"quiz"}`
- **Deploy:** `cd ~/ved/devops-workflow-2026 && .\scripts\did.ps1 deploy quiz`
- **Pasta local:** `~/ved/quiz/`

### Env vars necessárias em produção
- `OPENAI_API_KEY` — pro TTS (tts-1).
- `DATABASE_URL` — injetada pela plataforma.
- `GCS_BUCKET` — default `didlu-imagestore`.
- Token de upload GCS: via metadata server da VM GCP.

## Estado atual — implementado

### MVP base
- Home + criação de deck via texto (TAB/`;`/` - `/`,` auto-detecta).
- Modal custom (sem `confirm()`/`alert()`).
- Hash router com cleanup registry + invalidação de render assíncrono via token.
- Atalhos consistentes nos 5 modos.
- Mobile responsivo (breakpoints 600/480).
- 5 modos de jogo (flashcards, MC, escrever, match, speed).

### TTS (sprint anterior)
- Backend `server/tts.js`: OpenAI `tts-1`, cache GCS.
- URL pública via `st.did.lu/quiz/tts/<hash>.mp3`.
- Hash determinístico = `sha256(model|voice|lang|text).slice(0,24)`.
- Cache global entre usuários.

### Sprint ownership/visibility/folders/Explore (2026-05-20) ✅
- **Postgres em produção.** Schema com users (anônimos/logados/system), folders, decks, cards, reports. Migrations versionadas em `migrations/`.
- **Identidade anônima** via cookie `flashy_aid` (UUID v4, max-age 10 anos, SameSite=Lax). Espelhado em `localStorage:flashy:aid` como backup.
- **Ownership:** todo deck pertence a um user. Edit/delete só dono. Anônimo pode criar/publicar (regra relaxada — uso doméstico por enquanto).
- **Visibilidade público/privado:** default público. Toggle no modal criar deck. Deck privado retorna 404 pra não-dono (não vaza existência).
- **Pastas:** pessoais, label-only. Um deck em 0 ou 1 pasta. Deletar pasta não deleta decks.
- **Tela Explorar:** decks públicos com busca + ordenação (Populares/Recentes), paginação 20/página.
- **Clone:** qualquer um clona deck público, vira deck novo do clonador. Atribuição "baseado em X" por 30 dias.
- **Rate limit:** 20 decks/dia por anônimo, 100/dia logado. Máximo 2000 cards/deck.
- **Migração automática:** primeiro load lê `localStorage:flashy:v1`, sobe decks pro backend, preserva `card.audio`. Marca `flashy:migrated_v1`. Backup local mantido por 1 release.
- **Decks seed** (Capitais SA, Vocabulário) agora são públicos no banco com owner `system`. Aparecem em Explorar, não em "Meus".
- **Components UI novos:** icons.js, toggle.js, dropdown.js, tabs.js, toast.js, skeleton.js.

### Bugs encontrados e corrigidos
- ✅ Modal-backdrop preso bloqueava cliques após navegação. Fix: `closeAllModals()` no router antes de cada render + modal fecha em `hashchange`.
- ✅ `cardCount` zerado na home — ternário caía em `cards.length` (array vazio = 0). Fix: usa `cards.length || cardCount || 0`.
- ✅ `flashy_aid` não espelhava em localStorage. Fix: `bootstrap()` grava após `api.me()`.
- ✅ Render assíncrono do detalhe sobrescrevia tela do modo de jogo. Fix: token de render no `root`.
- ✅ **Loop infinito no detalhe do deck:** `fetchDeck` emitia `flashy:change` → onChange disparava render → render chamava fetchDeck → ... Fix: fetchDeck só emite se a `myDeckOrder` muda de fato.

### QA E2E validado (Playwright)
- Criar deck → fechar browser → reabrir → deck persiste (motivação original da sprint). ✅
- Usuário B (cookie limpo) vê deck público de A em Explorar, não vê privado. ✅
- URL direta de privado de outro → 404. ✅
- Duplicar deck público funciona, vira do clonador. ✅
- Pastas: criar/mover/filtrar/deletar (decks voltam pra "Sem pasta"). ✅
- Toggle público→privado dinâmico funciona, sai do Explorar. ✅
- Modos de jogo abrem corretamente após click. ✅
- Migração de localStorage v1 funciona. ✅
- Rate limit (2001 cards) retorna 400. ✅

---

## Sprint atual: estabilizada. Próximas opções

### 1. Polimento / observabilidade (1-2 dias)
- Reports admin UI (endpoint existe, sem interface).
- Limpar `flashy:v1` após N dias da migração.
- Logging estruturado das mutations no backend.
- Métricas básicas (decks criados/dia, sessões).

### 2. Login Logto (1-2 dias)
- Setar `logto: true` no did.json.
- Fluxo de claim do anonymous_id pro user logado.
- Tela de perfil mínima.
- Trocar "por anônimo" em decks públicos por `@nome` real.

### 3. Gamificação (planejada em CONCEPTS.md, plano em PROGRESS antigo)
- XP, combo, medalhas, streak diário, sons.
- Sprint maior (3-5 dias).

### 4. Modo escrever bidirecional, edição manual de card, busca em deck grande
- Backlog menor; aproveita pra polir UX existente.

---

## Riscos / pontos de atenção

- **Banco compartilhado:** se uma migration ruim corromper algo, afeta só DB `quiz`. Mas atenção em qualquer drop/alter.
- **Soft delete sem UI de restore:** 30 dias retenção, mas sem caminho na UI. Quem deletou por engano precisa pedir.
- **Anonymous_id em 2 browsers:** continua sendo 2 usuários distintos. Resolve com login (claim).
- **OpenAI key:** chave única do toolbelt (uso doméstico). Cache GCS amortiza.
- **`removed_by_admin`:** backend respeita mas UI pra admin marcar não existe. Hoje seria via SQL direto.
- **Sem login = sem claim:** decks anônimos só existem no browser onde foram criados. Aceito até Logto entrar.

---

## Como rodar local

```bash
npm install
npm run dev    # vite, sem backend (só UI, sem persistência)
```

Pra testar com backend local, precisa Postgres rodando + env vars. Recomendação: testar mudanças direto em staging via deploy (`did.ps1 deploy quiz` é rápido — 30s).

---

## Arquivos-chave

```
quiz/
├── did.json               # database: true, migrations: migrations/
├── Dockerfile
├── server.js              # Express, monta rotas
├── server/
│   ├── auth.js            # middleware attachUser (cookie flashy_aid)
│   ├── db.js              # pg pool
│   ├── tts.js             # TTS endpoint (sprint anterior)
│   └── routes/
│       ├── me.js
│       ├── decks.js
│       ├── cards.js
│       ├── folders.js
│       └── explore.js
├── migrations/
│   ├── 001_init.sql       # schema completo
│   └── 002_seeds.sql      # user system + 2 decks seed públicos
├── src/
│   ├── main.js            # boot: migrate → bootstrap → start
│   ├── core/
│   │   ├── api.js         # client REST
│   │   ├── store.js       # cache em memória + migrações
│   │   ├── audio.js       # TTS client
│   │   └── util.js        # el(), helpers
│   ├── ui/
│   │   ├── router.js
│   │   ├── home.js        # tabs + chips de pasta + grid
│   │   ├── deck.js        # detalhe com ações condicionais
│   │   ├── explore.js     # tela nova
│   │   ├── folders.js     # tela nova
│   │   ├── topbar.js
│   │   ├── modal.js       # closeAllModals
│   │   ├── icons.js       # SVG inline
│   │   ├── toggle.js
│   │   ├── dropdown.js
│   │   ├── tabs.js
│   │   ├── toast.js
│   │   └── skeleton.js
│   └── games/             # 5 modos (inalterados)
└── specs/                 # decisões + product + ux desta sprint
```
