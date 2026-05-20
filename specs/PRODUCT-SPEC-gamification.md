# PRODUCT-SPEC — Gamificação (sprint atual)

Decisões de produto pra sprint que adiciona feedback imediato + progressão de
longo prazo ao Flashy. Esta spec define **o quê** e **por quê**. UX define **como
parece**, Dev define **como implementa**.

Última revisão: 2026-05-20
Autor: Agente de Produto

---

## 0. Por quê AGORA

O produto entrega flashcards e 5 modos de jogo. Falta o componente que transforma
"sessão de estudo" em "vontade de voltar amanhã": **resposta emocional ao acerto**
e **progressão visível no tempo**.

Hoje o user acerta um card e a tela só avança. Sem flash, sem som, sem número
subindo. Acerta 10 seguidos — nada acontece. Estuda 7 dias seguidos — invisível.
Isso é o que mata retenção em apps de aprendizado.

A sprint **não** é sobre adicionar pontos por adicionar. É sobre dar **dois
trilhos de recompensa**:

1. **Trilho curto (esta sessão):** cada acerto vira evento sensorial. Combos
   escalam. Sessão termina com resumo grande.
2. **Trilho longo (dias/semanas):** XP global, níveis, streak diário, medalhas
   acumulam. Existe um "eu" que progride entre sessões.

---

## 1. Barra de qualidade — referências e anti-referências

### 1.1 De onde puxar (referência positiva)

- **Duolingo:** confetti curto após acertar, número de XP subindo na topbar com
  pequena animação, streak flame, fim de lição com "+24 XP" grande. Recompensa
  proporcional, não infantil.
- **Quizlet:** transição entre cards rápida, flash verde discreto, micro-bounce
  no card certo. Refinamento de feel, não excesso.
- **Apple Fitness:** anel fechando, "haptic" curto, celebração contida quando
  bate meta. O som é sutil; o ganho de sentido é grande.
- **Mario Kart (boost de item):** ding curto, percepção de aceleração. Combo é
  um boost — o som tem que ter peso quando passa 5x, 10x.

### 1.2 O que NÃO virar (anti-referência crítica)

- **Candy Crush / hyper-casual:** cores berrantes, explosões enormes, narrador
  gritando "AWESOME!!", popups que param o jogo. Inaceitável.
- **App educacional infantil:** estrelinha gigante, mascote falando, "parabéns
  amiguinho". Flashy é produto adulto, mesmo que use vibe arcade.
- **Sons genéricos de mobile game:** synth barato de royalty-free pack. Tem que
  doer no ouvido — preferimos silêncio.
- **Pontuação que pune erro:** tirar XP, resetar nível, "vidas". Princípio 4
  de gamificação no CONCEPTS.md já barra isso.
- **Notificações de FOMO:** "você vai perder seu streak!" em tom ameaçador.
  Tolerado um lembrete diário gentil; chantagem emocional, não.

A vibe alvo, em uma frase: **arcade satisfatório de produto premium**. Som curto,
flash rápido, número sobe, segue jogo.

---

## 2. O que é gamificação válida pro Flashy (manter o trilho)

Critério único pra qualquer mecânica entrar: **reforça o ato de memorizar?**

### 2.1 Dentro do escopo
- Feedback visual/sonoro proporcional ao acerto (mais combo = mais peso).
- XP que mede esforço real de aprendizado (acertou em modo difícil = mais XP).
- Streak diário que premia consistência de uso (princípio espaçamento natural).
- Medalhas que reconhecem comportamento desejado (sessão sem erro, dominar
  deck, voltar após pausa, etc.).
- Nível por deck (mede domínio de um conteúdo específico).
- Nível global (mede esforço total da pessoa no produto).

### 2.2 Fora do escopo — **PROIBIDO** (taxativo)
- ❌ **Compras dentro do app.** Sem moeda virtual, sem premium, sem skin
  vendida.
- ❌ **Vidas / energy / cooldown.** Pessoa que quer estudar pode estudar. Sem
  contador de "tentativas restantes".
