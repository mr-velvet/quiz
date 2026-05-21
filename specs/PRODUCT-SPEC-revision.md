# PRODUCT-SPEC — Revisão (lista manual de cards pra revisar)

Decisões de produto pra sprint que adiciona ao Flashy uma **lista de cards
marcados pelo user pra revisar depois** — vinculada ao user, não ao deck —
e um modo de sessão dedicado que joga só essa lista.

Esta spec define **o quê** e **por quê**. UX define **como parece**, Dev
define **como implementa**.

Última revisão: 2026-05-21
Autor: Agente de Produto

---

## 0. Por quê AGORA

Hoje, quando o user erra um card em qualquer modo, o produto reconhece (lista
no `sessionEndModal`, stats internos), mas **não dá ação**. O user pensa
"queria treinar esse card de novo amanhã" e não tem como — precisaria caçar
o card no deck ou rejogar a sessão inteira.

A feature resolve isso com a abordagem mais barata possível: **o user
marca, o produto guarda, depois o user joga a lista**. Sem algoritmo, sem
agendamento, sem ciência. Reforça três princípios do CONCEPTS.md:

- **Jogos > cartões parados:** transforma o "errei esse card" em mais uma
  forma de sessão jogável (não vira lista estática pra contemplar).
- **Anônimo nativo:** a lista é do user (anônimo ou logado), preservada no
  mesmo modelo de identidade que já existe (cookie `flashy_aid` + Postgres).
- **Sem fricção:** marcar/desmarcar é 1 clique em qualquer lugar onde o card
  aparece. Iniciar revisão é 1 clique no deck.

**O que NÃO é:** isto **não é Anki SRS**. Não há algoritmo de espaçamento,
não há "due date", não há intervalo, não há fator de facilidade. É lista
manual. SRS continua no backlog estratégico (item 3 do CONCEPTS.md §Backlog)
e é uma feature diferente, futura.

---

## 1. Modelo conceitual

Para cada par **(user, deck)**, existe **uma única lista** de cards marcados
pra revisar. Many-to-many:

- Um user tem N listas (uma por deck que ele usa).
- Um card pode estar em N listas (uma por user que o marcou).
- O vínculo é **do user**, não do deck. Funciona em deck próprio E em deck
  público de outro.

Decisão deliberada: **uma lista por deck, não uma lista global por user.**
Razão: a sessão de revisão é por contexto (vou revisar inglês agora, não
"tudo que marquei na vida"). Lista global vira inbox que ninguém limpa.
Lista por deck mantém escopo cognitivo claro.

---

## 2. Modelo de dados

Migration nova: **`005_revision_list.sql`**. Não modifica tabelas existentes.

### 2.1 Tabela `card_reviews`

Snapshot mínimo do vínculo user↔card. Schema sugerido:

