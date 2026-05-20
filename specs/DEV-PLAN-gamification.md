# DEV-PLAN — Gamificação

> Plano técnico da sprint de gamificação. Lê em conjunto com
> `PRODUCT-SPEC-gamification.md` (mecânicas, fórmulas, medalhas) e
> `UX-SPEC-gamification.md` (paleta de efeitos, componentes, layout).
> Este arquivo é o "como" da engenharia.

---

## 0. Escopo e princípios técnicos

- Backend autoritativo, cliente otimista. Cliente nunca diverge mais que uma sessão do servidor.
- Tudo continua funcionando sem login (cookie `flashy_aid` é a identidade — não muda).
- Stats são por user, não por device. Quando login Logto entrar, `claimed_by` já permite herdar (mesma mecânica que decks).
- Sem framework, sem dep nova exceto se justificada (nenhuma é justificada neste sprint).
- Performance mobile importa — animações via CSS/Web Animations API, nunca lib pesada.
- Anti-cheat fraco no MVP (uso doméstico), só sanidade básica server-side.

---

## 1. Modelo de dados

### Decisão: snapshot agregado + event log granular

Híbrido. Justificativa:
- Snapshot (`user_stats`, `deck_stats`) → leitura O(1) pra topbar/tela /eu sem agregar nada.
- Event log (`study_sessions` + `session_events`) → permite recomputar histórico, gerar heatmap, debugar XP e migrar fórmula no futuro.
- Sem event log seria impossível QA conferir "por que ganhei 87 XP?".

### Novas tabelas (migration `003_gamification.sql`)

```sql
-- user_stats: snapshot agregado por user. 1:1 com users.
-- Atualizado a cada session finish. Reconstruível a partir de study_sessions.
CREATE TABLE user_stats (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp_total          INTEGER NOT NULL DEFAULT 0,
  level             INTEGER NOT NULL DEFAULT 1,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  last_active_date  DATE,
  total_sessions    INTEGER NOT NULL DEFAULT 0,
  total_correct     INTEGER NOT NULL DEFAULT 0,
  total_wrong       INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- deck_stats: XP/maestria por (user, deck).
CREATE TABLE deck_stats (
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id        UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  xp_deck        INTEGER NOT NULL DEFAULT 0,
  mastery_level  INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, deck_id)
);
CREATE INDEX idx_deck_stats_user ON deck_stats(user_id);

-- medals: catálogo. Povoado pelo migration.
CREATE TABLE medals (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  icon         TEXT,
  tier         TEXT NOT NULL DEFAULT 'bronze', -- bronze|silver|gold|legendary
  criteria     JSONB NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- user_medals: medalhas conquistadas.
CREATE TABLE user_medals (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medal_code  TEXT NOT NULL REFERENCES medals(code) ON DELETE CASCADE,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  context     JSONB,
  PRIMARY KEY (user_id, medal_code)
);
CREATE INDEX idx_user_medals_user ON user_medals(user_id, earned_at DESC);

-- study_sessions: 1 row por partida. Fonte de verdade do XP histórico.
CREATE TABLE study_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id         UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending|finished|abandoned
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INTEGER,
  correct         INTEGER NOT NULL DEFAULT 0,
  wrong           INTEGER NOT NULL DEFAULT 0,
  max_combo       INTEGER NOT NULL DEFAULT 0,
  xp_earned       INTEGER NOT NULL DEFAULT 0,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_sessions_user_started ON study_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_user_deck    ON study_sessions(user_id, deck_id);
CREATE INDEX idx_sessions_pending      ON study_sessions(status, started_at) WHERE status = 'pending';

-- session_events: granular. Permite QA conferir XP card-a-card.
CREATE TABLE session_events (
  id          BIGSERIAL PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,           -- correct|wrong|combo_break|session_end
  card_id     UUID REFERENCES cards(id) ON DELETE SET NULL,
  combo       INTEGER,
  time_ms     INTEGER,
  delta_xp    INTEGER NOT NULL DEFAULT 0,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_session ON session_events(session_id, at);
```

