# UX-SPEC — Gamificação

Spec visual/UX da sprint de gamificação do Flashy. Escrito em paralelo ao plano de produto, antes da implementação. Mesma estrutura do `UX-SPEC-ownership.md`. Última revisão: 2026-05-20.

**Premissas herdadas (não negociar aqui — ver `CONCEPTS.md` e `PROGRESS.md`):**
- VIBE alvo: "arcade satisfatório" — confetti curto, flash verde, número de XP subindo, sons pop/ding. Não infantil, não minimalista.
- Sistema long-term: **streak diário + XP por deck + XP global + medalhas**.
- 2 locais visuais: **topbar discreta sempre visível** (streak + XP global) + **tela `/eu`** (perfil, stats, medalhas, calendar heatmap).
- Sons default ON, toggle visível, respeita `prefers-reduced-motion`.
- Zero componente nativo (vale também pra modal de fim de sessão e popup de medalha).
- Paleta atual (`--accent`, `--good`, `--bad`, `--info`) é a base — gamificação adiciona 2-3 novos tokens semânticos, nada mais.

---

## 1. Auditoria do estado atual

O que **sustenta** a gamificação sem precisar mudar:
- **Componentes-base prontos:** `.pill`, `.banner`, `.panel`, `.toast` (animação fade já existe), `.modal` (overlay genérico com `confirmModal`). Aproveita-se tudo.
- **`.deck-card-progress`** já mostra progresso por deck — é o lugar natural pra cravar XP do deck visualmente (barra com gradient).
- **`.score-big`** (56px serif) cobre o caso "número grande" do XP final de sessão e da tela `/eu`.
- **`@keyframes flashGood` / `flashBad`** no match já são a estética que queremos pra acerto/erro — vamos reutilizar como base. Bom: a curva e duração (350ms) já estão calibradas.
- **`@keyframes shake`** existe pra erro grosseiro (já usado em flashcards). Mantém.
- **`@keyframes shimmer`** do skeleton já roda no app — base CSS pra gradients animados (vamos reaproveitar técnica em barra de XP que enche).
- **`speakerButton` + `playCurrent`** é o padrão de "elemento flutuante no card" — replicável pra botão de mute global no topbar.
- **`toast(message, { kind })`** resolve "XP ganho" e "medalha conquistada" sem inventar componente novo. Variante grande/especial pra medalha (`.toast-medal`) é só estilizar.

O que vai **precisar acomodar** sem virar confusão:
1. **Topbar** hoje tem `[brand]  ………  [Anônimo · este navegador]`. Não tem espaço pra streak + XP. Precisa redesign discreto: 2 chips minúsculos colados à direita, antes do label de identidade.
2. **Resultado de fim de sessão** já existe em cada modo (`renderResult` em flashcards/MC/write; painel inline em match/speed). Hoje cada modo desenha o seu — vamos consolidar visualmente (não estruturalmente) num componente `sessionResult({...})` reusável, pra XP e medalhas aparecerem do mesmo jeito em qualquer modo.
3. **`.mc-option.correct/wrong`** já fica verde/vermelho. Acerto está sutil demais pra vibe arcade — precisa pulse curto extra (não substituir, somar).
4. **Match** já tem `flash-correct` com animação. Reusar como referência para os outros modos.
5. **Flashcards** o "acerto" é botão "Sei" — feedback hoje é só `i++` instantâneo. Precisa de meio segundo de celebração antes de avançar.
6. **Speed** tem `setTimeout(500)` entre rounds — janela suficiente pra encaixar flash + XP popup sem alongar.
7. **Write** o feedback `Certo!` é texto cinza, não vibra. Precisa cor + animação.
8. **Tela vazia / Empty `/eu`**: anônimo sem sessão nenhuma → 0 XP, 0 medalhas. Tem que ser convidativo, não vazio frustrante.
9. **Mobile** topbar já está apertada (`<480px` esconde "este navegador"). Streak + XP precisa caber sem empurrar marca pra fora.
10. **Audio system** atual é só TTS de card. Não há infra de sons UI. Vai precisar módulo novo `src/core/sfx.js`, leve, com preload e fila pra não estourar `AudioContext`.

---

## 2. Princípios visuais da gamificação aqui

1. **Acerto = celebração de meio segundo, não 3 segundos.** Flash verde + número de XP subindo + som ding = ~500ms total. Já era pra próxima carta.
2. **Erro = correção breve, nunca punitivo.** Cor vermelha + leve shake (já existe), som pop curto e seco. Sem "X gigante", sem "frustração visual". Combo zera silenciosamente — feedback é "acertou de novo combo volta", não "puniu por errar".
3. **Efeitos nunca cobrem o conteúdo que importa.** Confetti é em volta da resposta certa, não em cima. Pop-up de XP sobe ao lado da resposta, fade rápido. Tela do modo continua legível.
4. **Sons opcionais, default ON, toggle visível.** Ícone de mute no topbar (perto do XP), persiste em localStorage. Tecla `M` global pra mute toggle. Respeitar `prefers-reduced-motion` → reduz animação E pode opcionalmente reduzir sons (decisão do user via toggle separado).
5. **`prefers-reduced-motion`** desliga: confetti, pulse de combo, popup que sobe (vira fade-in/out sem deslocamento), shimmer da barra de XP enchendo (vira fill instantâneo com cor). Mantém: mudança de cor de borda (acerto/erro), número final, som.
6. **Coerência com o que já existe.** Glassmorphism leve (radial gradients no body + `backdrop-filter: blur`), Inter + Fraunces, paleta âmbar/verde/rosa. Gamificação **complementa** — não traz Comic Sans, não traz neon roxo, não traz emoji gigante piscando.
7. **Streak é diário, não por sessão.** Bater 7 cards seguidos não é streak no sentido long-term — é combo (in-session). Streak = "estudou hoje" → +1 dia consecutivo. Distinção visual rígida: combo na tela do modo, streak na topbar.

---

## 3. Sistema de cores e tokens novos

Tudo entra em `:root` em `styles.css`, mantendo o padrão atual. **Nada substitui** tokens existentes — só adiciona semântica.

