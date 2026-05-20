# PRODUCT-SPEC — Ownership, identidade anônima, visibilidade e pastas

Decisões de produto pra migração `localStorage` → Postgres da did.lu.
Esta spec **não** define schema SQL nem código — é norte pra UX e Dev.

Última revisão: 2026-05-20
Autor: Agente de Produto

---

## 0. Princípios não-negociáveis (recap)

- **Zero fricção pra criar deck.** Quem entra pela primeira vez deve criar um deck em <30s, sem clicar em "criar conta", sem ver email field, sem nada.
- **Anônimo é cidadão de primeira classe.** Não é "modo degradado" — é a identidade default. Tudo funciona anônimo, login é upgrade.
- **Default público.** A web é descobrível por padrão. Privado é opt-in consciente.
- **Não inflar MVP.** Esta sprint resolve ownership + visibilidade + pastas. Social, ranking, comments — fora.

---

## 1. Identidade anônima

### 1.1 Geração do `anonymous_id`

- Formato: UUID v4 (string). Gerado no client na primeira interação que precise persistir (criar deck, salvar progresso, etc.).
- **Lazy creation:** não gerar no primeiro page-load. Só quando o user faz algo que precisa de dono. Evita poluir o banco com IDs fantasma de quem só passou na home.

### 1.2 Persistência (cookie + localStorage redundante)

Salvar o `anonymous_id` em **dois lugares**:

1. **Cookie httpOnly=false, SameSite=Lax, max-age=10 anos**, nome `flashy_aid`.
2. **localStorage** chave `flashy:aid`.

Por quê dois lugares: cookie sobrevive a alguns cenários que localStorage não (subdomínio diferente eventual, contexto de iframe), e vice-versa. Redundância barata.

**Sync entre os dois:** no boot do app, se um existe e o outro não, copia. Se ambos existem e divergem, **cookie ganha** (servidor é fonte de verdade pra requests).

### 1.3 O que NÃO sobrevive

- Limpeza explícita de cookies + storage do browser → perde tudo. **Aceito.** Comunicar 1x na UI (ver 1.5).
- Modo anônimo/incógnito do browser → vira identidade efêmera. **Aceito.**
- Trocar de browser/device → vira outro usuário. **Aceito até login existir.**

### 1.4 Visibilidade pro user (mostrar ou esconder?)

**Esconder por padrão.** Não mostrar UUID, não chamar de "ID". 99% dos users não precisam saber.

Onde aparece:
- Em **Configurações > Conta** (menu discreto), mostrar:
  - "Você está usando o Flashy de forma anônima."
  - "Seus decks ficam salvos neste navegador. Pra acessar de outro lugar, faça login (em breve)."
  - Botão **"Copiar código de recuperação"** que copia o `anonymous_id` (caso power-user queira backup manual). Sem documentar muito — é escape hatch, não feature destacada.

Não mostrar na home, não mostrar no topbar, não badge "anônimo". A identidade anônima é silenciosa.

### 1.5 Aviso de risco (1x)

Quando o user cria o **terceiro deck** anônimo, mostrar banner discreto no topo:

> "Seus decks só existem neste navegador. [Entrar / criar conta] pra não perder."

Dispensável (X), reaparece após 7 dias se ainda anônimo. **Não bloquear nada.** Só lembrar.

(Threshold 3 decks = sinal de uso real. Antes disso, banner = ruído.)

---

## 2. Ownership

### 2.1 Quem pode criar

**Qualquer um.** Anônimo ou logado, sem diferença. Criar deck nunca pede nada.

Limite: ver rate limit em §6.4.

### 2.2 Modelo de propriedade

Todo deck tem **exatamente um dono** (`owner_id` aponta pra um user — anônimo ou logado).

Sem co-ownership no MVP. Sem orgs. Sem times.

### 2.3 Quem pode editar

**Apenas o dono.** Editar = adicionar/remover/modificar cards, renomear deck, mudar visibilidade, mover pra pasta.

Visitante de deck público: **read-only**, não vê botão de edit.

### 2.4 Quem pode deletar

**Apenas o dono.** Deletar é destrutivo e definitivo (soft delete no banco mas user não recupera via UI — ver §6.3).

### 2.5 Quem pode duplicar/clonar deck público

**Qualquer um** (anônimo ou logado), em qualquer deck **público** que não seja seu.