### Trade-offs

- Por que não só event log: topbar precisa de XP em <50ms; agregar a cada GET é caro.
- Por que não só snapshot: sem trail, qualquer bug em fórmula corrompe stats sem como reconstruir; heatmap precisa de granularidade temporal.
- Mastery level vs porcentagem: Produto decide; schema usa INTEGER, flexível.

---

## 2. API nova

Rotas existentes intactas. Convenção segue padrão atual (`isAvailable`, `requireUser`, snake_case nos JSONs, camelCase no client).

### Endpoints

```
POST   /api/sessions                       cria sessão pendente
                                           body: { deck_id, mode }
                                           returns: { id, started_at }

POST   /api/sessions/:id/event             registra acerto/erro em tempo real
                                           body: { kind, card_id?, combo?, time_ms? }
                                           returns: { ok, delta_xp }
                                           Opcional — cliente bufferiza por default; ver §3.

POST   /api/sessions/:id/finish            fecha sessão, calcula XP, atualiza stats
                                           body: { correct, wrong, max_combo, duration_ms,
                                                   events?: [{ kind, card_id, combo, time_ms }] }
                                           returns: { session, xp_earned, level_up?,
                                                      new_medals: [...], stats: {...} }

GET    /api/me/stats                       snapshot + heatmap
                                           query: ?days=30, ?debug=1
                                           returns: { xp_total, level, level_progress,
                                                      current_streak, longest_streak,
                                                      last_active_date,
                                                      heatmap: [{ date, sessions, xp }],
                                                      totals: { sessions, correct, wrong } }

GET    /api/me/medals                      todas as medalhas + flag earned
                                           returns: { earned: [...], available: [...] }

GET    /api/decks/:id/stats                stats do deck pro user atual
                                           (mesma regra de visibilidade do GET /decks/:id)
```

### Regras server-side

- `attachUser` já trata identidade — endpoints criam user anon lazy.
- Anti-cheat MVP:
  - `duration_ms >= 1000` no finish, senão `xp_earned = 0` (registra mesmo assim).
  - `correct + wrong <= deck.cardCount * 3`.
  - XP por sessão capado em `MAX_XP_PER_SESSION = 5000` (Produto define).
  - Eventos com `delta_xp > 200`: descarta + log warn.
- Cálculo de XP é server-side autoritativo. Cliente envia eventos brutos; server aplica fórmula da Produto-Spec.
- Streak update no finish: comparar `today` com `last_active_date`:
  - mesmo dia → no-op
  - ontem → `current_streak++`, atualiza `longest_streak`
  - >1 dia → `current_streak = 1`
- Medalhas: avaliadas server-side no finish. Response retorna `new_medals[]`. Cliente tem checker local pra antecipar visualmente.
- Transação: finish faz tudo em `withTx` (insert session, update user_stats, update deck_stats, insert user_medals, insert session_events).

### Arquivos novos

```
server/routes/sessions.js     POST /, POST /:id/event, POST /:id/finish
server/routes/stats.js        GET /me/stats, GET /me/medals, GET /decks/:id/stats
server/gamification.js        lógica pura: calcXp(event), checkMedals(state), levelFromXp(n)
```

### Cleanup de sessões abandonadas

`setInterval` a cada 1h dentro do processo Node:
```sql
UPDATE study_sessions SET status='abandoned'
WHERE status='pending' AND started_at < now() - interval '2 hours';
```
Sessões abandonadas não geram XP nem afetam stats.

---

## 3. Cliente — onde plugar

### Módulos novos

```
src/core/events.js        bus interno de gamificação. NÃO usa CustomEvent global.
                          Set<fn> próprio — evita conflito com 'flashy:change'
                          (loop infinito conhecido).

src/core/stats.js         cache + sync de user_stats e medals.
                          Mesma forma de store.js. Boot após store.bootstrap().

src/core/medals.js        catálogo + checker local. Reconciliado com finish response.

src/core/sfx.js           áudio de gamificação. Lazy load. Volume em localStorage.

src/core/sessionLoop.js   wrapper por sessão. Cada game cria instância:
                            const s = startSession(deckId, mode);
                            s.onCorrect(cardId, timeMs);
                            s.onWrong(cardId);
                            s.finish() -> Promise<finishResponse>;
```

