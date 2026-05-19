# Flashy (quiz) — Progresso

Última atualização: 2026-05-19

## Produção

- **URL:** https://quiz.did.lu
- **Repo:** https://github.com/mr-velvet/quiz (branch `master`)
- **Porta interna:** 5034
- **Container:** Node 20 + Express servindo build do Vite em `public/`
- **Health:** `GET /api/health` → `{"status":"ok","service":"quiz"}`
- **Deploy:** `cd ~/ved/devops-workflow-2026 && .\scripts\did.ps1 deploy quiz`
- **Pasta local:** `~/ved/quiz/` (renomeada de `~/ved/simple-flash-cards/`)

> Observação técnica do deploy inicial: o `new-app.sh` da plataforma teve
> sucesso, mas o `add-env-vars.sh` (passo 2/5 do `deploy.sh`) duplicou a chave
> `PORT` no `docker-compose.yml`, quebrando o passo seguinte. App ficou rodando
> normalmente; YAML foi corrigido manualmente removendo a linha duplicada.
> Próximo deploy: verificar se o bug se repete e reportar pro mantenedor da
> plataforma se sim.

## Visão de produto

Aplicativo de flashcards anti-Quizlet: **simples, fluido, gratuito, sem burocracia**.
Foco em criar e estudar. Forte em modos de jogo de memorização.

### Princípios (regem TUDO)
1. **Criar e estudar sem fricção** — duas palavras-chave.
2. **Anônimo nativo** — não pede login pra nada essencial.
3. **Volume importa** — importação por texto (TAB ou ;) é a forma principal.
4. **Agnóstico** — biologia, política, idiomas, qualquer assunto.
5. **Jogos > cartões parados** — modos de jogo são onde ganha do Quizlet.
6. **Sem componentes nativos** — nada de `<select>` cru, `alert()`, scrollbar do SO.

## Estado atual

**MVP completo e testado visualmente.** Dev server em `http://localhost:5173`.

### Stack
- HTML/CSS/JS vanilla + Vite 5
- Persistência: `localStorage` chave `flashy:v1`
- Sem backend, sem login. Pronto pra hospedar como estático.

### Estrutura
```
src/
  main.js            — entry
  styles.css         — design system (dark, accent #ffd166)
  core/
    store.js         — Card / Deck / Folder, parseImport, seeds
    util.js          — shuffle, levenshtein (typo tolerante), DOM helper
  ui/
    router.js        — hash router, cleanup registry, replay()
    topbar.js, home.js, deck.js, modal.js (custom — sem confirm())
  games/
    flashcards.js    — virar carta, sei/não sei (atalhos 1/2/espaço)
    multiple-choice.js — 4 opções (atalhos 1-4)
    write.js         — digita resposta, tolera typo via Levenshtein
    match.js         — grid 4x3, pares termo/definição (atalhos 1-4 Q-R A-F)
    speed.js         — 60s, múltipla escolha rápida (Enter pra começar)
```

### Decisões já tomadas
- Importação aceita TAB, `;`, ` - `, e (fallback) `,` — auto-detecta.
- Modal de criar deck mostra exemplo direto no placeholder (3 linhas).
- Match com 6 pares por padrão (12 tiles, grid 4×3) com atalhos posicionais.
- Speed com timing 500ms entre questões (estava 280ms, agente reclamou).
- "Jogar de novo" usa router.replay() (não location.reload).
- Cleanup registry no router pra listeners de teclado não vazarem entre re-renders.
- Mobile: breakpoints em 600px e 480px (fc-card, fc-controls, mc-options, match-grid).
- Semântica: `<main role="main">`, favicon SVG inline.

### Testado via Playwright
- Home → criar deck → fluxo completo ✓
- Flashcards: flip espaço + 1/2 ✓
- Múltipla escolha: feedback verde correto ✓
- Match: par Argentina+Buenos Aires acende verde, timer inicia ✓
- Write: typo "sucri" aceito como "Sucre" (Levenshtein) ✓
- Speed: Enter inicia, timer 59s ✓
- Deck novo "Elementos químicos" criado end-to-end ✓

### Modos de jogo (MVP) — todos prontos
1. ✓ Flashcards clássico
2. ✓ Múltipla escolha
3. ✓ Escrever (typo tolerante)
4. ✓ Match grid (foco do user)
5. ✓ Speed round (60s)

## Backlog (priorizado a partir das revisões dos agentes)

### Alta — bom de pegar logo
- **Modo Escrever bidirecional.** Hoje só pergunta front→back. Decks de capitais/idiomas perdem metade.
  Sugestão: toggle "inverter" no card de modo OU randomizar direção quando deck parecer bidirecional.
- **Speed com combo/streak visual.** Hoje é "MC com timer". Mostrar "3x seguidas!" / "5x!" pra diferenciar.
- **Continuar de onde parou.** Sair no meio perde o progresso da sessão.
- **Match difícil (10-12 pares).** Hoje é fixo em 6.

### Média
- **Renomear `records` para `localRecords`** antes de sync entrar (evita refactor).
- **`aria-live` em feedbacks** de Write/MC pra leitores de tela.
- **Hint visual no modo Flashcards ao apertar 1/2 antes de virar.** *Feito* (shake + flip automático), mas pode melhorar com tooltip.
- **Busca de cartas dentro do deck** quando passar de ~30.

### Baixa / depois
- **SRS** (spaced repetition) — Anki-style por card stats.
- **Login** (e-mail código, Google via Logto did.lu) — estratégia de "claim" do localStorage existente.
- **Sync entre devices.** Quando entrar, IDs viram UUID, `localRecords` separa de globais.
- **Pastas (Folder)** — agrupar decks.
- **Compartilhar deck por link público.**
- **Validação de conteúdo** (anti-spam, normalização).
- **Ranking global** (precisa backend + validação).
- **Edição manual de card individual** (existe a infra, falta UI).

## Riscos sinalizados pelos agentes

- **Migração localStorage → sync.** Chave já versionada (`flashy:v1`). Bom.
- **IDs:** `Math.random + Date.now`. Improvável colidir, mas trocar pra UUID quando sync entrar.
- **`records` local vs global:** renomear pra `localRecords` proativamente.
- **Login depois de uso anônimo:** decidir UX de "claim" antes de implementar auth.

## Como rodar
```
npm install
npm run dev
```
Abre em `http://localhost:5173`. Seeds com 2 decks (capitais sul-americanas, vocabulário inglês).