Clonar = cria deck novo com `owner_id` = clonador. Cards são **copiados** (snapshot, não referência). Não há link de "fork" rastreado no MVP — clone é um deck novo independente.

**Atribuição:** o deck clonado mostra na descrição "Baseado em '[nome original]' por anônimo/usuário X" durante 30 dias após clone. Some depois. Razão: dar crédito sem virar feature social permanente.

Deck **privado**: só o dono enxerga, então a pergunta de clone não se aplica.

---

## 3. Visibilidade

### 3.1 Default: público

Todo deck criado é **público** por padrão. Razão: anti-Quizlet quer descobribilidade; a maioria dos decks tem valor pra outros (capitais, idiomas, etc.); pedir pra marcar público a cada criação é fricção.

### 3.2 Flag privada

Na tela de criação, abaixo do textarea de import, um toggle:

```
[ ] Manter este deck só pra mim
```

Default desligado. Toggle simples, sem modal explicando.

Privacidade depois de criado: editável a qualquer momento em "Editar deck > Visibilidade".

### 3.3 Quem vê decks públicos e onde

**Decisão:** decks públicos aparecem em **dois lugares**:

1. **Tela "Explorar"** (rota `#/explorar`) — listagem dos decks públicos. Ordenação default: **mais clonados** (proxy de qualidade). Filtros básicos: idioma (detectado pelo TTS lang), tamanho (pequeno/médio/grande). Busca por nome.

2. **Link direto** — toda URL de deck público é acessível por qualquer pessoa sem login. `quiz.did.lu/#/deck/<deck_id>` funciona pra qualquer visitante.

**Explorar é simples no MVP:** lista paginada, 20 por página. Sem feed, sem categorias curadas, sem destaques. Só listagem + busca + 2 filtros.

### 3.4 Deck privado — comportamento

- Não aparece em Explorar.
- URL direta retorna 404 (não 403 — não vazar existência).
- Só o dono enxerga na home, na lista, no Explorar (não, na verdade não aparece nem pro dono em Explorar — Explorar é só públicos).
- Lista do dono ("Meus decks") mostra ambos, com badge `🔒` discreto em privados.

### 3.5 Mudar visibilidade depois

**Público → Privado:** permitido a qualquer momento. Clones já existentes **não** são afetados (já são decks independentes do clonador).

**Privado → Público:** permitido. Sem revisão, sem moderação prévia (ver §6.5).

---

## 4. Pastas

### 4.1 Escopo

Pasta é organização **pessoal** do dono. Não é compartilhável, não é descobrível, não tem visibilidade própria.

Pasta é só uma label de organização — agrupa decks pra que o dono encontre rápido.

### 4.2 Quem cria/edita/deleta

**Apenas o dono da pasta.** Pasta pertence a um user (anônimo ou logado), igual deck.

### 4.3 Decks em pasta

- Um deck pode estar em **0 ou 1 pasta** (sem multi-pasta no MVP).
- Pasta só contém decks **do próprio dono**. Não dá pra colocar deck de outra pessoa numa pasta sua (pra colocar, clona primeiro — vira seu — depois move).

### 4.4 Privado vs público dentro de pasta

Pasta **não tem visibilidade**. Ela é só do dono. Mas decks dentro podem ser públicos ou privados — cada deck mantém sua flag própria.

Resultado: pasta "Idiomas" pode ter 3 decks públicos e 2 privados. Visitante de Explorar vê os 3 públicos individualmente (sem saber que estão numa pasta). Dono vê os 5 agrupados na sua área.

### 4.5 Deletar pasta

Deletar pasta **não** deleta os decks. Decks dentro voltam pra "Sem pasta" (raiz da área pessoal).

---

## 5. Claim no login futuro

**Premissa:** login (Logto did.lu) chega numa sprint posterior. Esta spec define o **contrato** pra Dev preparar o banco — implementação UI do claim vem depois.

### 5.1 Fluxo de claim

Quando user anônimo faz login pela primeira vez (assumindo `anonymous_id` X, faz login e recebe `logto_user_id` Y):

