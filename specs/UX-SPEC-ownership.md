# UX-SPEC — Ownership, Visibilidade e Pastas

Spec visual/UX para a sprint que sai do `localStorage`-only e entra no modelo Postgres com ownership / visibility / folders.

Escrito pelo agente UX em paralelo ao spec de Produto (`PRODUCT-SPEC-ownership.md`) e antes da implementação técnica. Última revisão: 2026-05-20.

**Premissas herdadas (não negociar aqui — ver CONCEPTS.md):**
- Anônimo nativo continua sendo default. Login é opcional e tardio.
- Zero componente de SO/browser. Toggle, dropdown, confirm — tudo custom.
- Grid denso > card-grande-com-avatar. Flashy não vira Pinterest nem rede social.
- Importação por texto é o caminho principal de criar deck. Criar ≤30s.

---

## 1. Auditoria visual atual

O que sustenta a sprint:
- **Paleta consolidada** (`--accent` âmbar `#ffd166`, `--good` verde `#6ee7a8`, `--bad` rosa `#ff7a8a`, `--info` azul `#82aaff`) tem range suficiente pra mapear public/private/owner sem inventar cor.
- **Componentes base sólidos:** `.pill`, `.panel`, `.btn`, `.modal`, `.deck-card`, `.empty`. Reusáveis pro escopo da sprint inteira sem CSS novo significativo.
- **`.pill` é o slot natural** pra badges de visibilidade/autor — já tem variantes `pill-good`/`pill-bad` e padding pequeno (12px). Não precisa criar componente novo.
- **Modal e `confirmModal` resolvem 100% dos confirms** desta sprint (deletar deck, tornar público, etc.). Não tocar.
- **`.empty` (60px de padding + h2 + texto)** serve as telas vazias novas (Explorar / Pasta sem decks) tal qual.

O que é frágil ou ausente:
- **Topbar não acomoda nada além do brand + texto "Anônimo · local".** Não tem espaço pensado pra tabs ou ações (Explorar, Pastas, Login). Vai precisar evoluir.
- **`deck-card` tem só title + meta + progress.** Não tem affordance pra mostrar visibilidade nem autor. Tem que caber badge minúsculo sem inflar altura (atual `min-height: 130px` — manter).
- **Não existe filtro / tabs nem componente "navlist".** Será o único componente novo da sprint.
- **Ações no detalhe do deck (`deck.js`) são todas destrutivas** (Renomear/Deletar) sem checagem de ownership. Hoje é "todo deck é meu". Precisa virar condicional.
- **Não existe seletor de pasta nem chip de pasta atual.** Decisão visual nova.
- **Toggle (on/off) não existe no design system.** Componente novo, custom.
- **Estados de erro/loading inexistentes.** Hoje tudo é síncrono via `localStorage`. Com fetch, precisamos de skeleton e banner de erro (o `.banner` já existe, só usar).

---

## 2. Vocabulário visual novo

Tudo extraído da paleta existente. Sem cor nova, sem ícone novo de biblioteca.

### Badges de visibilidade (sobre `.pill`)

| Estado | Visual | Justificativa |
|--------|--------|---------------|
| Privado | `.pill` neutro com glifo de cadeado (SVG inline, 12px, stroke `--text-mute`) + texto opcional "Privado" | Cinza neutro = default, sem chamar atenção. Cadeado é universal. |
| Público | `.pill` com borda em `--good` a 30% (já existe via `.pill-good`) + glifo de olho aberto ou globo (SVG inline 12px) + texto "Público" | Verde = "está vivo no mundo". Não usar amarelo (`--accent` é reservado pro botão primário e estado ativo — diluir confunde). |
| Não listado (futuro, se virar feature) | `.pill` com `--info` + glifo de link | Azul = "link" semanticamente. Fora desta sprint mas reservado. |

**Regra:** badge só aparece em deck **seu**. Em deck de outro (na tela Explorar) o badge é redundante — todo deck listado lá é público por definição.

