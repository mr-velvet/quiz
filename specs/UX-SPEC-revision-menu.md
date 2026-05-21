# UX-SPEC — Menu de revisão (marcar/desmarcar card)

Spec visual/UX da feature "lista de revisão" definida em `PRODUCT-SPEC-revision.md`.
Define **como** o user marca/desmarca um card e como o CTA "Treinar revisão (N)"
aparece. Reutiliza componentes existentes (modal, dropdown, toast). Zero
componente nativo. Última revisão: 2026-05-21.

**Premissas herdadas (não negociar aqui):**
- 4 pontos de marcação (lista do deck, pós-resposta, sessionEndModal, Explore).
- Marcar/desmarcar é toggle visual no mesmo item.
- CTA esconde quando N=0, aparece quando N≥1.
- Tokens existentes (`--accent`, `--good`, `--bg-elev`, `--border`, etc.) — NÃO
  inventar paleta nova. Cor de destaque do CTA = `--accent` (âmbar).

---

## 1. Auditoria do que existe

O que **sustenta** sem precisar mudar:
- `src/ui/dropdown.js` já cobre: posicionamento absoluto, outside-click, Escape,
  `aria-expanded`, alinhamento direita. **É a base do popup do menu** — não
  criar componente novo.
- `.dropdown-popup` (1632): bg `--bg-elev`, border `--border`, radius 10px,
  `fadeIn 100ms`, `min-width: 180px`, scroll interno. Já é exatamente o visual.
- `.dropdown-item` (1652): padding 8/12, hover bg `--bg-elev-2`, `gap: 8` pra
  ícone à esquerda do label. **Pronto pra ícone + texto.**
- `iconKebab(size)` (icons.js:53) já existe, três círculos verticais. Já é
  usado em `deck.js` no fluxo mobile de owner actions — **mesmo ícone**.
- `toast(msg, { kind })` cobre o feedback "Adicionado à revisão" com border
  `--good`. Suporta `durationMs` custom.
- `.card-row` (1504) tem grid responsivo — área "stats" no canto direito é o
  lugar natural pra inserir o kebab (sem quebrar layout mobile).
- `.session-end-error` (486) é grid por linha; idem, kebab vai na lateral.

O que precisa **acomodar**:
1. `dropdown.js` aceita items com `{ label, onSelect, value, active, separator }`
   mas **não suporta `icon`**. Precisa estender p/ aceitar `icon: Element` à
   esquerda do label (já há `gap: 8` no `.dropdown-item` antecipando isso).
2. Pós-resposta dos modos (flashcards/MC/write) — janela de 500-850ms entre
   responder e próximo card. Abrir menu kebab nessa janela é hostil. Ver §4.2
   pra recomendação alternativa.
3. `card-row-stats` hoje mostra `correct/total` quando dono. Em deck de outro
   ela é vazia — perfeita pra abrigar kebab visível pra qualquer ownership.
4. Não existe ainda ícone `bookmark` / `check-circle` / `copy` / `speaker-off-bg`
   no `icons.js`. Adicionar 3-4 ícones novos (ver §10).

---

## 2. Princípios visuais

1. **O menu é o mesmo em todo lugar.** Mesmo trigger (kebab), mesmo popup, mesmas
   opções, mesma ordem. Único variável é o **contexto** do card (no jogo, na
   lista, no resumo) — o conteúdo do menu não muda.