1. Backend recebe login com header/cookie contendo `flashy_aid` = X.
2. Backend verifica: existe user logado com Y? Se **não**, cria user logado novo e **atribui** todos os recursos do anônimo X (decks, pastas, profile/XP/medalhas) pro novo user Y. O user anônimo X é marcado `claimed_by = Y` e fica desativo.
3. Se **sim** (Y já existe — login de retorno), perguntar ao user:
   > "Você tem 12 decks criados sem conta neste navegador. Adicionar à sua conta?"
   > `[Adicionar] [Descartar] [Decidir depois]`

   - **Adicionar:** merge — todos os decks de X passam pra Y. Pastas idem. XP/streak: somar XP, manter streak maior, união de medalhas.
   - **Descartar:** anônimo X é apagado.
   - **Decidir depois:** modal some, banner reaparece na próxima sessão. Não bloqueia uso.

### 5.2 Fricção mínima

- Não pedir confirmação pra "Adicionar" se for primeiro login (cenário 2 acima — claim implícito, sem modal).
- Modal só aparece quando há **conflito real** (cenário 3, login retornado em browser que também tem identidade anônima).

### 5.3 Após claim

- `anonymous_id` no cookie/localStorage é **substituído** pelo `user_id` logado.
- Próximas requests vão como user logado.
- Se user faz logout, **volta a ser anônimo** com novo `anonymous_id` (não recupera o antigo — esse foi consumido no claim).

---

## 6. Edge cases — decisões

### 6.1 User anônimo em 2 browsers

**Decisão:** são 2 usuários distintos. Sem merge sem login. **Documentado, aceito.**

Razão: não tem como provar que são a mesma pessoa sem identidade compartilhada. Solução = login (claim resolve).

UX: o banner de "faça login pra não perder" cobre essa dor.

### 6.2 Deck público clonado — ownership

**Decisão:** clone é **100% do clonador**. Original continua do dono original. Sem link de fork rastreado.

Razão: simplifica drasticamente. Se rola alguma feature de "ver de quem veio" no futuro, é cosmético (já temos a string de atribuição por 30 dias, §2.5).

### 6.3 Deletar deck público com N clones

**Decisão:** deletar não afeta clones. Clones já são decks independentes. O original some, clones continuam.

Soft delete no banco (flag `deleted_at`), 30 dias de retenção, depois purge. User não recupera via UI (sem "lixeira" no MVP) — soft delete é só pra Dev poder restaurar manualmente em caso de bug/abuso. **Não comunicar essa retenção** ao user (evita ambiguidade do tipo "ah eu pensei que deletar não deletava de verdade").

### 6.4 Rate limit pra criar deck (anti-spam)

**Decisão:** sim, rate limit por `anonymous_id` E por IP.

- **Anônimo:** máximo **20 decks novos por dia** por `anonymous_id`. Máximo **50 por IP por dia**.
- **Logado:** máximo **100 decks novos por dia**.
- Excedeu: modal "Você criou muitos decks hoje. Tente novamente amanhã." Sem rage-quit (uso real legítimo dificilmente bate 20/dia).

Cards dentro de um deck: máximo **2000 cards** por deck. Acima disso, UI bloqueia import com mensagem.

### 6.5 Conteúdo NSFW / abuso em decks públicos

**Decisão:** **moderação reativa, não proativa.**

- Sem classificador de conteúdo no MVP (custa, demora, falha).
- Botão **"Reportar"** em deck público (visível só pra visitantes, não pro dono). Form simples: 1 dropdown ("Spam", "Conteúdo ofensivo", "Direitos autorais", "Outro"), 1 textarea opcional.
- Reports vão pra fila interna (admin enxerga via endpoint protegido — Dev decide formato).
- **Sem threshold automático.** Decisão de tirar do ar é manual, do user (admin = manu@did.lu por enquanto).
- Deck reportado e removido: vira privado forçado + flag `removed_by_admin`. Dono continua vendo, mas não pode reverter pra público. (Não deletar — preservar histórico pra eventual contestação.)

Comunicar nada disso na UI pro user comum. Reactive moderation é silenciosa.

---

## 7. O que NÃO está no MVP desta sprint

Cortes deliberados pra entregar sprint pequena:

