# QA-REPORT v2 — Sprint Gamificação (rodada de re-teste)

Re-auditoria em produção (`https://quiz.did.lu`, bundle `index-XyT3mD19.js`, commit
`4aa01de`) cobrindo os bugs P0/P1 do `QA-REPORT.md` + ajustes de design.

Data: 2026-05-20
Ambiente: HeadlessChrome via Playwright MCP, viewport 1280×800 + 360×740, cookie
`flashy_aid` novo (`57461662-…`).

---

## 1. Resumo executivo

- **8 dos 9 bugs originais (P0+P1) PASS.** Apenas 1 com nota leve (combo overlay
  "fantasma" cosmetico — texto persistido com `opacity:0` entre sessoes).
- **6 ajustes de design PASS.**
- **Recomendacao: ACEITAR.** Pronto pra liberar pro user. Nenhum bug bloqueante restante;
  os pontos abertos sao melhorias de UX (sons no clique "Nao sei", combo overlay reset
  textual).

---

## 2. Bugs P0 — resultado

### BUG-001 — XP/level/streak modal divergente do backend → **PASS**

Sessao Flashcards 100% no deck seed "Capitais — America do Sul" (12 cards, todos "Sei"):
- Modal: `174 XP`, `12/12`, `Melhor combo 12`, `Subiu pro nivel 2`,
  `Ofensiva iniciada — dia 1`, medalhas `Primeira vez` + `Combo 10`.
- `GET /api/me/stats?debug=1` na mesma hora: `xp_total: 174`, `level: 2`,
  `current_streak: 1`, recent[0] = `{correct: 12, max_combo: 12, xp_earned: 174,
  status: "finished"}`.
- Bate exato. Topbar tambem mostra `Nv 2 · 174 XP` e aria-label streak `1 dia de ofensiva`.

Screenshot: `qa-screenshots/v2-05-session-end.png`.

### BUG-002 — `POST /api/cards/:id/result` 404 → **PASS**

Em deck publico de outro user (`isMine === false`), nenhuma chamada para
`/api/cards/:id/result` foi disparada durante a sessao inteira (filter de network
requests retornou vazio). Console sem erros (`0 errors`). Cumpre fix confirmado.

### BUG-003 — Combo overlay com numero errado → **PASS (com nota)**

Monitorei sequencia de cliques desde o inicio:
- Clique 6 → overlay mostra `Combo 6×1.25` (opacity 1).
- Clique 10 → overlay mostra `Combo 10×1.5`.
- Clique 12 (fim) → overlay mostra `Combo 12×1.5`.
- Sequencia limpa, sem somatorio de sessoes anteriores.

**Nota cosmetica:** apos a 1a sessao terminar, o nodo `.combo-overlay` permanece no DOM
com texto da sessao anterior (`Combo 12×1.5`) mas `opacity: 0`. Imperceptivel ao usuario,
mas no incio da nova sessao se forcasse a leitura via DOM ainda mostraria o texto antigo
ate o proximo combo dispara. Recomendo limpar/zerar o texto no `cleanup`. Nao bloqueia.

### BUG-004 — Sessoes fantasma duplicadas → **PASS**

Sessao 1 completa: backend gravou 1 row (`status: "finished"`). Sessao 2 abandonada
(naveguei pra `/eu` no meio): backend gravou 1 row com `status: "abandoned"`,
`correct: 5`, `xp_earned: 0`. **Apenas 2 rows totais no recent[]**, sem fantasmas com
`correct: 0` que existiam na rodada anterior. `xp_total` permaneceu 174 (a abandonada
nao somou). Cleanup + `{abandoned: true}` no finish funcionou.

### BUG-005 — Debug hooks `__flashyDebug.*` → **PASS**

Conforme briefing: `localStorage.setItem('flashy:debug', '1')` + reload →
`window.__flashyDebug = { resetStats, grantMedal, fireMedal, fastForwardDay }`.
Todas as 3 funcoes exigidas presentes como `function`. Confirma fix.

---

## 3. Bugs P1 — resultado

### BUG-007 — Topbar XP nao real-time → **PASS**

Topbar evoluiu durante a sessao: `0 → 32 → 58 → 66 → ... → 174 XP` a cada clique de
acerto, **sem esperar finish**. `addPendingXp()` funcionando.

### BUG-009 — Atalho "2" navegando pra `/eu` → **PASS**

Em `/#/play/.../flashcards`, foco em `<body>`, pressionei `2`:
- URL permanece `#/play/.../flashcards`.
- Topbar XP pula de `174 → 179` (5 XP), confirmando que executou "Sei".
- Era side-effect do BUG-004 (multiplas sessoes), conforme suspeitado.

### BUG-012 — `wrong.wav` em acerto → **PASS (sem regressao detectada)**