### POST /event vs buffer

**Buffer no cliente, envia no finish.** Razões:
- Eventos a 200ms entre acertos → req/s alto desnecessário.
- Falha de rede no meio não estraga sessão.
- XP final é o que importa.

Exceção: sessões >5min fazem flush periódico (60s). Endpoint `/event` existe pra esse flush.

### Bus de eventos (`events.js`)

```
Eventos:
  'correct'        { deckId, cardId, mode, combo, timeMs, deltaXp }
  'wrong'          { deckId, cardId, mode }
  'comboMilestone' { combo: 5|10|15|20, ... }
  'sessionStart'   { sessionId, deckId, mode }
  'sessionEnd'     { sessionId, summary, newMedals, levelUp }
  'medalEarned'    { code, name, ... }
  'levelUp'        { from, to }
```

### Hooks em cada game

`flashcards.js`: trocar chamadas `recordCardResult` por `session.onCorrect(card.id)` / `session.onWrong(card.id)`. Manter `recordCardResult` pra stats por card.

Mesmo padrão em `multiple-choice.js`, `write.js`, `match.js`, `speed.js`.

`match.js` e `speed.js` adicionam `session.setRecord({ timeMs })` antes do finish — server compara com `decks.records` e marca medalha "novo recorde".

Cada game chama `session.finish()` no result screen. Retorno alimenta `sessionEndModal`.

---

## 4. Animações sem comprometer performance

- Toda animação respeita `@media (prefers-reduced-motion: reduce)`.
- CSS keyframes pra coisa que se repete (pulse do streak, glow de XP).
- Web Animations API pra número subindo, barra de XP enchendo.
- rAF só pra confetti (1 loop coordenado, máx 3s, auto-cleanup).
- Confetti = canvas 2D leve, 80-150 partículas, gravidade simples. Sem lib externa.

### Componentes visuais novos

```
src/ui/confetti.js        burst() | rain() — canvas overlay. Auto-remove 2s.
src/ui/xpCounter.js       elemento que anima XP A→B via WAAPI.
src/ui/comboOverlay.js    "x5! x10!" no canto durante o jogo.
src/ui/medalToast.js      toast especial pra medalha (maior, com ícone, som).
src/ui/sessionEndModal.js modal de fim de sessão.
src/ui/streakBadge.js     badge da topbar com streak diário.
src/ui/levelBadge.js      pill de nível.
src/ui/heatmap.js         grid 7×N estilo GitHub pra tela /eu.
```

---

## 5. Sons

- Pasta `public/sounds/` (servida estática).
- Mapping em `src/core/sfx.js`:
  ```
  correct, wrong, combo5, combo10, levelUp, medal, record
  ```
- Lazy load. `Audio` instanciado no primeiro `playSfx(key)`. Cacheado em Map.
- Pool de 3 `Audio` por som pra overlap (speed mode).
- Volume: `localStorage 'flashy:sfx-volume'` (default 0.6). Mute: `'flashy:sfx-muted'`.
- Toggle na topbar + atalho `M`.
- Pre-load no boot só de `correct` + `wrong`.

### Geração

- `sfx-gen` (toolbelt) pra criar os 7 sons. Bundlar em `public/sounds/` (~30KB total).
- Mover pra GCS só se passar 100KB.

---

## 6. UI — Componentes e telas

### Topbar redesign

- Esquerda: brand (igual).
- Centro: streak badge (🔥 + número) + pill "Nv 4 · 1.2k XP".
- Direita: ícone som (mute) + link /eu (avatar/iniciais).

Re-render via listener em `events.js` (canal `'flashy:stats-change'`).

### Tela /eu (rota nova)

Path: `#/eu`. Adicionar caso no `router.js`.

