// Detecção barata de idioma por amostra de palavras.
// Mesma heurística do client (src/core/audio.js) — duplicada de propósito
// pra evitar dependência cruzada e pra detectar 1× no servidor na criação do deck.
// Quando inconclusivo, retorna null (deixa o client tentar de novo via fallback).

const LANG_WORDS = {
  pt: ['de','a','o','e','do','da','em','um','para','com','não','que','os','as','no','na','ção','são','água','cidade','capital'],
  es: ['de','la','el','en','y','un','una','que','no','es','los','las','por','con','para','capital','ciudad'],
  fr: ['de','la','le','et','à','un','une','est','que','pour','avec','sans','dans','capitale','ville'],
  de: ['der','die','das','und','ist','ein','eine','mit','für','auf','von','zu','stadt','hauptstadt'],
  it: ['di','la','il','e','un','una','che','per','con','sono','è','città','capitale'],
  en: ['the','and','is','of','to','a','in','that','it','with','for','as','on','city','capital']
};

const ACCENT_HINTS = {
  pt: /[ãõçáéíóúâêô]/i,
  es: /[ñáéíóúü¡¿]/i,
  fr: /[àâçéèêëîïôûüœ]/i,
  de: /[äöüß]/i,
  it: /[àèéìíòù]/i
};

function detectLang(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();

  for (const [lang, re] of Object.entries(ACCENT_HINTS)) {
    if (re.test(lower)) return lang;
  }

  const words = lower.match(/[a-zà-ÿ]+/gi) || [];
  if (!words.length) return null;

  const scores = {};
  for (const [lang, list] of Object.entries(LANG_WORDS)) {
    let s = 0;
    for (const w of words) if (list.includes(w)) s++;
    scores[lang] = s;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best[1] === 0) return null;
  return best[0];
}

// Recebe os cards do deck (ou um subset) e retorna { front, back }.
// Concatena até 10 cards de cada lado pra amostra robusta.
function detectDeckLangs(cards) {
  if (!Array.isArray(cards) || !cards.length) return { front: null, back: null };
  const sample = cards.slice(0, 10);
  return {
    front: detectLang(sample.map(c => c.front || '').join(' ')),
    back:  detectLang(sample.map(c => c.back  || '').join(' '))
  };
}

module.exports = { detectLang, detectDeckLangs };