| Coluna | Tipo | Notas |
|---|---|---|
| `user_id` | UUID NOT NULL | FK `users(id)` ON DELETE CASCADE |
| `card_id` | UUID NOT NULL | FK `cards(id)` ON DELETE CASCADE |
| `deck_id` | UUID NOT NULL | FK `decks(id)` ON DELETE CASCADE — denormalizado pra index e filtro |
| `added_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | Pra ordenar a lista "mais antigos primeiro" |
| `source` | TEXT | Opcional: `manual_deck`, `session_wrong`, `session_end_modal`, `explore` — pra telemetria, não afeta lógica |
| PK | `(user_id, card_id)` | Idempotente: marcar 2× não duplica |

### 2.2 Índices

- PK `(user_id, card_id)` — leitura/escrita do par.
- `idx_card_reviews_user_deck (user_id, deck_id)` — query principal: "quais
  cards desse deck eu marquei?" e contagem N pra CTA.
- `idx_card_reviews_deck (deck_id)` — limpeza em massa (deck removido,
  cards reordenados) e contagem agregada se algum dia precisar.

### 2.3 Comportamento em eventos

- **Card deletado:** ON DELETE CASCADE em `card_id`. O vínculo some
  silenciosamente. Sem notificar o user (não vale o ruído).
- **Deck deletado:** CASCADE em `deck_id`. Lista some junto. Consistente
  com como deletar deck já apaga tudo associado.
- **Deck vira privado e eu não sou o dono:** o vínculo é mantido na tabela,
  mas **o user perde acesso de leitura** porque o deck não é mais visível
  pra ele. CTA de revisão e cards da lista deixam de aparecer pra esse user
  (filtro de visibilidade na API). Se o deck voltar a ser público,
  reaparece tudo. Razão: o user não causou a mudança e a lista é trabalho
  dele — não vale apagar.
- **Deck removido pelo admin** (`removed_by_admin = TRUE`): mesmo
  comportamento que privado de terceiros — vínculo fica, fica invisível.
- **Anonymous_id:** mesma lógica das outras tabelas. Vínculo pertence ao
  `user_id`; se o user limpa cookies e perde o `flashy_aid`, vira outro
  user e a lista some pra ele. Aceitável — é a mesma trade-off de XP /
  streak / decks. Resolve com login (claim).

### 2.4 Limites

- Sem limite hard de cards por lista no MVP. Se a lista crescer absurdo
  (>500 cards de um deck só), UX da sessão lida com paginação interna do
  modo (já é problema de qualquer deck grande). Revisitar se vier sinal
  de abuso.

---

## 3. Fluxos de usuário

Quatro pontos de entrada pra **marcar/desmarcar** + dois pra **iniciar
sessão**.

### 3.1 Marcar / desmarcar — lugares

Todos usam o **mesmo menu contextual** (componente único, definido em
UX-SPEC). Botão "marcar pra revisar" / "remover da revisão" como toggle
visual claro (estado on/off visível no ícone).

1. **Lista de cards na tela do deck** (`#/deck/:id`):
   contexto: user navegando o deck inteiro, vê um card específico, quer
   marcar. Menu aparece por card.

2. **Durante os modos de jogo, após responder** (qualquer modo):
   contexto: errou e quer marcar pra praticar; OU acertou mas achou
   difícil. Menu aparece junto com o feedback de acerto/erro, sem
   bloquear a transição pro próximo card. Se user não age, segue jogo
   normal.

3. **No `sessionEndModal`, na lista de erros** (já existe na sprint 4.6):
   contexto: terminou sessão com erros, está revisando o resumo. Cada
   linha da lista de erros ganha o menu. **Atalho recomendado:** botão
   "Marcar todos pra revisar" no topo da lista (1 clique adiciona os N
   erros da sessão).

4. **Explore — deck público de outro** (`#/deck/:id` em deck que não é
   meu): mesmo comportamento da #1. Importante: a marcação é minha, não
   do dono. O dono não é notificado nem vê estatística disso.

### 3.2 Desmarcar

Mesmo menu, mesmo toggle. Adicional: **dentro da própria sessão de
revisão**, ao acertar um card N vezes seguidas, mostrar prompt sutil
"Card dominado — remover da revisão?" (decisão de UX se vira botão
inline ou auto-remove com undo; recomendação: botão inline, sem
auto-remove — anti-paternalismo).

### 3.3 Iniciar sessão de revisão

**A partir da tela do deck:** CTA dedicado quando lista tem N≥1 cards.
Detalhes em §5.

**Não há "revisar tudo de todos os decks":** consistente com §1 (não
existe lista global).

### 3.4 Modo da sessão de revisão

A sessão de revisão **não é um modo novo** — reusa os modos existentes
(Flashcards, MC, Match, Speed, Write). O user escolhe qual modo joga a
revisão, igual escolhe modo no deck normal. O **diferencial é o conjunto
de cards**: só os marcados, em vez do deck inteiro.

Mecânica idêntica aos modos sobre o deck, com 3 ajustes:

- Conjunto de cards = lista de revisão do user no deck.
- Sessão usa os mesmos `sessionLoop`, mesmo XP, mesmo combo, mesmo
  `sessionEndModal`.
- `study_sessions.meta` ganha flag `{"source":"revision"}` pra telemetria
  e pra medalha (§4).

### 3.5 Lista vazia mid-sessão

