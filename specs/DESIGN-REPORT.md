# DESIGN-REPORT — Sprint Gamificação

Auditoria visual de https://quiz.did.lu contra `UX-SPEC-gamification.md` + `DECISIONS-sprint-gamification.md`. Capturas em `qa-screenshots/design-NN-*.png`. Auditado em 2026-05-20, desktop 1280x800 e mobile 375x667.

---

## Resumo executivo

**Vibe atingida: SIM. Arcade premium.** O produto entrega o feel "Duolingo refinado / Linear gamificado" sem cair em Candy Crush. Decisões acertadas: serif Fraunces no número grande do XP, paleta âmbar/verde/rosa/azul calibrada, sem emoji gigante piscando, sem cores neon. Combo overlay sem fundo (só número colorido em escala) é mais elegante que a "banner com fundo" proposta na spec — fica menos intrusivo. Session-end-modal (`design-12`) é o ponto alto: hierarquia tipográfica clara, breakdown em pills, banner level-up roxo discreto, medal card integrada. Topbar é discreta como pedido (chip streak + chip level + 2 ícones). Tela `/eu` empty state e populated estão coerentes. Mobile foi pensado (som default OFF, topbar colapsa para chips minúsculos, install prompt fora do gameplay).

**Pontos onde escorregou:** heatmap está superdimensionado (cells 55x55px em vez de 12px estilo GitHub), o número grande do nível em `/eu` está em 38px (spec pedia 72px na `.score-xl`), touch targets do topbar em mobile estão abaixo de 40px, emojis nativos do SO em medalhas e mute/perfil quebram a consistência cross-OS, regra CSS `prefers-reduced-motion` cobre poucas classes (JS faz o trabalho, mas a auditoria CSS isolada acusa cobertura parcial), lista "por deck" não tem barra de progresso visual (era inline pill mini), e em desktop home há overflow visual onde título do deck cobre a pill "Privado".

**Recomendação: aceitar visual com pequenos ajustes.** Não justifica refazer. Os 4 itens marcados como Critical/Major abaixo são corrigíveis em ~half-day.

---

## Lista de problemas por severidade

### Critical (quebra a spec ou estraga percepção)

1. **Heatmap 30 dias com cells 55x55px** — `design-04`, `design-15`. Spec UX-SPEC §6.3 prescreve `grid-template-columns: repeat(N, 12px); gap: 3px`. Implementação atual usa célula gigante (~55px). Resultado: o "calendar heatmap estilo GitHub" virou um grid de 5 cards-quadrados gigantes que ocupa metade da viewport. **Quebra a vibe** — vira "tabuleiro de batalha naval" em vez de "atividade compactada visível de relance". A diferenciação 0-4 fica visualmente desperdiçada porque o espaço é todo branco/dark.

2. **Lista "Decks que você joga" sem barra de progresso inline** — `design-15`. Spec UX-SPEC §6.5 pede `nome · barra mini · XP · Nv`. Implementação atual exibe apenas `Capitais — América do Sul | Nv 2 · Aprendendo · 60 XP · 5 sessões` em texto puro. Perde o feedback visual de "quanto falta pra próximo nível por deck", que é o atrativo principal dessa seção.

### Major (polimento necessário)

3. **Número grande do level em `/eu` é só 38px** — `design-15` (level "1" no círculo). UX-SPEC §3 prescreve `.score-xl` em 72px Fraunces. Implementação atual é 38px no `.me-level-num`. A tela /eu perdeu o "número trofeu" que justifica o panel de identidade. Pode-se argumentar que o círculo laranja em volta compensa, mas a hierarquia tipográfica fica menos impactante que no session-end-modal (onde "240" XP aparece em 72px e mata).

4. **Touch targets do topbar abaixo de 40px no mobile** — measurements: `.topbar-mute` 34x34, `.topbar-me` 34x34, `.streak-badge` 46x30 (altura 30!), `.level-badge` 76x32. UX-SPEC §9 fala em ≥44px. Prompt da QA pede ≥40px. Está abaixo. Soluciona-se com `padding` extra ou `min-height: 40px`. Mute e perfil são os mais críticos (alvo único pequeno).