### Indicador de autor

- **Não criar avatar.** Avatar = rede social. Flashy não é rede social.
- Usar **texto pequeno** (`tiny muted`, 12px) com formato:
  - Em deck próprio (sempre): omitir autor. Implícito.
  - Em deck de outro: `por @nome` (logado) ou `por anônimo` (criador anônimo). Em decks de terceiros sempre que o card aparece fora da Home (Explorar, modal de duplicar).
- Cor: `--text-mute` (cinza apagado). Não compete com título.

### Glifos (SVG inline ou unicode)

Padrão atual já é unicode + emoji (`+`, `←`, `🃏`, `🎯`). Manter coerência:
- **Cadeado privado:** SVG inline 12px stroke 1.5 (não usar 🔒 — emoji colorido grita demais em pill discreta). Path: `M5 8V6a3 3 0 0 1 6 0v2 M3 8h10v6H3z`.
- **Globo público:** SVG inline 12px stroke 1.5. Path: simples círculo + linha vertical + 2 curvas horizontais.
- **Pasta:** SVG inline 14px stroke 1.5 (forma clássica de folder). Não usar 📁 emoji.
- **Compass / explorar:** SVG inline 14px (círculo + losango interno) OU caractere `◇`. Decidir na implementação.
- **Tudo via SVG inline em `core/icons.js`** (criar arquivo). Mantém zero dependência.

### Toggle público/privado (componente novo)

Slider horizontal custom, ~36×20px, com bolinha que desliza.

```
[ Privado ◯─── ] → [ ──●  Público ]
```

- Fundo OFF: `--bg-elev-2` com borda `--border`.
- Fundo ON: `--good` a 25% opacity, borda `--good` a 50%.
- Bolinha: 16px círculo, `--text` ON, `--text-dim` OFF.
- Transição: 220ms cubic-bezier (mesmo `--t-base`).
- Label do estado ao lado em `tiny muted`.
- Acessibilidade: `role="switch"`, `aria-checked`. Focável por teclado, ativável por espaço/enter.

**NUNCA** usar `<input type="checkbox">` cru, mesmo escondido com peer-checked, se isso fizer aparecer popup nativo em algum browser. Toggle é puro `<button>` + `<div>` interno.

---

## 3. Mudanças por tela

### 3.1 Home — lista dos meus decks

Layout atual: `<h1>Seus estudos</h1>` + parágrafo + grid de deck-cards.

**Adicionar:**
- **Subnavegação por tabs** abaixo do título (antes do grid). Itens: `Meus decks` (default) · `Explorar` · `Pastas`.
  - Visual: linha de pills `.btn-ghost` agrupadas; pill ativa fica com border-bottom de 2px `--accent` (estilo "tab" leve, sem fundo cheio).
  - Mobile: vira lista horizontal scrollável (sem barra) — manter ordem.
- **Filtro de pasta** (só na tab Meus decks): linha extra com chips, cada chip uma pasta. "Todas" é o default. Visual: `.pill` clicável; ativo usa `--accent` borda + cor.
- **Cada `.deck-card`** ganha badge de visibilidade no canto superior direito (absolute, top: 12px, right: 12px). Pill mini (padding 2px 8px). Só aparece em deck do user logado (ver §7).
- **Card "Criar deck"** (`+`) continua igual.

**Empty state da tab Meus:** já existe (deck-card-new é o único item) — manter.

**NÃO fazer:** sidebar lateral com folders. Vira UI pesada e o app perde a sensação de "uma página, vai rápido". Filtro inline (chips) basta.

### 3.2 Modal "Criar deck"

Hoje: input nome + textarea (cole as cartas) + ações Cancelar/Criar.

