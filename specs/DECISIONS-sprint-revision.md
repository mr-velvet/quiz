# DECISÕES — Sprint Revisão

Decisões batidas com o user (2026-05-21) que fundam a sprint de lista de
cards pra revisar. Quando houver conflito com outras specs (UX-SPEC,
DEV-PLAN futuros), este arquivo manda.

---

## Decisões batidas com o user (formalizadas desta conversa)

- **Decisão:** Modelo de dados é UMA lista por par (user_id, deck_id),
  many-to-many entre users e decks. Razão: a sessão de revisão é por
  contexto (revisar um deck específico, não "tudo que marquei na vida");
  lista global vira inbox sem manutenção. Alternativa rejeitada: lista
  global única por user, com filtro por deck — adiciona complexidade de
  UI sem ganho real.

- **Decisão:** O vínculo é DO USER, não do deck. Funciona em deck público
  de outro também — minha lista no deck de terceiro é minha sombra
  privada, dono não vê nem é notificado. Razão: preserva privacidade do
  meu trabalho de aprendizado e evita criar canal social implícito.
  Alternativa rejeitada: limitar revisão a decks próprios — quebra o
  caso de uso mais comum (estudar deck público alheio e querer marcar
  cards difíceis).

- **Decisão:** Menu contextual de marcar/desmarcar aparece em 4 lugares:
  (a) lista de cards na tela do deck, (b) durante os modos de jogo após
  a resposta, (c) no `sessionEndModal` na lista de erros (com atalho
  "marcar todos os erros"), (d) Explore / deck público de outro. Razão:
  cobre todos os momentos cognitivos em que o user pensa "esse card eu
  quero revisar". Alternativa rejeitada: só na lista do deck — exigiria
  o user lembrar de voltar e procurar o card depois.

- **Decisão:** A sessão de revisão NÃO é um modo novo. Reusa os 5 modos
  existentes (Flashcards, MC, Match, Speed, Write). O diferencial é
  apenas o conjunto de cards (só os marcados). Razão: zero código novo
  de modo, zero curva de aprendizado pro user. Alternativa rejeitada:
  modo "revisão" próprio com mecânica única — viola CONCEPTS §"Não
  inventar mecânica nova sem testar".

- **Decisão:** Sessão de revisão dá XP normal, conta pro streak diário,
  e participa de todas as medalhas existentes. Bônus de 100% sessão
  (+50 XP) vale só se ≥10 cards (regra preexistente preservada). Bônus
  de "deck inteiro" (+100 XP) NÃO se aplica porque a sessão de revisão
  por definição não joga o deck inteiro. Razão: tratar revisão como
  cidadã de primeira classe do `sessionLoop`; isolar incentivos
  específicos da revisão na medalha nova. Alternativa rejeitada: XP
  reduzido em revisão pra evitar farm — contraproducente, revisão é
  exatamente o comportamento que queremos premiar.

- **Decisão:** 1 medalha nova: "Mestre da revisão" (`revision_master`,
  tier gold, categoria performance) — completar 50 cards de revisão
  lifetime acertando todos (soma de `correct` em `study_sessions` com
  `meta.source = 'revision'` e `wrong = 0`). Razão: dá pulso de
  progressão sem inflar catálogo. Alternativa rejeitada: 3–5 medalhas
  escalando (10, 25, 50, 100, 250) — pra feature simples e nova, 1
  medalha aspiracional cobre; expandir só se a feature pegar.

- **Decisão:** CTA "Revisar marcados (N)" na tela do deck aparece só
  quando N≥1; some quando N=0. Razão: não criar UI pra estado morto e
  evitar ruído visual de botão desabilitado. Alternativa rejeitada:
  botão sempre visível com hint "marque cards pra começar" — vira
  noise pra quem nunca vai usar.

- **Decisão:** Em deck público de terceiro que VIRA PRIVADO depois, o
  vínculo na tabela `card_reviews` é PRESERVADO mas fica invisível pro
  user via filtro de visibilidade (deck não é mais acessível). Se voltar
  a ser público, reaparece. Razão: o user não causou a mudança e a
  lista é trabalho dele — apagar seria hostil. Alternativa rejeitada:
  apagar a lista no instante que o deck vira privado — perda silenciosa
  de trabalho.

## Decisões já tomadas em contexto adjacente (reafirmadas)

- **TTS migração:** OpenAI tts-1 → Google Cloud TTS Standard é outra
  task. Fora do escopo desta sprint. Razão: separação de concerns —
  feature de revisão não depende de áudio e a migração de TTS afeta
  decks inteiros, não a lista.

