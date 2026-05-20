# DECISÕES — Sprint Gamificação

Decisões batidas com o user (2026-05-20) que selam diferenças entre PRODUCT-SPEC,
UX-SPEC e DEV-PLAN. Quando há conflito, este arquivo manda.

---

## Decisões batidas com o user (round 1)

- **Vibe:** Arcade satisfatório premium (Duolingo/Quizlet, nunca Candy Crush).
- **Mecânicas long-term:** as 4 — streak diário + XP por deck + XP global + medalhas.
- **Onde aparece:** topbar discreta (sempre) + tela `/eu` (perfil/stats).

## Decisões batidas com o user (round 2)

- **Curva XP global:** PRODUCT-SPEC §3.6 (Nv2=100, Nv5=1k, Nv10=16k, Nv20=120k, Nv50=3M). Hardcoded em `server/gamification.js` num único objeto pra tweak rápido.
- **Streak grace:** sim, 1 dia/semana de grace. Pular 1 dia não quebra. Implementação: streak conta se "último dia válido" estiver dentro das últimas 48h.
- **Som default:** ON em desktop / OFF em mobile (detect via `window.matchMedia('(pointer:coarse)')` ou ua).
- **Sons:** gerar tudo via `sfx-gen` (toolbelt) na própria sprint. 7-12 sons curtos em `public/sounds/`.

## Decisões internas (consolidando conflitos das specs)

- **Nome da tela perfil:** `/eu` (rota `#/eu`).
- **Lista de medalhas:** 18 do PRODUCT-SPEC §3.8 (não as 14 da UX). Retroativas pós-deploy, com empilhamento (toast 1 a 1, max 3 visíveis simultâneo, resto em consolidated toast).
- **Heatmap:** 30 dias (alinha com PRODUCT §5.6 e default do endpoint stats; UX queria 90 mas começamos enxuto, expandir se for útil).
- **Combo cap:** ×2.0 em combo 30+ (PRODUCT-SPEC §3.3). UX dizia ×3.0 mas Produto manda.
- **XP base por modo:** Flashcards 5, MC 10, Match 8, Speed 6, Write 20 (PRODUCT §3.1).
- **Modificador de dificuldade:** card novo ×1.0, aprendendo ×1.5, dominado ×0.5 (PRODUCT §3.2).
- **Bônus 100%:** +50 XP em sessão (≥10 cards) / +100 XP em deck inteiro.
- **Streak corte:** 04:00 do fuso local do user.
- **Anti-cheat:** confiar no client por ora (sem ranking). Server valida `duration_ms`, capa XP/sessão em 5000.
- **POST /event no client:** buffer no cliente, envia só no finish. Endpoint /event existe pra flush periódico em sessões >5min (defensivo).
- **Backend autoritativo:** XP/medalhas calculados server-side no finish. Cliente antecipa visualmente só medalhas óbvias (combo X, primeira sessão); medalhas dependentes de fim (streak_N, novo recorde) NUNCA antecipam.
- **Bus de eventos:** canal próprio em `events.js`, não usar `flashy:change` (loop infinito conhecido). Stats emite `flashy:stats-change`.
- **Confetti:** custom em canvas leve (≤80 partículas mobile, ≤150 desktop), sem lib externa. Auto-pause em `document.hidden`. Reduced-motion → fade.
- **Reduced-motion:** desliga confetti/partículas/movimento, mantém cor e número final.
- **a11y:** aria-live polite na topbar XP (uma anúncio por sessão, não por acerto). Toast medalha tem role=alert.
- **Persistência stats:** somente backend. Cliente em memória + sync. Exceção: `sfx-volume` e `sfx-muted` em localStorage (preferência, não estado).

## Decisão adicional: PWA + install prompt mobile

User pediu também tornar PWA + mostrar botão "Adicionar à tela inicial" ao entrar pelo mobile.

- **Manifest:** `public/manifest.json` com nome, ícones (192, 512), theme color, display=standalone.
- **Service worker:** registrar SW básico (cache-first pra assets estáticos + offline fallback simples). Sem cache de API.
- **Ícones:** gerar via `imagen-gen` ou desenhar SVG → exportar 192x192, 512x512, e variantes maskable.
- **Install prompt:**
  - Android/Chrome: capturar `beforeinstallprompt`, mostrar banner custom inferior com CTA. Dismiss persiste em localStorage por 30 dias.
  - iOS Safari: detectar via UA + `(navigator.standalone === false)`. Mostrar dica "Toque em Compartilhar → Adicionar à Tela Inicial" com ícone Safari.
  - Desktop: sem prompt (não pediu).
- **Quando aparecer:** primeira visita mobile, após 5s de uso (não interrompe abertura). Fechável.
- **Onde:** `src/ui/installPrompt.js` novo, montado em `main.js` após bootstrap.

## Ordem de implementação (1 turno só, em paralelo onde der)

1. Migration `003_gamification.sql` (tabelas + catálogo 18 medalhas).
2. `server/gamification.js` (fórmulas puras).
3. `server/routes/sessions.js` + `stats.js`.
4. Cliente: `core/events.js` + `core/stats.js` + `core/medals.js` + `core/sessionLoop.js` + `core/sfx.js`.
5. Topbar redesign + chips (streak, XP, mute).
6. Componentes visuais: confetti, comboOverlay, medalToast, xpCounter, sessionEndModal.
7. Integração em todos os 5 games.
8. Tela `/eu` (header + heatmap 30d + medalhas + decks).
9. Sons via `sfx-gen` → `public/sounds/`.
10. PWA: manifest + SW + ícones + installPrompt.
11. Debug hooks + data-testids da QA-PLAN.
12. Deploy + QA E2E + ajustes.