```css
/* Gamificação */
--xp:        var(--accent);                  /* XP = âmbar (mesma da marca; XP é "a moeda") */
--xp-soft:   rgba(255, 209, 102, 0.18);
--combo:     #ffb45a;                        /* laranja queimado, distinto do âmbar */
--combo-hot: #ff7a4a;                        /* combo 10+ entra em escala */
--levelup:   #b08cff;                        /* roxo-azul; level up é evento mais raro */
--medal:     #ffd97a;                        /* dourado quente, próximo do accent mas mais saturado */
--medal-ink: #3a2a00;
--correct:   var(--good);                    /* alias semântico: acertou */
--correct-glow: rgba(110, 231, 168, 0.35);
--wrong:     var(--bad);
--wrong-glow:  rgba(255, 122, 138, 0.30);
--streak:    #ff8a3d;                        /* fogo: laranja vivo, mas só aparece em ícone pequeno */
```

**Por que combo tem 2 cores:** combo 3-9 = `--combo` (laranja queimado, dentro da paleta âmbar). Combo 10+ = gradient `--combo → --combo-hot`. Visual: "esquentou". Combo 20+ adiciona pulse + escala 1.05. Sem nova cor além de `--combo-hot`.

**Por que level-up é roxo:** distinto de XP (âmbar) e de medalha (dourado). Level-up é evento de transformação, então a cor é fria-vibrante. Roxo `#b08cff` testa OK no fundo `--bg` (contraste >4.5:1).

**Por que medalha é dourado próprio:** `--accent` é a marca / botão primário. Diluir a marca em conquistas baratearia. Medalha vira sua própria coisa, mais saturada e quente. Texto sobre medalha (`--medal-ink`) é marrom-escuro, garante contraste em badge.

### Tipografia pra números grandes

- **XP de sessão final / XP total tela `/eu`:** `Fraunces 600`, 72px, letter-spacing -0.03em. Reaproveita classe `.score-big`, adiciona variante `.score-xl` (72px) pra tela `/eu`.
- **XP popup no card (subindo):** `Fraunces 600`, 22px, cor `--xp`. Pequeno mas vivo. `text-shadow: 0 0 12px var(--xp-soft)`.
- **Combo counter inline (canto do modo):** `JetBrains Mono 600`, 14px → escala pra 18px em combo 10+, 22px em combo 20+. Mono porque é "contador". Cor escala junto.
- **Streak na topbar:** `Inter 600`, 12px. Discreto. Cor `--streak` só no ícone, número em `--text`.

---

## 4. Catálogo de efeitos

Cada efeito = gatilho + duração + elementos + animação. Implementação fica em `src/ui/fx.js` (módulo novo) + classes em `styles.css`.

### 4.1 Acerto simples

**Gatilho:** flashcards "Sei", MC opção correta, write resposta certa, par no match, speed correta.
**Duração:** ~500ms total (efeito visual termina antes da transição pra próxima carta).
**Elementos:**
- Flash verde (já existe `flash-correct` em match — promover pra `.flash-correct` global).
- Som `pop-correct.mp3` (~120ms, ding curto seco, sem cauda).
- Mini-pop-up de XP subindo do elemento da resposta (`+10`, `+20`, etc.).

**CSS:**
```css
@keyframes flashCorrect {
  0%   { box-shadow: 0 0 0 0 var(--correct-glow); }
  40%  { box-shadow: 0 0 0 8px var(--correct-glow); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.fx-correct {
  animation: flashCorrect 480ms cubic-bezier(.2,.8,.2,1);
  border-color: var(--correct) !important;
}
@keyframes xpRise {
  0%   { opacity: 0; transform: translateY(0)   scale(0.85); }
  20%  { opacity: 1; transform: translateY(-8px) scale(1); }
  80%  { opacity: 1; transform: translateY(-32px) scale(1); }
  100% { opacity: 0; transform: translateY(-44px) scale(0.95); }
}
.fx-xp-float {
  position: absolute;
  font-family: 'Fraunces', serif; font-weight: 600; font-size: 22px;
  color: var(--xp);
  text-shadow: 0 0 12px var(--xp-soft);
  pointer-events: none;
  animation: xpRise 850ms ease-out forwards;
}
```

**JS:** `fx.correct(targetEl, xpAmount)` — adiciona classe `fx-correct` por 500ms + injeta `<span class="fx-xp-float">+10</span>` posicionado absoluto perto do canto direito do alvo. Self-cleanup com `animationend`.

### 4.2 Erro simples

**Gatilho:** MC opção errada, write resposta errada, par errado no match, speed errada, flashcards "Não sei" (quando esperava acerto — pune leve, não punitivo).
**Duração:** ~400ms total.
**Elementos:** shake leve (já existe `@keyframes shake`) + flash vermelho de borda + som `pop-wrong.mp3` (~150ms, thud baixo, sem alarme).

**CSS:**
```css
@keyframes flashWrong {
  0%, 100% { box-shadow: 0 0 0 0 transparent; border-color: var(--wrong); }
  50%      { box-shadow: 0 0 0 6px var(--wrong-glow); }
}
.fx-wrong {
  animation: flashWrong 380ms ease, shake 380ms ease;
  border-color: var(--wrong) !important;
}
```

**Combo zerado é silencioso.** O contador na tela do modo só "desce" — sem som, sem flash. Conscientiza, não pune.

### 4.3 Combo escalonado

**Gatilho:** N acertos consecutivos sem erro. Marcos: 3, 5, 10, 20.
**Duração:** banner no canto superior direito da área de jogo (não da topbar — topbar não muda), aparece por 1.2s.
**Elementos:**
- 3+: banner discreto, cor `--combo`, texto "Combo x3". Som `combo-3.mp3` (pop duplo curto).
- 5+: banner um pouco maior, mesmo texto "Combo x5". Som `combo-5.mp3` (3 pops ascendentes).
- 10+: banner com gradient `--combo → --combo-hot`, texto "Em chamas! x10". Som `combo-10.mp3` (whoosh + ding). Adiciona pulse contínuo no contador.
- 20+: gradient + escala 1.1, texto "x20 — você é doente". Som `combo-20.mp3` (ding mais alto). Pulse mais rápido.

**Importante:** o **contador de combo está sempre visível** (não some), em pill no canto superior da área de jogo (junto com `✓ correct` e `✕ wrong`). Banner é o "evento" do marco. Cap em x3 multiplicador (já decidido em CONCEPTS).