**Adicionar (rodapé do modal, antes dos botões):**
- Linha 1: `[toggle público/privado]  Público` (label dinâmico). Default: **Privado**.
- Linha 2 (só se logado): `Pasta: [Sem pasta ▾]` — dropdown custom. Clique abre popup posicionado com a lista de pastas + opção "+ Nova pasta..." no fim.
- Anônimo: linha 2 oculta. Pastas exigem login (decisão de produto — confirmar).

**Princípio:** os 2 controles novos ficam visualmente em uma linha discreta (row + gap-3), em `tiny`/cor `muted`. Não compete com nome + cartas. Quem só quer criar rápido aperta Enter e ignora.

**Tempo total de criar deck:** continua ≤30s. Toggle e pasta são opcionais.

### 3.3 Detalhe do deck (`deck.js`)

Cabeçalho atual: título + linha de `.pill`s (cartas/acertos/erros/recordes) + grupo de botões à direita (+ Cartas / Renomear / Deletar).

**Mudanças:**

Ações condicionais por ownership:
- **Sou dono:** mantém `+ Cartas` `Renomear` `Deletar` + adiciona `[toggle visibilidade]` (inline na header como controle, não como ação de botão).
- **Não sou dono (deck público de outro):** substitui tudo por `[Duplicar pro meu]` `[Compartilhar link]`. Botão primário é Duplicar.
- **Sou dono mas anônimo:** mesmas ações de dono. Mas no header aparece banner discreto (`.banner` neutro) com microcopy "Este deck mora só neste navegador. [Criar conta] pra salvar." Banner pode ser fechado por sessão.

Header de identidade adicionada acima do título quando deck é de outro:
- Linha `por @nome` em `tiny muted` (12px), discreta, acima do `<h1>`.
- Em deck próprio: nada (autor é implícito).

Linha de pills ganha mais 1 item:
- `[badge visibilidade]` (pill mini, primeira da fila à esquerda das stats).
- Resto inalterado.

### 3.4 Tela nova: Explorar

Rota: `/explore`. Vai pela tab Explorar da Home.

Layout:
- `<h1>Explorar</h1>` + parágrafo "Decks públicos de outros. Duplique pro seu pra estudar."
- Linha de controles:
  - **Busca** (`.input` mesmo estilo, com placeholder "Buscar por nome ou tema..." + ícone de lupa SVG à esquerda inline).
  - **Ordenação:** dropdown custom (Recentes / Populares / Mais cartas). Default Populares.
- **Grid `.deck-grid` reaproveitado** (mesmo `deck-card`):
  - Sem `progress bar` (não é meu deck, "vistas" não fazem sentido).
  - Adiciona linha `por @nome` no card, abaixo do meta.
  - Stats mostradas: `N cartas · usado por M`.
  - Badge "Público" pode ser **omitido** aqui (redundante — tudo é público nesta tela). Mantém densidade.
- **Estado vazio** (`.empty`): "Nada encontrado. Tente outro termo."

**NÃO fazer:** scroll infinito + lazy load nesta sprint. Paginação simples (botão "Carregar mais" no fim) ou cap fixo de 60 itens. Decisão técnica do agente Dev.

### 3.5 Tela nova: Pastas

Rota: `/folders`. Acessada pela tab Pastas.

Layout (lista, não grid):
- `<h1>Pastas</h1>` + botão `+ Nova pasta` (`.btn btn-primary btn-sm`) à direita do título.
- Lista de pastas como `.panel`s empilhados (1 por linha):
  - `[ícone folder] Nome da pasta · N decks` à esquerda + ações `Renomear` `Deletar` em `.btn-sm` à direita.
  - Clicar na pasta navega pra Home filtrada pra essa pasta (atalho pro filtro).
- **Estado vazio:** `.empty` com "Nenhuma pasta ainda. Pastas agrupam seus decks por tema."

**Mover deck pra pasta:** acontece no detalhe do deck (3.3) via `.btn-sm` "Mover" que abre modal com a mesma lista de pastas + "+ Nova pasta".

