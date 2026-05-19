# Flashy (quiz) — Progresso

Última atualização: 2026-05-19

> **Antes de qualquer trabalho neste repo, ler `CONCEPTS.md`** — visão de produto,
> princípios e decisões estratégicas. Este arquivo aqui é o estado operacional.

## Produção

- **URL:** https://quiz.did.lu
- **Repo:** https://github.com/mr-velvet/quiz (branch `master`)
- **Porta interna:** 5034
- **Container:** Node 20 + Express servindo build do Vite em `public/`
- **Health:** `GET /api/health` → `{"status":"ok","service":"quiz"}`
- **TTS:** `POST /api/tts` `{text, lang?}` → URL no GCS (cache compartilhado)
- **Deploy:** `cd ~/ved/devops-workflow-2026 && .\scripts\did.ps1 deploy quiz`
- **Pasta local:** `~/ved/quiz/`

### Env vars necessárias em produção
- `OPENAI_API_KEY` — pro TTS (tts-1).
- `GCS_BUCKET` — default `didlu-imagestore` (não setar se for o padrão).
- Token de upload GCS: via metadata server da VM GCP (Application Default Credentials).
  Em dev local: `gcloud auth print-access-token` → `GCP_ACCESS_TOKEN` env.

> Bug conhecido: `add-env-vars.sh` da plataforma did.lu duplicou `PORT` no
> docker-compose.yml no primeiro deploy. Foi corrigido manualmente. Verificar no
> próximo deploy se persiste.

## Estado atual — implementado

### MVP
- Home + criação de deck via texto (TAB/`;`/` - `/`,` auto-detecta).
- Modal custom (sem `confirm()`/`alert()`).
- Hash router com cleanup registry + `replay()`.
- 2 decks seed (capitais SA, vocabulário en↔pt).
- Atalhos consistentes nos 5 modos.
- Mobile responsivo (breakpoints 600/480).
- Persistência via `localStorage` chave `flashy:v1`.

### Modos de jogo (5)
1. ✓ Flashcards clássico — atalhos `espaço/1/2/←→/S`
2. ✓ Múltipla escolha — `1-4/S`
3. ✓ Escrever (typo tolerante Levenshtein) — `Enter/Alt+S`
4. ✓ Match grid 4×3 — `1-4/Q-R/A-F`
5. ✓ Speed round 60s — `Enter/1-4`

### TTS (recém-entregue)
- Backend `server/tts.js`: OpenAI `tts-1`, cache GCS `didlu-imagestore/quiz/tts/<hash>.mp3`.
- URL pública via `st.did.lu/quiz/tts/<hash>.mp3` (DNS curto).
- Hash determinístico = `sha256(model|voice|lang|text).slice(0,24)`. Cache global
  entre usuários (decks compartilham mp3 quando texto é igual).
- Detecção de idioma no client (`detectLang`/`detectDeckLang`) com hint de acentos +
  palavras frequentes. Escolhe voz: alloy/nova/shimmer/onyx/echo.
- Botão speaker em: lista de cartas do deck (front + back), flashcards (na carta),
  MC (ao lado do prompt), Write (ao lado do prompt + resposta após resultado).
- Atalho `S` em flashcards/MC. Em Write é `Alt+S` (pra não bloquear digitação).
- Match e Speed **não têm áudio por design** — Match colide com tecla S como tile,
  Speed é modo adrenalina onde áudio interromperia o flow.

### Testado via Playwright (versões TTS)
- TTS gera mp3 e cacheia no GCS ✓
- Segunda chamada com mesmo texto: `cached: true`, instantâneo ✓
- URL pública st.did.lu retorna 200 com `audio/mpeg` ✓
- Botões speaker visíveis em todos os contextos ✓
- Atalho `S` em flashcards dispara request ✓

---

## Sprint atual: Gamificação (aguardando OK do user pra começar)

**Status:** plano desenhado. Implementação **não** começada. User pediu pra
documentar e esperar.

### Princípios da gamificação (de `CONCEPTS.md`)
1. Recompensar velocidade E precisão.
2. Combo/streak é o coração.
3. XP/nível é progressão lenta — não inflar.
4. Não punir erro brutalmente.
5. Recordes locais primeiro.
6. Lembrete diário opcional.

### Sistema de pontuação (proposta)

Cada acerto rende:
```
pontos = base × multiplicadorCombo + bônusTempo
```

**Base por modo** (reflete dificuldade intrínseca):
| Modo | Base |
|------|------|
| Flashcards | 10 (julgamento próprio é fácil) |
| MC | 20 |
| Match | 30 (por par) |
| Speed | 15 (já tem pressão de tempo) |
| Escrever | 40 (mais difícil) |

**Bônus tempo** (encoraja velocidade sem matar quem pensa):
- MC/Speed: resposta em <1s → +20; <2s → +10; <4s → 0.
- Escrever: <3s → +25; <6s → +15; <12s → 0.
- Match (por par): <2s → +20; <5s → +10; depois 0.
- Flashcards: sem bônus tempo (modo reflexivo).

**Combo/streak**:
- Acerto: `multiplicadorCombo = 1 + min(streak × 0.1, 2)` → cap 3x em 20 streaks.
- Erro: reseta streak pra 0. Não tira pontos.
- Mostrar visualmente: `2x`, `5x — combo!`, `10x — em chamas 🔥`, `20x — perfeito ⚡`.