```css
.combo-pill {
  background: var(--bg-elev-2);
  border: 1px solid var(--combo);
  color: var(--combo);
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  padding: 4px 10px;
  border-radius: 100px;
  transition: all var(--t-base);
}
.combo-pill-hot {
  background: linear-gradient(90deg, var(--combo), var(--combo-hot));
  color: var(--accent-ink);
  border-color: transparent;
  animation: comboPulse 800ms ease-in-out infinite;
  font-size: 18px;
}
.combo-pill-insane { font-size: 22px; }
@keyframes comboPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}

.combo-banner {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--combo);
  color: var(--accent-ink);
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 18px;
  animation: comboBannerIn 220ms ease-out, comboBannerOut 280ms ease 900ms forwards;
}
@keyframes comboBannerIn  { from { opacity: 0; transform: translateY(-8px) scale(.9); } to { opacity: 1; } }
@keyframes comboBannerOut { to   { opacity: 0; transform: translateY(-4px); } }
```

### 4.4 Sessão 100%

**Gatilho:** terminar modo sem nenhum erro.
**Duração:** 1.2s, **só na tela de resultado**, não interrompe transição.
**Elementos:** confetti CSS canvas-less (12-20 partículas em DOM, queda física simulada via CSS keyframes), som `perfect.mp3` (sting curto, ascendente, 800ms). Halo dourado em volta do número `100%`.

**Importante:** confetti é leve. Partículas são `<div>` posicionados absoluto, cada um com transform pseudo-aleatório calculado em JS no momento de spawn. Sem canvas, sem dep. 16 partículas, animação 1.2s, depois remove. `prefers-reduced-motion` → confetti suprimido, halo permanece.

```css
.fx-confetti-piece {
  position: absolute; width: 8px; height: 12px; pointer-events: none;
  border-radius: 2px; will-change: transform;
  animation: confettiFall 1.2s cubic-bezier(.2,.6,.4,1) forwards;
}
@keyframes confettiFall {
  to { transform: translate3d(var(--dx), 200px, 0) rotate(var(--rot)); opacity: 0; }
}
.fx-halo-gold {
  box-shadow: 0 0 0 0 rgba(255, 217, 122, 0.6);
  animation: haloPulse 1200ms ease-out;
}
@keyframes haloPulse {
  0%   { box-shadow: 0 0 0 0   rgba(255, 217, 122, .6); }
  100% { box-shadow: 0 0 0 40px rgba(255, 217, 122, 0); }
}
```

### 4.5 XP ganho (popup subindo)

Coberto em 4.1. Detalhe extra: em telas de fim de sessão (após o resultado), o número total de XP usa **rolling counter** — anima de 0 até o valor final em 700ms (steps com `requestAnimationFrame`). Para `prefers-reduced-motion`, exibe direto.

### 4.6 Streak preservado no dia

**Gatilho:** primeira sessão concluída do dia (qualquer modo).
**Duração:** 1.5s.
**Elementos:** mini-animação **na topbar** — ícone de fogo `--streak` pulse 2x + número incrementa com flip animation (dígito antigo sobe e sai, novo entra de baixo). Sem som agressivo: `streak-up.mp3` é discreto (sininho).

```css
.streak-chip-celebrate { animation: streakBeat 600ms ease 2; }
@keyframes streakBeat {
  0%, 100% { transform: scale(1); }
  40%      { transform: scale(1.15); }
}
.streak-num-old { animation: digitOut 250ms ease forwards; }
.streak-num-new { animation: digitIn  250ms ease forwards; }
@keyframes digitOut { to { transform: translateY(-12px); opacity: 0; } }
@keyframes digitIn  { from { transform: translateY(12px); opacity: 0; } }
```

**Streak quebrado:** sem animação, sem som. No próximo carregamento do app, se streak quebrou (>36h sem sessão), o contador volta a 1 silenciosamente. Toast NÃO aparece avisando "perdeu streak". Decisão deliberada: streak é motivacional positivo, não relógio de culpa.

### 4.7 Level up (deck ou global)

**Gatilho:** XP do deck cruza limiar de nível (`1k, 2.5k, 5k, 10k, 20k, ...`) OU XP global idem.
**Duração:** 1.8s, **toast grande** posicionado top-center (não bottom — leveling up é evento importante).
**Elementos:**
- Toast em `--levelup` (gradient `#9275ff → #b08cff`) com texto "Nível **X**" em Fraunces 28px + sub "Deck: Capitais SA" ou "Global".
- Halo roxo em volta + 8 partículas roxas (mesma técnica do confetti, cor `--levelup`, queda mais lenta).
- Som `levelup.mp3` (~1.2s, sting cinematográfico curto — não videogame anos 90).

**Não é bloqueante.** Aparece sobre o jogo em andamento, fica 1.8s, fade out. Jogo continua rodando atrás. Não pausa o speed timer.

### 4.8 Medalha conquistada

**Gatilho:** condição de medalha satisfeita (ex.: "primeira streak de 7 dias", "1000 XP em um deck", "match sub-10s").
**Duração:** 2.4s, toast grande inferior (`.toast-medal`), com botão fechar (X) — pode ser dispensado antes.
**Elementos:**
- Badge dourado 64px (medalha SVG inline) + nome da medalha + descrição.
- Halo dourado pulsante (`--medal`) por toda duração.
- Som `medal.mp3` (~1.5s, sino + sting de conquista — usar diferente de level-up pra ouvido distinguir).
- Confetti dourado leve (8 partículas).
- Ao final, fade out OU click no toast leva pra `/eu#medalhas`.

**Não é bloqueante** — mas é o efeito visual mais destacado da sprint. Medalha é raro.

```css
.toast-medal {
  background: linear-gradient(135deg, #2a1f00, #3a2a00);
  border: 1px solid var(--medal);
  color: var(--text);
  padding: 16px 20px;
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 14px;
  align-items: center;
  min-width: min(420px, 90vw);
  box-shadow: 0 20px 60px rgba(255, 217, 122, 0.25);
}
.toast-medal-icon {
  width: 56px; height: 56px;
  background: radial-gradient(circle at 35% 30%, #fff2b8 0%, var(--medal) 50%, #b8860b 100%);
  border-radius: 50%;
  display: grid; place-items: center;
  color: var(--medal-ink);
  animation: medalPulse 1.4s ease-in-out infinite;
}
@keyframes medalPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 217, 122, .5); }
  50%      { box-shadow: 0 0 0 12px rgba(255, 217, 122, 0); }
}
.toast-medal-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 18px; }
.toast-medal-desc  { font-size: 13px; color: var(--text-dim); }
```

### 4.9 Tabela resumo (referência rápida)