- **Anonymous_id behavior:** mesma lógica das outras tabelas. Vínculo
  pertence ao `user_id`; limpar cookies = perde lista junto com decks,
  XP, streak, medalhas. Aceitável até login (Logto). Claim no login
  futuro deve incluir `card_reviews` como parte da migração de dados
  anônimo→logado (DEV-PLAN futuro deve confirmar).

- **CASCADE em delete de card e deck:** alinhado com convenção de
  CASCADE já usada em `cards`, `deck_stats`, `study_sessions`. Sem soft
  delete em `card_reviews`.

## Decisões internas (defaults sem ambiguidade pra Dev)

- **Migration:** `005_revision_list.sql`. Não modifica nenhuma migration
  existente. Update da medalha pode entrar via `INSERT … ON CONFLICT`
  na própria 005 ou em arquivo separado — preferência: dentro da 005
  pra manter coesão da sprint.

- **PK:** `(user_id, card_id)` — idempotente. Marcar card já marcado é
  no-op.

- **Coluna `deck_id` denormalizada:** sim, redundante com
  `cards.deck_id`, mas evita JOIN em queries muito frequentes (contagem
  N pra CTA, listagem por deck). Trade-off aceito: sincronização
  garantida pelas FKs (card só existe num deck).

- **Coluna `source` (TEXT):** opcional, livre. Valores sugeridos:
  `manual_deck`, `session_wrong`, `session_end_modal`, `explore`. Pra
  telemetria, não pra lógica.

- **Snapshot mid-sessão:** a lista é "fotografada" no start da sessão.
  Desmarcar mid-sessão NÃO remove o card que ainda não foi visto desta
  rodada. Razão: comportamento previsível, evita lista mutando enquanto
  jogo roda.

- **Sem limite de tamanho de lista** no MVP. Revisitar se aparecer
  abuso (>500 cards de um deck só).

- **CTA "marcar todos os erros desta sessão"** no `sessionEndModal`:
  faz N inserts idempotentes; mostra contador final ("12 cards
  adicionados à revisão"). Atalho de 1 clique.

- **`study_sessions.meta.source = 'revision'`:** flag em JSONB, sem
  alterar schema. Suficiente pra contar medalha e pra KPI.

- **Sem tela dedicada de "minha lista":** o CTA leva direto pro picker
  de modo. Quem quer ver/gerenciar individual usa a lista do deck
  (cards marcados ganham indicador visual definido em UX-SPEC).

- **Detecção de "card dominado" na sessão de revisão:** acertar 3×
  seguidas dentro da MESMA sessão de revisão → prompt "Card dominado
  — remover?" botão inline. Sem auto-remove. Anti-paternalismo. UX
  decide visual.

- **Ordem dos cards na sessão de revisão:** shuffle (random por sessão),
  igual modos normais. Sem prioridade por `added_at` no MVP.

## Out of scope (taxativo)

- ❌ Algoritmo SRS (next_review_at, fator de facilidade, intervalo).
- ❌ Múltiplas listas nomeadas por deck.
- ❌ Lista global cross-deck.
- ❌ Compartilhar / exportar lista.
- ❌ Tela dedicada com bulk-actions.
- ❌ Notificação push específica de revisão.
- ❌ Auto-marcação de cards errados.
- ❌ Histórico extra de "revisado N vezes" (stats por card já bastam).

## Ordem de implementação sugerida (1 sprint)

1. Migration `005_revision_list.sql` (tabela + índices + medalha nova).
2. Backend: rotas `POST /api/cards/:id/review` (marcar),
   `DELETE /api/cards/:id/review` (desmarcar),
   `GET /api/decks/:id/review` (lista de cards marcados),
   `GET /api/decks/:id/review/count` (contagem pra CTA).
3. Backend: extensão de `server/gamification.js` pra avaliar
   `revision_master` no finish (filtrar sessões por
   `meta.source = 'revision'` e `wrong = 0`).
4. Backend: rota de start de sessão de revisão (ou query param em
   `POST /api/sessions` indicando `source='revision'` + lista de
   `card_ids`).
5. Cliente: módulo `src/core/reviewList.js` (cache + sync, padrão de
   `stats.js`).
6. Cliente: componente menu contextual reutilizável (`src/ui/cardActionsMenu.js`).
7. Cliente: integração nos 4 pontos de marcação (deck, games, modal, explore).
8. Cliente: CTA no detalhe do deck + picker de modo já existente
   parametrizado pra revisão.
9. Cliente: indicador visual de "marcado" na lista do deck.
10. Cliente: atalho "marcar todos os erros" no `sessionEndModal`.
11. Deploy + QA (cobrir: visibilidade em deck que vira privado,
    snapshot mid-sessão, idempotência de marcar 2×, lista vazia mid).
