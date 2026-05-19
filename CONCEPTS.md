# Flashy — Conceitos e Princípios

Documento de referência para qualquer agente (humano ou IA) que vai trabalhar no Flashy.
Lê isto **antes** de tocar em código ou propor feature. Atualizar quando uma decisão
estratégica mudar (não pra cada feature nova).

Última revisão: 2026-05-19

---

## Mentalidade do produto

Flashy é o **anti-Quizlet**:
- Quizlet é paywall em cada esquina, login forçado, anúncios, UX pesada.
- Flashy é gratuito, anônimo nativo, sem fricção, sem login pra usar.
- Foco: **criar deck rápido → estudar rápido → ficar viciado nos jogos**.

O diferencial competitivo não é "mais um app de flashcards". É **o melhor lugar pra
quem quer transformar uma lista de pares em um jogo viciante de memorização**, com
qualidade de produto que faz a pessoa querer voltar amanhã.

### 6 princípios que regem TUDO

1. **Criar e estudar sem fricção.** Importação por texto > formulário card-a-card.
   Qualquer fluxo que custe mais de 30s pra primeira sessão é falha de design.
2. **Anônimo nativo.** localStorage primeiro, login depois (e opcional). Quem nunca
   criou conta deve conseguir estudar, jogar, bater recorde, e voltar amanhã com tudo
   intacto no mesmo navegador.
3. **Volume importa.** Decks têm 50, 200, 1000 cards. Importação em massa é o caminho
   principal. UI individual por card existe mas é exceção.
4. **Agnóstico de conteúdo.** Capitais, vocabulário, biologia, política, leis, vinhos.
   Nada no produto pode presumir um domínio específico.
5. **Jogos > cartões parados.** Os modos de jogo são onde se ganha do Quizlet. Cada
   modo precisa ter feel próprio, feedback bom, e ser viciante por si só.
6. **Zero componentes nativos.** `<select>`, `alert()`, `confirm()`, scrollbar do SO,
   focus ring azul, tooltip `title=""` — proibidos. Tudo custom.

### O que NÃO é Flashy
- Não é Anki. Não vamos competir em SRS científico — SRS entra como feature, não como
  identidade. Anki é ferramenta de estudo profundo; Flashy é jogo de memorização rápido.
- Não é plataforma social. Compartilhar deck por link público vai existir, mas perfis,
  follows, feed — fora de escopo.
- Não é LMS. Sem cursos, sem progresso curatorial, sem certificados.

---

## Modelo de dados

```
Folder (futuro) → contém múltiplos Decks
Deck → { id, name, createdAt, cards[], localRecords{ match, speed }, stats? }
Card → { id, front, back, stats: { correct, wrong, lastSeenAt }, audio?: { front, back } }
```

- **Persistência atual:** `localStorage` chave `flashy:v1`.
- **IDs:** `Math.random + Date.now`. Trocar pra UUID quando sync entrar.
- **`localRecords`** (renomear de `records` antes de sync) — recordes locais por device.
  Quando login + sync entrar, separar de `globalRecords`.

### Card.audio (TTS — ver seção dedicada)
```
audio: {
  front: { url, lang, hash, generatedAt },
  back:  { url, lang, hash, generatedAt }
}
```
URLs apontam pro GCS (`st.did.lu/quiz/tts/<hash>.mp3`). Geração on-demand, cache
permanente. Ver seção TTS.

---

## Modos de jogo

Cinco modos no MVP. Cada um deve ter **identidade própria** — não pode ser "o mesmo
modo com timer".

| Modo | Identidade | Atalhos |
|------|-----------|---------|
| Flashcards | Reflexão. Vê o cartão, vira, julga a si mesmo. Sem pressão. | espaço (vira), 1/2 (não sei/sei), setas |
| Múltipla escolha | Reconhecimento. 4 opções, escolhe. Velocidade média. | 1-4 |
| Escrever | Produção ativa. Digita a resposta. Mais difícil, mais recompensador. | Enter (envia/avança) |
| Match grid | Pareamento espacial. Conecta termo↔definição clicando em pares. **Foco do user.** | 1-4 / Q-R / A-F |
| Speed | Adrenalina. 60s, MC rápida, bater recorde. | 1-4, Enter (inicia) |

### Princípios por modo
- **Não inventar mecânica nova sem testar.** Cada modo passou por iteração; mudar é
  fácil, equilibrar é difícil.
- **Atalhos consistentes:** 1-4 sempre vale como "primeira opção" → "quarta opção".
- **Feedback rápido:** acerto/erro mostra em ≤150ms.
- **Transição entre cards:** 500-850ms (testado — menos é estressante, mais é lento).
- **Áudio:** todo modo deve permitir ouvir o card via `S`.

---

## TTS — Áudio dos cards

### Por quê
- Decks de idioma (vocabulário, frases) precisam pronúncia correta.
- Decks de termos científicos/técnicos: ouvir reforça memorização.
- Acessibilidade.
- Diferencial vs Quizlet (que tem TTS mas mecânico, sem cache compartilhado).

### Como funciona

**Servidor:** endpoint `POST /api/tts` recebe `{ text, lang? }`, gera hash determinístico
`sha256(text + lang + voice + model)`, checa se `gs://didlu-imagestore/quiz/tts/<hash>.mp3`
existe. Se sim, retorna URL `https://st.did.lu/quiz/tts/<hash>.mp3`. Se não, gera com
OpenAI TTS (`tts-1`, voice `alloy`), salva no GCS, retorna URL.

**Cliente:** ao tocar áudio pela primeira vez, faz request, recebe URL, cacheia URL
no card (`card.audio.front.url`). Próximas vezes toca direto sem nem chamar o backend.

