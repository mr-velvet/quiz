# QA-PLAN — Sprint Gamificação

Plano de teste pra sprint que adiciona streak, XP por deck, XP global, medalhas, level-up,
efeitos visuais e tela `/eu`. Este documento é a **fonte de verdade** pro agente de QA
validar a entrega antes de aceitar o merge.

Última revisão: 2026-05-20
Autor: Agente de QA

---

## 0. Resumo executivo

- **Critérios de aceite:** 41 itens binários (PASS/FAIL), agrupados por área.
- **E2E Playwright:** 10 cenários (A–J), rodados em sequência num mesmo run.
- **Selectors obrigatórios:** 16 `data-testid` que o Dev DEVE colocar.
- **Debug hooks obrigatórios:** 5 (3 no `window.__flashyDebug`, 1 endpoint, 1 logger).
- **Regressão:** 8 fluxos pré-existentes que não podem quebrar.
- **Pós-deploy:** 5 checks em produção (10min após push).

Se 1 critério P0 falha → sprint volta pro Dev. Se >3 P1 falham → volta pro Dev. P2 pode
entrar como follow-up.

---

## 1. Critérios de aceite (PASS/FAIL)

Cada critério é um teste único, observável, sem ambiguidade. Severidade entre parênteses:
**P0** (bloqueante), **P1** (deve corrigir antes de aceitar), **P2** (pode virar
follow-up).

### 1.1 Efeitos visuais por modo (10)

1. **VIS-01 (P1)** Flashcards · acerto: card faz pulse verde + som "ding" ≤150ms após click em "Sei".
2. **VIS-02 (P1)** Flashcards · erro: card faz shake leve + som "thud" suave.
3. **VIS-03 (P1)** MC · acerto: opção escolhida vira verde, faz pulse, confetti pequeno na opção.
4. **VIS-04 (P1)** MC · erro: opção escolhida vira vermelha, opção correta destaca em verde simultâneo.
5. **VIS-05 (P1)** Escrever · acerto: input ganha border verde + pulse + som "ding".
6. **VIS-06 (P1)** Escrever · erro: input ganha border vermelha, mostra resposta certa em verde.
7. **VIS-07 (P1)** Match · acerto: par some com flash verde + confetti pequeno + som "pop".
8. **VIS-08 (P1)** Match · erro: ambos tiles fazem shake vermelho + som "thud".
9. **VIS-09 (P0)** Combo ≥5: aparece `combo-indicator` no canto/topbar com número, som progressivo (pitch sobe a cada acerto).
10. **VIS-10 (P0)** Combo ≥10: confetti grande na tela inteira (1x, não polui), som "ding" mais alto.

### 1.2 XP — cálculo e persistência (6)

11. **XP-01 (P0)** Acerto em flashcards adiciona exatamente `10 + bonusTempo + (combo×0.1)*base` ao XP do deck e ao XP global (fórmula do CONCEPTS.md §gamificação).
12. **XP-02 (P0)** Erro NUNCA subtrai XP. XP só pode crescer ou ficar igual.
13. **XP-03 (P0)** Após fim de sessão, refresh da página mantém XP global (persiste no backend, via `flashy_aid`).
14. **XP-04 (P1)** `topbar-xp` mostra o valor atual e atualiza em real-time durante sessão (incremento animado, não pulo seco).
15. **XP-05 (P1)** `xp-delta-toast` aparece a cada combo ≥3 ou marco (+50, +100), some em ≤2s.
16. **XP-06 (P0)** XP somado na sessão = somatório dos deltas mostrados no `xp-delta-toast` + base de cada acerto. Não pode ter divergência entre exibição e estado real.

### 1.3 Streak (5)

17. **STK-01 (P0)** Primeira sessão de estudo do dia (qualquer modo) incrementa streak para 1 (se era 0) ou mantém número se já >0.
18. **STK-02 (P0)** Segunda sessão **no mesmo dia** NÃO incrementa streak (continua igual).
19. **STK-03 (P0)** `__flashyDebug.fastForwardDay(1)` + nova sessão = streak +1.
20. **STK-04 (P0)** `__flashyDebug.fastForwardDay(2)` (pula 1 dia inteiro) + nova sessão = streak reseta para 1.
21. **STK-05 (P1)** `topbar-streak` mostra streak atual com ícone de fogo, e visualmente "pisca" no momento que incrementa.