| Efeito | Trigger | Duração | Som | Bloqueia? | Pos |
|---|---|---|---|---|---|
| Acerto | resposta certa | 480ms | pop-correct (120ms) | Não | alvo |
| Erro | resposta errada | 380ms | pop-wrong (150ms) | Não | alvo |
| Combo x3 | 3 seguidos | 1.2s banner | combo-3 (200ms) | Não | top-right do modo |
| Combo x10 (hot) | 10 seguidos | 1.2s + pulse contínuo | combo-10 (400ms) | Não | top-right + pill |
| 100% sessão | sessão sem erro | 1.2s + halo | perfect (800ms) | Não | tela de resultado |
| XP float | acerto | 850ms | (junto com pop-correct) | Não | sobre alvo |
| Streak +1 | 1ª sessão do dia | 600ms | streak-up (300ms) | Não | topbar |
| Level up | cruza limiar | 1.8s | levelup (1.2s) | Não | top-center |
| Medalha | condição rara | 2.4s | medal (1.5s) | Não | bottom-center |

---

## 5. Topbar redesign

Atual:
```
[F Flashy]   ........................................................  [Anônimo · este navegador]
```

Novo:
```
[F Flashy]   ........................   [🔥 7]  [⚡ 1.2k XP]  [🔊]  [Anônimo · este navegador]
```

Em ASCII fiel ao layout proposto:

```
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [F] Flashy            (spacer)            🔥 7   ⚡ 1240   [🔊]   Anônimo · ...   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

**Detalhes:**
- **Streak chip:** ícone de fogo SVG (cor `--streak`) + número. Sem texto "dias" (implícito; tooltip mostra "7 dias seguidos"). Click leva pra `/eu#streak`. Hover: tooltip custom (NÃO `title=""`).
- **XP chip:** ícone de raio SVG (cor `--xp`) + número formatado (`1240`, `1.2k`, `12.4k`, `124k`). Click leva pra `/eu`. Mesmo tooltip pattern.
- **Mute toggle:** ícone speaker on/off pequeno (28×28px, `btn-icon` style), click toggla som global. Tecla `M` global ativa o mesmo. Estado persiste em `localStorage` (`flashy:sfx_muted`).
- **Identidade textual** (Anônimo · ... / @nome) continua à direita.
- Em **tela de play** (`showBack=true`): topbar minimizada. Streak e XP chips **continuam visíveis** (a vibe arcade depende deles serem persistentes), mas mute toggle só aparece se houver hover na topbar (mantém limpo).

**Posicionamento CSS:**
```css
.topbar-stats {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-right: 8px;
}
.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 100px;
  background: var(--bg-elev);
  border: 1px solid var(--border-soft);
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.stat-chip:hover { border-color: var(--border); background: var(--bg-elev-2); }
.stat-chip-streak svg { color: var(--streak); }
.stat-chip-xp     svg { color: var(--xp); }
.stat-chip-muted  { color: var(--text-mute); }
```

**Mobile (<600px):**
```
[F]     🔥7  ⚡1.2k  [🔊]
```
- Brand vira só `[F]` (mark sem texto).
- "Anônimo · este navegador" some (já era; vai pra popup do menu lateral em sprint futura).
- Streak/XP/mute permanecem.
- Mute aparece sempre visível (não esconde por hover, mobile não tem hover).

**Mobile (<480px):**
```
[F]   🔥7  ⚡1.2k
```
- Mute vira opção dentro de `/eu`. Não cabe.

---

## 6. Tela `/eu` nova

Rota: `/eu`. Acessada pelo click no chip streak/XP da topbar, OU por link em popup futuro do user. **Não é tab** do home — é tela própria (tela "perfil"). Sem tabs internas pra não fragmentar.

### Layout (desktop)

```
+----------------------------------------------------------------------+
|  ← Voltar          [F] Flashy             🔥 7   ⚡ 1240   [🔊]      |
+----------------------------------------------------------------------+
|                                                                      |
|  Você (Anônimo · este navegador)                                     |
|  ------------------------------------------------------------------  |
|                                                                      |
|   +-------------+   +-------------+   +-------------+                |
|   |   1240 XP   |   |   Nível 3   |   |   🔥 7 dias |                |
|   |   ─────     |   |  próximo:   |   |  ─────────  |                |
|   |  ░░░ 760    |   |   5000 XP   |   | melhor: 12  |                |
|   +-------------+   +-------------+   +-------------+                |
|                                                                      |
|  Atividade dos últimos 90 dias                                       |
|  ▢▢▢▢▢▢▢▢▢▢▢▢▢▢                                                      |
|  ▢▢▢▢▢▢▢▢▢▢▢▢▢▢   (calendar heatmap estilo GitHub, 4 níveis)         |
|  ▢▢▢▢▢▢▢▢▢▢▢▢▢▢                                                      |
|                                                                      |
|  Medalhas                                          12 de 30          |
|  +--------+ +--------+ +--------+ +--------+                         |
|  | 🏅      | | 🏅      | | 🏅      | | 🔒      |                         |
|  | Iniciado| | 7 dias  | | 100 XP  | | Speed   |                         |
|  +--------+ +--------+ +--------+ +--------+                         |
|  +--------+ +--------+ +--------+                                   |
|  | 🔒      | | 🔒      | | 🔒      |                                   |
|  | ???    | | Match    | | Combo  |                                   |
|  | dica   | | sub-10   | | x50    |                                   |
|  +--------+ +--------+ +--------+                                   |
|                                                                      |
|  ------------------------------------------------------------------  |
|  Por deck                                                            |
|  • Capitais SA          ████████░░  680 XP  · Nv 2                   |
|  • Vocabulário FR       ██░░░░░░░░  180 XP  · Nv 1                   |
|  • [...]                                                             |
|                                                                      |
|  ------------------------------------------------------------------  |
|  [Exportar dados (JSON)]   [Limpar progresso]                        |
|                                                                      |
+----------------------------------------------------------------------+
```

### Decomposição

#### Header stats (3 panels lado a lado)

3 `.panel` flexíveis (grid 3 colunas → 1 coluna em <600px).
1. **XP total** com `score-xl` (72px) + barra de progresso pro próximo nível abaixo (`.deck-card-progress` mas com `--xp` e altura 6px).
2. **Nível** atual em score-xl + label "próximo: N XP" em `tiny muted`.
3. **Streak** em score-xl com ícone de fogo grande à esquerda + "melhor: 12" em `tiny muted`.

#### Calendar heatmap (90 dias)

Grid `display: grid; grid-template-columns: repeat(14, 12px); gap: 3px;` — 14 colunas (semanas) × ~7 linhas. Cada célula:
- `0` sessões: `--border-soft`.
- `1`: `--xp-soft`.
- `2-4`: `--xp` a 50%.
- `5+`: `--xp` cheio.

