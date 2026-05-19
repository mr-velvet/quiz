// Storage layer — anonymous nativo via localStorage.
// Estrutura:
//   { decks: { [id]: Deck }, order: [deckId...] }
// Card: { id, front, back, stats: { correct, wrong, lastSeenAt } }
// Deck: { id, name, createdAt, cards: [Card], records: { match, speed } }

const KEY = 'flashy:v1';

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function blankState() {
  return { decks: {}, order: [] };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return blankState();
    if (!parsed.decks) parsed.decks = {};
    if (!Array.isArray(parsed.order)) parsed.order = Object.keys(parsed.decks);
    return parsed;
  } catch {
    return blankState();
  }
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  // dispatch event for reactive listeners
  window.dispatchEvent(new CustomEvent('flashy:change'));
}

export function listDecks() {
  const s = read();
  return s.order.map(id => s.decks[id]).filter(Boolean);
}

export function getDeck(id) {
  const s = read();
  return s.decks[id] || null;
}

export function createDeck(name, cards = []) {
  const s = read();
  const id = uid();
  const deck = {
    id,
    name: (name || 'Sem título').trim(),
    createdAt: Date.now(),
    cards: cards.map(c => ({
      id: uid(),
      front: c.front,
      back: c.back,
      stats: { correct: 0, wrong: 0, lastSeenAt: 0 }
    })),
    records: { match: null, speed: null }
  };
  s.decks[id] = deck;
  s.order.unshift(id);
  write(s);
  return deck;
}

export function deleteDeck(id) {
  const s = read();
  delete s.decks[id];
  s.order = s.order.filter(x => x !== id);
  write(s);
}

export function renameDeck(id, name) {
  const s = read();
  if (!s.decks[id]) return;
  s.decks[id].name = name.trim() || 'Sem título';
  write(s);
}

export function addCards(deckId, cards) {
  const s = read();
  const deck = s.decks[deckId];
  if (!deck) return;
  for (const c of cards) {
    deck.cards.push({
      id: uid(),
      front: c.front,
      back: c.back,
      stats: { correct: 0, wrong: 0, lastSeenAt: 0 }
    });
  }
  write(s);
}

export function recordCardResult(deckId, cardId, correct) {
  const s = read();
  const deck = s.decks[deckId];
  if (!deck) return;
  const card = deck.cards.find(c => c.id === cardId);
  if (!card) return;
  if (correct) card.stats.correct++;
  else card.stats.wrong++;
  card.stats.lastSeenAt = Date.now();
  write(s);
}

export function recordGameScore(deckId, gameKey, score) {
  const s = read();
  const deck = s.decks[deckId];
  if (!deck) return;
  if (!deck.records) deck.records = {};
  const prev = deck.records[gameKey];
  // 'match' menor = melhor (tempo), 'speed' maior = melhor (acertos)
  if (gameKey === 'match') {
    if (!prev || score.timeMs < prev.timeMs) deck.records[gameKey] = { ...score, at: Date.now() };
  } else if (gameKey === 'speed') {
    if (!prev || score.correct > prev.correct) deck.records[gameKey] = { ...score, at: Date.now() };
  } else {
    deck.records[gameKey] = { ...score, at: Date.now() };
  }
  write(s);
}

// Parse texto importado.
// Formato padrão: cada linha é um card. Lado A e B separados por TAB.
// Tolerante a: vários TABs, vírgula+espaço (se sem TAB e sem ; ), ponto-e-vírgula.
// Detecta separador automaticamente examinando a primeira linha não vazia.
export function parseImport(text, sepHint = 'auto') {
  if (!text) return [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  let sep = sepHint;
  if (sep === 'auto') {
    const sample = lines[0];
    if (sample.includes('\t')) sep = '\t';
    else if (sample.includes(';')) sep = ';';
    else if (/ - /.test(sample)) sep = ' - ';
    else if (sample.includes(',')) sep = ',';
    else sep = '\t';
  }

  const cards = [];
  for (const line of lines) {
    const idx = line.indexOf(sep);
    if (idx === -1) continue;
    const front = line.slice(0, idx).trim();
    const back = line.slice(idx + sep.length).trim();
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

// Seeded decks para o user ver algo na primeira abertura.
export function seedIfEmpty() {
  const s = read();
  if (s.order.length > 0) return;
  createDeck('Capitais — América do Sul', parseImport(
    'Brasil\tBrasília\n' +
    'Argentina\tBuenos Aires\n' +
    'Uruguai\tMontevidéu\n' +
    'Chile\tSantiago\n' +
    'Peru\tLima\n' +
    'Colômbia\tBogotá\n' +
    'Venezuela\tCaracas\n' +
    'Equador\tQuito\n' +
    'Bolívia\tSucre\n' +
    'Paraguai\tAssunção\n' +
    'Guiana\tGeorgetown\n' +
    'Suriname\tParamaribo'
  ));
  createDeck('Vocabulário — Inglês ↔ Português', parseImport(
    'ephemeral\tefêmero\n' +
    'serendipity\tserendipidade\n' +
    'cumbersome\tincômodo\n' +
    'mundane\tcomum\n' +
    'whim\tcapricho\n' +
    'foster\tfomentar\n' +
    'plight\tdificuldade\n' +
    'akin\tsemelhante\n' +
    'thorough\tminucioso\n' +
    'fleeting\tpassageiro\n' +
    'cumber\tonerar\n' +
    'glimpse\tvislumbre'
  ));
}

export function exportAll() {
  return JSON.stringify(read(), null, 2);
}