`src/ui/me.js`:
- Header: avatar inicial + nível grande + barra de XP.
- Streak atual + recorde + heatmap 30d.
- Medalhas: grid (conquistadas coloridas, futuras grayscale com tooltip).
- Top decks por XP, link pro deck stats.
- Histórico: últimas 10 sessões.

### Tela fim de sessão

Componente `src/ui/sessionEndModal.js` substitui `renderResult` dos games:
- Animação de XP subindo (WAAPI).
- Breakdown: "acertos × base + bônus combo + bônus tempo".
- Medalhas conquistadas (uma por uma, som + confetti).
- Level up: banner especial.
- Botões: Voltar / Jogar de novo.

Games não renderizam mais `renderResult` direto — chamam `sessionEndModal({ summary, finishResponse, onReplay, onBack })`.

### data-testid (lista da QA-Plan)

- `topbar-streak`, `topbar-xp`, `topbar-level`, `topbar-mute`
- `me-page`, `me-heatmap`, `me-medals`, `me-decks-list`
- `session-end-modal`, `session-end-xp`, `session-end-medal-{code}`
- `medal-toast-{code}`, `level-up-banner`
- `combo-overlay`, `confetti-canvas`
- `deck-card-mastery-{deckId}`
- `audio-toggle`, `motion-respect`

---

## 7. Persistência anônima

`flashy_aid` continua sendo identidade. Sem mudança no contrato.

`stats.js`:
- Cache em memória. Source of truth no backend.
- Boot: `GET /api/me/stats` + `GET /api/me/medals` em paralelo com `store.bootstrap()`.
- Não persistir stats em localStorage — risco de divergir entre abas.
- Exceção: `sfx-volume` e `sfx-muted` em localStorage (preferência, não estado).

---

## 8. Migration `003_gamification.sql`

### Ordem

1. CREATE TABLE user_stats
2. CREATE TABLE deck_stats
3. CREATE TABLE medals
4. INSERT INTO medals (catálogo da Produto-Spec)
5. CREATE TABLE user_medals
6. CREATE TABLE study_sessions
7. CREATE TABLE session_events

### Idempotência

- `CREATE TABLE IF NOT EXISTS`.
- INSERTs de medals com `ON CONFLICT (code) DO UPDATE` — permite atualizar catálogo.
- Não altera schema existente. Zero risco em produção.

---

## 9. Como QA verifica

### Debug endpoints

- `GET /api/me/stats?debug=1` retorna snapshot + últimas 50 sessions com events + breakdown da última.
- `GET /api/sessions/:id?debug=1` retorna sessão + todos events + breakdown.

### Modo fast-forward

- `POST /api/dev/fast-forward { user_id?, days: 7 }` — backdata `last_active_date` e cria N sessões sintéticas.
- Gated por `process.env.NODE_ENV !== 'production'` E header `X-Dev-Token` igual a `DEV_TOKEN`.

### Window debug hooks

```
window.__flashyDebug.fastForwardDay(n)   // backdate localStorage + chama endpoint
window.__flashyDebug.resetStats()         // zera tudo, mantém decks
window.__flashyDebug.grantMedal(slug)
```

### Logging

- Server: `[gamification] session=X xp=Y medals=[a,b]`.
- Cliente: `console.debug('[flashy:gamification]', kind, payload)`. Ligado por `localStorage.setItem('flashy:debug', '1')`.

---

## 10. Riscos técnicos

### Loop infinito do emit

`events.js` da gamificação usa Set próprio, NUNCA dispatcha `flashy:change`.
`stats.js` emite `'flashy:stats-change'` (canal isolado).
Antes de emitir: comparar valor anterior (no-op se igual).

### Sessions abandonadas

- Cleanup periódico (§2).
- Cliente: `beforeunload` tenta `finish` com `abandoned: true`. Best effort.

### Race condition cliente/server em medalhas

- Cliente antecipa medalhas óbvias (combo 10, primeira sessão).
- Cliente NÃO antecipa medalhas dependentes de fim (streak_7, novo recorde).
- Se cliente antecipou e server cortou (anti-cheat), reconcilia em silêncio.

### Mobile performance com confetti