### 1.4 Medalhas (6)

22. **MED-01 (P0)** Cada medalha tem critério único e documentado em `/eu` (tooltip ou inline).
23. **MED-02 (P0)** Conquistar medalha dispara `medal-toast` com nome + ícone, dura 3-4s, som de fanfarra curta (não genérico de jogo mobile).
24. **MED-03 (P0)** Medalha conquistada aparece em `eu-medals-list` na tela `/eu` após reload.
25. **MED-04 (P0)** Medalha "Primeiro 100%" dispara ao completar deck com 100% de acerto pela primeira vez.
26. **MED-05 (P0)** Medalha "Streak 7" dispara no 7º dia consecutivo (verificado via fastForward).
27. **MED-06 (P1)** Medalha NÃO dispara 2x. Re-conquistar mesmo deck com 100% não re-dispara toast.

### 1.5 Level up (4)

28. **LVL-01 (P0)** Ao cruzar limiar (1k, 2.5k, 5k, 10k...), dispara animação grande de level-up no centro da tela, som de fanfarra, duração ≤3s.
29. **LVL-02 (P0)** `topbar-level` sobe número 1 unidade no momento exato do level-up.
30. **LVL-03 (P1)** Animação de level-up NÃO bloqueia interação após terminar (não fica modal preso — bug já visto na sprint anterior).
31. **LVL-04 (P2)** Se user passa 2 níveis numa única sessão (XP grande), dispara 2 animações em sequência, não simultâneas.

### 1.6 Tela `/eu` (5)

32. **EU-01 (P0)** Rota `#/eu` renderiza sem erro de console, mostra: XP global, nível, streak atual, medalhas, calendar heatmap dos últimos 90 dias.
33. **EU-02 (P0)** `eu-stats-xp` bate exatamente com `topbar-xp`. Sem divergência.
34. **EU-03 (P0)** `eu-stats-streak` bate com `topbar-streak`.
35. **EU-04 (P1)** `eu-heatmap` mostra um quadradinho aceso para cada dia que teve sessão. Tooltip do quadradinho mostra "X sessões em DD/MM/YYYY".
36. **EU-05 (P1)** Tela `/eu` cabe em mobile 360px sem scroll horizontal.

### 1.7 Fim de sessão (3)

37. **END-01 (P0)** `session-end-modal` mostra: % de acerto, total XP ganho na sessão (`session-end-xp`), medalhas conquistadas (`session-end-medals`), botão "voltar" e "jogar de novo".
38. **END-02 (P0)** `session-end-xp` = soma exata de todos os XP ganhos na sessão. Validar contra delta `topbar-xp` (antes vs depois).
39. **END-03 (P1)** Se medalha conquistada nesta sessão, aparece em `session-end-medals` com ícone + nome.

### 1.8 Áudio (2)

40. **AUD-01 (P0)** `audio-toggle` na topbar/eu funciona: OFF silencia TODOS os sons de gamificação (ding/thud/fanfarra/pop). Default ON.
41. **AUD-02 (P0)** Preferência de áudio persiste após reload (localStorage).

### 1.9 Acessibilidade (1)

42. **A11Y-01 (P1)** `prefers-reduced-motion: reduce` desliga confetti, animação grande de level-up, e shakes. XP/streak ainda atualizam mas sem movimento exagerado. Selector `motion-respect` em algum container reflete o estado (data attribute).

### 1.10 Persistência anônima (2)

43. **ANO-01 (P0)** XP/streak/medalhas persistem cross-session (reabrir browser, mesmo cookie `flashy_aid` = mesmos stats).
44. **ANO-02 (P1)** Limpar cookies (browser limpo) zera todos os stats. Nova sessão começa do 0.

> Total: 44 critérios. Excede o mínimo de 30 do brief.

---

## 2. Plano E2E Playwright