- ❌ **Microtransações.** Não existe loja, ponto final.
- ❌ **Leaderboard social / ranking entre users.** Vira competição tóxica,
  incentiva farm, exige anti-fraude que não temos. Sair do MVP definitivamente.
- ❌ **Trocar XP por benefícios (loot box, gacha, prêmio random).** Anti-padrão
  de design.
- ❌ **Streak quebrar = perder tudo.** Streak quebra = volta a 0, mas XP, nível
  e medalhas ficam intactos.
- ❌ **Notificação push agressiva.** Lembrete diário sim, com opt-in claro;
  "VOCÊ PERDEU SEU STREAK" não.
- ❌ **Comparação com amigos.** Não temos amigos no produto. Fica assim.

### 2.3 Out por enquanto, mas não taxativo (futuro possível)
- ⏸ Personalização de avatar / cosméticos desbloqueados por XP (sem custo, só
  reward visual). Aceitável depois.
- ⏸ Desafios semanais (medalhas com prazo). Aceitável depois.
- ⏸ Compartilhar conquista por link (sem feed, só link). Aceitável depois.

---

## 3. Mecânicas — fórmulas exatas

### 3.1 XP por acerto (base por modo)

| Modo | XP por acerto base | Razão |
|------|-------------------|-------|
| Flashcards (self-report "sei") | **5** | Self-report — barato falsificar. Não pode ser caminho fácil de farm. |
| Múltipla escolha | **10** | Reconhecimento. Baseline médio. |
| Match grid | **8** | Pareamento — fácil quando lista é pequena, escala com deck grande. |
| Speed (acerto na rodada de 60s) | **6** | Volume alto compensa XP baixo por unidade. |
| Escrever (resposta correta) | **20** | Produção ativa = aprendizado mais profundo. Dobro de MC. |

**Regra:** "acerto" em Flashcards = user clica "sei" depois de virar. Em MC =
clica opção certa de primeira. Em Match = par correto. Em Write = resposta
canônica (ou com tolerância de acento/case configurada). Em Speed = acerto
dentro do timer.

### 3.2 Bônus de dificuldade do card

XP do card é multiplicado por fator de dificuldade individual:

- Card **novo** (nunca acertou): **× 1.0**
- Card **errado nas últimas 3 sessões** ("aprendendo"): **× 1.5**
- Card **dominado** (3+ acertos seguidos): **× 0.5**

Razão: acertar coisa que você já sabe vale menos. Acertar coisa que você errava
vale mais. Empurra o user a focar no que importa.

### 3.3 Combo dentro da sessão

Combo conta **acertos consecutivos** dentro de uma sessão (qualquer modo). Erra
um → combo zera.

Multiplicador aplicado sobre XP do acerto:

| Combo | Multiplicador | Feedback |
|-------|--------------|----------|
| 1–4 | × 1.0 | normal |
| 5–9 | × 1.25 | flash verde + som "ding" leve |
| 10–19 | × 1.5 | flash verde + confetti curto + som "tada" |
| 20–29 | × 1.75 | flash dourado + confetti maior + texto "🔥 ON FIRE" |
| 30+ | × 2.0 (cap) | full screen flash + sustain musical |

Cap em 2.0 deliberado: não inflar XP. Sessão de 100 acertos seguidos rende
muito, mas não absurdo.

### 3.4 Bônus de sessão completa

- **100% de acerto numa sessão** (mínimo 10 cards): **+ 50 XP** flat.
- **100% num deck inteiro** (todos os cards do deck, sessão "estudar tudo"):
  **+ 100 XP** flat.

Razão: recompensar o "encerramento limpo". Cria meta clara: "vou tentar zerar
sem erro".

### 3.5 Streak diário

**Definição:** dias consecutivos com pelo menos **1 sessão de qualquer modo
com ≥10 acertos**.

- **Timezone:** do user (detectado pelo browser). Não usar UTC — confunde quem
  estuda à noite.