- 80 partículas, cap 60fps, auto-pause em `document.hidden`.
- Reduced-motion → fade gradient ao invés de canvas.

### Anti-cheat fraco

- Aceito pra MVP. Se virar problema: `time_ms` mínimo, rate limit de finish, detecção de XP suspeito.

---

## 11. Sequência de implementação

14 etapas. Estimativa: 3-5 dias.

| # | Etapa | Depende | Output |
|---|-------|---------|--------|
| 1 | Migration `003_gamification.sql` + povoamento medals | — | Tabelas + catálogo |
| 2 | `server/gamification.js` (calcXp, levelFromXp, checkMedals) | 1 | Lógica isolada |
| 3 | `server/routes/sessions.js` + cleanup periódico | 1, 2 | Sessões funcionais |
| 4 | `server/routes/stats.js` | 1, 2 | Leitura de stats |
| 5 | Smoke backend: criar sessão, simular eventos, finish | 3, 4 | Backend validado |
| 6 | Cliente: `events.js` + `stats.js` + `medals.js` + bootstrap | 4 | Cache sincronizado |
| 7 | `sessionLoop.js` + integração em flashcards | 3, 6 | Loop completo |
| 8 | Topbar redesign + `streakBadge` + `xpCounter` + `levelBadge` | 6 | Visual sempre presente |
| 9 | Confetti, comboOverlay, medalToast, sessionEndModal | 7, 8 | Efeitos visuais |
| 10 | `sfx.js` + sons + mute toggle | 9 | Áudio integrado |
| 11 | Integração nos outros 4 games | 7, 9, 10 | Cobertura total |
| 12 | Tela `/eu` + heatmap + medalhas grid + deck stats | 8, 9 | Vitrine |
| 13 | Endpoints debug + fast-forward + auditoria data-testid | 11, 12 | QA habilitado |
| 14 | E2E Playwright + ajustes | 13 | Smoke + regression |

Pausas pra demo: #7 (acerto gera XP no flashcards), #9 (confetti + medalha), #14 (entrega).

---

## 12. Dúvidas que precisam fechar antes de codar

1. Produto-Spec finalizada (fórmulas exatas, lista de medalhas, thresholds de mastery)?
2. UX-Spec finalizada (paleta confetti, ícones medalhas, layout /eu)?
3. Sons: gerar via `sfx-gen` ($0.70) ou referências?
4. Volume default 0.6 ok?
5. Reduced-motion: confetti vira fade ou some?
6. Medalhas duplicadas: uma vez ganhou, não ganha de novo (UNIQUE). OK?
7. Reset de stats em /eu? (Recomendo fora do MVP.)
8. Heatmap range: 30/90/365 dias?
9. Cleanup de sessions abandonadas: 2h ou 24h?
10. Confirmar buffer-only para POST /event?

---

## Arquivos críticos a criar/modificar

```
migrations/003_gamification.sql          (novo)
server/gamification.js                   (novo)
server/routes/sessions.js                (novo)
server/routes/stats.js                   (novo)
server.js                                (mount das rotas)
src/core/events.js                       (novo)
src/core/stats.js                        (novo)
src/core/medals.js                       (novo)
src/core/sfx.js                          (novo)
src/core/sessionLoop.js                  (novo)
src/ui/topbar.js                         (refactor pesado)
src/ui/streakBadge.js                    (novo)
src/ui/levelBadge.js                     (novo)
src/ui/xpCounter.js                      (novo)
src/ui/comboOverlay.js                   (novo)
src/ui/confetti.js                       (novo)
src/ui/medalToast.js                     (novo)
src/ui/sessionEndModal.js                (novo)
src/ui/me.js                             (novo, rota /eu)
src/ui/heatmap.js                        (novo)
src/ui/router.js                         (rota /eu)
src/games/flashcards.js                  (refactor pra usar sessionLoop)
src/games/multiple-choice.js             (idem)
src/games/write.js                       (idem)
src/games/match.js                       (idem)
src/games/speed.js                       (idem)
public/sounds/*.mp3                      (7 sons)
```
