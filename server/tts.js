// TTS endpoint: gera áudio dos cards via OpenAI tts-1 e cacheia no GCS.
// Cache key: sha256(text + lang + voice + model). URL pública via st.did.lu.
//
// Fluxo:
// 1. Recebe { text, lang? }. Sanitiza, valida tamanho.
// 2. Calcula hash determinístico → checa se já existe no GCS via HEAD.
// 3. Se existe, retorna URL e fim.
// 4. Se não, chama OpenAI tts-1, recebe mp3, sobe pro GCS, retorna URL.
//
// Bucket: didlu-imagestore (público). Path: quiz/tts/<hash>.mp3.
// URL pública curta: https://st.did.lu/quiz/tts/<hash>.mp3.

const crypto = require('crypto');
const https = require('https');
const http = require('http');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GCS_BUCKET = process.env.GCS_BUCKET || 'didlu-imagestore';
const GCS_PREFIX = 'quiz/tts';
const ST_BASE = 'https://st.did.lu';
const GCS_BASE = `https://storage.googleapis.com/${GCS_BUCKET}`;
const TTS_MODEL = 'tts-1';
const MAX_TEXT_LEN = 500;

const VOICE_BY_LANG = {
  en: 'alloy', pt: 'nova', es: 'nova', fr: 'shimmer', de: 'onyx', it: 'echo',
  default: 'alloy'
};

function pickVoice(lang) {
  return VOICE_BY_LANG[lang] || VOICE_BY_LANG.default;
}

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

// HEAD ao objeto público pra checar cache hit sem precisar de credencial.
function checkCache(hash) {
  return new Promise((resolve) => {
    const url = `${GCS_BASE}/${gcsObjectPath(hash)}`;
    const req = https.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function callOpenAITTS(text, voice) {
  return new Promise((resolve, reject) => {
    if (!OPENAI_API_KEY) return reject(new Error('OPENAI_API_KEY not set'));
    const body = JSON.stringify({
      model: TTS_MODEL,
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

async function generateAndStore(text, langCode, voice, hash) {
  let audio;
  try {
    audio = await callOpenAITTS(text, voice);
  } catch (e) {
    // 1 retry com backoff curto
    await new Promise(r => setTimeout(r, 400));
    audio = await callOpenAITTS(text, voice);
  }
  await uploadToGCS(audio, hash);
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
    const voice = pickVoice(langCode);
    const hash = hashKey(text, langCode, voice, TTS_MODEL);
    const url = publicUrl(hash);

    const hit = await checkCache(hash);
    if (hit) return res.json({ url, hash, cached: true });

    let pending = inFlight.get(hash);
    if (!pending) {
      pending = generateAndStore(text, langCode, voice, hash).finally(() => inFlight.delete(hash));
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