### Por que esse design
- **Cache global compartilhado:** se 1000 usuários têm "Buenos Aires" no deck, geramos
  o áudio UMA vez. Custo desprezível em escala.
- **GCS sobre filesystem:** sobrevive a deploys (container é stateless).
- **OpenAI sobre browser nativo:** qualidade consistente, multilingual real, sem
  dependência da voz do SO do usuário.

### Detecção de idioma
Heurística simples no client (caracteres + lista de palavras frequentes por idioma).
Suficiente pra escolher voz adequada. Se ambíguo, default `en`.

Idiomas suportados no MVP: en, pt, es, fr, de, it. (OpenAI TTS detecta sozinho a partir
do texto, mas explicitar ajuda escolher voz e debug.)

### Custo estimado
- `tts-1`: $0.015 / 1k caracteres.
- Card típico: 30 chars → $0.00045 por card novo.
- 1000 cards novos = $0.45.
- Cache hit = $0.

---

## Gamificação (em desenho — não implementado)

Ver `PROGRESS.md` seção "Sprint gamificação" pro plano detalhado e estado atual.

### Princípios de gamificação
1. **Recompensa por velocidade E precisão.** Não dá pra recompensar só uma — quem
   acerta tudo lento perde, quem chuta rápido perde mais.
2. **Combo/streak é o coração.** Bater 10 seguidas tem que parecer um evento.
3. **XP/nível é progressão lenta.** Não inflar com pontos baratos. Bater nível tem que
   ser conquista real (vários dias de uso).
4. **Não pune erro brutalmente.** Erro reseta combo, não tira XP. Frustração mata uso.
5. **Recordes locais primeiro.** Bater seu próprio recorde > ranking global (que vem
   muito depois).
6. **Lembrete diário opcional.** Notification API do browser. Streak de dias.

### Sistema base (regras-mãe)
- Cada acerto: `pontosBase + bônusTempo + multiplicadorCombo`.
- `pontosBase`: 10 (flashcards), 20 (MC), 40 (escrever), 30 (match), 15 (speed).
- `bônusTempo`: linear até cap. Ex: MC respondida em <2s = +20, 5s = 0.
- `multiplicadorCombo`: 1x base, +0.1 por acerto consecutivo, cap 3x em 20 streak.
- XP: pontos totais da sessão. Níveis crescem exponencial (1k, 2.5k, 5k, 10k, ...).

(Detalhes finais ficam em `PROGRESS.md` aguardando OK do user.)

---

## Anti-padrões (PROIBIDO)

Vindos de regras gerais + aprendizados deste projeto:

- ❌ `<select>` nativo, `<input type=date>` nativo, `alert()`, `confirm()`, `prompt()`.
- ❌ Scrollbar do SO (sempre `::-webkit-scrollbar`).
- ❌ Web Speech API pra TTS (qualidade ruim, voz inconsistente).
- ❌ Whisper no client (usar API).
- ❌ Frameworks (React/Vue/Svelte) — vanilla é parte da identidade técnica.
- ❌ Bibliotecas pesadas. Cada dep nova tem que justificar.
- ❌ Pontuação que pune erro brutalmente (tirar XP, resetar nível).
- ❌ Forçar login pra qualquer feature core.
- ❌ Anúncios. Nunca.
- ❌ "Achievement unlocked" som genérico de jogo mobile barato.

---

## Stack técnica e razões

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Build | Vite 5 | Zero config, ESM nativo, dev server instantâneo |
| Front | Vanilla HTML/CSS/JS | Sem dep, sem build complexo, sem framework lock-in |
| DOM helper | `el(tag, props, children)` em `util.js` | Substituto leve de JSX |
| Router | Hash router custom (`router.js`) | SPA sem `history.pushState` (simplifica deploy) |
| Estado | `localStorage` | Anônimo nativo, zero backend pro MVP |
| Persistência futura | Postgres na VM did.lu | Já existe infra, sem custo marginal |
| Backend | Node 20 + Express | Suficiente, mantenível, alinhado com did.lu |
| Hospedagem | did.lu (VM GCP + Caddy + Docker) | Padrão deste workspace, HTTPS auto |
| TTS | OpenAI tts-1 + cache GCS | Qualidade > nativo, cache amortiza custo |
| Auth (futuro) | Logto did.lu | Já integrado na plataforma |

---

## Backlog estratégico (visão de longo prazo)

Em ordem de impacto, não de ordem de implementação:

1. **Gamificação completa** (combo + XP + medalhas + lembretes) — está sendo planejado.
2. **TTS** — em implementação.
3. **SRS opcional** (modo "estudo profundo" com algoritmo Anki-like).
4. **Login + sync** (e-mail código ou Google via Logto, com "claim" do localStorage).
5. **Compartilhar deck por link público** (read-only ou clone).
6. **Folders** agrupando decks.
7. **Edição manual de card** (UI; infra existe).
8. **Validação de conteúdo** (anti-spam quando deck público existir).
9. **Ranking global** (precisa backend + anti-fraude).
10. **Apps mobile** (Capacitor sobre o mesmo código, se PWA não bastar).

---

## Como contribuir (humano ou agente)

1. Ler este arquivo até o final.
2. Ler `PROGRESS.md` da pasta (estado atual + sprint atual).
3. Antes de propor feature nova, perguntar: **viola algum princípio?**
4. Antes de mudar mecânica de jogo, perguntar: **passou por iteração já?**
5. Antes de adicionar dep ou framework, perguntar: **justifica?**
6. Após implementar, rodar agentes paralelos de revisão (produto + técnico + visual).
7. Deploy via `did.ps1 deploy quiz`.
