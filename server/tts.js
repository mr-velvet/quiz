// TTS endpoint: gera áudio dos cards via Google Cloud TTS (Standard) e cacheia no GCS.
// Cache key: sha256(text + lang + voice + model). URL pública via st.did.lu.
//
// Fluxo:
// 1. Recebe { text, lang? }. Sanitiza, valida tamanho.
// 2. Calcula hash determinístico → checa se já existe no GCS via HEAD.
// 3. Se existe, retorna URL e fim.
// 4. Se não, chama Google TTS, recebe mp3 (base64 decodificado), sobe pro GCS, retorna URL.
//
// Provider: Google Cloud Text-to-Speech v1 (voices Standard, ~$4 / 1M chars).
// Auth: Application Default Credentials (mesmo token usado pro upload no GCS,
// obtido via metadata server na VM ou via GCP_ACCESS_TOKEN em dev).
// Scope necessário no token: https://www.googleapis.com/auth/cloud-platform.
//
// Fallback opcional pra OpenAI tts-1:
//   - GOOGLE_TTS_ENABLED=false  → força usar OpenAI
//   - OPENAI_TTS_FALLBACK=true  → se Google falhar (após 1 retry), tenta OpenAI
// Default: Google ativo, sem fallback (falha = 500).
//
// Bucket: didlu-imagestore (público). Path: quiz/tts/<hash>.mp3.
// URL pública curta: https://st.did.lu/quiz/tts/<hash>.mp3.
//
// Áudios antigos (gerados por tts-1) continuam funcionando: URLs ficam cacheadas
// no card.audio.front.url e a constante TTS_MODEL nova ('google-standard-v1')
// muda o hash de gerações futuras — sem colisão.

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // opcional (só pra fallback)
const GCS_BUCKET = process.env.GCS_BUCKET || 'didlu-imagestore';
const GCS_PREFIX = 'quiz/tts';
const ST_BASE = 'https://st.did.lu';
const GCS_BASE = `https://storage.googleapis.com/${GCS_BUCKET}`;
const TTS_MODEL = 'google-standard-v1';
const MAX_TEXT_LEN = 500;

const GOOGLE_TTS_ENABLED = String(process.env.GOOGLE_TTS_ENABLED ?? 'true').toLowerCase() !== 'false';
const OPENAI_TTS_FALLBACK = String(process.env.OPENAI_TTS_FALLBACK ?? 'false').toLowerCase() === 'true';

// Vozes Google Standard por idioma (femininas naturais; escolha conservadora
// que privilegia clareza pra estudo de vocabulário).
const GOOGLE_VOICE_BY_LANG = {
  en: { languageCode: 'en-US', name: 'en-US-Standard-C' },
  pt: { languageCode: 'pt-BR', name: 'pt-BR-Standard-A' },
  es: { languageCode: 'es-ES', name: 'es-ES-Standard-A' },
  fr: { languageCode: 'fr-FR', name: 'fr-FR-Standard-A' },
  de: { languageCode: 'de-DE', name: 'de-DE-Standard-A' },
  it: { languageCode: 'it-IT', name: 'it-IT-Standard-A' },
  default: { languageCode: 'en-US', name: 'en-US-Standard-C' }
};

// Mantido só pro fallback OpenAI.
const OPENAI_VOICE_BY_LANG = {
  en: 'alloy', pt: 'nova', es: 'nova', fr: 'shimmer', de: 'onyx', it: 'echo',
  default: 'alloy'
};

function pickGoogleVoice(lang) {
  return GOOGLE_VOICE_BY_LANG[lang] || GOOGLE_VOICE_BY_LANG.default;
}

function pickOpenAIVoice(lang) {
  return OPENAI_VOICE_BY_LANG[lang] || OPENAI_VOICE_BY_LANG.default;
}

// Hash usa o nome da voz Google como "voice" identificador.
// Pra requests forçados a OpenAI (GOOGLE_TTS_ENABLED=false) usamos voice OpenAI —
// isso garante que os dois universos de áudio ficam em paths separados no GCS.
function hashKey(text, lang, voice, model) {
  return crypto.createHash('sha256')
    .update(`${model}|${voice}|${lang || ''}|${text}`)
    .digest('hex').slice(0, 24);
}