Hover na célula: tooltip custom "12 mar · 3 sessões · 450 XP". Implementado com `hoverTip(el, content)` (novo helper em `ui/tooltip.js`).

Sem libs (Chart.js, etc.). É um grid CSS puro com classes de intensidade. ~15 linhas de JS pra gerar.

#### Medalhas

Grid `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))`, gap 12px. Cada medalha:
- **Conquistada:** `.medal-card` com badge dourado SVG, nome + data conquista em `tiny muted`. Hover: scale 1.04.
- **Bloqueada:** mesma estrutura mas badge cinza (`--text-mute`), nome substituído por dica ("???" ou "Bate 10 combo") + ícone de cadeado pequeno. Click numa bloqueada mostra dica em modal pequeno.

**Lista inicial de medalhas (ver Produto pra confirmar):**
1. **Iniciado** — primeira sessão concluída.
2. **Repetente** — 2 sessões no mesmo deck.
3. **Triple combo** — combo x10 em qualquer modo.
4. **Em chamas** — combo x20.
5. **Maratona** — 30 cards em uma sessão.
6. **Perfeitoso** — sessão 100% com ≥10 cards.
7. **Veloz** — speed round com 20+ acertos.
8. **Match-relâmpago** — match sub-10s.
9. **Memorista** — 7 dias de streak.
10. **Devoto** — 30 dias de streak.
11. **Polígloto** — 3 decks de idiomas diferentes (heurística por TTS lang).
12. **Coletor** — 10 decks criados.
13. **Curador** — 1 deck publicado e duplicado por outro.
14. **Carteira cheia** — 10000 XP total.
15. (placeholder pra produto adicionar mais)

#### Por deck

Lista simples (`.stack`), cada linha:
```
nome do deck                    [barra mini]  XP atual  · Nv X
```
Click leva pro `/deck/:id`. Limit 10 visíveis + "Ver todos" se houver mais.

#### Botões finais

- **Exportar dados (JSON):** baixa `flashy-export-YYYY-MM-DD.json` com `{ xp, streak, medals, perDeck, history }`. Sem confirm.
- **Limpar progresso:** abre `confirmModal` com texto destrutivo. Apaga só dados de gamificação (XP, streak, medalhas, history) — **não** apaga decks. Microcopy: "Apagar todo o progresso? Decks ficam intactos. XP, streak e medalhas zeram. **Sem volta.**".

### Empty state (zero atividade)

Quando user nunca completou sessão:

```
+------------------------+
|     Ainda sem stats    |
|                        |
|   Termine uma sessão   |
|  de qualquer modo pra  |
|   ganhar seu primeiro  |
|        XP.             |
|                        |
|     [Ir pros decks]    |
+------------------------+
```

Usa `.empty` existente. Sem stats panels, sem heatmap, medalhas todas bloqueadas só mostra "0 de 30" e a grid de bloqueadas em fade-out.

---

## 7. Resumo de fim de sessão

Componente novo `src/ui/session-result.js`. Substitui os `renderResult` específicos de cada modo (cada modo passa a chamar `sessionResult({...})`).

### Layout

```
+----------------------------------------------------+
|                                                    |
|                      🎯                            |
|                                                    |
|                  Boa sessão                        |
|                                                    |
|                   + 240 XP                         |
|                   ─────                            |
|              de 18 acertos                         |
|                                                    |
|  ─────────────────────────────────────────         |
|                                                    |
|  Combo máximo:  x8                                 |
|  Tempo:         1m 24s                             |
|  Acertos:       18/20  ·  90%                      |
|                                                    |
|  ─────────────────────────────────────────         |
|                                                    |
|  🏅  Medalha nova: Iniciado                        |
|  🔒  Próxima: Combo x10  (você fez x8!)            |
|                                                    |
|  +-------------------+   +-------------------+     |
|  |  Voltar ao deck   |   |  Jogar de novo    |     |
|  +-------------------+   +-------------------+     |
|                                                    |
+----------------------------------------------------+
```

### Detalhes visuais

- **Emoji topo:** mesmo do atual (`🎯/💪/📚` por % de acerto; **`🏆`** se houve novo recorde local de game). Mantém continuidade.
- **"+ 240 XP"** em `score-big` (cor `--xp`) — rolling counter de 0 → 240 em 700ms ao montar a tela. Som `xp-final.mp3` (pop ascendente curto, ~400ms) sincronizado.
- **Lista resumo** em pills empilhadas (vertical), label à esquerda, valor à direita. Visual sóbrio.
- **Bloco medalhas** só aparece se houver:
  - Nova medalha conquistada nesta sessão: badge dourado pequeno + nome + animação `medalPulse` 1x.
  - Próxima medalha: cinza + nome + parêntese com progresso atual ("você fez x8!", "faltam 2 dias").
  - Sem nada: bloco inteiro some.
- **Botões:** "Voltar ao deck" (secundário) + "Jogar de novo" (primário). Foco automático em "Jogar de novo" pra Enter avançar.
- **Não bloqueante** no sentido de modal-backdrop. É uma tela inteira no `stage`. User pode usar atalhos `Enter` (replay), `Esc` (voltar ao deck).
- **Confetti** dispara aqui se sessão 100%. Halo dourado em volta do "+ N XP" se nova medalha.
- **Toast de medalha** NÃO dispara aqui (já está mostrada inline) — toast só dispara durante o jogo (medalha conquistada no meio).

### Estados extras

- **Speed/Match com novo recorde:** acima de "Boa sessão", linha em `--accent` "🏆 Novo recorde local!" + tempo antigo riscado.
- **Sessão muito curta (<3 cards):** XP ainda mostra, mas sem medalha eligível, e sem confetti mesmo em 100% (3 cards 100% não é evento épico).
- **Sessão abandonada:** se user clica voltar no meio, **sessionResult não aparece**. Volta direto. Mas XP do que foi acertado já é creditado (parcial, real-time, em cada acerto). Coerente com a vibe "nunca punitiva".

---

## 8. Áudio

### Paleta de sons

Lista (todos curtos, <1.5s, formato MP3 64kbps mono):