5. **Emojis nativos do SO nos ícones de mute, perfil e medalhas** — `design-13`, `design-04`. O botão de som usa `🔊` text (não SVG), o perfil usa `👤`, e as 18 medalhas usam emojis (`🎯 📦 📥 📚 🗂 ✨ 💎 🔟 🚀 🔥 ⚡ ⌨ 🔍 🎓 👑 🌟 🏆`). Em screenshots a renderização ficou OK no Chromium do CI, mas emojis variam drasticamente entre Windows/Mac/Android/iOS — sem controle sobre a aparência. Em alguns sistemas o `🔊` vira monochrome outline, o que descaracteriza o produto. **Quebra a regra de "zero componente nativo do SO"** (CLAUDE.md). Recomenda-se substituir por SVGs inline. Nota: em screenshot `design-19` (após algumas sessões) o mute aparece como SVG limpo — talvez já tenha uma versão SVG no código mas a renderização inicial está usando o emoji. Investigar.

6. **Heatmap cell-0 (sem sessões) indistinguível de cell-empty (padding)** — `design-04`, `design-15`. Ambos `rgb(31, 35, 48)`. Cell-0 deveria ter borda sutil ou tom 1-2 pontos mais clara pra comunicar "este dia existe, sem atividade" vs "padding do grid". Hoje a grade parece quebrada visualmente nas primeiras células (que são padding) — vide screenshot `design-05` onde a primeira linha aparece "incompleta" no canto superior esquerdo.

7. **Overflow visual no deck-card grid (desktop home)** — `design-19`. O card "Teste A — Capitais EU" tem o "EU" do título passando por baixo da pill "Privado" no canto superior direito. Bug de flex/grid overflow. O commit recente `62b808c` ("grid da card-row tinha spacer-column ocupando filho do back") sugere que houve fix relacionado mas não cobriu o overflow do título em deck-cards.

### Minor (nice-to-have)

8. **Combo overlay sem fundo/pill** — `design-08/09/10`. Spec UX-SPEC §4.3 prescrevia banner com fundo cor `--combo`. Implementação atual é só número grande colorido (sem pill/box) flutuante no canto superior direito. **Visualmente é melhor que a spec original** (mais discreto, premium), mas técnicamente é desvio. Aprovar como melhoria, anotar.

9. **Microcopy do combo sumiu** — UX-SPEC §11 prescrevia "Combo x10 — Em chamas!", "x20 — você é doente". Implementação mostra só o número. Decisão deliberada talvez (menos texto = mais premium), mas perdeu personalidade.

10. **Header "Eu" centralizado pequeno em /eu** — `design-04`. Spec pedia `h1 "Você (Anônimo · este navegador)"`. Implementação mostra só "Eu" centralizado pequeno na topbar, sem identidade textual destacada. Anônimo nunca vê seu próprio "rótulo" — perde-se a personalização leve.

11. **CSS `@media (prefers-reduced-motion)` cobre poucas classes** — confirmei em `styles.css:680`. Só `.combo-pulse, .streak-badge-fire, .install-prompt, .me-level-bar-fill` estão na regra. Confetti, medal-toast, level-up banner glow, halo, xp-float NÃO estão. JS faz a checagem em `comboOverlay.js`, `confetti.js`, `xpCounter.js` (early-return correto), o que cobre a maioria dos casos importantes. Auditoria via CSS isolada seria preocupante, mas o sistema funciona via JS. Adicionar regras CSS defensivas tornaria a cobertura mais robusta.

12. **404s no endpoint `/api/cards/:id/result`** — visto em console durante sessão MC. Bug backend, fora do escopo de design, mas afeta a experiência (XP/medalhas dependem do server-side). Reportar ao Dev.

---

## Comparação visual vs spec por componente