**XP** = soma de todos os pontos. Persiste por device.
- Níveis: 1k, 2.5k, 5k, 10k, 20k, 40k, 75k, 130k, 220k, 400k... (curva ~×1.8).
- Subir de nível: animação cheia, som curto, badge no topbar.

### Medalhas (10 iniciais)
1. **Primeira sessão** — completou 1 modo.
2. **Estudioso** — 7 dias com pelo menos 1 sessão.
3. **Maratonista** — 30 dias com pelo menos 1 sessão.
4. **Match relâmpago** — match com 6 pares em <15s.
5. **Sem erros** — sessão de 12+ cards sem errar.
6. **Combo épico** — 20+ acertos seguidos em qualquer modo.
7. **Velocista** — 30+ acertos em Speed round.
8. **Polyglot** — usou áudio em 4+ idiomas diferentes.
9. **Criador** — criou 5 decks.
10. **Veterano** — alcançou nível 10.

### Streak diário
- Track de dias consecutivos com pelo menos 1 sessão completa.
- Topbar mostra `🔥 3 dias` se streak ativo.
- Notificação opcional (Notification API do browser):
  - Pedir permissão só depois de 3 dias de uso (senão é spam).
  - Lembrete único às 19h se ainda não estudou hoje.

### Sons
- Acerto: tom curto leve (não bater no padrão "achievement mobile").
- Combo milestone (5x/10x/20x): som mais cheio, riser curto.
- Erro: sem som (não punir).
- Geração: usar `sfx-gen` do toolbelt OU sintetizar via `AudioContext` direto.
- Mute toggle no topbar (persistir em localStorage).

### Onde isso vive no código
- **Novo:** `src/core/score.js` — fórmulas, persistência de XP/nível/medalhas.
- **Novo:** `src/core/sfx.js` — sons curtos.
- **Modificar:** cada modo de jogo (registrar acerto/erro → score).
- **Modificar:** topbar.js — mostrar streak, nível, XP da sessão.
- **Novo:** `src/ui/profile.js` — telinha de perfil com medalhas, histórico, streak.

### Schema de persistência (extensão de `flashy:v1`)
```js
{
  decks: { ... },
  order: [...],
  profile: {                       // NOVO
    xp: 0,
    level: 1,
    streak: { days: 0, lastSessionAt: 0 },
    medals: [],                    // ids das conquistadas
    counters: { sessions, decksCreated, langsUsed: [] },
    settings: { mute: false, notifications: 'unasked' }
  }
}
```

### Ordem de implementação proposta
1. `score.js` + persistência básica (XP, sem UI).
2. Integração em flashcards/MC/Write/Match/Speed (registrar pontos).
3. UI de combo durante o jogo (numerinho subindo, milestone visual).
4. Topbar: XP da sessão + nível.
5. Tela de resultado pós-jogo: total de pontos, combo máximo, novo nível?
6. Streak diário + topbar fire icon.
7. Medalhas (10 iniciais) + página de perfil.
8. Sons (após visual estar 100% — sons polidos não maquilam UX ruim).
9. Notification API (último — depende de prova de hábito).

---

## Backlog pós-gamificação

### Alta
- Modo Escrever bidirecional.
- Continuar de onde parou (não perde sessão ao sair).
- Match difícil (10-12 pares).

### Média
- Renomear `records` → `localRecords` antes de sync.
- `aria-live` em feedbacks de Write/MC.
- Busca de cartas no deck quando >30.
- Edição manual de card individual.

### Baixa / depois
- SRS (Anki-like).
- Login (Logto did.lu) + claim de localStorage.
- Sync entre devices.
- Pastas (Folder).
- Compartilhar deck por link público.
- Validação de conteúdo (anti-spam).
- Ranking global.

---

## Riscos / pontos de atenção

- **OpenAI key:** chave única do toolbelt do user (conta pessoal). Custo TTS:
  ~$0.015/1k chars. Cache global no GCS amortiza muito — 1 card popular gera só
  uma vez pra todos os usuários.
- **GCS upload via metadata server:** funciona na VM did.lu nativamente. Em dev
  local, precisa `gcloud auth print-access-token` → `GCP_ACCESS_TOKEN` env.
- **Migração localStorage → sync:** chave já versionada (`flashy:v1`).
- **IDs:** `Math.random + Date.now`. Trocar pra UUID quando sync entrar.
- **`records` local:** renomear pra `localRecords`.
- **TTS sem rate limit no backend:** se virar problema, adicionar por IP.
- **Audio cache no card:** se OpenAI muda voz ou bucket some, URLs guardadas
  apontam pra 404. Bom ter retry que regenera nesse caso.

---

## Como rodar local

```bash
npm install
npm run dev    # vite, sem backend
```

Pra testar TTS local (precisa backend):
```bash
npx vite build && rm -rf public && mv dist public
export OPENAI_API_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('C:/Users/manu/dev/universal-toolbelt/.api-keys.json')).openai.api_key)")
export GCP_ACCESS_TOKEN=$(gcloud auth print-access-token | tr -d '\r\n')
PORT=5034 node server.js
```