**Deletar pasta:** confirmModal com texto "Pasta deletada. Decks dela voltam pra 'Sem pasta'." (decks NÃO são deletados junto — decisão de produto, confirmar).

### 3.6 Topbar

Atual: brand à esquerda, "Anônimo · local" à direita.

**Mudanças:**
- **Anônimo:** texto vira `Anônimo · este navegador  [Entrar]` onde `[Entrar]` é `.btn btn-sm btn-ghost`. Clique abre fluxo de login (fora desta sprint detalhar, mas slot pronto).
- **Logado:** vira `@nome  [▾]` clicável, abre popup com Sair / Minhas pastas / Sobre.
- **Em tela de play** (showBack=true): topbar minimizada não muda. Continua como está.
- Brand continua à esquerda; quando logado, opcionalmente reduz a marca pra só `[F]` (brand-mark) sem texto pra dar mais espaço — decidir na implementação se sobrar espaço.

Mobile: identificador colapsa pra inicial + ícone, popup continua igual.

---

## 4. Estados

Toda tela nova/alterada precisa cobrir 3 estados — hoje não existe nenhum porque tudo é síncrono.

### Loading
- **Não usar spinner girando no meio da tela.** Cafona.
- Usar **skeleton** dos `.deck-card`: fundo `--bg-elev`, sem texto, com animação de shimmer leve (gradient horizontal que percorre 1.4s, opacity baixa). 3-6 skeletons no grid enquanto carrega.
- Em Explorar/Folders idem.
- Carregamento de uma única ação (ex: tornar público) — botão entra em estado `disabled` + texto vira "Salvando…", sem spinner separado.

### Erro
- **Banner topo da tela** (`.banner banner-error` já existe) com microcopy e ação. Ex: "Offline. Mostrando o que tá em cache." + botão "Tentar de novo" à direita.
- Erro de submit (criar deck, mover, etc.): banner **dentro do modal**, acima das ações. Modal não fecha.
- 404 (deck não existe / foi deletado): redireciona pra Home com banner-error breve "Esse deck não está mais disponível."

### Vazio
- Já temos `.empty` — reusar:
  - Home meus decks vazio: já existe (deck-card-new é único item, OK).
  - Explorar vazio (sem resultado da busca): `.empty` com "Nada encontrado." + sugestão.
  - Pastas vazio: `.empty` com convite a criar.
  - Pasta sem decks: `.empty` com "Esta pasta está vazia." + botão "Mover um deck pra cá".

---

## 5. Microcopy (PT-BR)

Tom: direto, curto, sem piegas, sem "Ops!", sem "Que pena!".

### Visibilidade
- Toggle OFF: "Privado"
- Toggle ON: "Público"
- Descrição privado (hover/aside): "Só você vê e edita."
- Descrição público (hover/aside): "Qualquer um pode estudar e duplicar."

### Confirmações
- Tornar público: "Tornar deck público?" + body "Qualquer um vai poder achar, estudar e duplicar. Você ainda controla edição." + actions "Cancelar / Tornar público".
- Tornar privado: "Tornar privado?" + body "Some da busca. Quem já duplicou mantém a cópia." + actions "Cancelar / Tornar privado".
- Deletar deck próprio público: "Deletar deck público?" + body "**N pessoas** já duplicaram. As cópias delas continuam. **Você perde este.**" + actions "Cancelar / Deletar".
- Deletar deck próprio sem cópia: usa o confirm atual.
- Duplicar deck público: sem modal — ação direta + toast "Deck duplicado pra você." (toast = `.banner` posicionado fixo bottom-center, fade out 3s).
- Deletar pasta com decks: "Deletar pasta?" + body "Os N decks dela voltam pra 'Sem pasta'." + actions "Cancelar / Deletar pasta".