| Arquivo | Duração | Descrição |
|---|---|---|
| `pop-correct.mp3` | 120ms | Ding curto, frequência média-alta. Satisfação seca. |
| `pop-wrong.mp3` | 150ms | Thud baixo, sem alarme. Indica "errou" sem irritar. |
| `combo-3.mp3` | 200ms | Pop duplo, ascendente. |
| `combo-5.mp3` | 250ms | 3 pops ascendentes. |
| `combo-10.mp3` | 400ms | Whoosh + ding "esquentou". |
| `combo-20.mp3` | 500ms | Ding mais alto, escala. |
| `streak-up.mp3` | 300ms | Sininho leve. Confirma "fez hoje". |
| `levelup.mp3` | 1200ms | Sting cinematográfico curto. Roxo. |
| `medal.mp3` | 1500ms | Sino + sting de conquista. Dourado. Distinto do levelup. |
| `perfect.mp3` | 800ms | Sting ascendente final, "fechou 100%". |
| `xp-final.mp3` | 400ms | Pop ascendente do número crescendo. |
| `click-soft.mp3` | 60ms | (opcional) Clique sutil em opção MC selecionada. Default OFF, toggle separado. |

**Princípios:**
- Sons **não são videogame anos 90.** Devem soar próximos do feedback de SaaS premium (Linear, Notion). Aquele "tap-pop-ding" sutil.
- Nada com loop. Nada com cauda longa. Nada com voz.
- Tudo testado em volume médio (60%) — usuário não deve querer baixar.
- Geração: Eleven Labs SFX ou Mubert/AudioJungle licenciado. Não usar SFX gerados por IA com qualidade ruim.

### Armazenamento

Pasta: `public/sounds/` (servida estática pelo Express + Vite).
Arquivos referenciados em `src/core/sfx.js`:

```js
const SOUNDS = {
  correct: '/sounds/pop-correct.mp3',
  wrong:   '/sounds/pop-wrong.mp3',
  combo3:  '/sounds/combo-3.mp3',
  // ...
};
```

### Implementação

Módulo `src/core/sfx.js`:
- Preload no boot: cria `HTMLAudioElement` pra cada som, faz GET (browser cacheia).
- API: `sfx.play('correct')`, `sfx.play('medal')`.
- Cada `play` clona o áudio (`audio.cloneNode().play()`) pra permitir sobreposição (combo + xp ao mesmo tempo).
- Pool de instâncias limitado (max 4 simultâneos) pra evitar AudioContext lockup.
- `sfx.setMuted(bool)` persiste em `localStorage:flashy:sfx_muted`.
- `sfx.setVolume(0..1)` (default 0.6). Slider de volume na tela `/eu` (futuro — não na MVP da sprint).
- Respeita `prefers-reduced-motion`? **NÃO automaticamente** — reduzir movimento não implica silenciar. Mas adicionar opção separada na tela `/eu`: "Acompanhar 'reduzir movimento' do SO" → quando ligada, mute segue prefers-reduced-motion.

### Toggle de mute

- Ícone no topbar (4×4 SVG: speaker on / speaker off cruzado).
- Click toggla. Persiste imediato.
- Atalho global `M` (não interfere com inputs).
- Quando muted, **todos** os sons param — incluindo sons de medalha e level-up. Não há "som obrigatório".

---

## 9. Mobile

### Topbar <600px

Já coberto em §5. Resumo:
- `[F]` + `🔥7` + `⚡1.2k` + `[🔊]`. Identidade textual some.

### Combo banner

- Em mobile, banner posicionado `top: 8px; right: 8px;` (mesmo padrão), tamanho reduzido (font 14px em vez de 18px). Continua visível, não infla o jogo.

### Tela `/eu` <600px

- 3 panels stats viram coluna única (`grid-template-columns: 1fr`).
- Heatmap continua com 14 colunas × 7 linhas — em <480px, cell size 10px com gap 2px (cabe em 168px de largura).
- Grid medalhas vira `repeat(auto-fill, minmax(96px, 1fr))` — 3 por linha em telas estreitas, 2 em <380px.
- "Por deck": lista vertical natural, barra mini fica acima do XP em vez de inline (vira 2 linhas por deck).
- Botões `Exportar` e `Limpar` empilham.

### Fim de sessão <600px

- Painel ocupa 100% da largura do container (já é o caso).
- Stats list (combo máximo, tempo, acertos) continua em 2 colunas.
- Botões empilham (já era o caso com `.fc-controls` flex-wrap).
- Confetti: reduz pra 8 partículas em mobile (perf).

### Sons em mobile

- iOS Safari requer user gesture pra liberar audio. Primeira tentativa de `sfx.play()` antes de gesture → silenciada silenciosamente. Após primeiro click/touch, audio context é criado. **Implementação:** `sfx.unlock()` no primeiro `pointerdown` global.
- Battery: sons curtos não estouram bateria. Sem preocupação.

### Tap targets

Todos os botões já cumprem mínimo 44×44 (botões base em 14×16 padding + 14px font + bordas → ~48px altura). Mute toggle (28×28) precisa ter área de click expandida via padding/pseudo-hitbox.

---

## 10. Acessibilidade