Script único `qa/gamification.spec.js` (a ser criado pelo QA). Roda em sequência os
cenários A–J. Cada cenário é uma `test()` separada que pode rodar isolado.

**Setup global:**
- Limpar cookies + localStorage do domínio `quiz.did.lu`.
- Navegar para `https://quiz.did.lu`.
- Aguardar `__flashyDebug` estar disponível (até 3s).
- Cada cenário começa de estado limpo via `__flashyDebug.resetStats()`.

### Cenário A — XP básico ganha ao jogar (P0)

1. Limpar storage, navegar para home.
2. Capturar `topbar-xp` inicial (esperado: "0" ou ausente).
3. Criar deck via UI (paste de texto, 10 cards).
4. Abrir modo Flashcards.
5. Acertar 5 cards (clicar "Sei").
6. Voltar pro deck.
7. Ler `topbar-xp`. **Asserção:** valor > 0, exatamente igual ao somatório esperado pela fórmula.
8. Screenshot `qa-screenshots/gam-A-xp.png`.

### Cenário B — Combo dispara efeito (P0)

1. Criar deck com 20 cards.
2. Modo MC.
3. Acertar 5 consecutivos (escolher opção certa baseado no deck conhecido).
4. **Asserção:** `combo-indicator` aparece com texto "Combo 5x" ou similar, classe ativa.
5. Continuar até 10 acertos.
6. **Asserção:** confetti aparece (verificar via DOM — elemento `.confetti-burst` ou similar).
7. Screenshot `qa-screenshots/gam-B-combo.png`.

### Cenário C — Deck 100% + medalha "primeiro 100%" (P0)

1. Criar deck pequeno (4 cards).
2. Modo MC, acertar todos.
3. **Asserção:** `session-end-modal` aparece com `session-end-xp` > 0.
4. **Asserção:** `medal-toast` apareceu durante ou ao fim.
5. **Asserção:** `session-end-medals` contém medalha "Primeiro 100%".
6. Ir para `/eu`, **asserção:** medalha visível em `eu-medals-list`.
7. Screenshot `qa-screenshots/gam-C-100pct.png`.

### Cenário D — Streak fica em 1 com múltiplas sessões mesmo dia (P0)

1. Reset stats.
2. Jogar 1 sessão (Flashcards, 5 cards).
3. **Asserção:** `topbar-streak` = "1".
4. Jogar segunda sessão (mesmo deck, mesmo dia — sem fastForward).
5. **Asserção:** `topbar-streak` ainda = "1".
6. Jogar terceira sessão.
7. **Asserção:** `topbar-streak` ainda = "1".

### Cenário E — Streak incrementa em dia +1 (P0)

1. Continuar do estado do Cenário D (ou novo reset + 1 sessão).
2. `window.__flashyDebug.fastForwardDay(1)`.
3. Jogar nova sessão.
4. **Asserção:** `topbar-streak` = "2".
5. Screenshot `qa-screenshots/gam-E-streak2.png`.

### Cenário F — Streak quebra ao pular dia (P0)

1. Continuar do Cenário E (streak=2).
2. `window.__flashyDebug.fastForwardDay(2)` (pula 1 dia inteiro sem jogar).
3. Jogar nova sessão.
4. **Asserção:** `topbar-streak` = "1" (resetou).

### Cenário G — Tela /eu coerente com topbar (P0)

1. Estado: já tem XP, streak, medalhas (de cenários anteriores).
2. Capturar `topbar-xp`, `topbar-streak`, `topbar-level`.
3. Navegar para `#/eu`.
4. **Asserção:** `eu-stats-xp` == `topbar-xp`.
5. **Asserção:** `eu-stats-streak` == `topbar-streak`.
6. **Asserção:** `eu-medals-list` tem ≥1 medalha.
7. **Asserção:** `eu-heatmap` renderiza, tem células acesas correspondentes aos dias jogados (via fastForward).
8. Screenshot `qa-screenshots/gam-G-eu.png`.

### Cenário H — Mobile viewport (P1)

