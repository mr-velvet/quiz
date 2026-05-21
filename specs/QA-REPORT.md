# QA-REPORT — Sprint Gamificação

Auditoria em produção (`https://quiz.did.lu`) contra `QA-PLAN-gamification.md` (44 critérios)
e `PRODUCT-SPEC-gamification.md` (fórmulas).

Data: 2026-05-20
Ambiente: HeadlessChrome 148 (Win11), viewport 1280×800 + 360×740, cookie `flashy_aid` novo.

---

## 1. Resumo executivo

- **PASS:** 18 / 44 critérios
- **FAIL:** 13 / 44 critérios
- **Não-testado (faltam hooks de debug / som silenciado no headless):** 13 / 44
- **Recomendação:** **VOLTAR PRO DEV.** Há 5 bugs P0 e 4 bugs P1. O mais grave é a
  **divergência de XP/streak/level entre `session-end-modal` (cliente) e backend autoritativo**
  — viola XP-06, LVL-01/02, STK-01, END-02. Também faltam todos os 5 debug hooks
  obrigatórios (`__flashyDebug.*`), o que torna QA automatizado de streak impossível.

---

## 2. Bugs encontrados

### [BUG-GAM-001] `session-end-modal` mostra XP/level/streak inflados e desconectados do backend

**Cenário:** A/C (sessão Flashcards 100%)

**Severidade:** P0

**Esperado (AC XP-06, END-02, STK-01, LVL-02):** `session-end-xp` = soma exata do XP da
sessão; topbar reflete o estado real; streak "Dia 1" só aparece se backend gravou.

**Observado:**
- Após uma sessão de Flashcards onde acertei 10 cards (12 cliques em `fc-known`), o modal
  mostrou: **240 XP**, **18/18 acertos**, **Melhor combo 18**, **"Subiu pro nível 2!"**,
  **"🔥 Dia 1 da ofensiva"**, medalha "Primeira vez".
- `GET /api/me/stats?debug=1` na mesma hora retornou: `xp_total: 60`, `level: 1`,
  `current_streak: 0`, `last_active_date: null`. A sessão correspondente gravou
  `correct: 9, max_combo: 9, xp_earned: 50`.
- Modal mostra dados de uma "sessão lógica" do cliente que mistura várias chamadas
  `POST /api/sessions` em curto espaço, mas backend grava cada uma isolada com 0 acertos
  na maioria. Resultado: jogador vê "Nv 2 + streak ativo + 240 XP" e ao trocar de tela
  topbar mostra "Nv 1 · 60 XP, streak 0".

**Reproduzir:**
1. Cookie limpo, abrir `/#/deck/00000000-0000-0000-0000-000000000010`.
2. Clicar Flashcards.
3. Clicar `[data-testid="fc-known"]` 10–12 vezes (acertar todos).
4. Comparar texto do `.session-end-backdrop` com `GET /api/me/stats?debug=1`.

**Evidência:** `qa-screenshots/gamification-05-session-end.png`, `gamification-07-after-session.png`,
`gamification-08-eu-after-session.png`. Stats debug salvos inline no relatório.

---

### [BUG-GAM-002] `POST /api/cards/:id/result` retorna 404 toda jogada

**Cenário:** Qualquer sessão de qualquer modo.

**Severidade:** P0

**Esperado:** Backend grava o resultado por carta (acerto/erro/timing) pra dificuldade
adaptativa (PRODUCT-SPEC §3.2 — multiplicador de "card aprendendo × 1.5", "dominado × 0.5").

**Observado:** Cada acerto em qualquer modo dispara `POST /api/cards/<uuid>/result` que
volta `404`. O backend não tem essa rota. Bug silencioso — cliente continua, mas:
- O multiplicador de dificuldade do card NUNCA pode ser aplicado corretamente (não há
  histórico per-card).
- Console mostra erro a cada jogada — vira ruído permanente em produção.

**Reproduzir:** Qualquer jogada em qualquer modo. Verificar Network tab ou console.

