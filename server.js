const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5034;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`));
  next();
});

app.use(express.static(PUBLIC_DIR, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'quiz' }));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`quiz on port ${PORT}`));