function gcsObjectPath(hash) {
  return `${GCS_PREFIX}/${hash}.mp3`;
}

function publicUrl(hash) {
  return `${ST_BASE}/${gcsObjectPath(hash)}`;
}

// Cache em memória de hashes que sabemos que já existem no GCS.
// Evita o HEAD em hits repetidos (50-100ms a menos por chamada).
const knownHashes = new Map(); // hash -> insertedAt
const KNOWN_TTL_MS = 6 * 60 * 60 * 1000;
const KNOWN_MAX = 5000;

function rememberHash(hash) {
  knownHashes.set(hash, Date.now());
  if (knownHashes.size > KNOWN_MAX) {
    const cutoff = Date.now() - KNOWN_TTL_MS;
    for (const [k, t] of knownHashes) if (t < cutoff) knownHashes.delete(k);
  }
}

function isKnown(hash) {
  const t = knownHashes.get(hash);
  if (!t) return false;
  if (Date.now() - t > KNOWN_TTL_MS) { knownHashes.delete(hash); return false; }
  return true;
}

// HEAD ao objeto público pra checar cache hit sem precisar de credencial.
function checkCache(hash) {
  if (isKnown(hash)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const url = `${GCS_BASE}/${gcsObjectPath(hash)}`;
    const req = https.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      const ok = res.statusCode === 200;
      if (ok) rememberHash(hash);
      resolve(ok);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// Chama Google Cloud Text-to-Speech v1.
// Response: { audioContent: <base64 mp3> }. Decodifica e devolve Buffer.
function callGoogleTTS(text, langCode, voiceName) {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await getAccessToken();
      const body = JSON.stringify({
        input: { text },
        voice: { languageCode: langCode, name: voiceName },
        audioConfig: { audioEncoding: 'MP3' }
      });
      const req = https.request('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 30000
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode !== 200) {
            return reject(new Error(`Google TTS ${res.statusCode}: ${raw.slice(0, 200)}`));
          }
          try {
            const json = JSON.parse(raw);
            if (!json.audioContent) return reject(new Error('Google TTS: no audioContent in response'));
            resolve(Buffer.from(json.audioContent, 'base64'));
          } catch (e) {
            reject(new Error(`Google TTS parse error: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Google TTS timeout')); });
      req.write(body);
      req.end();
    } catch (e) { reject(e); }
  });
}

function callOpenAITTS(text, voice) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) return reject(new Error('OPENAI_API_KEY not set'));
    const body = JSON.stringify({
      model: 'tts-1',
      voice,
      input: text,
      response_format: 'mp3'
    });
    const req = https.request('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode !== 200) {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => reject(new Error(`OpenAI TTS ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`)));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('OpenAI TTS timeout')); });
    req.write(body);
    req.end();
  });
}

// Upload via GCS JSON API. Usa Application Default Credentials (na VM via
// service account do compute engine; localmente via `gcloud auth application-default login`).
// O mesmo token cobre Google TTS — scope precisa incluir cloud-platform.
let cachedToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) return Promise.resolve(cachedToken);
  if (tokenPromise) return tokenPromise;

  tokenPromise = new Promise((resolve, reject) => {
    // Dev override: GCP_ACCESS_TOKEN env (preenchido por `gcloud auth print-access-token`).
    if (process.env.GCP_ACCESS_TOKEN) {
      cachedToken = process.env.GCP_ACCESS_TOKEN;
      tokenExpiry = Date.now() + 30 * 60 * 1000;
      return resolve(cachedToken);
    }

    // Metadata server (funciona em VM GCP). É HTTP, não HTTPS.
    const req = http.request({
      hostname: 'metadata.google.internal',
      path: '/computeMetadata/v1/instance/service-accounts/default/token',
      headers: { 'Metadata-Flavor': 'Google' },
      timeout: 2000
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!json.access_token) return reject(new Error('no access_token from metadata'));
          cachedToken = json.access_token;
          tokenExpiry = Date.now() + (json.expires_in || 3600) * 1000;
          resolve(cachedToken);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('metadata timeout')); });
    req.end();
  }).finally(() => { tokenPromise = null; });

  return tokenPromise;
}

function uploadToGCS(buffer, hash) {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await getAccessToken();
      const objectName = encodeURIComponent(gcsObjectPath(hash));
      const url = `https://storage.googleapis.com/upload/storage/v1/b/${GCS_BUCKET}/o?uploadType=media&name=${objectName}`;
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length
        },
        timeout: 15000
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve();
          reject(new Error(`GCS upload ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`));
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('GCS upload timeout')); });
      req.write(buffer);
      req.end();
    } catch (e) { reject(e); }
  });
}