Cenário: user iniciou revisão com 12 cards, durante a sessão desmarcou 11
("dominados") e errou o último. Ao chegar nele, ainda joga; ao terminar,
o `sessionEndModal` mostra sessão normal. Se ele desmarcou TODOS antes do
último, o modo termina graciosamente: `sessionEndModal` aparece com mensagem
"Você dominou todos os cards desta lista" + CTA "voltar pro deck". Sem
crash, sem loop. **Regra:** lista nunca é re-checada mid-card; ela é
snapshot no momento do start da sessão.

### 3.6 Lista vazia na origem

Se user clica em revisar quando N=0, a CTA simplesmente não existe (ver
§5). Não há "tela vazia" pra revisar — não criar UI pra estado morto.

---

## 4. Interação com gamificação

A sessão de revisão é **sessão normal** sob a ótica do `sessionLoop`:

| Aspecto | Comportamento na revisão |
|---|---|
| **XP** | Sim. Mesmas fórmulas, mesmos modificadores. Como cards marcados tendem a ser "aprendendo" (×1.5), revisão naturalmente rende mais XP por card — recompensa intencional. |
| **Combo** | Sim. Mesmo cap. |
| **Streak diário** | Sim. Sessão de revisão com ≥10 acertos valida o dia, igual qualquer outra. |
| **Bônus 100%** | Sim, mas só se sessão tiver ≥10 cards (regra preexistente). Lista de 4 cards revisada perfeitamente NÃO ganha o +50 — evita farm de listas curtas. |
| **Bônus deck inteiro (+100)** | Não se aplica — a sessão de revisão não joga o deck inteiro por definição. |
| **Medalhas existentes** | Valem normalmente (combo, sem deslizes, etc.). |

### 4.1 Medalha nova — "Mestre da revisão"

Adicionar **1 medalha** ao catálogo via update na `003_gamification.sql`
(ou migration 005 cuidando do `INSERT ... ON CONFLICT`):

- **Code:** `revision_master`
- **Nome:** "Mestre da revisão"
- **Descrição:** "Completar 50 cards de revisão acertando todos."
- **Tier:** gold
- **Categoria:** performance
- **Critério:** lifetime, soma de `correct` em sessões com `meta.source =
  'revision'` E `wrong = 0`, ≥ 50. Reset de combo entre sessões é OK; o que
  conta é total de acertos limpos em sessões de revisão.

Razão de só **1 medalha:** a feature é simples, não merece família de 5.
Uma medalha aspiracional é o suficiente pra dar pulso de progressão. Mais
medalhas adicionar depois conforme uso.

---

## 5. CTA na tela do deck

### 5.1 Onde aparece

No detalhe do deck (`#/deck/:id`), perto dos botões dos 5 modos de jogo.
Pode virar o **6º botão** ou um bloco visualmente distinto acima/abaixo da
linha de modos — decisão UX. Recomendação: bloco distinto (não 6º modo)
porque é meta-ação ("jogar uma subseleção") e não modo.

### 5.2 Copy

- **N≥1:** "Revisar marcados (N)" — N é a contagem atual. Ex: "Revisar
  marcados (12)".
- **N=0:** botão **escondido** (não desabilitado). Razão: estado "0
  marcados" sem nenhuma marca antes é ruído visual; o user descobre a
  feature quando marca o primeiro card e o botão aparece. Hint contextual
  só onde se marca (no menu).

### 5.3 Comportamento ao clicar

Abre **picker de modo** (mesmo padrão visual dos modos do deck): escolhe
entre os 5 modos, inicia sessão com a lista. Picker não é tela cheia,
pode ser sheet/modal.

### 5.4 Indicação visual da lista

Discreta. Não inflar topbar nem deck card. Recomendação: badge pequeno
"N marcados" na própria linha do CTA. Lista propriamente dita não tem
tela dedicada nesta sprint (out of scope — ver §7).

---

## 6. Comportamento em deck público de outro

A lista de revisão num deck público de terceiro é **inteiramente minha**:

