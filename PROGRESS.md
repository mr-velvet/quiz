# Flashy (quiz) — Progresso

Última atualização: 2026-05-21 (ajustes pós-gamificação: áudio + import + write)

> **Antes de qualquer trabalho neste repo, ler `CONCEPTS.md`** — visão de produto,
> princípios e decisões estratégicas. Este arquivo aqui é o estado operacional.
>
> Specs detalhadas em `specs/`. A última sprint (gamificação) está documentada em:
> - `DECISIONS-sprint-gamification.md` — decisões batidas
> - `PRODUCT-SPEC-gamification.md` — fórmulas, medalhas, KPIs
> - `UX-SPEC-gamification.md` — paleta de efeitos, layouts
> - `DEV-PLAN-gamification.md` — schema, endpoints, módulos
> - `QA-PLAN-gamification.md` — 44 critérios, 10 cenários Playwright

## Produção

- **URL:** https://quiz.did.lu
- **Repo:** https://github.com/mr-velvet/quiz (branch `master`)
- **Porta interna:** 5034
- **Container:** Node 20 + Express + Postgres compartilhado da plataforma did.lu
- **Banco:** `quiz` no postgres da did.lu
- **Health:** `GET /api/health` → `{"status":"ok","service":"quiz"}`
- **Deploy:** `cd ~/ved/devops-workflow-2026 && .\scripts\did.ps1 deploy quiz`

### Env vars necessárias em produção
- `OPENAI_API_KEY` — pro TTS (tts-1).
- `DATABASE_URL` — injetada pela plataforma.
- `GCS_BUCKET` — default `didlu-imagestore`.
- `DEV_TOKEN` (opcional) — pra liberar `/api/dev/*` em prod.

## Sprints entregues

### Sprint 1 — MVP (5 modos, deck via texto, modal custom, router)
### Sprint 2 — TTS (OpenAI tts-1, cache GCS)
### Sprint 3 — Ownership/Visibility/Pastas/Explore
### Sprint 4 — Gamificação ✅
### Sprint 4.5 — Ajustes pós-gamificação ✅ (atual)

Três pequenos blocos com impacto direto na percepção do produto:

- **Áudio:** detecção de idioma roda 1× por deck na criação (server/langDetect.js)
  e fica em `decks.lang_front` / `decks.lang_back` (migration 004). Decks antigos
  (criados antes da migração) fazem backfill lazy via PATCH quando o dono toca o
  primeiro áudio. `playCardAudio` agora prefere a coluna do deck antes de
  detectar localmente. `prefetchCardAudio` é chamado pelos modos
  (flashcards / write / multiple-choice) pra esquentar a URL da próxima carta
  enquanto o user vê a atual — corta a latência percebida em quase tudo. Server
  também mantém um set de hashes já confirmados no GCS pra pular o HEAD em hits
  repetidos.
- **Importação:** novo `src/ui/importPicker.js` com seletor de separador
  (auto/tab/vírgula/`;`/`-`) e, quando o texto tiver >2 colunas, seletor de quais
  colunas viram frente e verso. Default colunas 1 e 2. Integrado no modal "novo
  deck" (home) e "adicionar cartas" (deck).
- **Write:** `card.back` agora pode listar múltiplos significados (separados por
  `,`, `;`, `/`, `|`) — qualquer um deles bate como certo. `splitMeanings` /
  `matchesAnyMeaning` em `src/core/util.js`. Hint no erro mostra "Aceita: X · Y · Z".

Adiciona feedback emocional ao acerto + progressão de longo prazo:
- **XP por modo** (Flashcards 5, MC 10, Match 8, Speed 6, Write 20), modulado
  por dificuldade do card (×0.5 dominado, ×1.0 novo, ×1.5 aprendendo) e combo
  (até ×2.0 cap em combo 30+). Bônus +50/+100 por sessão 100%.
- **Combo visual** no canto da tela, com som que escala por tier (5/10/20/30).
- **Confetti custom** em canvas (sem libs), 80 mobile/150 desktop, auto-pause em
  document.hidden, fade pra reduced-motion.
- **Streak diário** com corte 04:00 local + grace de 1 dia/semana. Marcos 3/7/14/30/60/100/365.
- **18 medalhas** retroativas (onboarding, criação, performance, combo, mode-específico, mastery, streak).
- **Nível global** com curva exponencial (Nv2=100, Nv5=1k, Nv10=16k, Nv20=120k, Nv50=3M).
- **Nível por deck** com cap 10 (Novo → Lenda do deck).
- **Topbar redesenhada:** brand + streak + level pill + mute + me (avatar).
- **Tela `/eu`:** header com nível/XP/streak, heatmap 30d estilo GitHub,
  grid de 18 medalhas (lockeds em grayscale), top decks com nível e barra.
- **9 sons** gerados via sfx-gen (correct, wrong, combo5/10/20, level-up, medal, record, finish).
  ON desktop / OFF mobile default. Toggle global + atalho `M`.
- **PWA:** manifest.json, service worker (cache-first estáticos),
  ícones 192/512 maskable + apple-touch-icon. Install prompt mobile (Android/iOS)
  com dismiss 30 dias.
- **Backend autoritativo:** XP/medalhas calculados server-side no finish.
  Cliente bufferiza eventos e envia tudo no finish (defensivo: flush periódico em
  sessões >5min). Anti-cheat MVP: duration_ms ≥1s, XP capado em 5000/sessão.
- **a11y:** prefers-reduced-motion respeitado (desliga confetti, pulses), aria-live
  na topbar XP, role=alert em medal-toast.