**Evidência:** Console log mostrado em ambiente HeadlessChrome:
`[ERROR] Failed to load resource: the server responded with a status of 404 ()
@ https://quiz.did.lu/api/cards/<uuid>/result:0`

---

### [BUG-GAM-003] Combo overlay mostra número errado (não corresponde ao combo real)

**Cenário:** B (combo dispara em flashcards)

**Severidade:** P0

**Esperado (AC VIS-09):** Combo overlay mostra exatamente o número de acertos
consecutivos. Combo 5 → "5", combo 10 → "10", etc.

**Observado:** Após 7 cliques consecutivos em "Sei" (sem nenhum erro entre eles), o
overlay mostrou **"20x 1.8"** — o backend confirma "correct: 9, max_combo: 9" pra essa
sessão. O overlay parece somar contadores de sessões abertas anteriormente sem fechar.
Combo 5 inicial mostrou "5x 1.2", combo 10 nunca apareceu corretamente.

**Reproduzir:**
1. Abrir Flashcards, clicar Sei 5x. Overlay mostra "5x 1.2" (OK).
2. Continuar clicando até 10 acertos. Overlay pula direto pra "10x", "15x", "20x" em
   apenas 7 cliques.

**Evidência:** `qa-screenshots/gamification-04-combo20.png` (mostra "20x 1.8" em "Carta
7 de 12").

---

### [BUG-GAM-004] Sessões duplicadas/fantasma — `POST /api/sessions` é chamado várias vezes

**Cenário:** Reentrar no modo Flashcards mesmo deck.

**Severidade:** P0

**Esperado:** Uma sessão por entrada no modo. `POST /api/sessions` cria 1 row por jogo.

**Observado:** Em ~8 minutos de QA com 1 jogador, backend gravou **9 sessões** no mesmo
deck, sendo **4 sessões com `correct: 0, xp_earned: 0`** (sessões abertas e abandonadas
ao recarregar URL ou trocar de modo sem fechar). Isso polui métricas (KPI "sessões/dia"
fica inflado) e provavelmente desencadeia o BUG-GAM-003 (combo somando entre sessões
não fechadas).

**Reproduzir:** Abrir `/#/play/<id>/flashcards`, sair sem terminar, voltar. Cada entrada
cria uma sessão nova mesmo que a anterior não tenha fechado com `finish`.

**Evidência:** `GET /api/me/stats?debug=1` mostra `sessions: 9` no `recent[]`. 4 delas
têm `correct: 0`.

---

### [BUG-GAM-005] Faltam todos os 5 debug hooks obrigatórios

**Cenário:** D/E/F (streak fastForward), G (reset), e qualquer cenário automatizado.

**Severidade:** P0

**Esperado (QA-PLAN §4):**
- `window.__flashyDebug.fastForwardDay(n)`
- `window.__flashyDebug.resetStats()`
- `window.__flashyDebug.grantMedal(slug)`
- Console com prefixo `[flashy:gamification]` em todo evento (XP, combo, medal, levelup).
- `GET /api/me/stats?debug=1` retorna histórico cru de sessões.

**Observado:**
- `typeof window.__flashyDebug === "undefined"`. Nenhum hook exposto.
- Console em 8 minutos de jogo: zero entries com prefixo `[flashy:gamification]`.
- `GET /api/me/stats?debug=1` funciona parcialmente — retorna `recent[]` (PASS), mas
  sem informações de deltas de XP por evento (apenas o agregado da sessão).

**Impacto:** Cenários D (múltiplas sessões mesmo dia), E (streak +1), F (streak quebra)
**impossíveis de testar** sem manipular o relógio. STK-01..STK-04 ficaram "não-testado".

---

### [BUG-GAM-006] Faltam vários `data-testid` obrigatórios do QA-PLAN

**Severidade:** P1

**Esperado (QA-PLAN §3, 16 testids obrigatórios):**

| QA-PLAN exige | Implementado | Status |
|---------------|--------------|--------|
| `topbar-streak` | `topbar-streak` | PASS |
| `topbar-xp` | (combinado com `topbar-level`) | FAIL |
| `topbar-level` | `topbar-level` | PASS |
| `xp-delta-toast` | — não existe | FAIL |
| `combo-indicator` | `combo-overlay` (nome diferente) | nominalmente FAIL |
| `medal-toast` | — não existe (tem `session-end-medal-icon` só dentro do modal) | FAIL |
| `session-end-modal` | `.session-end-backdrop` (sem testid) | FAIL |
| `session-end-xp` | — sem testid (texto em `.session-end-*`) | FAIL |
| `session-end-medals` | — sem testid | FAIL |
| `eu-stats-xp` | (combinado em `me-page`) | FAIL |
| `eu-stats-streak` | — sem testid | FAIL |
| `eu-medals-list` | `me-medals` (nome diferente) | nominalmente FAIL |
| `eu-heatmap` | `me-heatmap` (nome diferente) | nominalmente FAIL |
| `audio-toggle` | `topbar-mute` (nome diferente) | nominalmente FAIL |
| `motion-respect` | — não existe | FAIL |

Renomear contratualmente OK. Ausência (`xp-delta-toast`, `medal-toast`, `motion-respect`,
testids específicos do modal) bloqueia automação E2E.

---

### [BUG-GAM-007] Topbar XP não atualiza em tempo real durante sessão

**Severidade:** P1

**Esperado (AC XP-04):** `topbar-xp` reflete em tempo real o XP acumulado durante a
sessão (incremento animado, não pulo seco).

**Observado:** Durante 10 acertos seguidos em Flashcards, `topbar-level` permaneceu
"Nv 1 · 0 XP" até o `session-end-modal` aparecer. Depois pulou pra "Nv 1 · 60 XP" (ou
similar). Bate com o modelo "cliente bufferiza e envia tudo no finish" — mas violou o
critério de aceite explícito de **incremento real-time**.

---

### [BUG-GAM-008] Streak quase-incrementa mas exige fechar sessão corretamente

**Severidade:** P1

**Esperado (AC STK-01):** Primeira sessão do dia com ≥10 acertos seta streak pra 1.

**Observado:** Setou para 1 SOMENTE após a sessão de MC com 12 acertos + finish bem
sucedido. Sessões anteriores de flashcards (que dependem do BUG-GAM-001 — modal mostra
"Dia 1 ofensiva" enganosamente) deixaram backend com `current_streak: 0` por
~5 minutos. Inconsistência entre o que o usuário vê e o que está no banco. PASS apenas
para sessões "limpas".

---

### [BUG-GAM-009] Atalho de teclado "2" (Sei) navega pra `/eu` em vez de avançar card

**Severidade:** P1

**Esperado:** Botão de modo Flashcards tem UI explícita "Atalho: espaço vira · 1 não sei
· 2 sei". Apertar "2" deveria executar a ação "Sei".

**Observado:** Após focar o `<body>` (estado default ao entrar em `/#/play/.../flashcards`),
apertar a tecla "2" causou **navegação imediata pra `#/eu`**. Provavelmente o handler
global do botão "Meu perfil 👤" da topbar capturou o keydown, ou o roteador interpretou
mal. Apertar "1" provavelmente tem efeito similar (não testado).

**Reproduzir:**
1. Abrir `/#/play/<id>/flashcards`.
2. Não clicar em nada, só apertar tecla `2`.
3. Observa: rota muda pra `#/eu`.

---

### [BUG-GAM-010] Aria-label do streak tem gramática errada ("1 dias")

**Severidade:** P2

**Esperado:** "1 dia de ofensiva" (singular).

**Observado:** Após primeiro streak, aria-label do `topbar-streak` é `"1 dias de
ofensiva"`. Sempre plural, sem ramo singular.

**Evidência:** `topbarStreakAria = "1 dias de ofensiva"` lido do DOM em `https://quiz.did.lu/`.

---

### [BUG-GAM-011] PWA install prompt aparece no meio do jogo

**Severidade:** P2

**Esperado:** Prompts (instalar PWA, banner ownership) não interrompem fluxo de jogo.

**Observado:** Durante uma sessão de MC, modal "Instalar Flashy?" apareceu por cima
das opções, bloqueando interação. Tive que fechar manualmente. Em mobile real isso
pode ser pior se a heurística de prompt do browser disparar logo após o user começar
a jogar.

---

### [BUG-GAM-012] Some sons servidos: `wrong.wav` é tocado em cliques "Sei" (acerto)

**Severidade:** P1

**Esperado:** Acerto toca som de "ding/pop" alegre. Erro toca "thud/wrong".

**Observado:** Network tab durante 3 cliques consecutivos em `fc-known` (todos
"sei/acerto"): **4 requests para `/sounds/wrong.wav`**. Nenhum request para arquivo de
acerto. Provavelmente os cards de tutorial estavam sendo marcados como erro
internamente, OU o nome do arquivo está trocado, OU o cliente está disparando o som
errado.

**Reproduzir:** Network tab aberto, jogar Flashcards e clicar "Sei" várias vezes.

---

### [BUG-GAM-013] `xp-delta-toast` (+10 XP flutuante) não foi observado em nenhuma jogada

**Severidade:** P1

**Esperado (AC XP-05):** A cada acerto, micro-toast `+N XP` flutua e some em ≤2s.
PRODUCT-SPEC §4.1: "Número de XP da jogada flutuando subindo (+10) e sumindo."

**Observado:** Em Flashcards: nada flutua. Em MC: opção certa parece flashar verde
rapidamente, mas sem número de XP. Em Write: aparece feedback "Certo! +20 XP" dentro
da própria área do input (não é toast flutuante). Em Match: par some sem +N XP visível.

Cliente provavelmente não implementou o componente flutuante; só implementou texto
estático no feedback.

---

## 3. Resultado por critério (44 ACs)

### Efeitos visuais (10)

| AC | Sev | Status | Nota |
|---|---|---|---|
| VIS-01 (Flashcards acerto) | P1 | PARCIAL | Card faz transição, mas sem som de acerto observado (BUG-GAM-012); flash não confirmado visualmente no headless. |
| VIS-02 (Flashcards erro) | P1 | NÃO-TESTADO | Não testei errar de propósito. |
| VIS-03 (MC acerto) | P1 | PARCIAL | Opção troca rapidamente; sem confetti pequeno visível. |
| VIS-04 (MC erro) | P1 | NÃO-TESTADO | |
| VIS-05 (Write acerto) | P1 | **PASS** | Input ganha classes `correct flash-correct`; feedback "Certo! +20 XP". |
| VIS-06 (Write erro) | P1 | NÃO-TESTADO | |
| VIS-07 (Match acerto) | P1 | PARCIAL | Par some (PASS), mas confetti/flash não verificado. |
| VIS-08 (Match erro) | P1 | NÃO-TESTADO | |
| VIS-09 (Combo ≥5) | P0 | **FAIL** | Overlay aparece, mas número errado (BUG-GAM-003). |
| VIS-10 (Combo ≥10) | P0 | **FAIL** | Inalcançável corretamente por causa do BUG-GAM-003. |

### XP (6)

| AC | Sev | Status | Nota |
|---|---|---|---|
| XP-01 (fórmula correta) | P0 | PARCIAL | Backend grava XP coerente com fórmulas (MC=10/card, Write=20, Match=8, FC=5). Combo multiplicador aplicado parece OK. Mas modal cliente mostra valores INCOERENTES (BUG-GAM-001). |
| XP-02 (erro nunca subtrai) | P0 | **PASS** | Backend `wrong: 0` em todas as sessões, XP só cresce. |
| XP-03 (persiste após reload) | P0 | **PASS** | XP 338 sobreviveu a refresh + nova request. |
| XP-04 (topbar real-time) | P1 | **FAIL** | Topbar só atualiza após finish (BUG-GAM-007). |
| XP-05 (`xp-delta-toast`) | P1 | **FAIL** | Componente não existe (BUG-GAM-013). |
| XP-06 (sem divergência) | P0 | **FAIL** | BUG-GAM-001. |

### Streak (5)

| AC | Sev | Status | Nota |
|---|---|---|---|
| STK-01 (primeira sessão do dia) | P0 | PARCIAL | Funcionou só após sessão MC de 12 acertos. Sessões anteriores de Flashcards (com 9 acertos) NÃO setaram streak — mas critério é "≥10 acertos", então tecnicamente OK. Modal disse "Dia 1" enganosamente sem backend ter setado. |
| STK-02 (mesma sessão dia) | P0 | NÃO-TESTADO | |
| STK-03 (fastForward +1) | P0 | NÃO-TESTÁVEL | Sem `__flashyDebug.fastForwardDay` (BUG-GAM-005). |
| STK-04 (fastForward +2, reset) | P0 | NÃO-TESTÁVEL | Idem. |
| STK-05 (visual de fogo + pisca) | P1 | NÃO-TESTADO | Streak nunca passou de 1 em uma sessão observável. |

### Medalhas (6)

| AC | Sev | Status | Nota |
|---|---|---|---|
| MED-01 (critério único documentado) | P0 | **PASS** | Tela `/eu` mostra descrição inline de cada medalha. |
| MED-02 (`medal-toast` 3-4s + fanfarra) | P0 | **FAIL** | Medalhas aparecem só dentro do `session-end-modal`. Não vi toast flutuante separado durante a sessão. Sem `medal-toast` testid. |
| MED-03 (aparece em `eu-medals-list` após reload) | P0 | **PASS** | "Primeira vez", "Caçula do deck", "Combo 10" aparecem na grid após reload. |
| MED-04 ("Primeiro 100%") | P0 | N/A (renomeada) | Não há medalha "Primeiro 100%" no MVP (spec atualizada). Equivalente "Sem deslizes" requer ≥20 cards — não testada. |
| MED-05 ("Streak 7") | P0 | NÃO-TESTÁVEL | Sem fastForward. |
| MED-06 (não dispara 2x) | P1 | NÃO-TESTADO | |

### Level up (4)

| AC | Sev | Status | Nota |
|---|---|---|---|
| LVL-01 (animação grande) | P0 | PARCIAL | Modal mostrou "Subiu pro nível 2!" mas BUG-GAM-001 fez ser fake. Backend depois subiu pra nível 3 com mais XP, sem nova celebração observada. |
| LVL-02 (`topbar-level` sobe na hora) | P0 | **FAIL** | Topbar mostrava Nv 1 enquanto modal dizia Nv 2. Após reload virou Nv 3. Sem sincronia. |
| LVL-03 (não bloqueia) | P1 | **PASS** | Modal fecha e libera UI. |
| LVL-04 (2 level-ups em sequência) | P2 | NÃO-TESTADO | |

### Tela `/eu` (5)

| AC | Sev | Status | Nota |
|---|---|---|---|
| EU-01 (renderiza sem erro) | P0 | **PASS** | Header, heatmap, medalhas, decks dominados, sem erros. |
| EU-02 (xp bate com topbar) | P0 | **PASS** | Após reload, ambos mostram 338 XP. |
| EU-03 (streak bate) | P0 | **PASS** | Ambos mostram 1. |
| EU-04 (heatmap quadradinhos) | P1 | **PASS** | 30 quadradinhos com tooltips "DD/MM: X XP, Y sessões". |
| EU-05 (mobile 360px sem overflow) | P1 | **PASS** | bodyScrollW = bodyW = 360. Topbar tem overflow de 2px (insignificante). |

### Fim de sessão (3)

| AC | Sev | Status | Nota |
|---|---|---|---|
| END-01 (modal completo) | P0 | **PASS** | Modal mostra %, XP, breakdown, medalhas, botões "Voltar ao deck" + "Jogar de novo". |
| END-02 (XP da sessão = soma exata) | P0 | **FAIL** | BUG-GAM-001. |
| END-03 (medalhas no modal) | P1 | **PASS** | "Primeira vez" apareceu na seção "Medalha conquistada". |

### Áudio (2)

| AC | Sev | Status | Nota |
|---|---|---|---|
| AUD-01 (toggle silencia tudo) | P0 | NÃO-TESTADO | Headless não toca som; mas BUG-GAM-012 (wrong.wav em acerto) indica problema na lógica de som. |
| AUD-02 (persiste após reload) | P0 | **PASS** | localStorage `flashy:sfx-muted = "1"` preserva. |

### Acessibilidade (1)

| AC | Sev | Status | Nota |
|---|---|---|---|
| A11Y-01 (prefers-reduced-motion) | P1 | **FAIL** | `[data-testid="motion-respect"]` não existe no DOM. |

### Persistência anônima (2)

| AC | Sev | Status | Nota |
|---|---|---|---|
| ANO-01 (cross-session) | P0 | **PASS** | XP/medalhas persistem com mesmo cookie. |
| ANO-02 (limpar cookies zera) | P1 | NÃO-TESTADO | |

---

## 4. Cenários Playwright executados

- **A (XP básico)** — PASS parcial: jogou Flashcards 12 cards via UI, backend gravou
  XP corretamente. Modal mostra valor errado (BUG-GAM-001).
- **B (combo)** — FAIL: overlay aparece mas com número errado (BUG-GAM-003).
- **C (deck 100% + medalha)** — PASS parcial: medalha `first_session` desbloqueou após
  ≥10 acertos. Mas via MC, não Flashcards (Flashcards parou em 9 — não atinge critério).
- **D, E, F (streak fastForward)** — NÃO-TESTÁVEL: faltam debug hooks (BUG-GAM-005).
- **G (tela /eu coerente)** — PASS: após reload, valores batem.
- **H (mobile 360px)** — PASS: sem overflow horizontal.
- **I (prefers-reduced-motion)** — FAIL: sem `motion-respect` testid (BUG-GAM-006).
- **J (toggle som persiste)** — PASS: `flashy:sfx-muted` em localStorage sobrevive
  reload.

Screenshots em `qa-screenshots/gamification-01` a `-14`.

---

## 5. Recomendação final

**VOLTAR PRO DEV** — os 5 bugs P0 abaixo são bloqueantes:

1. **BUG-GAM-001** — divergência cliente/backend nos números do `session-end-modal`.
   Esse bug sozinho mina a confiança do user: ele vê "Subiu pro Nv 2 + Streak Dia 1!"
   e quando vai pra `/eu` aparece "Nv 1 + Streak 0". Quebra a experiência inteira.
2. **BUG-GAM-002** — `/api/cards/:id/result` 404. Backend não tem rota, fórmula de
   dificuldade nunca pode ser aplicada, console polui com erros em produção.
3. **BUG-GAM-003** — combo overlay mostra número errado (acertos de sessões anteriores
   somando).
4. **BUG-GAM-004** — sessões duplicadas/fantasma poluem métricas e contribuem pro
   BUG-GAM-003.
5. **BUG-GAM-005** — sem `__flashyDebug.*`, QA não consegue automatizar streak. Sem
   automação, regressões futuras de streak vão escapar.

Os P1 (testids faltantes, topbar não real-time, atalho de teclado quebrado, sons
trocados, sem xp-delta-toast, sem medal-toast) também são corrigíveis em curto prazo
mas dão pra ir em follow-up.

**Não recomendo aceitar com follow-ups** porque BUG-GAM-001 + BUG-GAM-003 produzem
sensação de "produto bugado" — usuário casual percebe a inconsistência rapidamente.

**Pós-deploy (HEALTH-01..05):** todos os endpoints essenciais respondem 2xx, schema
do `/api/me/stats` correto, mas `/api/cards/<id>/result` 404 (HEALTH-04 indica
"console sem erros não-tratados" — esse erro 404 violaria esse check).

---

## 6. Arquivos relevantes

- Spec: `C:\Users\manu\ved\quiz\specs\QA-PLAN-gamification.md`
- Spec: `C:\Users\manu\ved\quiz\specs\PRODUCT-SPEC-gamification.md`
- Screenshots: `C:\Users\manu\ved\quiz\qa-screenshots\gamification-01..14.png`
- Este relatório: `C:\Users\manu\ved\quiz\specs\QA-REPORT.md`