- **Corte do dia:** 04:00 da manhã no fuso do user (não 00:00 — quem estuda
  até 02h não perde streak por isso).
- **Grace period:** 1 dia perdido por semana **não quebra** o streak
  (concedido automaticamente, sem o user pedir). Implementação: streak conta
  se a janela de "último dia válido" estiver dentro das últimas 48h.
- **Quebra:** se passou de 48h sem sessão válida, streak vai a 0. Sem perda
  de XP / nível / medalhas. Pode recomeçar imediatamente.
- **Visualização:** chama de "ofensiva" ou "streak" (decidir em UX-SPEC).
  Número + ícone discreto (chama 🔥 só passando de 7). Não usar "DIAS
  CONSECUTIVOS!!!" em caps.

**Marcos de streak** (geram medalha):
- 3, 7, 14, 30, 60, 100, 365 dias.

### 3.6 Nível global do user

XP global = soma de todo XP ganho em todas as sessões, todos os decks.

Curva de níveis (XP **acumulado** pra atingir cada nível):

| Nível | XP acumulado | Faixa simbólica |
|-------|-------------|-----------------|
| 1 | 0 | Iniciante |
| 2 | 100 | Iniciante |
| 3 | 250 | Iniciante |
| 4 | 500 | Aprendiz |
| 5 | 1 000 | Aprendiz |
| 6 | 2 000 | Aprendiz |
| 7 | 4 000 | Estudante |
| 8 | 7 000 | Estudante |
| 9 | 11 000 | Estudante |
| 10 | 16 000 | Veterano |
| 15 | 50 000 | Veterano |
| 20 | 120 000 | Mestre |
| 25 | 250 000 | Mestre |
| 30 | 500 000 | Lenda |
| 40 | 1 200 000 | Lenda |
| 50 | 3 000 000 | Lenda (cap visível) |

Curva é **exponencial leve** (~1.7× a cada salto inicial, suaviza pra ~1.5×
depois do 15). Razão: subir os primeiros níveis tem que ser rápido (recompensa
imediata pra novo user). Depois desacelera (cada nível conquistado pesa).

Não há nível máximo "hard cap" — após 50 continua subindo, sem destaque
adicional. Mantém porta aberta pra power-user.

### 3.7 Nível por deck

XP por deck = XP ganho **especificamente nesse deck**.

Curva **mais rápida** que a global (deck individual é unidade menor):

| Nível do deck | XP acumulado | Faixa |
|--------------|-------------|-------|
| 1 | 0 | Novo |
| 2 | 50 | Aprendendo |
| 3 | 150 | Aprendendo |
| 4 | 400 | Conhecendo |
| 5 | 800 | Conhecendo |
| 6 | 1 500 | Dominando |
| 7 | 2 500 | Dominando |
| 8 | 4 000 | Mestre do deck |
| 9 | 6 500 | Mestre do deck |
| 10 | 10 000 | Lenda do deck |

Cap em 10 por deck (visível). Razão: deck pequeno (50 cards) deve ser
"zerável". Atingir lenda do deck é meta concreta.

**Exibição:** na tela do deck, badge discreta "Lv 4 · Conhecendo" ao lado do
nome. Barra de progresso fina mostrando próximo nível.

### 3.8 Medalhas — lista completa do MVP

Todas com critério **objetivo** (sem julgamento subjetivo). 18 medalhas no
release inicial:

| # | Medalha | Critério | Categoria |
|---|---------|----------|-----------|
| 1 | **Primeira vez** | Concluir primeira sessão (≥10 cards) | Onboarding |
| 2 | **Caçula do deck** | Criar primeiro deck | Onboarding |
| 3 | **Importador** | Criar deck com ≥50 cards de uma vez | Criação |
| 4 | **Bibliotecário** | Ter 5 decks ativos | Criação |
| 5 | **Curador** | Ter 10 decks ativos | Criação |
| 6 | **Sem deslizes** | Sessão 100% acerto (≥20 cards) | Performance |
| 7 | **Imbatível** | Sessão 100% acerto (≥50 cards) | Performance |
| 8 | **Combo 10** | Atingir combo 10 em qualquer modo | Combo |
| 9 | **Combo 25** | Atingir combo 25 em qualquer modo | Combo |
| 10 | **Combo 50** | Atingir combo 50 em qualquer modo | Combo |
| 11 | **Velocista** | Bater 30 acertos em uma rodada de Speed | Modo-específico |
| 12 | **Datilógrafo** | Acertar 100 cards em modo Escrever (lifetime) | Modo-específico |
| 13 | **Olho clínico** | Atingir nível 5 de qualquer deck | Domínio |
| 14 | **Mestre do deck** | Atingir nível 8 de qualquer deck | Domínio |
| 15 | **Lenda do deck** | Atingir nível 10 de qualquer deck | Domínio |
| 16 | **Streak 7** | Manter ofensiva por 7 dias | Streak |
| 17 | **Streak 30** | Manter ofensiva por 30 dias | Streak |
| 18 | **Streak 100** | Manter ofensiva por 100 dias | Streak |

Cada medalha tem: ícone (SVG inline, paleta consistente), nome, descrição
curta, data de desbloqueio. Categoria definida pra agrupar na tela /eu.

**Medalhas escondidas (easter eggs):** não definir agora. Backlog futuro.

**Medalhas não-retroativas?** Sim, retroativas. Se na release o user já tem
5 decks, ganha "Bibliotecário" no primeiro load pós-deploy. Razão: punir users
existentes por chegar antes é hostil.

---

## 4. Eventos visuais/sonoros — catálogo

Categorias e o que cada uma dispara. **UX-SPEC define o desenho exato; aqui só
ancora intenção e duração.**

### 4.1 Acerto simples (combo 1–4)
- **Visual:** flash verde curto no card/opção (200–300ms). Número de XP da
  jogada flutuando subindo (+10) e sumindo. Sem confetti.
- **Som:** "pop" curto, ~50ms, low-key. Tom musical agradável (não beep).
- **Háptico (mobile):** vibração curta 20ms.

### 4.2 Combo 5+ (multiplicador entra)
- **Visual:** flash verde + número do combo aparece pequeno ("× 5") perto do
  card. Pulse no contador de XP da topbar.
- **Som:** "ding" mais cheio, ~100ms. Tom mais alto que o pop.

### 4.3 Combo 10+
- **Visual:** flash + confetti curto (10–15 partículas, 600ms). Texto "🔥
  Combo 10" curto no overlay (não bloqueia jogo). Multiplicador 1.5×
  destacado.
- **Som:** "tada" musical, ~300ms. Não pode atrapalhar leitura do próximo card.

### 4.4 Combo 20+ / 30+
- **Visual:** confetti dourado, flash mais largo (não fullscreen — borda do
  card). Texto "ON FIRE". Sustain visual sutil enquanto combo segue.
- **Som:** sustain musical baixo (bg loop curto, 1–2s). Some sozinho se quebra.

### 4.5 Erro
- **Visual:** flash vermelho **leve** no card/opção (150ms, opacidade baixa —
  não agressivo). Combo cai a 0 com pequena animação descendente.
- **Som:** "thunk" curto, neutro. **Não** punitivo. Quase ausente.
- **Háptico:** vibração curtinha (15ms).

### 4.6 Sessão completa 100% (mínimo 10 cards)
- **Visual:** overlay grande com:
  - "Sessão limpa!" / "100% de acerto"
  - XP ganho total (animado de 0 até o valor final, ~1.2s)
  - Cards vistos, melhor combo, tempo
  - Confetti maior (2s)
- **Som:** jingle de vitória de 1.5s, satisfatório, não infantil.

### 4.7 Sessão completa normal (não 100%)
- **Visual:** overlay igual, sem confetti grande, com breakdown:
  - XP ganho
  - "X cards acertados de Y"
  - Cards a revisar (lista dos que erraram, max 5)
