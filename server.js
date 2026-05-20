const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const { handleTTS } = require('./server/tts');
const { attachUser } = require('./server/auth');

const meRouter = require('./server/routes/me');
const decksRouter = require('./server/routes/decks');
const cardsRouter = require('./server/routes/cards');
const foldersRouter = require('./server/routes/folders');
const exploreRouter = require('./server/routes/explore');
const sessionsRouter = require('./server/routes/sessions');
const statsRouter = require('./server/routes/stats');
const devRouter = require('./server/routes/dev');

const app = express();
const PORT = process.env.PORT || 5034;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.set('trust proxy', true);
app.set('query parser', 'simple');
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());

app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`));
  next();
});

// /api/health e /api/tts ANTES do attachUser — não dependem de identidade.
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'quiz' }));
app.post('/api/tts', handleTTS);

// Identidade anônima/logada: cookie flashy_aid → req.user.
// Aplica em toda rota /api depois desse ponto.
app.use('/api', attachUser);

app.use('/api/me', meRouter);
app.use('/api/decks', decksRouter);
app.use('/api/cards', cardsRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/explore', exploreRouter);
app.use('/api/sessions', sessionsRouter);
// statsRouter expõe /me/stats, /me/medals, /me/decks-top, /decks/:id/stats
app.use('/api', statsRouter);
app.use('/api/dev', devRouter);

app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`quiz on port ${PORT}`);
  // Cleanup periódico de sessions pending > 2h.
  if (sessionsRouter.startCleanupLoop) sessionsRouter.startCleanupLoop();
});