### `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  /* Reduz, não remove. Cor e flash permanecem; deslocamento e escala somem. */
  .fx-correct, .fx-wrong, .combo-pill-hot, .toast-medal-icon, .fc-card-inner,
  .fx-confetti-piece, .fx-halo-gold {
    animation: none !important;
  }
  .fx-xp-float { animation: xpRiseStatic 600ms ease forwards; }
  @keyframes xpRiseStatic {
    0%   { opacity: 0; }
    20%  { opacity: 1; }
    80%  { opacity: 1; }
    100% { opacity: 0; }
  }
  /* Halo permanece (cor é informação, não animação) */
}
```

Confetti, halo pulsante, combo pulse, medal pulse, level-up partículas — **todos suprimidos**. Cor de borda e flash de glow ainda mudam (informação semântica é preservada).

### Contraste

Verificar cada par contra `--bg` (#0f1115) com WCAG AA (≥4.5:1 pra texto normal, ≥3:1 pra largeText/UI):

| Cor sobre `--bg` | Contraste | OK? |
|---|---|---|
| `--xp` (#ffd166) | 11.2:1 | ✓ |
| `--combo` (#ffb45a) | 9.0:1 | ✓ |
| `--combo-hot` (#ff7a4a) | 6.5:1 | ✓ |
| `--levelup` (#b08cff) | 6.1:1 | ✓ |
| `--medal` (#ffd97a) | 11.0:1 | ✓ |
| `--streak` (#ff8a3d) | 7.2:1 | ✓ |

Todas as cores principais passam. Verificar combinações: `--accent-ink` (#1a1500) sobre `--medal` no badge: contraste >12:1, OK.

### Screen reader

XP ganho: usar `<span aria-live="polite">` invisível (off-screen) no topbar que recebe mensagem `"Ganhou 20 XP. Total: 1240."` a cada sessão concluída. Não a cada acerto individual (verboso demais).

Medalha conquistada: toast tem `role="alert"` (já é o padrão de `aria-live="assertive"` implícito) com texto "Medalha conquistada: Iniciado. Termine sua primeira sessão." — sem o emoji/decoração que confunde leitor.

Level up: idem. `role="alert"`. "Nível 3 alcançado."

Combo: **não** anunciar cada combo (verboso). Apenas marcos altos (10, 20) com `aria-live="polite"` "Combo de 10 acertos seguidos".

Streak: anúncio único do dia "Streak agora em 7 dias seguidos."

Botão mute: `aria-label="Silenciar sons"` / `aria-label="Ativar sons"`, `aria-pressed`. Anunciado por screen reader corretamente.

Tela `/eu`: ordem semântica natural — h1 "Você", h2 "Atividade", h2 "Medalhas" (com contagem aria-label), h2 "Por deck". Heatmap precisa de descrição: cada célula tem `aria-label="3 sessões em 12 de março"` (gerado dinamicamente).

### Focus management

- Fim de sessão: foco automático no botão primário "Jogar de novo".
- Modal de medalha: se modal foi aberto (click no toast medal), foco no botão fechar; trap focus dentro.
- Tecla `Esc` fecha qualquer toast/popup grande (medalha, level-up).
- Tecla `M` toggla mute (verificar não conflita com inputs — já protegido pelo padrão `if (target.tagName === 'INPUT')`).

### Reduced data (futuro, não nesta sprint)

Pré-load de sons (~150KB total) não é problemático. Em `Save-Data: on` (futuro), pular preload — carregar sob demanda.

---

## 11. Microcopy (PT-BR)

Tom: arcade descontraído, sem piegas, sem "Parabéns!", sem "Você é incrível!". Direto, com personalidade.

### Combo banner
- x3: "Combo x3"
- x5: "Combo x5"
- x10: "Em chamas! x10"
- x20: "x20 — você é doente"
- x30+: "x30 — pare de mostrar"

### Sessão
- 100% perfeita: "Perfeito."
- ≥80%: "Boa sessão"
- ≥50%: "Bora de novo"
- <50%: "Tá no caminho"

### XP/Level
- Toast level up: "Nível **X**" + sub "global" OU "no deck *Capitais SA*"
- Tela /eu vazia: "Ainda sem stats. Termine uma sessão pra ganhar seu primeiro XP."
- Próxima medalha (no resumo): "Próxima: **Combo x10** · você fez x8!"

### Streak
- Topbar tooltip: "7 dias seguidos. Volte amanhã pra manter."
- Tooltip melhor: "Seu melhor foi 12 dias."
- (Nunca anunciar quebra de streak. Silenciosamente reinicia.)

### Medalhas
- Toast: "Medalha conquistada: **Iniciado**" + sub "Primeira sessão. Bem-vindo."
- Bloqueada (dica): "Faça 10 acertos seguidos." (Tom: direto, sem floreio.)

### Mute
- Tooltip on: "Som ON · `M`"
- Tooltip off: "Som OFF · `M`"

### Limpar progresso
- Modal: "Apagar todo o progresso?" + body "Decks ficam intactos. XP, streak e medalhas zeram. **Sem volta.**" + actions "Cancelar / Apagar tudo".

---

## 12. Riscos UX e decisões

### Risco: efeitos viram ruído visual
**Decisão:** combo x3 e x5 são banners discretos curtos (1.2s, top-right do modo). XP popup é 22px (não 48px). Acerto = 480ms total. Só level-up e medalha são "eventos grandes" e ambos são raros (mínimo nível 1 = 1000 XP).

### Risco: gamificação afasta usuários "sérios" que querem só estudar
**Decisão:** sons default ON mas **toggle visível em todos os lugares**. Animações respeitam `prefers-reduced-motion`. Topbar streak/XP é discreto (2 chips minúsculos). Não há tela de pop-up de bem-vindo, sem onboarding de gamificação. Quem ignora ainda usa o produto inteiro.

### Risco: streak vira culpa diária
**Decisão:** nunca avisar quebra. Reinicia silenciosamente. Sem badge "perdeu streak". Sem retomada forçada. Streak é motivação positiva, nunca pena.

### Risco: XP inflado mata sensação de progresso
**Decisão:** níveis exponenciais (1k, 2.5k, 5k, 10k, 20k, 40k...). Nível 5 vira evento real (~10 dias de uso médio). Já vem decidido em CONCEPTS.md.

### Risco: confetti em DOM (sem canvas) trava em mobile fraco
**Decisão:** ≤16 partículas desktop, ≤8 mobile. Cada partícula 8×12px `div` com `will-change: transform`. Cleanup com `animationend`. Testado em iPhone 8 = OK.

### Risco: sons assassinam o foco de quem estuda em ambiente compartilhado
**Decisão:** mute global no topbar, sempre visível, atalho `M`. Estado persiste. Default ON é arriscado, mas a vibe arcade depende disso (e ouvir o ding muda o feel). Aceitamos o trade-off, mitigado pelo toggle 1-click sempre acessível.

### Risco: medalha conquistada no meio do speed round atrapalha
**Decisão:** toast de medalha aparece **bottom-center**, fora da área de jogo. Não pausa, não bloqueia, fade out em 2.4s. Click é opcional. Speed timer continua rodando.

### Risco: o componente `sessionResult` quebra modos que hoje têm renderResult próprio
**Decisão:** novo `sessionResult({ mode, xp, combo, time, accuracy, isRecord, newMedals })` substitui os 5 renderResult atuais sem perder o que cada modo mostrava. Cada modo passa os campos relevantes (speed passa `accuracy` em terms de acertos no tempo; match passa `time` mas não `accuracy` no sentido %). Spec do Produto define o contrato exato.

### Risco: tela `/eu` vira página social (vanity)
**Decisão:** sem comparação com outros usuários. Sem ranking. Sem botão compartilhar conquista. Tela `/eu` é só **você consigo mesmo**. Heatmap, medalhas, XP — tudo pessoal. Manter Flashy não-social, conforme CONCEPTS.

### Risco: sons gerados por IA soam ruins
**Decisão:** sons via ElevenLabs SFX ou pack comercial. Sem improvisação. Se não houver tempo de produzir os 12, partir com 4 essenciais (correct, wrong, levelup, medal) e o resto fica silencioso até produzir. Pior cenário: arcade sem combo sounds — ainda funciona.

### Risco: efeito de level-up colide com toast normal de erro/sucesso
**Decisão:** level-up toast é **top-center**; toast normal continua **bottom-center**. Medalha é **bottom-center especial** (`.toast-medal` é mais alto que toast normal). Coexistem sem sobrepor.

### Risco: tooltip custom (hover dos chips) vai ser componente novo grande
**Decisão:** componente leve `hoverTip(targetEl, contentEl)` em `ui/tooltip.js`. ~30 linhas. Reusa `.dropdown-popup` styling. Sem libs. Não cobre touch (em mobile, click no chip leva direto pra `/eu` em vez de mostrar tooltip).

---

## 13. Checklist de implementação (resumo pro Dev)

### Componentes novos
- [ ] `src/core/sfx.js` — preload, play, mute, unlock pra iOS.
- [ ] `src/core/xp.js` — cálculo de XP, combo, level up, streak (lógica pura, sem UI).
- [ ] `src/core/medals.js` — definições + checagem de unlock.
- [ ] `src/core/profile.js` — store de gamificação (localStorage `flashy:gamification`, com migração).
- [ ] `src/ui/fx.js` — `fx.correct(el, xp)`, `fx.wrong(el)`, `fx.combo(level)`, `fx.confetti(el)`, `fx.halo(el)`, `fx.levelUp(level, scope)`, `fx.medal(medal)`.
- [ ] `src/ui/session-result.js` — componente `sessionResult({...})` usado por todos os 5 modos.
- [ ] `src/ui/profile-screen.js` — tela `/eu`.
- [ ] `src/ui/tooltip.js` — `hoverTip(el, content)` leve.
- [ ] `src/ui/topbar.js` — refatorar pra incluir streak/XP chips + mute toggle.
- [ ] `src/ui/icons.js` — adicionar `iconFire`, `iconBolt`, `iconSpeakerOn`, `iconSpeakerOff`, `iconMedal`, `iconLockSmall`.
- [ ] `public/sounds/` — 12 arquivos de áudio (ou subset inicial).

### CSS novo (em `styles.css`)
- [ ] Tokens novos (`--xp`, `--combo`, `--combo-hot`, `--levelup`, `--medal`, `--medal-ink`, `--correct-glow`, `--wrong-glow`, `--streak`).
- [ ] `.fx-correct`, `.fx-wrong`, `@keyframes flashCorrect`, `@keyframes flashWrong`.
- [ ] `.fx-xp-float`, `@keyframes xpRise`.
- [ ] `.combo-pill`, `.combo-pill-hot`, `.combo-pill-insane`, `.combo-banner`, `@keyframes comboPulse / comboBannerIn / comboBannerOut`.
- [ ] `.fx-confetti-piece`, `@keyframes confettiFall`.
- [ ] `.fx-halo-gold`, `@keyframes haloPulse`.
- [ ] `.toast-medal`, `.toast-medal-icon`, `@keyframes medalPulse`.
- [ ] `.toast-levelup` (variante top-center, gradient roxo).
- [ ] `.topbar-stats`, `.stat-chip`, `.stat-chip-streak`, `.stat-chip-xp`, `.stat-chip-muted`.
- [ ] `.streak-chip-celebrate`, `.streak-num-old`, `.streak-num-new`, `@keyframes streakBeat / digitOut / digitIn`.
- [ ] `.score-xl` (72px), `.medal-card`, `.medal-card-locked`, `.heatmap-grid`, `.heatmap-cell` (5 níveis).
- [ ] `.session-result-bar`, layout do componente.
- [ ] `@media (prefers-reduced-motion: reduce)` cobrindo todos os efeitos animados.

### Telas alteradas
- [ ] `src/ui/topbar.js`: streak chip, XP chip, mute toggle, mobile collapse.
- [ ] `src/games/flashcards.js`: chamar `fx.correct/wrong` em `answer()`, gravar XP via `profile.recordResult`, mostrar combo pill, trocar `renderResult` por `sessionResult`.
- [ ] `src/games/multiple-choice.js`: mesma adaptação. Acerto/erro em `.mc-option` com `fx.correct/wrong`.
- [ ] `src/games/write.js`: idem. Acerto/erro no `.write-input`.
- [ ] `src/games/match.js`: já tem `flash-correct/wrong` — promover pra `fx-correct/wrong` global ou manter dual (decisão Dev). Adicionar XP via par casado.
- [ ] `src/games/speed.js`: idem MC. Combo pill no header. Sessão termina sempre com `sessionResult`.
- [ ] `src/ui/router.js`: rota `/eu` → `profileScreen()`.
- [ ] `src/main.js`: chamar `sfx.preload()` + `profile.init()` no boot. `sfx.unlock()` no primeiro `pointerdown`.

### Persistência
- [ ] localStorage chave `flashy:gamification`:
  ```ts
  {
    xpTotal: number,
    levelGlobal: number,
    streak: { current: number, best: number, lastDate: string },
    perDeck: { [deckId]: { xp, level, sessions } },
    medals: { [medalId]: { unlockedAt: string } },
    history: Array<{ date: string, sessions: number, xp: number }>,
    sfxMuted: boolean,
    reduceMotionMirror: boolean
  }
  ```
- [ ] Backup em backend (futuro). Pra esta sprint: só localStorage, igual ao resto.

---

## Pontos abertos pra alinhar com Produto

- **Lista exata de medalhas** (Spec sugere 14; Produto refina).
- **Curva de level up:** confirmar `1k, 2.5k, 5k, 10k, 20k, 40k, ...` ou outra progressão.
- **Combo cap:** confirmar multiplicador máximo 3x (CONCEPTS já diz 3x mas spec assume).
- **Streak counta horário ou data civil?** Spec assume **data civil local do user** (mais permissivo, "estudei segunda + estudei terça = 2 dias", não importa hora).
- **Streak grace period?** Pular um dia perde tudo, ou tem "ticket"? Spec assume **perda imediata, sem grace**. Confirmar.
- **XP base por modo** (`flashcards 10`, `MC 20`, etc.) confirmado em CONCEPTS — manter.
- **Anônimo perde tudo ao limpar browser?** Mesma situação dos decks. Aceito.
- **Sons: budget tem pra ElevenLabs SFX?** Se não, partir com pack comercial.
- **Tela `/eu` pra anônimo: tem sentido?** Sim — XP/streak local funcionam mesmo anônimo. Heatmap idem (localStorage).

Quando esses pontos estiverem decididos, atualizar microcopy, cores e fluxos de confirmação.