- **Som:** ding suave de encerramento, 400ms.

### 4.8 Medalha desbloqueada
- **Visual:** card de medalha desce do topo (não centro — não bloqueia ação),
  fica 3s, sai. Ícone, nome, descrição. Sem confetti dedicado (evita poluição
  se desbloqueia junto com combo grande).
- **Som:** chime distinto, **diferente** de todos os outros (tom de
  "conquista"), 500ms.
- **Empilhamento:** se 2+ medalhas desbloqueiam na mesma sessão, fila na ordem
  de desbloqueio, 1 por vez (não sobrepor).

### 4.9 Level up (global ou do deck)
- **Visual:** badge antiga vira badge nova com transição (flip / morph). Texto
  "Nível X" 1s no canto. Cor da faixa simbólica (Aprendiz → Veterano → ...)
  muda se atravessou faixa.
- **Som:** sweep ascendente curto, 600ms.
- Acontece **no fim da sessão**, não no meio (não interromper jogo).

### 4.10 Streak preservado / quebrado
- **Streak preservado (novo dia):** primeira sessão válida do dia mostra small
  toast "🔥 Dia X da ofensiva" no início da sessão. Não no fim.
- **Marco de streak (3/7/14/30/...):** medalha desbloqueia + animação especial
  do número (incremento dramático).
- **Streak quebrado:** sem alerta. Próxima sessão volta a contar do dia 1. Se
  o user perguntar (clica no badge), explica em tooltip que streak quebrou
  por inatividade.

### 4.11 Controles de som

- Toggle global "Som on/off" em Configurações + atalho rápido na topbar
  durante jogo (ícone speaker).
- Default: **ON em desktop, OFF em mobile** (mobile costuma ter contexto onde
  som incomoda — metrô, biblioteca).
- Preferência persiste por device (localStorage local).

---

## 5. Telas afetadas

### 5.1 Topbar (todas as telas exceto modo de jogo full-screen)
Adicionar à direita do brand:
- **XP atual + nível global** (formato: "Lv 7 · 4.2k XP"). Click → vai pra /eu.
- **Streak** (formato: "🔥 12"). Click → vai pra /eu seção streak.
- Versão mobile: só ícones + número (sem "Lv" / "XP" textuais).

Mantém o "Anônimo · este navegador" pequeno do lado, ou some pra dar lugar à
gamificação. **Decisão UX:** preferência por mover identidade pro menu de
config e deixar topbar focada em progressão.

### 5.2 Home (`#/`)
- Card de deck mostra **nível do deck** como badge pequeno (ex: "Lv 3" no
  canto).
- Ordenação possível adicional: "Mais estudados" (XP no deck desc).

### 5.3 Detalhe do deck (`#/deck/:id`)
- Sob o nome do deck, linha de progressão: "Lv 4 · Conhecendo · 600 / 800 XP".
- Barra de progresso fina pro próximo nível do deck.
- Botão de cada modo de jogo mostra "Último: 84% · +120 XP" se já jogou
  recentemente nesse modo (pequeno, abaixo do nome do modo).

### 5.4 Modos de jogo (5 modos)
Cada um recebe:
- **Contador de XP da sessão** no canto superior (acumulando em tempo real).
- **Contador de combo** quando combo ≥ 5 (sai de tela quando volta a < 5).
- Animação visual no acerto (§4.1–4.4).
- Som on/off rápido no canto.
- **Speed mode** especificamente: combo é mais central (já é modo de
  adrenalina). Multiplicador aplica também ao recorde de pontos do modo.

### 5.5 Fim de sessão (novo overlay)
Componente reutilizado pelos 5 modos. Mostra:
- Linha principal: XP ganho na sessão (animado).
- Stats: cards corretos / total, melhor combo, tempo decorrido.
- Acertou cards específicos? lista de até 5 "pra revisar".
- Level ups (do deck, global) — se houve.
- Medalhas desbloqueadas — se houve.
- Streak atualizado — se sessão validou o dia.
- Ações: **[Jogar de novo] [Mudar modo] [Voltar pro deck]**