- Só **eu** vejo e edito.
- O **dono não é notificado** nem vê contagem agregada (sem "X usuários
  marcaram cards seus pra revisar").
- Se eu **desmarco** todos, o dono não sabe.
- Se eu **clonar** o deck depois, a lista **não migra** automaticamente
  pro clone — são decks distintos por `deck_id`. (Decisão deliberada:
  migrar geraria expectativa de sincronização contínua, que não existe.)
- Se o **dono deletar** o deck público, minha lista some via CASCADE.
- Se o **dono virar privado** e eu não sou o dono, minha lista some da UI
  até voltar (ver §2.3).

Em resumo: a lista é minha sombra sobre o deck público de outro. Não
existe canal de comunicação implícita.

---

## 7. Out of scope (NÃO faz parte desta sprint)

Listar explícito pra evitar scope creep:

1. **Algoritmo de espaçamento (SRS).** Sem `next_review_at`, sem fator de
   facilidade. Continua no backlog (item 3 do CONCEPTS.md).
2. **Múltiplas listas nomeadas por deck.** "Vermelhas", "amarelas", "pra
   prova de quarta" — não. Uma lista, sem nome.
3. **Lista global cross-deck.** §1 já decidiu contra.
4. **Compartilhar lista de revisão.** A lista é privada por natureza.
5. **Exportar lista.** Sem CSV, sem print. Lista vive no app.
6. **Tela dedicada de "minha lista de revisão"** com paginação, filtro,
   bulk-actions. CTA é direto pra jogar; ver/gerenciar individual usa o
   próprio deck (cards marcados ganham indicador visual).
7. **Histórico de "cards já revisados N vezes".** Stats por card já
   existem em `cards.stats`; não adicionar telemetria extra agora.
8. **Notificação / lembrete específico de revisão.** Streak diário e
   lembrete global já cobrem; revisão piggyback.
9. **Auto-marcação de cards errados.** Não. Deliberado. A decisão de
   marcar é do user — preserva intenção e evita lista que infla sozinha.
   Atalho "marcar todos os erros desta sessão" (§3.1.3) é manual.

---

## 8. KPIs de sucesso

Sinais a observar nas 4 semanas pós-deploy.

| KPI | Sinal positivo | Sinal de alerta |
|---|---|---|
| **% de users ativos que marcaram ≥1 card** | ≥ 30% | < 10% (feature invisível) |
| **% de users com ≥1 card marcado que iniciaram ≥1 sessão de revisão** | ≥ 60% | < 25% (marcar não vira ação) |
| **Retenção D7 de quem usou revisão vs quem não usou** | revisão +5pp ou mais | revisão neutra ou negativa (sinal de que a feature não ajuda retenção) |
| **Média de cards marcados por user (entre quem marcou)** | 8–30 | > 100 (lista virou inbox sem limpar) ou < 3 (não pegou) |
| **% de sessões de revisão que terminam em ≥80% acerto** | 40–70% | > 85% (lista virou farm fácil) ou < 20% (cards marcados são impossíveis e frustram) |

Operacionalização: campo `source` em `card_reviews` + `meta.source =
'revision'` em `study_sessions` já dão tudo via SQL.

---

## 9. Resumo das decisões (TL;DR)

| Item | Decisão |
|---|---|
| Modelo | 1 lista por (user, deck). Many-to-many. Vínculo é do user. |
| Funciona em deck público de outro | Sim. Lista é minha, dono não vê. |
| Tabela | `card_reviews(user_id, card_id, deck_id, added_at, source)` |
| Card deletado | CASCADE silencioso. |
| Deck virou privado (e não sou dono) | Lista some da UI, fica no banco. Volta se virar público. |
| Anonymous behavior | Mesma lógica do resto (cookie + Postgres, perde se limpar). |
| Pontos de marcação | 4: lista deck, durante jogo, sessionEndModal, Explore. |
| Modo da sessão | Reusa os 5 modos. Não cria modo novo. |
| Gamificação | XP/combo/streak normais. Bônus 100% só se ≥10 cards. |
| Medalha nova | 1: "Mestre da revisão" — 50 cards de revisão acertados lifetime. |
| CTA | Aparece só quando N≥1. Esconde quando N=0. |
| Lista vazia mid-sessão | Snapshot no start. Termina graciosamente. |
| TTS | Fora desta spec (Google Cloud TTS Standard em outra task). |
| SRS | Fora. Sempre fora. Esta feature é manual. |