| Componente | Status | Comentário |
|---|---|---|
| **Topbar — streak badge** | ✓ alinhado | Chip pill com fogo SVG + número, cor `--streak`, transita pra gradient laranja vivo quando >0 (`design-19`). Tooltip via `title` (não custom, mas aceitável). |
| **Topbar — level pill** | ✓ alinhado | "Nv 3 · 310 XP" com ring circular preto e accent dourado. Discreto, premium. |
| **Topbar — mute toggle** | ⚠ desvio | Emoji nativo `🔊` em vez de SVG inline. Renderização inconsistente cross-OS. Em algumas screenshots aparece como SVG real (Speaker icon) — possível duplicidade no código. |
| **Topbar — me icon** | ⚠ desvio | Emoji nativo `👤`. Deveria ser SVG avatar genérico. |
| **Topbar — mobile collapse** | ✓ alinhado | Brand→F-only, XP value some, streak/level/mute/me persistem (`design-13`). |
| **Tela /eu — header level big** | ⚠ desvio | Número 38px em vez dos 72px da `.score-xl`. Compensa parcialmente com o círculo laranja, mas perde impacto. |
| **Tela /eu — XP bar** | ✓ alinhado | Barra dourada bonita, 6px altura, gradient implícito, fill suave (`design-15`). |
| **Tela /eu — streak panel** | ✓ alinhado | Card lateral com círculo grande e número de dias. Bonito. |
| **Tela /eu — heatmap 30d** | ✗ desvio crítico | Cells 55x55 em vez de 12px. Aspecto de "card grid", não de heatmap GitHub. Cell-0 = cell-empty visualmente. |
| **Tela /eu — medalhas grid** | ✓ alinhado | 18 medalhas (DECISIONS), grid auto-fill, locked com `grayscale(0.8) + opacity(0.45)`. Tier coloring funciona. |
| **Tela /eu — top decks** | ✗ desvio | Lista sem barra de progresso. Texto puro. |
| **Session-end-modal — emoji** | ✓ alinhado | 🎯/💪/📚/🌱 por accuracy. Sintonia com spec. |
| **Session-end-modal — XP big** | ✓ alinhado | 72px Fraunces, animação rolling counter, cor `--xp`. Premium. |
| **Session-end-modal — breakdown** | ✓ alinhado | Pills com label tiny muted + valor grande. Bônus em verde. |
| **Session-end-modal — level-up banner** | ✓ alinhado | Border roxa, "↑ Subiu pro nível 2!" Fraunces, glow sutil. |
| **Session-end-modal — medalha inline** | ✓ alinhado | Card centralizada, mesmo padrão da medal-toast. |
| **Session-end-modal — botões** | ✓ alinhado | "Voltar ao deck" ghost + "Jogar de novo" primary âmbar. Hierarquia clara. |
| **Combo overlay — base (3-9, azul)** | ⚠ desvio | Sem pill/banner com fundo. Só número + multiplier text. Visual melhor que spec, mas técnicamente desvio. |
| **Combo overlay — combo 10 (laranja)** | ✓ alinhado | Cor `--combo-hot #ff9e4d`. |
| **Combo overlay — combo 20 (vermelho)** | ✓ alinhado | Cor `--combo-fire #ff5e7a`, escala 32px. |
| **Combo overlay — combo 30** | ✓ alinhado | Mesma cor vermelho, escala 36px. |
| **Medal toast — bronze** | ✓ alinhado | Fundo bronze-claro discreto, border tonal (`design-11`). |
| **Medal toast — silver** | ✓ alinhado | Fundo prata-claro discreto. |
| **Medal toast — gold** | ✓ alinhado | Fundo dourado mais visível, premium. |
| **Medal toast — legendary** | ✓ alinhado | Gradient roxo+dourado. Distinto e bonito. |
| **Medal toast — animação** | ✓ alinhado | Slide-from-top com fade, classes `medal-toast-visible/leaving`. |
| **Confetti — combo 10+** | (não capturado em runtime) | Código em `confetti.js` respeita reduced-motion. Aceitar baseado em code review. |
| **Confetti — 100% rain** | (não capturado em runtime) | `openSessionEndModal` chama `rain({duration: 1500})` se isClean+xp>0. OK. |
| **Heatmap — contraste cells 0-4** | ⚠ desvio | Cell-0 e cell-empty idênticos. Cell-1 (alpha 0.15), Cell-2 (0.35), Cell-3 (0.6), Cell-4 (1.0) — gradação OK, mas o ponto baixo (0) está invisível. |
| **Heatmap — touch target** | ✓ alinhado | 55x55 (excessivo, mas certamente clicável). |
| **Heatmap — legenda Menos→Mais** | ✓ alinhado | 5 quadradinhos pequenos lado a lado. Funcional. |
| **Install prompt mobile** | ✓ alinhado | `design-17`. Bottom-fixed, ícone F, título, sub, botão Instalar, X dismiss. Aparece após 5s no mobile (não dispara no Playwright porque pointer:coarse=false). Não bloqueia jogo. |
| **Reduced-motion** | ⚠ desvio | CSS regra cobre só 4 seletores. JS faz o resto. Defensiva CSS poderia ser mais ampla. |
| **WCAG AA contraste** | ✓ alinhado | Texto principal #e8eaf0 sobre bg #0f1115: ~14:1. Texto-dim #9097a7 sobre bg-elev #161922: ~5.5:1 (passa AA pra texto normal). Cores semânticas (xp, streak, combo, levelup) todas >6:1 sobre bg. |
| **Touch targets ≥40px mobile** | ✗ desvio | mute 34x34, me 34x34, streak 46x30, level 76x32. Todos abaixo de 40px de altura. |
| **Componentes nativos SO** | ⚠ desvio | Emojis em mute/me/medalhas. Sem `<select>`/`alert()`/scrollbar nativa detectados. |