Pode ser fechado a qualquer momento (não bloqueia navegação).

### 5.6 Nova tela `/eu` (perfil/stats)
Rota: `#/eu`. Acessível pela topbar (click no XP ou streak) e via menu.

Seções:
1. **Header:** badge do nível global, faixa simbólica, barra pro próximo
   nível, XP total acumulado, streak atual com fogo.
2. **Histórico:** gráfico simples (sparkline ou heatmap tipo GitHub) dos
   últimos 30 dias — XP ganho por dia.
3. **Medalhas:** grid de medalhas. Desbloqueadas em cores vivas + data;
   bloqueadas em cinza com descrição do critério (sem spoiler de "easter
   eggs" — todas do MVP são reveladas).
4. **Decks dominados:** lista dos decks ordenados por XP/nível, com nível e
   barra de progresso.
5. **Configurações de gamificação:** toggles pra som on/off, lembrete diário
   on/off (sem implementar push agora — só flag, ver §7.1).

A tela é o "santuário" da progressão. Sem CTAs comerciais, sem upsell. Só
celebração do que o user fez.

### 5.7 Banner / nudges
- Após streak de 3 dias, pequena celebração inline no topo da home no 4º dia.
- Quando atinge 90% pro próximo nível global, pequena nota: "Faltam 200 XP
  pro próximo nível". Discreto, não anima nem chama.

---

## 6. Métricas de sucesso

KPIs pra observar nas 4 semanas pós-deploy. Sinais, não metas rígidas.

| KPI | Sinal positivo | Sinal de alerta |
|-----|----------------|-----------------|
| **Retenção D1** (% que voltam dia seguinte ao primeiro acesso) | ≥ 35% | < 20% |
| **Retenção D7** | ≥ 18% | < 8% |
| **Sessões / dia / user ativo** | ≥ 2 | < 1.2 |
| **Cards / sessão** (média) | ≥ 25 | < 12 |
| **% users com streak ≥ 3 dias** | ≥ 25% dos ativos da semana | < 10% |
| **% users com 1+ medalha** | ≥ 70% dos ativos da semana | < 40% |
| **% users que chegam ao nível 5 global** | ≥ 30% (1ª semana) | < 10% |
| **% sessões que terminam em 100% acerto** | 15–35% (sweet spot) | < 5% (difícil demais) ou > 50% (fácil demais — combo / curva tá inflacionando) |
| **Combo médio máximo por sessão** | 6–12 | < 4 (XP mal sentido) ou > 30 (combos virou farm trivial) |
| **% sessões com som ON** | ≥ 50% desktop | n/a |
| **Visitas à tela /eu por user ativo / semana** | ≥ 1.5 | < 0.5 (tela morta) |

Métricas operacionalizadas no backend (eventos de XP, fim de sessão, medalha,
nível) via logging estruturado. Sem analytics third-party — usar logs próprios
+ queries no Postgres.

**Validação qualitativa:** após 2 semanas, perguntar a 3–5 users diretamente:
- "O que você achou dos efeitos quando acerta?"
- "Você notou que existe XP / nível / streak?"
- "Algum incômodo? Demais? De menos?"

---

## 7. Não-objetivos explícitos (NÃO faz nesta sprint)

Listar pra evitar scope creep:

1. **Notificação push** (browser ou mobile). Toggle existe na UI, mas não
   conecta a nada. Implementação fica pra sprint posterior.
2. **Lembrete por e-mail.** Idem.
3. **Social / amigos / follow.** Categórico fora.
4. **Ranking global ou semanal.** Categórico fora.
5. **Avatar / skins desbloqueáveis.** Backlog, não agora.
6. **Marketplace de medalhas / decks.** Categórico fora.
7. **Compras dentro do app.** Categórico fora.
8. **Easter egg medalhas escondidas.** Backlog futuro.
9. **Desafios semanais com prazo.** Backlog futuro.
10. **Conquistas por importação de outros apps (Anki, Quizlet).** Backlog.
11. **Replay de sessão / histórico card-a-card.** Backlog.
12. **Mudar fórmulas via admin UI.** Hardcoded por enquanto. Quando a curva
    estabilizar, talvez vire config.
13. **Anti-fraude formal** (server-side de XP). Esta sprint confia no client
    pra XP/sessão, igual confiamos pra deck/card. Quando login + ranking
    entrarem, viraliza necessidade de mover XP pro server.

---

## 8. Riscos e mitigação

### 8.1 Risco: cansaço de efeitos (over-stimulation)
Confetti em todo lugar vira ruído. Som em loop irrita.

**Mitigação:**
- Confetti só em combo ≥ 10, sessão 100%, medalha. Acerto normal = só flash +
  pop curto.
- Duração curta (≤ 500ms pra micro-feedback, ≤ 1.5s pra macro).
- Som ON default em desktop, OFF em mobile.
- Toggle fácil pra desligar tudo (Configurações).
- Após 2 semanas, revisar telemetria de "som on/off" — se muita gente desliga,
  reduzir intensidade.

### 8.2 Risco: gamificação vira o objetivo (em vez de aprender)
User farma combo num deck que já sabe pra subir XP, e isso vira o jogo —
abandonando a função de memorização.

**Mitigação:**
- Multiplicador de **dificuldade do card** (§3.2) penaliza cards "dominados"
  com × 0.5. Farm em deck já sabido rende menos.
- Cap de combo em 2.0 evita combos longos serem desproporcionalmente
  rentáveis.
- Bônus de 100% só vale se sessão tem ≥ 10 cards (não farma sessões de 2 cards
  fáceis).
- Acompanhar KPI "% sessões 100%" — se > 50%, ajustar curva.

### 8.3 Risco: anônimo perde tudo ao trocar de device / limpar cookies
Pessoa investe 30 dias de streak, troca de celular, perde tudo.

**Mitigação:**
- **Reaproveitar mensagem da sprint ownership:** banner discreto "seus dados
  só existem neste navegador" reaparece com peso novo agora que tem streak /
  XP / medalhas em jogo.
- Após streak de 7 dias OU nível global 5, banner muda pra: "Você tem [streak]
  dias de ofensiva e [nível] níveis. Crie conta pra não perder." Mais forte
  porque agora tem o que perder.
- Quando login Logto entrar, **claim** preserva tudo (já especificado em
  PRODUCT-SPEC-ownership §5).

### 8.4 Risco: curva de XP errada (níveis voam ou pacaty)
Nível 1 → 2 em 1 sessão é gratificante; nível 1 → 2 em 5 sessões é frustrante.
Nível 30 trivial 2 semanas pós-launch arruína meta-game.

**Mitigação:**
- Curva escolhida (§3.6) testada contra cenário: user "casual" (50 cards/dia
  em MC) chega ao nível 5 em ~5 dias; user "intenso" (200 cards/dia + Write)
  chega ao 10 em ~3 semanas.
- Fórmulas hardcoded mas isoladas em um arquivo só (Dev: `gamification.js` em
  `src/core/`). Tweakar rapidamente se telemetria mostrar desvio.
- Não comunicar a curva pro user (não publicar "nível 5 = 1000 XP"). Mantém
  liberdade de ajustar sem quebrar promessa.

### 8.5 Risco: medalhas desbloqueiam em massa no primeiro dia (retroatividade)
User existente abre o app pós-deploy, ganha 8 medalhas de uma vez, fica
saturado.

**Mitigação:**
- Empilhamento: fila de 1 por vez no overlay, com botão "ver todas" se acumular
  > 3 na sessão.
- Notificação consolidada em vez de pop individual quando vem em massa: "Você
  desbloqueou 8 medalhas. Ver tudo →".
- Estado inicial pós-deploy mostra na tela /eu uma faixa "Bem-vindo à
  gamificação" só na primeira visita.

### 8.6 Risco: backend não persiste estado, anônimo perde XP entre sessões
Esquema atual no Postgres não tem coluna pra XP/streak/medalha.

**Mitigação:**
- Dev cria migration nova (não modifica `001_init.sql`). Adiciona:
  - `user_stats` (user_id, xp_total, level, streak_current, streak_best,
    streak_last_day, settings JSONB).
  - `deck_stats` (user_id, deck_id, xp, level).
  - `user_medals` (user_id, medal_code, unlocked_at).
  - `sessions` (user_id, deck_id, mode, started_at, ended_at, cards_total,
    cards_correct, best_combo, xp_earned) — pra dashboard e métricas.
- Todas as mutações de XP passam pelo backend (não confiar 100% no client mesmo
  sem anti-fraude formal — pelo menos garantir persistência).

### 8.7 Risco: medalhas em outros idiomas (Flashy é PT-BR mas decks em qualquer idioma)
Não cria risco real — medalha é sobre comportamento (acertar, fazer streak),
não sobre conteúdo do deck. Texto da medalha sempre em PT-BR.

---

## 9. Resumo das decisões (TL;DR)

| Item | Decisão |
|------|---------|
| Vibe | Arcade satisfatório premium — Duolingo/Quizlet, nunca Candy Crush |
| Trilhos | Curto (sessão: combo + XP imediato) + longo (XP/nível/streak/medalha) |
| XP base por modo | FC self-report 5, MC 10, Match 8, Speed 6, Write 20 |
| Modificador de dificuldade do card | Novo × 1.0, aprendendo × 1.5, dominado × 0.5 |
| Combo | × 1.0 → × 2.0 cap em 30+ acertos |
| Bônus 100% sessão | +50 XP (≥10 cards), +100 XP (deck inteiro) |
| Streak diário | Tz local, corte 04:00, grace 1 dia/semana, sem perda de XP ao quebrar |
| Nível global | Curva exponencial leve, marcos 1/4/7/10/15/20/25/30/50 |
| Nível por deck | Curva mais rápida, cap visível em 10 |
| Medalhas | 18 no MVP, todas retroativas |
| Som | ON desktop / OFF mobile default, toggle global |
| Visual | Flash 200ms, confetti só ≥ combo 10 / 100% / medalha, ≤ 1.5s |
| Topbar | XP + nível + streak (mobile: ícones) |
| Tela /eu | Header + heatmap 30d + medalhas + decks dominados + settings |
| Persistência | Backend (Postgres) — nova migration. Anônimo via cookie. |
| Anti-fraude | Aceitar confiança no client por ora (sem ranking). |
| PROIBIDO | Compras, vidas, ranking, leaderboard, push agressivo, XP punitivo |

---

## 10. Perguntas pro user antes da Dev começar

Decisões que tomei mas valem confirmar:

1. **XP do Write 2× MC.** Write é o modo mais "honesto" (não dá pra chutar).
   2× é meu valor. User concorda ou prefere 1.5× / 3×?
2. **Grace period de 1 dia/semana no streak.** Generoso (Duolingo cobra
   "freeze" por moeda; aqui é grátis). Manter ou ser mais rígido (sem grace)?
3. **Cap de nível global em 50 visível.** Após 50 continua subindo silencioso.
   Ou expor 50+ como "prestígio"?
4. **18 medalhas no MVP.** Sinto que cobre as categorias mas é discutível.
   Adicionar mais (chegar a 25)? Tirar alguma específica?
5. **Som default ON em desktop / OFF em mobile.** Pode irritar quem abre no
   trabalho. Default OFF em tudo, com toggle no onboarding?
6. **Tela `/eu` ou outro nome.** "Eu" é direto e pessoal. Alternativas: "perfil",
   "estatísticas", "progresso". Decisão estética/UX — user prefere?
7. **Retroatividade total das medalhas pós-deploy.** Acordado, mas reconfirmar
   que prefere isso a "começar do zero" (que evita overflow de notificação no
   dia do deploy).