### Anônimo
- Topbar: "Anônimo · este navegador"
- Banner no detalhe do deck (1ª visita): "Este deck mora só neste navegador. [Criar conta] pra acessar de qualquer lugar."
- Tentar tornar deck público sendo anônimo (se exigir conta — confirmar com Produto): modal "Pra publicar decks você precisa criar uma conta. É rápido. [Criar conta / Agora não]"

### Explorar
- Header: "Explorar"
- Sub: "Decks públicos da galera. Duplique pro seu pra estudar com suas próprias stats."
- Empty: "Nada encontrado por aqui."
- Card meta: `por @nome · N cartas · usado por M`

### Pastas
- Header: "Pastas"
- Sub: omitir (autoexplicativo)
- Empty: "Nenhuma pasta ainda. Pastas agrupam seus decks por tema."
- Mover: "Mover deck"
- Botão "Sem pasta" na lista: usar `Sem pasta` literal — não "Todas" nem "Outros".

### Erros
- Offline: "Sem conexão. Mostrando o que tá em cache."
- 404 deck: "Esse deck não existe mais."
- Conflict (salvar deck editado por outra aba): "Conflito. Sua versão foi atualizada — confira antes de salvar de novo."
- Genérico: "Algo deu errado. Tente de novo."

---

## 6. Mobile

Breakpoints atuais no CSS: 600px e 480px.

Pontos críticos:
- **Tabs da Home** (`Meus / Explorar / Pastas`): vira linha scrollável horizontal sem scrollbar (`overflow-x: auto; scrollbar-width: none`). Tabs nunca empilham (perde affordance de "navegação").
- **Chips de pasta:** mesma técnica — scroll horizontal. Em telas <480px, esconder chips se houver só 1 pasta.
- **Topbar:** "Anônimo · este navegador  [Entrar]" pode ficar apertado. <600px, omitir "este navegador" — vira só "Anônimo [Entrar]". <480px, omitir "Anônimo" — só botão `[Entrar]` com ícone.
- **Detalhe do deck:** linha de pills + grupo de botões: hoje já é `row-between`, vai quebrar feio em mobile com botões a mais. Solução: <600px, agrupar `+ Cartas` `Renomear` `Mover` `Deletar` num menu kebab (`⋮` btn-icon) que abre popup. Toggle visibilidade fica visível (importante e frequente).
- **Modal criar deck:** já é `width: min(90vw, 520px)`. Toggle + pasta cabem inline em 1 linha em mobile com `flex-wrap`.
- **Grid Explorar:** mesmo grid auto-fill 240px. <600px vira 1 coluna naturalmente. Já resolvido pelo CSS atual.
- **Modal mover pasta:** lista vertical de pastas, scroll interno se >8 pastas. Max-height 60vh.

---

## 7. Riscos UX e decisões

### Risco: mostrar autor em todo deck vira social
**Decisão:** autor **só aparece em deck de outro** (Explorar + detalhe). Em deck próprio, nunca mostrar "por você" — é implícito e infla a UI. Em deck público próprio visto por outros, o autor aparece pra eles, não pra mim. Mantém Flashy não-social.

### Risco: badges de visibilidade poluem o grid
**Decisão:** badge mini no canto superior direito do card, padding 2px 8px, sem texto na home (só glifo) — texto aparece em hover. Densidade preservada. Em tela `Explorar` o badge some (redundante).

### Risco: anônimo confunde sobre durabilidade do deck
**Decisão:** banner discreto no detalhe do deck (1ª visita, dispensável por sessão) avisa "mora neste navegador". Não bloqueia, não interrompe — mas existe. Topbar reforça "Anônimo · este navegador". User entende sem ler tutorial.

### Risco: toggle público/privado parece pequeno demais e some no modal
**Decisão:** toggle sempre visível com label dinâmico ("Privado" ↔ "Público") + descrição minúscula em `tiny muted` abaixo ("Só você vê" ↔ "Qualquer um pode estudar"). Texto educa sem pop-up.