- ❌ Ranking global de decks (likes, views, etc.). Explorar ordena por clones — fim.
- ❌ Comentários em decks públicos.
- ❌ Follow / perfis públicos de usuários.
- ❌ Feed personalizado.
- ❌ Categorias curadas / tags.
- ❌ Co-ownership / decks compartilhados pra edição.
- ❌ Pastas compartilháveis ou aninhadas (subpastas).
- ❌ Convidar amigos.
- ❌ Multi-device sync ativo entre 2 browsers sem login.
- ❌ Lixeira / recuperar deck deletado via UI.
- ❌ Moderação automática (classificador, ML, regex de palavrão).
- ❌ Histórico de versões do deck.
- ❌ Exportar/importar deck via arquivo (futuro, fácil, mas não nesta sprint).
- ❌ Migração automática do localStorage existente pra Postgres na **primeira visita pós-deploy** — isso é da Dev decidir como detectar e oferecer. Esta spec só garante que **o modelo suporta** (cria anônimo no boot, importa decks locais via mesmo fluxo de criação).

---

## 8. KPIs de produto (validar a feature)

Métricas pra observar nas 4 semanas pós-deploy. Não são metas — são sinais.

1. **% decks marcados privado.** Esperado: <15%. Se >40%, default público está errado / UX assustando user.
2. **% de users anônimos que criam 2+ decks.** Esperado: >40%. Mede engajamento real após primeira criação.
3. **Sessões médias por deck público (quem não é dono).** Esperado: >2 por deck público no top 20. Valida que Explorar funciona.
4. **Clone rate** (clones / views únicos de deck público). Esperado: >5%. Se ninguém clona, Explorar tá morto.
5. **Crescimento da base de decks públicos.** Esperado: crescimento orgânico mesmo sem marketing.
6. **Claim rate no login (quando login entrar).** Esperado: >70% dos primeiros logins têm identidade anônima pré-existente — valida que anônimo é o ponto de entrada real.
7. **Reports / 1000 decks públicos.** Esperado: <2. Se explodir, moderação reativa não tá dando conta.
8. **Tempo médio entre criar deck e primeira sessão de jogo.** Esperado: <60s. Mede a promessa "criar rápido → jogar rápido".

Não usar pra trigger de feature flag — usar pra **conversar com o user** no fim da sprint e decidir próximo passo.

---

## 9. Resumo das decisões (TL;DR)

| Item | Decisão |
|------|---------|
| `anonymous_id` | UUID v4, cookie + localStorage, lazy creation |
| Visibilidade do ID | Escondido, só em Configurações > Conta |
| Banner "faça login" | Aparece após 3º deck, dispensável, volta em 7 dias |
| Ownership | Um dono por deck, sem co-ownership |
| Edit/delete | Só o dono |
| Clone | Qualquer um clona público, vira seu, com atribuição 30 dias |
| Default visibilidade | Público |
| Toggle privado | Checkbox simples na criação |
| Explorar | Rota `#/explorar`, ordenação por clones, busca + 2 filtros |
| Pastas | Pessoais, não compartilháveis, 0 ou 1 pasta por deck |
| Deletar pasta | Não deleta decks, voltam pra raiz |
| Claim no login | Implícito se único, modal se conflito |
| 2 browsers anônimos | 2 users, sem merge sem login |
| Delete público com clones | Clones intactos, original some |
| Rate limit anônimo | 20 decks/dia por aid, 50 por IP |
| Cards por deck | Máximo 2000 |
| Moderação | Reativa, botão Report, decisão manual |
| Out do MVP | Ranking, comments, follow, categorias, co-own, subpastas |

---

## 10. Perguntas pro user antes da Dev começar

Decisões que tomei mas que dependem de confirmação. Se o user discordar, vale derrubar:

1. **Default público.** Confirmado pelo brief, mas vale checar se o user quer que a UI de criação destaque "será público" ou se segue silencioso (default invisível).
2. **Rate limit anônimo 20/dia.** Número arbitrário. Mais conservador (10) ou mais liberal (50)?
3. **Banner "faça login" no 3º deck.** Pode ser percebido como fricção. Manter ou tirar até login real existir?
4. **Explorar no MVP desta sprint.** Eu incluí porque sem Explorar "público" não significa nada. Confirmar se entra junto ou se entra na sprint seguinte (e neste caso "público" é só "acessível por link direto").
5. **Atribuição de clone por 30 dias.** É feature social leve. Cortar pro MVP ainda mais enxuto? Eu mantive porque é o único reconhecimento de autoria — sem isso, criador público fica anônimo total.
