// Áudio dos cards: detecta idioma, pede TTS ao backend, cacheia URL no card,
// toca via <audio> compartilhado.

import { getDeck } from './store.js';
import { setCardAudio } from './api.js';

const audioEl = new Audio();
audioEl.preload = 'auto';

let currentlyPlayingKey = null;

// --- Detecção de idioma --------------------------------------------------

const LANG_WORDS = {
  pt: ['de', 'a', 'o', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'que', 'os', 'as', 'no', 'na', 'ção', 'são', 'água', 'cidade', 'capital'],
  es: ['de', 'la', 'el', 'en', 'y', 'un', 'una', 'que', 'no', 'es', 'los', 'las', 'por', 'con', 'para', 'capital', 'ciudad'],
  fr: ['de', 'la', 'le', 'et', 'à', 'un', 'une', 'est', 'que', 'pour', 'avec', 'sans', 'dans', 'capitale', 'ville'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'mit', 'für', 'auf', 'von', 'zu', 'stadt', 'hauptstadt'],
  it: ['di', 'la', 'il', 'e', 'un', 'una', 'che', 'per', 'con', 'sono', 'è', 'città', 'capitale'],
  en: ['the', 'and', 'is', 'of', 'to', 'a', 'in', 'that', 'it', 'with', 'for', 'as', 'on', 'city', 'capital']
};

const ACCENT_HINTS = {
  pt: /[ãõçáéíóúâêô]/i,
  es: /[ñáéíóúü¡¿]/i,
  fr: /[àâçéèêëîïôûüœ]/i,
  de: /[äöüß]/i,
  it: /[àèéìíòù]/i
};

export function detectLang(text) {
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

// Pega o idioma representativo do deck inteiro (concatena tudo).
export function detectDeckLang(deck) {
  if (!deck || !deck.cards) return null;
  const sampleFront = deck.cards.slice(0, 10).map(c => c.front).join(' ');
  const sampleBack = deck.cards.slice(0, 10).map(c => c.back).join(' ');
  return {
    front: detectLang(sampleFront),
    back: detectLang(sampleBack)
  };
}

// --- TTS ---------------------------------------------------------------

async function fetchTTS(text, lang, signal) {
  const r = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, lang: lang || null }),
    signal
  });
  if (!r.ok) throw new Error(`tts ${r.status}`);
  return r.json();
}

let requestToken = 0;

// Toca o áudio de um lado do card. Se já tem URL cacheada, vai direto.
// Senão pede ao backend, salva URL no card.audio, toca.
//
// `side` = 'front' | 'back'.
// Retorna promessa que resolve quando áudio começa OU rejeita em erro.
export async function playCardAudio(deckId, cardId, side, langHint) {
  const deck = getDeck(deckId);
  if (!deck) throw new Error('no deck');
  const card = deck.cards.find(c => c.id === cardId);
  if (!card) throw new Error('no card');
  const text = side === 'front' ? card.front : card.back;
  if (!text) throw new Error('no text');

  const key = `${cardId}:${side}`;
  if (currentlyPlayingKey === key && !audioEl.paused) {
    audioEl.pause();
    audioEl.currentTime = 0;
    currentlyPlayingKey = null;
    return { stopped: true };
  }

  const myToken = ++requestToken;
  const lang = langHint || (card.audio?.[side]?.lang) || detectLang(text);
  let entry = card.audio?.[side];

  if (!entry || !entry.url || entry.lang !== lang) {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetchTTS(text, lang, ctrl.signal);
    } finally {
      clearTimeout(timeoutId);
    }
    if (myToken !== requestToken) return { aborted: true };
    entry = { url: res.url, lang, hash: res.hash, generatedAt: Date.now() };
    // Atualiza cache local (otimista) e persiste no backend.
    const fresh = getDeck(deckId);
    if (fresh) {
      const freshCard = fresh.cards.find(c => c.id === cardId);
      if (freshCard) {
        freshCard.audio = freshCard.audio || {};
        freshCard.audio[side] = entry;
      }
    }
    // Persistência só funciona pra dono do deck — em deck público de outro o
    // backend responde 404 e a gente apenas ignora (cache local segura a sessão).
    setCardAudio(cardId, side, entry).catch(() => {});
  }

  if (myToken !== requestToken) return { aborted: true };

  audioEl.src = entry.url;
  audioEl.onerror = () => {
    // URL inválida (cache obsoleto?). Invalida do cache em memória — backend
    // será re-pedido na próxima tentativa.
    const fresh = getDeck(deckId);
    if (fresh) {
      const freshCard = fresh.cards.find(c => c.id === cardId);
      if (freshCard?.audio?.[side]?.url === entry.url) {
        delete freshCard.audio[side];
      }
    }
  };
  currentlyPlayingKey = key;
  await audioEl.play();
  return { url: entry.url, lang };
}

export function stopAudio() {
  audioEl.pause();
  audioEl.currentTime = 0;
  currentlyPlayingKey = null;
}

// Cria o botão speaker padrão pros modos. Recebe callback async que toca o áudio.
// Atalho S é registrado pelo modo, não aqui.
export function speakerButton(playFn) {
  const btn = document.createElement('button');
  btn.className = 'speaker-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Ouvir card');
  btn.innerHTML = svgSpeaker();

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (btn.classList.contains('loading')) return;
    btn.classList.add('loading');
    try {
      const result = await playFn();
      if (!result?.stopped && !result?.aborted) {
        btn.classList.add('playing');
        const stop = () => btn.classList.remove('playing');
        audioEl.addEventListener('ended', stop, { once: true });
        audioEl.addEventListener('pause', stop, { once: true });
      }
    } catch (err) {
      console.error('audio err', err);
      btn.classList.add('error');
      setTimeout(() => btn.classList.remove('error'), 1200);
    } finally {
      btn.classList.remove('loading');
    }
  });
  return btn;
}

function svgSpeaker() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
  </svg>`;
}