1. `page.setViewportSize({ width: 360, height: 740 })`.
2. Reset + jogar sessão até `session-end-modal`.
3. **Asserção:** `topbar-streak`, `topbar-xp`, `topbar-level` cabem na topbar sem overflow (verificar `scrollWidth` da topbar ≤ `clientWidth`).
4. **Asserção:** `session-end-modal` cabe na tela (sem scroll vertical do modal).
5. Screenshot `qa-screenshots/gam-H-mobile.png`.

### Cenário I — prefers-reduced-motion (P1)

1. `page.emulateMedia({ reducedMotion: 'reduce' })`.
2. Reset + sessão com combo 10x.
3. **Asserção:** elemento `[data-testid="motion-respect"]` tem `data-motion="reduce"`.
4. **Asserção:** `.confetti-burst` NÃO existe ou tem `display: none`.
5. **Asserção:** animação de level-up grande não dispara (verificar via não aparecer overlay full-screen).
6. XP e streak ainda atualizam normalmente.
7. Screenshot `qa-screenshots/gam-I-reduced-motion.png`.

### Cenário J — Toggle de som persiste (P0)

1. Reset, navegar home.
2. Click em `audio-toggle` para OFF.
3. Jogar sessão, ouvir (via audio API stub — verificar que `Audio.play()` não é chamado ou é mutado).
4. Reload da página.
5. **Asserção:** `audio-toggle` continua OFF (`data-state="off"` ou aria-checked="false").
6. Click pra ON.
7. Reload.
8. **Asserção:** continua ON.

---

## 3. Selectors necessários (`data-testid`)

Dev DEVE adicionar estes atributos. Sem eles, QA é manual e custoso.

### Topbar
- `topbar-streak` — wrapper do streak (ícone + número).
- `topbar-xp` — wrapper do XP (texto numérico legível).
- `topbar-level` — wrapper do nível.

### Efeitos in-game
- `xp-delta-toast` — toast efêmero de +X XP.
- `combo-indicator` — indicador de combo (qualquer elemento que renderiza "Combo Nx").
- `medal-toast` — toast de medalha conquistada.

### Fim de sessão
- `session-end-modal` — container do modal/painel de resultado.
- `session-end-xp` — texto do XP ganho na sessão.
- `session-end-medals` — container das medalhas conquistadas na sessão.

### Tela `/eu`
- `eu-stats-xp` — XP global.
- `eu-stats-streak` — streak atual.
- `eu-medals-list` — lista de medalhas.
- `eu-heatmap` — container do calendar heatmap.

### Settings / acessibilidade
- `audio-toggle` — botão/switch de som ON/OFF.
- `motion-respect` — container raiz que reflete prefers-reduced-motion (atributo `data-motion="reduce|normal"`).

> Total: 16 testids. Todos obrigatórios.

---

## 4. Debug hooks obrigatórios

Sem isso, QA não consegue automatizar streak nem reset. Dev DEVE expor em produção
(não esconder atrás de flag — é hook silencioso, não polui UX).

### `window.__flashyDebug`

- **`fastForwardDay(n: number)`** — avança o "relógio" do app em N dias para fins de
  cálculo de streak/heatmap. Implementação sugerida: salvar um offset em localStorage
  que é somado ao `Date.now()` em todas as comparações de data de sessão.

- **`resetStats()`** — zera XP global, XP por deck, streak, medalhas, último-dia-jogado.
  NÃO apaga decks nem cookies. Útil pra começar cenário do zero.

- **`grantMedal(slug: string)`** — concede medalha por slug, útil pra testar UI sem
  reproduzir a condição. Lista de slugs documentada no DEV-PLAN.

### Backend

- **`GET /api/me/stats?debug=1`** — retorna histórico cru de sessões (timestamps,
  deltas de XP, eventos de medalha) para verificação de cálculo. Sem `debug=1`,
  retorna só o agregado.

### Logging

- **`console.debug` com prefix `[flashy:gamification]`** — todo evento relevante
  (XP ganho, combo break, medal trigger, level up, streak update) loggado com esse
  prefixo. QA filtra console por esse prefixo pra debug rápido.

---

## 5. Casos de regressão (não pode quebrar)