2. **Marcar/desmarcar é toggle visual claro.** Item do menu com check (✓) à
   esquerda quando ativo, texto muda ("Adicionar à revisão" ↔ "Remover da
   revisão"). User vê o estado sem precisar abrir e fechar.
3. **Não bloquear o jogo.** Pós-resposta, abrir popup inteiro estressa o fluxo
   (Speed = 60s totais, MC = 850ms transição). Recomendação: nessa situação
   **não há kebab** — há um **botão único "+ Revisão"** inline, 1 clique, com
   estado toggled. Justificativa em §4.2.
4. **Feedback discreto.** Adicionar à revisão é micro-ação. Toast bottom-center
   de 2.4s com "Adicionado à revisão · **Desfazer**" — sem celebração, sem
   confetti, sem som. Recomendação justificada em §5.
5. **CTA "Treinar revisão (N)" é segundo cidadão dos modos**, não 6º modo.
   Bloco visualmente distinto **acima** da grid de modos quando N≥1, com cor
   `--accent` na borda (mesma do `pill-good`/CTA primário) e contador `(N)`
   embutido no texto. Some completamente quando N=0 (sem placeholder cinza).

---

## 3. Anatomia do gatilho (kebab)

### 3.1 Visual

Reusa o `iconKebab(16)` já existente. Botão é `btn btn-icon btn-sm` (classes
existentes — padding 8px, font-size 13px) com aria-label.

```
+------+
|      |
|  ·   |
|  ·   |
|  ·   |
|      |
+------+
```

- **Tamanho ícone:** 16×16px.
- **Botão envolvente:** `.btn-icon` → padding 8px → área 32×32 nominal.
- **Hit area mínima mobile:** 44×44. Garantida via `min-height: 44px;
  min-width: 44px;` na classe `.card-action-kebab` (CSS novo) **sem** mudar
  o tamanho visual do ícone — usa padding extra invisível.
- **Cor padrão:** `color: var(--text-mute)` (#5a6172).
- **Hover:** `color: var(--text-dim)` (#9097a7), `background: var(--bg-elev-2)`.
- **Active / aberto:** `color: var(--accent)` + `aria-expanded="true"`.
- **Focus visible:** já coberto pelo `:focus-visible` global (outline accent 2px).

### 3.2 Posicionamento por contexto

| Contexto | Posição | Visibilidade |
|---|---|---|
| `.card-row` (lista de cards no deck) | Última coluna do grid, depois de `card-row-stats`. Em mobile (<600px), vira ícone na linha de stats. | Sempre visível (não só hover). |
| `.session-end-error` (lista de erros) | Posição absoluta `top: 8px; right: 8px;` dentro do `.session-end-error`. | Sempre visível. |
| `.deck-card` (explore — mesmo padrão que listagem do deck) | Idem `.card-row`. | Sempre visível. |
| Pós-resposta nos modos | **Não usa kebab.** Ver §4.2. | — |

Sempre visível porque hover-only quebra mobile e a feature precisa de
descobribilidade no MVP.

---

## 4. Anatomia do popup

### 4.1 Estrutura visual

Reusa `.dropdown-popup` (já tem bg, border, shadow, fadeIn). Adiciona variante
`.dropdown-popup-menu` para padding maior e larguras pré-definidas (caso fique
flutuando solto).

```
                     +-------------------------------+
                     | ✓  Remover da revisão         |
                     | ─────────────────────────────|
                     | 🔊 Ouvir frente               |
                     | 🔊 Ouvir verso                |
                     | 📋 Copiar texto               |
                     +-------------------------------+
```

- **Background:** `var(--bg-elev)`.
- **Borda:** `1px solid var(--border)`, radius 10px.
- **Shadow:** `var(--shadow)` (já no `.dropdown-popup`).
- **Padding interno:** 4px (já no `.dropdown-popup`).
- **Width:** `min-width: 200px` (override do default 180 pra acomodar "Adicionar
  à revisão" + ícone), `max-width: 260px`.
- **Animação entrada:** `fadeIn 100ms ease` (já existe) — adicionar `transform:
  translateY(-4px)` → `translateY(0)` opcional pra leve slide vertical (~120ms
  total). Mantém o `fadeIn` existente como base.
- **Animação saída:** sem — `dropdown.js` hoje remove o nó direto. Aceitável.

### 4.2 Item

Cada `.dropdown-item` (já estilizado: padding 8/12, gap 8, hover `--bg-elev-2`):

```
[icone 14px] [label                              ]
```

- **Ícone:** 14×14 SVG, cor `currentColor`, `flex-shrink: 0`.
- **Label:** font-size 13px, cor `--text`.
- **Item ativo (toggle on):** ícone check (✓) à esquerda + label trocada. NÃO
  usar a classe `.dropdown-item-active` (que muda cor pra accent) — o check é
  feedback suficiente, e cor accent reservaria visual de "selecionado" pra
  algo que aqui é "estado on".

### 4.3 Posicionamento contextual (acima/abaixo)

`dropdown.js` hoje só posiciona abaixo (`top: calc(100% + 6px)`). **Extensão
necessária:** detectar espaço disponível e flipar pra cima quando o trigger
está nos últimos ~280px da viewport. Implementação leve em `dropdown.js`:

```js
// Pseudo: ao montar popup, mede getBoundingClientRect do btn.
// Se viewport.bottom - btn.bottom < 280, adiciona classe .dropdown-popup-up
// (CSS: top: auto; bottom: calc(100% + 6px)).
```

CSS:
```css
.dropdown-popup-up { top: auto; bottom: calc(100% + 6px); }
```

Necessário porque na lista de erros do `sessionEndModal` os últimos itens estão
perto do fundo da viewport — abrir pra baixo cobre os botões "Voltar / Jogar de
novo".

### 4.4 Fechamento

Já coberto por `dropdown.js`:
- Click fora → fecha.
- Escape → fecha + devolve foco ao trigger.
- **Adicionar:** seleção de item já fecha (via `close()` no `onSelect`).

### 4.5 Focus trap

Não é trap rigoroso (não é modal bloqueante). Mínimo:
- Ao abrir, foco vai pro primeiro item (`popup.querySelector('.dropdown-item').focus()`).
- Tab navega entre items naturalmente.
- Setas ↑/↓ navegam (adicionar handler no `dropdown.js`).
- Enter ativa item focado.
- Escape fecha (já existe).

---

## 5. Itens do menu

Ordem fixa e mesma em todos os contextos:

| # | Estado | Label | Ícone | Comportamento |
|---|---|---|---|---|
| 1 | Toggle | "Adicionar à revisão" ↔ "Remover da revisão" | bookmark vazio / bookmark check | Chama API + toast com Desfazer. |
| — | separator | — | — | — |
| 2 | Action | "Ouvir frente" | speaker | `playCardAudio(deckId, cardId, 'front', lang)` |
| 3 | Action | "Ouvir verso" | speaker | `playCardAudio(deckId, cardId, 'back', lang)` |
| 4 | Action | "Copiar texto" | copy | Copia `front\tback` pra clipboard, toast confirma. |

**Reservado pra futuro (não renderizar agora):**
- "Editar carta" — só dono, ícone pencil.
- "Apagar carta" — só dono, ícone trash, cor `--bad`.

Manter slots reservados na implementação como flags `if (isMine && SHOW_EDIT)`
pra plugar sem refactor quando entrar.

### 5.1 Variante "Marcar todos pra revisar" (sessionEndModal)

No topo da lista de erros do `sessionEndModal`, **antes do primeiro card
errado**, botão único (não menu):

```
+--------------------------------+
| + Marcar todos (5) pra revisar |
+--------------------------------+
```

- Classe `.btn .btn-sm` com ícone bookmark+.
- 1 clique adiciona todos os N cards errados da sessão.
- Toast: "5 cartas marcadas · **Desfazer**".
- Após click, desaparece (ou vira "✓ Todos marcados" disabled). Recomenda
  desaparecer — anti-clutter.

---

## 6. Variações por contexto

### 6.1 Lista de cards no deck (`.card-row`)

Kebab vai na **última coluna** do grid `.card-row`. No grid mobile (<600px) o
grid template é redesenhado (`grid-area: stats` no canto), encaixa do lado do
contador stats.

```
+---------------------------------------------------------------+
| 01  Capital da França       [🔊]   Paris            [🔊]  ⋮  |
+---------------------------------------------------------------+
```

Popup abre alinhado à direita (`align: 'right'` no `dropdown`).

**Mobile <600px:**
```
+-----------------------------+
| 01  Capital da França  ⋮    |
| Paris                       |
| [🔊]   [🔊]      12/15      |
+-----------------------------+
```
Kebab fica no canto superior direito do card (grid area dedicada).

### 6.2 Pós-resposta nos modos de jogo — RECOMENDAÇÃO PRÓPRIA

**Decisão de design:** **não usar kebab nesse contexto.** Em vez disso, um
**botão único "+ Revisão"** inline aparece junto ao feedback de acerto/erro,
no canto inferior direito do card/área de resposta. Estado toggled visualmente
(borda âmbar quando marcado).

**Justificativa:**
- Janela é curta (500-850ms transição em MC; ainda menor em Speed).
- Abrir menu inteiro com 4 opções pra escolher "+ Revisão" mata o ritmo arcade.
- Ouvir frente/verso e copiar texto **não fazem sentido nessa janela** —
  acabou de responder, vai pra próxima. Quem quer ouvir/copiar usa a lista do
  deck depois.
- 1 botão, 1 ação, 1 clique. Combina com a vibe arcade da gamificação.

**Visual:**
```
[ + Revisão ]      ← estado off (border-soft, text-dim)
[ ✓ Marcada ]      ← estado on (border accent, text accent)
```

- Classe `.btn .btn-sm` + variante `.btn-revision`.
- `min-width: 110px` pra evitar layout shift entre estados.
- Posicionamento: absoluto canto inferior direito da área do card, com `bottom:
  12px; right: 12px;` — não conflita com `speakerButton` (que já fica top-right
  via CSS dos cards).
- Em **flashcards**: aparece **só depois** que user respondeu "Sei"/"Não sei" e
  durante o flash de feedback (até a próxima carta). Some no rerender da
  próxima.
- Em **MC**: aparece **junto com** o flash da opção correta/errada, durante a
  janela de 850ms. Some no rerender.
- Em **Write**: aparece após Enter (resposta enviada). Some na próxima carta.
- Em **Match**: aparece no card que acabou de ser pareado (frame de flash) —
  ou alternativamente, **não aparece em Match** (par é dois cards ao mesmo
  tempo, ambíguo qual marcar). Recomenda **não aparecer em Match** — user usa
  a lista de erros do `sessionEndModal`.
- Em **Speed**: pula. Pressão de tempo. Marca pelo `sessionEndModal`.

**Atalho de teclado:** `R` (ou `M`? — `M` já é mute global na gamificação).
**Usar `R`** ("revisão"). Adicionar à hint de atalhos do modo:
`R revisar`.

### 6.3 sessionEndModal — lista de erros

User não está sob pressão de tempo. **Menu completo (kebab) faz sentido.**

```
+-----------------------------------------------------+
| 3 cartas pra revisar       [+ Marcar todos (3)]    |
+-----------------------------------------------------+
| Capital da França                              ⋮   |
|  [Certo]  Paris                                    |
|  [Marcou] Londres                                  |
+-----------------------------------------------------+
| Capital do Peru                                ⋮   |
|  [Certo]  Lima                                     |
|  [Marcou] Bogotá                                   |
+-----------------------------------------------------+
```

Kebab `top: 8px; right: 8px;` absoluto dentro do `.session-end-error`.
Popup abre alinhado direita, **acima** quando viewport apertada (último item
da lista geralmente próximo dos botões finais — ver §4.3).

### 6.4 Explore (deck público de outro)

Mesma `.card-row` da §6.1. **Opções "Editar" e "Apagar" jamais aparecem**
(check `if (isMine)`). Marcar/desmarcar funciona normalmente — a lista é minha,
não do dono (ver `PRODUCT-SPEC-revision.md` §6).

---

## 7. Feedback ao adicionar/remover

### Recomendação: **micro-toast bottom-center com "Desfazer"**.

Recusada: badge pulsando no CTA do deck. Razões:
- O CTA pode não estar visível (user marcou de dentro de um modo de jogo, ou
  do Explore). Animar algo que ele não está olhando é desperdício.
- Toast é padrão estabelecido no produto (`toast.js`) — não introduz padrão
  novo.
- "Desfazer" é crítico: marcou sem querer no meio do jogo, precisa reverter
  sem abrir menu de novo. Toast com action coberto pelo mesmo componente
  (`toast.js` precisa extensão pra aceitar action — ver §10).

**Especificação:**
```
                +----------------------------------------+
                | ✓ Adicionado à revisão     [Desfazer] |
                +----------------------------------------+
```

- `kind: 'success'` (border `--good`).
- `durationMs: 2400` (curto, não polui).
- Action "Desfazer" → desmarca o card + toast neutro "Reverteu" (1.5s).
- Remoção: toast "Removido da revisão · **Desfazer**" (recoloca).
- Em **caso "Marcar todos (N)"**: "N cartas marcadas · **Desfazer**" remove
  todas que foram adicionadas naquela ação (não as que já estavam marcadas
  antes).

**Anti-padrão evitado:** sem ícone gigante, sem som, sem confetti. Marcar pra
revisar é organização, não conquista.

---

## 8. CTA "Treinar revisão (N)" na tela do deck

### 8.1 Posição

**Bloco distinto acima da grid de modos**, dentro da seção "Modos de estudo",
**colado** ao h2 "Modos de estudo", **antes** do grid `.mode-grid`.

Razões pra não ser 6º modo:
- Conceitualmente é meta-ação (subseleção), não modo.
- Se virasse 6º card na grid, ficaria visualmente igual aos 5 modos e o user
  pensaria "outro modo". Quebra a mensagem.
- Bloco separado destaca quando aparece (N≥1) e some sem deixar buraco no grid
  quando N=0.

### 8.2 Visual

```
+---------------------------------------------------------------+
| ◆ Revisar marcados (12)                            [Iniciar →]|
| Sua lista pessoal de cartas nesse deck                        |
+---------------------------------------------------------------+
```

- Classe `.revision-cta`.
- Border-left de 3px `--accent` (destaque sutil sem mudar a cor de fundo).
- Background `var(--bg-elev)` (mesmo dos panels).
- Padding 14/18, radius `var(--radius)`.
- Título: `font-family: 'Fraunces'`, 17px, peso 600.
- Contador `(12)` em `var(--accent)`, peso 700.
- Subtítulo: 12px `--text-dim`.
- Botão "Iniciar →" à direita: `.btn .btn-primary .btn-sm`.
- Hover do bloco inteiro: `border-color` accent ganha mais intensidade,
  `transform: translateY(-1px)`.

### 8.3 Comportamento

**Click no bloco ou no "Iniciar":** abre **picker de modo** (modal). Reusa
visualmente a `.mode-grid` dentro de um `openModal({ title: 'Treinar com X
cartas marcadas', content: gridDeModosCompacta })`.

Picker é grid 5 botões (mesmos 5 modos) com versão compacta:
```
+------------------+ +------------------+
|  🃏 Flashcards   | |  🎯 MC           |
+------------------+ +------------------+
+------------------+ +------------------+
|  ✏️ Escrever     | |  🧩 Match        |
+------------------+ +------------------+
+------------------+
|  ⚡ Speed        |
+------------------+
```

Cada botão abre `/play/<deckId>/<modo>?source=revision`.

### 8.4 Estados

| N | Visual |
|---|---|
| 0 | **Bloco completamente escondido.** Sem placeholder, sem disabled. |
| 1 | "Revisar marcados (1)" — singular natural. |
| ≥2 | "Revisar marcados (N)". |
| ≥100 | "Revisar marcados (99+)" pra não estourar layout. |

Contador atualiza após `await` da API quando o user marca/desmarca, sem refresh
da página (DOM patch in-place).

---

## 9. Acessibilidade

### 9.1 ARIA do trigger (kebab)

```html
<button
  class="btn btn-icon btn-sm card-action-kebab"
  type="button"
  aria-label="Mais opções da carta"
  aria-haspopup="menu"
  aria-expanded="false">
  <!-- iconKebab -->
</button>
```

`aria-expanded` flipa via `dropdown.js` (já flipa hoje).

### 9.2 ARIA do popup

`dropdown.js` precisa adicionar `role="menu"` no `.dropdown-popup` e
`role="menuitem"` em cada `.dropdown-item`. Mudança simples no `buildPopup`.

Item ativo (toggle on): `aria-checked="true"` + `role="menuitemcheckbox"` no
item "Remover da revisão".

### 9.3 Navegação por teclado

- **Tab** entra/sai do menu naturalmente.
- **Setas ↑/↓** navegam entre items (precisa handler novo em `dropdown.js`).
- **Enter / Espaço** ativa item focado.
- **Escape** fecha + devolve foco ao trigger (já existe).
- **Home/End** opcional (primeiro/último item).

### 9.4 Botão "+ Revisão" pós-resposta

```html
<button class="btn btn-sm btn-revision"
        aria-label="Marcar carta para revisão depois"
        aria-pressed="false">
  + Revisão
</button>
```

`aria-pressed` flipa pra `true` quando marcado. Screen reader anuncia
"alternado" corretamente.

### 9.5 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  .dropdown-popup { animation: none; }
  .revision-cta:hover { transform: none; }
  /* O fadeIn de 100ms é leve, mas pra ser consistente, desligar. */
}
```

Cor e estado permanecem — animação some.

### 9.6 Anúncio screen reader

- Marcar: `aria-live="polite"` no toast → "Adicionado à revisão. 12 cartas
  marcadas neste deck."
- Desmarcar: idem.
- CTA com contador: o `(12)` é parte do texto visível, screen reader lê
  naturalmente "Revisar marcados, 12, botão".

---

## 10. Tokens / variáveis CSS a reusar

**Não inventar paleta nova.** Tudo já existe em `styles.css:1-34`:

| Uso | Token |
|---|---|
| Cor de destaque do CTA (border-left, contador, hover) | `--accent` |
| Cor do CTA primário (botão Iniciar) | `--accent` + `.btn-primary` existente |
| Background do popup, CTA bloco | `--bg-elev` |
| Hover de item | `--bg-elev-2` |
| Border padrão | `--border` |
| Border discreta | `--border-soft` |
| Texto principal | `--text` |
| Texto secundário (subtítulo CTA) | `--text-dim` |
| Texto muted (kebab parado) | `--text-mute` |
| Toast sucesso | `--good` (já no `.toast-success`) |
| Cor "marcado" no botão revisão pós-resposta | `--accent` (border) |
| Animação base | `--t-fast`, `--t-base` |
| Shadow popup | `--shadow` (já no `.dropdown-popup`) |
| Radius | `--radius`, `--radius-sm` |

**Novos ícones em `icons.js`** (não tokens — assets):
- `iconBookmark(size)` — outline, pra estado "não marcado".
- `iconBookmarkCheck(size)` — preenchido + check, pra estado "marcado".
- `iconCopy(size)` — duas folhas sobrepostas.
- (`iconSpeakerOn` já existe — reusar pras opções "Ouvir frente/verso".)

**Extensão necessária em `toast.js`:**
- Aceitar `action: { label, onClick }` que renderiza botão à direita do texto.
- Quando há action, durationMs default sobe pra 4000 (dar tempo do user clicar).

**Extensão em `dropdown.js`:**
- Aceitar `icon` no item (Element ou função que retorna Element).
- `role="menu"` no popup, `role="menuitem"` (ou `menuitemcheckbox`) nos items.
- Navegação por setas.
- Detecção de espaço vertical pra flipar acima (classe `.dropdown-popup-up`).

**Nova classe CSS em `styles.css`** (estimativa ~40 linhas):
- `.card-action-kebab` (hit area 44, padding extra invisível).
- `.btn-revision` (variante do `.btn`: border âmbar quando `aria-pressed`).
- `.revision-cta` (bloco do CTA na tela do deck).
- `.dropdown-popup-up` (variante acima).
- `.toast-action` (botão dentro do toast pra "Desfazer").

---

## 11. Mockups ASCII de cada contexto

### 11.1 Lista de cards no deck — kebab parado

```
+------------------------------------------------------------------+
| 01  Capital da França       [🔊]   Paris        [🔊]  12/15  ⋮  |
+------------------------------------------------------------------+
| 02  Capital do Peru          [🔊]  Lima         [🔊]   8/10  ⋮  |
+------------------------------------------------------------------+
```

### 11.2 Lista de cards no deck — popup aberto

```
+------------------------------------------------------------------+
| 02  Capital do Peru          [🔊]  Lima         [🔊]   8/10  ⋮  |
+------------------------------------------------------------------+
                                              +-----------------------+
                                              | ▢  Adicionar à revisão|
                                              | ──────────────────── |
                                              | 🔊 Ouvir frente       |
                                              | 🔊 Ouvir verso        |
                                              | 📋 Copiar texto       |
                                              +-----------------------+
```

### 11.3 Lista de cards — estado marcado

```
                                              +-----------------------+
                                              | ✓  Remover da revisão |
                                              | ──────────────────── |
                                              | 🔊 Ouvir frente       |
                                              | 🔊 Ouvir verso        |
                                              | 📋 Copiar texto       |
                                              +-----------------------+
```

### 11.4 Pós-resposta MC — botão "+ Revisão" inline

```
+----------------------------------------------------+
|                  Capital da França                 |
|                                                    |
|   +-------------+              +-------------+    |
|   | 1  Paris  ✓ |              | 2  Lisboa   |    |
|   +-------------+              +-------------+    |
|   +-------------+              +-------------+    |
|   | 3  Madrid   |              | 4  Roma     |    |
|   +-------------+              +-------------+    |
|                                                    |
|                                     [ + Revisão ] |
+----------------------------------------------------+
```

Após clicar (estado on):
```
|                                     [ ✓ Marcada ] |
```

### 11.5 sessionEndModal — lista de erros com kebab

```
+-----------------------------------------------------+
|              3 cartas pra revisar                   |
|                            [+ Marcar todos (3)]    |
+-----------------------------------------------------+
| Capital da França                              ⋮   |
|  [Certo]  Paris                                    |
|  [Marcou] Londres                                  |
+-----------------------------------------------------+
| Capital do Peru                                ⋮   |
|  [Certo]  Lima                                     |
|  [Marcou] Bogotá                                   |
+-----------------------------------------------------+
| Capital da Argentina                           ⋮   |
|  [Certo]  Buenos Aires                             |
|  [Marcou] Caracas                                  |
+-----------------------------------------------------+
|                                                     |
|   [Voltar ao deck]       [Jogar de novo]           |
+-----------------------------------------------------+
```

Popup aberto no último (precisa flipar acima):
```
| Capital da Argentina                          [⋮]  |
+--------------------------+                         |
| ▢  Adicionar à revisão   |   ← popup acima         |
| ───────────────────────  |     pra não cobrir      |
| 🔊 Ouvir frente          |     os botões finais    |
| 🔊 Ouvir verso           |                         |
| 📋 Copiar texto          |                         |
+--------------------------+                         |
|  [Certo]  Buenos Aires                             |
|  [Marcou] Caracas                                  |
+-----------------------------------------------------+
```

### 11.6 Tela do deck — CTA "Treinar revisão" presente

```
+---------------------------------------------------------------+
|                                                               |
|    Capitais SA                          [+ Cartas] [Renomear]|
|    [Público]  [12 cartas]  [✓ 48]  [✕ 7]  [Lv 3 · 520 XP]   |
|                                                               |
|    Modos de estudo                                            |
|                                                               |
|    +---------------------------------------------------+     |
|    | ◆ Revisar marcados (5)              [Iniciar →]   |     |
|    | Sua lista pessoal de cartas nesse deck            |     |
|    +---------------------------------------------------+     |
|                                                               |
|    +----------+  +----------+  +----------+                  |
|    | 🃏 Flash | | 🎯 MC    | | ✏️ Escr. |                  |
|    +----------+  +----------+  +----------+                  |
|    +----------+  +----------+                                |
|    | 🧩 Match | | ⚡ Speed  |                                |
|    +----------+  +----------+                                |
|                                                               |
+---------------------------------------------------------------+
```

Quando N=0, o bloco `◆ Revisar marcados` **simplesmente não está no DOM**.
Grid de modos sobe colada ao h2 "Modos de estudo".

### 11.7 Picker de modo (modal aberto do CTA)

```
                +-------------------------------------------+
                |  Treinar com 5 cartas marcadas           |
                |                                           |
                |  +----------+  +----------+              |
                |  | 🃏 Flash | | 🎯 MC    |              |
                |  +----------+  +----------+              |
                |  +----------+  +----------+              |
                |  | ✏️ Escr. | | 🧩 Match |              |
                |  +----------+  +----------+              |
                |  +----------+                            |
                |  | ⚡ Speed  |                            |
                |  +----------+                            |
                |                                           |
                |                            [Cancelar]    |
                +-------------------------------------------+
```

### 11.8 Toast feedback

```
                                                              ↓ bottom-center
                                          +------------------------------------+
                                          | ✓ Adicionado à revisão  [Desfazer] |
                                          +------------------------------------+
```

---

## 12. Resumo de riscos e decisões

| Risco | Decisão |
|---|---|
| Kebab pós-resposta interrompe ritmo do modo | Substituído por botão único "+ Revisão" inline. Justificado em §4.2/§6.2. |
| Menu inteiro com 4 opções repete em todo lugar e fica redundante | Mantido. Coerência > densidade. As 3 ações secundárias (ouvir/copiar) cobrem casos diferentes; remover faria o menu colapsar pra 1 opção e perderia a expansibilidade futura (editar/apagar). |
| Toast "Desfazer" duplica botão de feedback que pode atrapalhar quem navega rápido | `durationMs: 2400` curto + posição bottom-center (já estabelecida no produto). Não interfere com sessionResult que é tela cheia. |
| CTA "Treinar revisão" some quando N=0 e user nunca descobre a feature | Hint contextual aparece no menu kebab (texto "Adicionar à revisão" é descoberto via lista do deck). Não precisa placeholder vazio. Aceitar trade-off de descoberta lenta — feature é opt-in por natureza. |
| Match não tem ponto de marcação pós-resposta | Coberto pelo sessionEndModal. Match termina rápido (timer) e o resumo agrupa tudo. |
| `dropdown.js` precisa de várias extensões (icon, role, setas, flip vertical) | ~30-40 linhas total. Não justifica reescrever — extensão incremental. |
| Sem ícones bookmark/copy ainda | Adicionar 3 SVGs em `icons.js` (~15 linhas cada, padrão `svg(size, paths)` existente). |
| `toast.js` sem suporte a action | Extensão simples (~15 linhas) — aceitar `action: { label, onClick }`, render botão linkado à direita do texto, cancela auto-dismiss se hover. |

---

## 13. Checklist de implementação (resumo pro Dev)

### Componentes / extensões
- [ ] `src/ui/icons.js`: `iconBookmark`, `iconBookmarkCheck`, `iconCopy`.
- [ ] `src/ui/dropdown.js`: aceitar `icon` no item, `role="menu"/menuitem`,
      navegação por setas, classe `.dropdown-popup-up` quando espaço apertado.
- [ ] `src/ui/toast.js`: aceitar `action: { label, onClick }`.
- [ ] `src/ui/cardMenu.js` (novo): factory `cardMenu({ deckId, card, isMine,
      isInRevision, onToggleRevision, lang })` retorna o `dropdown` configurado.
      Usado em deck.js, sessionEndModal.js, explore.js.
- [ ] `src/ui/revisionButton.js` (novo): factory `revisionButton({ deckId,
      cardId, isInRevision, onToggle })` retorna o botão `+ Revisão / ✓ Marcada`.
      Usado pós-resposta em flashcards/MC/write.
- [ ] `src/ui/revisionCta.js` (novo): bloco `Revisar marcados (N)` + picker de
      modo. Usado em deck.js.

### CSS novo (em `styles.css`)
- [ ] `.card-action-kebab` (hit area 44).
- [ ] `.btn-revision`, `.btn-revision[aria-pressed="true"]`.
- [ ] `.revision-cta`, `.revision-cta:hover`.
- [ ] `.dropdown-popup-up`.
- [ ] `.toast-action` (botão dentro do toast).
- [ ] `@media (prefers-reduced-motion: reduce)` ajustes.

### Telas alteradas
- [ ] `src/ui/deck.js`: kebab por card-row + bloco CTA acima da grid de modos.
- [ ] `src/ui/sessionEndModal.js`: kebab por erro + botão "Marcar todos (N)".
- [ ] `src/ui/explore.js` (lista de deck público): kebab por card (sem editar/
      apagar mesmo se logado — não é dono).
- [ ] `src/games/flashcards.js`: botão `+ Revisão` no card durante feedback.
- [ ] `src/games/multiple-choice.js`: botão idem durante flash 850ms.
- [ ] `src/games/write.js`: botão idem após Enter.
- [ ] (Match e Speed: pular, marcação fica pelo `sessionEndModal`.)

### Atalho de teclado
- [ ] Tecla `R` em todos os modos pós-resposta toggla revisão do card atual.
      Não dispara se feedback ainda não apareceu (cuidar do estado `locked`).

---

## Pontos abertos pra alinhar com Produto/Dev

- **Atalho `R` ou outro?** Produto não definiu. `R` é mnemônico ("revisão") e
  não colide com `S` (speak), `M` (mute), `Espaço` (flip), `1-4` (opções).
- **Match — confirmar que não tem ponto inline de marcação.** Spec assumiu não
  pra evitar ambiguidade do par.
- **Speed — confirmar idem.** Spec assumiu não por pressão de tempo.
- **Botão "Marcar todos (N)" na sessionEndModal — exibir só quando N>1?** Spec
  assumiu sim (com 1 erro, kebab no item resolve sem precisar do "todos").
- **Limite visual do contador (99+)?** Spec assumiu 99+. Confirmar com Produto
  se isso afeta KPI de "lista virou inbox" (§8 do Product spec).