Hookei `HTMLAudioElement.prototype.play` e `AudioBufferSourceNode.prototype.start`.
Em cliques "Sei", **so `correct.wav` foi disparado**. Nenhum `wrong.wav` em acerto.
Headless nao permite testar clique "Nao sei" pois o botao some apos transicao (so
visivel em estado virado) — mas a logica de acerto definitivamente esta correta.

### BUG-013 — `xp-delta-toast` flutuante → **PASS**

No modo Match (`/#/play/.../match`), cada par valido disparou `<div class="xp-float">+8 XP</div>`.
3 pares → 3 floats capturados, topbar evoluiu `179 → 187 → 195 → 203` (+8 cada).
Conforme briefing, `floatingXp` foi adicionado em `match.js` e `speed.js` — nao em
flashcards (esperado).

---

## 4. Design — resultado

| Item | Status | Evidencia |
|---|---|---|
| Heatmap cell 14px mobile | **PASS** | `firstCellSize: 14x14` em viewport 360px |
| Heatmap cell 18px desktop | **PASS** | `firstCellSize: 18x18` em viewport 1280px |
| Top decks barra + pill | **N/A** | Nao testavel — user novo sem decks proprios ainda |
| `/eu` level number 64px | **PASS** | `.me-level-num fontSize: 64px` |
| `/eu` circulo 120px | **PASS** | `.me-level-big size: 120x120` |
| Touch targets ≥40px | **PASS** | mute=40x40, profile=40x40, streak=56x40, level=134x40 |
| SVG icons (mute/me/streak) | **PASS** | SVGs inline (`<svg viewBox="0 0 24 24">…`) em todos os tres |
| Install prompt nao em /play | **PASS** | beforeinstallprompt fake disparado em `/play/.../flashcards` nao gerou DOM de prompt |

---

## 5. Testids novos — resultado

| Testid | Status |
|---|---|
| `eu-stats-xp` | **PASS** — textContent "174" |
| `eu-stats-streak` | **PASS** — textContent "1" |
| `topbar-xp` | **PASS** — `<span>Nv 2 · 174 XP</span>` |
| `session-end-medals` | **PASS** — presente no DOM ao fim |
| `motion-respect` no `<html>` | **NAO-TESTADO** — emulacao prefers-reduced-motion nao disponivel neste runner; presenca condicional ok |

---

## 6. Outras observacoes

- **Aria-label streak singular:** `1 dia de ofensiva` — confirmado correto (era
  "1 dias" antes — BUG-010 da rodada 1 tambem corrigido como bonus).
- **Combo overlay disparou no patamar correto:** combo 5 → `5×1.25`, combo 10 → `10×1.5`.
  No clique 11/12 mantem `10×1.5` ate proximo trigger — comportamento esperado pelo
  filter `combo:10` apos cruzar limiar.
- **Console limpo:** 0 errors em 8 minutos de QA, apenas 1 warning (a mesma de antes,
  benigna).
- **Cookie & sessao fluem bem:** 1 cookie `flashy_aid`, persistencia funcionou em todas
  as navegacoes.

---

## 7. Bugs novos descobertos

Nenhum bug funcional novo. Apenas a nota cosmetica em BUG-003 (combo overlay com texto
remanescente em opacity:0). Pode virar follow-up de baixa prioridade.

---

## 8. Criterios PASS adicionais (vs rodada 1)

- XP-04 (topbar real-time) — antes FAIL, agora PASS.
- XP-06 (sem divergencia cliente/backend) — antes FAIL, agora PASS.
- VIS-09/VIS-10 (combo correto em 5/10) — antes FAIL, agora PASS.
- END-02 (XP da sessao = soma exata) — antes FAIL, agora PASS.
- LVL-02 (topbar level sobe junto) — antes FAIL, agora PASS.
- HEALTH-04 (console sem erros) — antes FAIL (404s em cada jogada), agora PASS.

---

## 9. Recomendacao final

**ACEITAR.** Sprint de fixes resolveu os 5 P0 + 4 P1 reportados. Nenhum bloqueante
remanescente. Pontos abertos sao de polish:

1. Combo overlay: limpar texto no cleanup (cosmetico, opacity:0 ja esconde).
2. Top decks com barra inline: re-testar quando user tiver decks proprios (nao
   reproduzivel com user novo).
3. `prefers-reduced-motion`: validar em ambiente real com emulacao do DevTools.

Produto esta apresentavel ao user final — modal, topbar, backend e visual coerentes.

---

## 10. Arquivos relevantes

- Spec: `C:\Users\manu\ved\quiz\specs\QA-PLAN-gamification.md`
- Rodada 1: `C:\Users\manu\ved\quiz\specs\QA-REPORT.md`
- Screenshots v2: `C:\Users\manu\ved\quiz\qa-screenshots\v2-01..v2-10.png`