- **Debug hooks** pra QA: `window.__flashyDebug.resetStats() / grantMedal(code) /
  fastForwardDay(n) / fireMedal(code)`. Endpoints `/api/dev/*` gated por DEV_TOKEN
  em prod.

### Migration nova (003_gamification.sql)
6 tabelas: `user_stats`, `deck_stats`, `medals` (catálogo 18), `user_medals`,
`study_sessions`, `session_events`.

### API nova
```
POST   /api/sessions                       cria sessão pendente
POST   /api/sessions/:id/event             flush periódico (opcional)
POST   /api/sessions/:id/finish            fecha, calcula XP, retorna medalhas
GET    /api/sessions/:id?debug=1           debug
GET    /api/me/stats?days=30&debug=1       snapshot + heatmap + recent
GET    /api/me/medals                      catálogo + earned
GET    /api/me/decks-top                   top decks por XP
GET    /api/decks/:id/stats                stats do deck pro user atual
POST   /api/dev/reset-stats                debug only
POST   /api/dev/grant-medal                debug only
POST   /api/dev/fast-forward               debug only
```

### Loop infinito conhecido — evitado
`flashy:change` (CustomEvent global) continua sendo usado pelo store, mas a
gamificação NÃO usa esse canal. `src/core/events.js` tem bus próprio (Set<fn>)
que emite `'statsChange'`, `'correct'`, `'wrong'`, `'comboMilestone'`,
`'medalEarned'`, etc. Topbar escuta `statsChange` e re-renderiza chunk-da-direita
(cleanup via `registerCleanup` do router).

## Arquivos-chave

```
quiz/
├── did.json
├── Dockerfile               (copia public/sounds/, manifest, sw, ícones pro dist)
├── server.js                (monta sessions, stats, dev routers + cleanup loop)
├── migrations/
│   ├── 001_init.sql
│   ├── 002_seeds.sql
│   └── 003_gamification.sql (novo — 6 tabelas + 18 medalhas)
├── server/
│   ├── gamification.js      (fórmulas puras: calcXp, levelFromXp, updateStreak,
│   │                         evaluateMedals, ...)
│   ├── routes/
│   │   ├── sessions.js      (POST /, /:id/event, /:id/finish)
│   │   ├── stats.js         (/me/stats, /me/medals, /me/decks-top, /decks/:id/stats)
│   │   └── dev.js           (reset/grant/fast-forward)
│   ├── auth.js, db.js, tts.js
│   └── routes/me, decks, cards, folders, explore
├── public/
│   ├── manifest.json        (PWA)
│   ├── sw.js                (service worker)
│   ├── sounds/              (9 wavs gerados via sfx-gen)
│   └── assets/icon-192.png, icon-512.png, *-maskable.png, apple-touch-icon.png
├── src/
│   ├── core/
│   │   ├── events.js        (bus isolado, NÃO usa flashy:change)
│   │   ├── stats.js         (cache user_stats + sync)
│   │   ├── medals.js        (catálogo local + antecipação visual)
│   │   ├── sfx.js           (pool de Audio, mute, volume)
│   │   ├── sessionLoop.js   (wrapper de sessão — startSession/onCorrect/finish)
│   │   ├── pwa.js           (registra SW)
│   │   ├── debug.js         (window.__flashyDebug)
│   │   └── api.js, store.js, audio.js, util.js
│   ├── ui/
│   │   ├── topbar.js        (refactor: streak + level + mute + me)
│   │   ├── streakBadge.js
│   │   ├── levelBadge.js
│   │   ├── comboOverlay.js
│   │   ├── confetti.js      (canvas custom)
│   │   ├── medalToast.js
│   │   ├── xpCounter.js     (animateNumber, floatingXp)
│   │   ├── sessionEndModal.js (substitui renderResult dos games)
│   │   ├── heatmap.js       (grid 7×N GitHub-style)
│   │   ├── me.js            (rota /eu)
│   │   ├── gamificationOverlay.js (host de combo + medal toast)
│   │   ├── installPrompt.js (Android/Chrome + iOS)
│   │   └── deck, home, explore, folders, modal, etc.
│   └── games/               (5 refatorados pra usar sessionLoop)
└── specs/                   (4 specs + DECISIONS)
```

## Backlog / próximas opções

### A. Polimento de gamificação (1-2 dias)
- Banner inline na home no 4º dia ("🔥 Dia 4 da ofensiva").
- Lembrete "faltam X XP pro próximo nível" quando ≥90%.
- Filtrar medalhas por categoria na tela /eu.
- Sons em mp3 (com ffmpeg) pra economizar bandwidth (wav é 5×).
- Antecipação de level-up via curva client (sem aguardar finish).

### B. Login Logto (1-2 dias)
- Setar `logto: true` no did.json.
- Claim do anonymous_id → user logado (preserva XP/streak/medalhas).
- Trocar "anônimo" em decks públicos por `@nome`.

### C. Modo escrever bidirecional, edição manual de card

## Riscos atuais

- **Anonymous_id em 2 browsers** = 2 users distintos com XPs separados.
  Resolve com login.
- **Sons em WAV** (~1.7MB total) — funciona mas consome bandwidth. Converter
  pra mp3 economizaria 5× quando ffmpeg estiver disponível.
- **Anti-cheat fraco**: aceita confiança no client por ora. Anti-cheat formal
  só faz sentido quando entrar ranking (categoricamente fora pra MVP).
- **PWA install prompt mobile**: testado no design mas precisa validação em
  device real (iOS Safari + Android Chrome).