### Risco: pastas viram feature pesada (sidebar, drag-and-drop, etc.)
**Decisão:** pastas são **chips de filtro** + **dropdown no detalhe do deck** + **tela simples de gerenciar**. Sem drag-and-drop, sem aninhamento (folder dentro de folder), sem cores customizadas por pasta. Se virar dor real, evoluir depois.

### Risco: tabs Home + tela Explorar + tela Pastas = navegação fragmentada
**Decisão:** **3 tabs na Home** (Meus / Explorar / Pastas) que trocam o conteúdo sem mudar layout. URL muda (`/`, `/explore`, `/folders`) mas o frame é o mesmo. User não pula entre páginas inteiras — sente uma só tela.

### Risco: confirmação de deletar deck público é fricção excessiva
**Decisão:** mostrar **só se tiver duplicações ativas** (`N pessoas duplicaram`). Sem cópias, usa confirm padrão atual. Reduz aviso a quando ele é informativo de verdade.

### Risco: dropdown custom (pasta, ordenação) duplica esforço
**Decisão:** criar **um único componente `dropdown(items, onSelect)` em `ui/dropdown.js`**. Usado em pasta no criar, ordenação no Explorar, popup do topbar. Componente fechado: botão + popup posicionado + lista de items. Sem libs.

---

## 8. Checklist de implementação (resumo pro Dev)

Componentes novos:
- [ ] `ui/icons.js` — SVG inline de cadeado, globo, pasta, lupa, kebab, compass.
- [ ] `ui/toggle.js` — toggle switch custom (role=switch, aria-checked).
- [ ] `ui/dropdown.js` — botão + popup posicionado (pasta, ordenação, popup topbar).
- [ ] `ui/tabs.js` — barra de tabs com border-bottom ativo + scroll horizontal mobile.
- [ ] `ui/toast.js` — banner posicionado bottom-center, fade out 3s.
- [ ] `ui/skeleton.js` — deck-card skeleton com shimmer.

CSS novo (em `styles.css`):
- [ ] `.tab` / `.tab-active` (linha de tabs).
- [ ] `.toggle` / `.toggle-on` (slider).
- [ ] `.dropdown` / `.dropdown-popup` / `.dropdown-item`.
- [ ] `.skeleton` + `@keyframes shimmer`.
- [ ] `.deck-card-badge` (absolute top-right).
- [ ] `.toast` + animação.

Telas alteradas:
- [ ] `home.js`: tabs, filtro de pasta, badges em cards.
- [ ] `home.js` (criar modal): toggle + dropdown pasta.
- [ ] `deck.js`: identidade do autor, ações condicionais, badge visibilidade, banner anônimo, kebab mobile.
- [ ] `topbar.js`: estado anônimo/logado, popup dropdown.
- [ ] `ui/explore.js` (novo): tela Explorar.
- [ ] `ui/folders.js` (novo): tela Pastas.

---

## Pontos abertos pra alinhar com Produto

- **Anônimo pode publicar deck público?** Spec assume que não (exige login). Confirmar.
- **Deletar pasta deleta decks contidos?** Spec assume que não (decks voltam pra "Sem pasta"). Confirmar.
- **Decks já duplicados por outros — dono pode deletar?** Spec assume que sim, com aviso reforçado. Confirmar.
- **Tornar privado deck que outros duplicaram:** cópias permanecem? Spec assume que sim. Confirmar.
- **Username pra usuários logados:** vai existir `@nome` ou é só "nome real"? Spec assume `@nome` (estilo Twitter, único, pesquisável). Confirmar.
- **Pasta tem ordenação custom (arrastar pra reordenar) ou é alfabética?** Spec assume alfabética (sem drag).
- **Search no Explorar:** debounce + fuzzy ou exact match? Decisão de Produto/Dev.
- **Limites:** quantos decks públicos por user? quantos cards por deck público? — anti-spam. Spec não define.

Quando esses pontos estiverem decididos, atualizar microcopy e fluxos de confirmação.