Sprint de gamificação **não pode quebrar** funcionalidade pré-existente. QA roda
este checklist depois dos cenários A–J:

1. **R-01** Criar deck via paste de texto continua funcionando (≥10 cards importam corretamente).
2. **R-02** Editar deck (renomear, mudar visibilidade) funciona.
3. **R-03** Deletar deck funciona (e some da lista).
4. **R-04** Todos os 5 modos abrem e jogam até o fim sem erro de console.
5. **R-05** Tela Explorar lista decks públicos, busca funciona, paginação funciona.
6. **R-06** Pastas: criar, mover deck pra pasta, filtrar, deletar — tudo funciona.
7. **R-07** TTS toca em cards (botão speaker / atalho S).
8. **R-08** Modal de criação NÃO fica preso após fechar (bug já corrigido na sprint anterior — re-validar).

Cada um é PASS/FAIL. Qualquer FAIL = regressão = sprint volta pro Dev.

---

## 6. Formato pra reportar bugs

Bugs encontrados são reportados em issues no repo ou no canal interno, no formato:

```
### [BUG-GAM-NNN] Título curto

**Cenário:** A / B / ... ou descrição manual

**Severidade:** P0 / P1 / P2

**Esperado:** o que devia acontecer (referência: AC-XX do QA-PLAN)

**Observado:** o que aconteceu de fato

**Passos pra reproduzir:**
1. ...
2. ...

**Evidência:**
- Screenshot: `qa-screenshots/gam-bug-NNN.png`
- Recording: (se aplicável, link GCS)
- Console errors: (colar log)

**Ambiente:** browser, viewport, prefers-reduced-motion (sim/não)
```

### Definição de severidade

- **P0** — Bloqueante. Quebra cálculo de XP/streak, perda de dados, crash, regressão de feature core.
- **P1** — Sério mas não bloqueante. Efeito visual quebrado, medalha não dispara em caso raro, UX feio.
- **P2** — Cosmético / edge case. Melhor corrigir, mas pode virar follow-up.

---

## 7. Métricas de saúde pós-deploy (10min após push)

QA acompanha por 10 minutos após `did.ps1 deploy quiz` rodar com sucesso. Se algum
falhar, **rollback imediato** (Dev decide hotfix vs revert).

1. **HEALTH-01** `GET https://quiz.did.lu/api/health` retorna `200 { status: "ok" }`.
2. **HEALTH-02** `GET https://quiz.did.lu/api/me/stats` (com cookie válido) retorna `200` com schema esperado.
3. **HEALTH-03** Logs do container (`docker logs <container>` via SSH na VM) sem `5xx` nos últimos 10min.
4. **HEALTH-04** Abrir `https://quiz.did.lu` no browser, console sem erros não-tratados (apenas warnings tolerados). Verificar prefixo `[flashy:gamification]` aparece no console quando joga.
5. **HEALTH-05** No banco `quiz` (psql), tabela `sessions` (ou equivalente da gamificação) recebendo INSERT — query `SELECT COUNT(*) FROM sessions WHERE created_at > NOW() - INTERVAL '10 minutes'` retorna ≥1 após primeira sessão real.

Se 5/5 PASS após 10min → sprint marcada como **deploy estável**. Atualizar `PROGRESS.md`.

---

## 8. Sequência sugerida de execução do QA

1. **Pré-requisito:** Dev confirma que selectors + debug hooks estão implementados. QA roda smoke test no `__flashyDebug` antes de qualquer cenário.
2. **Rodada 1 — Critérios isolados (manual + assistido):** percorrer AC-01 a AC-44 em ambiente de staging local (vite dev) ou produção. Marcar PASS/FAIL.
3. **Rodada 2 — E2E Playwright:** rodar `gamification.spec.js` headed, conferir screenshots gerados.
4. **Rodada 3 — Regressão:** R-01 a R-08.
5. **Rodada 4 — Pós-deploy:** após Dev pushar e deploy concluir, rodar HEALTH-01 a HEALTH-05 em janela de 10 minutos.
6. **Relatório final:** consolidar PASS/FAIL por categoria, listar bugs no formato §6, recomendação de merge ou rollback.