---

## Screenshots citados

- `design-01-home-desktop.png` — home inicial, topbar com chips
- `design-02-topbar-desktop.png` — topbar close
- `design-04-eu-empty-desktop.png` — /eu empty
- `design-05-eu-empty-full.png` — /eu full + heatmap grande
- `design-06-flashcards-start.png` — sessão de flashcards começando
- `design-08-combo-5-blue.png` — combo 5 azul
- `design-09-combo-10-orange.png` — combo 10 laranja
- `design-10-combo-20-red.png` — combo 20 vermelho-rosa
- `design-11-medal-tiers.png` — 4 tiers de medal toast
- `design-12-session-end-modal.png` — session end modal completo
- `design-13-home-mobile.png` — home mobile 375px
- `design-14-eu-mobile.png` — /eu mobile com dados
- `design-15-eu-with-data.png` — /eu desktop com dados
- `design-17-install-prompt.png` — install prompt mobile
- `design-19-topbar-final-desktop.png` — topbar com streak ativo

---

## Recomendação final

**Aceitar visual com pequenos ajustes.**

A sprint entrega o produto. A vibe arcade premium foi alcançada. A maior parte dos componentes (medal toasts, session-end-modal, combo overlay, topbar chips, install prompt) está em nível de produção. Os defeitos são pontuais e corrigíveis sem refazer:

**Prioridade 1 (Critical, ~3h dev):**
- Heatmap: reduzir cells para 12px conforme spec (ou ao menos 18-20px), differenciar cell-0 de cell-empty
- Lista "Decks que você joga": adicionar barra de progresso mini inline

**Prioridade 2 (Major, ~2h dev):**
- Level number na /eu: subir pra 56-72px
- Touch targets mobile: bump pra min-height 40px nos chips/botões da topbar
- Substituir emojis nativos (mute 🔊, perfil 👤) por SVGs já existentes
- Fix overflow do título no deck-card desktop

**Prioridade 3 (Minor, opcional):**
- Adicionar microcopy do combo ("Em chamas!", etc.) — ou aceitar a decisão de "só número" e remover da spec
- Avaliar troca dos emojis das 18 medalhas por SVGs custom (esforço alto, talvez sprint futura)
- Ampliar regras CSS `@media prefers-reduced-motion` defensivamente

Total estimado de ajustes: 6-8h. Vale fazer antes de promover qualquer feature nova em cima.