function sanitize(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT_LEN);
}

// Rate limit por IP: janela deslizante 1min, 30 req. + teto global 500/min.
const rateBuckets = new Map(); // ip -> [timestamps]
let globalBucket = [];
function checkRate(ip) {
  const now = Date.now();
  const windowMs = 60000;
  globalBucket = globalBucket.filter(t => now - t < windowMs);
  if (globalBucket.length >= 500) return false;
  const arr = (rateBuckets.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= 30) { rateBuckets.set(ip, arr); return false; }
  arr.push(now);
  rateBuckets.set(ip, arr);
  globalBucket.push(now);
  if (rateBuckets.size > 1000) {
    // GC simples
    for (const [k, v] of rateBuckets) if (v.length === 0 || now - v[v.length-1] > windowMs) rateBuckets.delete(k);
  }
  return true;
}

// In-flight dedup por hash: chamadas concorrentes pro mesmo texto compartilham geração.
const inFlight = new Map(); // hash -> Promise<{url, hash, cached, bytes}>

// Tenta Google TTS com 1 retry. Se falhar e OPENAI_TTS_FALLBACK=true, cai pra
// OpenAI (e log avisa). Caso contrário propaga o erro.
async function generateAudio(text, langCode) {
  if (GOOGLE_TTS_ENABLED) {
    const voice = pickGoogleVoice(langCode);
    try {
      return await callGoogleTTS(text, voice.languageCode, voice.name);
    } catch (e1) {
      // 1 retry curto antes de desistir do Google.
      await new Promise(r => setTimeout(r, 400));
      try {
        return await callGoogleTTS(text, voice.languageCode, voice.name);
      } catch (e2) {
        if (!OPENAI_TTS_FALLBACK) throw e2;
        console.warn('Google TTS falhou 2x, fallback OpenAI:', e2.message);
      }
    }
  }
  // Caminho OpenAI (forçado ou fallback).
  const openaiVoice = pickOpenAIVoice(langCode);
  try {
    return await callOpenAITTS(text, openaiVoice);
  } catch (e) {
    await new Promise(r => setTimeout(r, 400));
    return await callOpenAITTS(text, openaiVoice);
  }
}

async function generateAndStore(text, langCode, hash) {
  const audio = await generateAudio(text, langCode);
  await uploadToGCS(audio, hash);
  rememberHash(hash);
  return { url: publicUrl(hash), hash, cached: false, bytes: audio.length };
}

async function handleTTS(req, res) {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || 'unknown').toString().split(',')[0].trim();
    if (!checkRate(ip)) return res.status(429).json({ error: 'rate_limit' });

    const { text: raw, lang } = req.body || {};
    const text = sanitize(raw);
    if (!text) return res.status(400).json({ error: 'text required' });
    const langCode = (lang || '').toLowerCase().slice(0, 5) || null;

    // Voice usado no hash depende do provider que vai gerar (Google por default).
    // Isso garante que se algum dia o user trocar GOOGLE_TTS_ENABLED no meio,
    // os áudios novos vão pra hashes separadas e não colidem.
    const voiceForHash = GOOGLE_TTS_ENABLED
      ? pickGoogleVoice(langCode).name
      : pickOpenAIVoice(langCode);
    const hash = hashKey(text, langCode, voiceForHash, TTS_MODEL);
    const url = publicUrl(hash);

    const hit = await checkCache(hash);
    if (hit) return res.json({ url, hash, cached: true });

    let pending = inFlight.get(hash);
    if (!pending) {
      pending = generateAndStore(text, langCode, hash).finally(() => inFlight.delete(hash));
      inFlight.set(hash, pending);
    }
    const result = await pending;
    res.json(result);
  } catch (e) {
    console.error('tts error:', e.message);
    res.status(500).json({ error: 'tts_failed' });
  }
}

module.exports = { handleTTS };
