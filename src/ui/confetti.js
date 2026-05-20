// Confetti custom em canvas. Sem libs.
// 80 partículas mobile, 150 desktop. Gravidade + drag. Auto-pause em document.hidden.
// Reduced-motion → fade-only (sem partículas).
//
// Uso:
//   burst({ x, y, size: 'normal'|'big' })   pequena/grande explosão
//   rain({ duration })                       chuva de 1-2s

let canvas = null;
let ctx = null;
let particles = [];
let rafId = null;
let lastTs = 0;
let prefersReducedMotion = false;

function ensureCanvas() {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.setAttribute('data-testid', 'confetti-canvas');
  canvas.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 9000;
  `;
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  try { prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
  return canvas;
}

function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const PALETTE = ['#ffd166', '#6ee7a8', '#82aaff', '#ff7a8a', '#c084fc', '#f0c419'];

function spawn(count, originX, originY, options = {}) {
  const isMobile = window.innerWidth < 700;
  const cap = isMobile ? 80 : 150;
  const target = Math.min(count, Math.max(0, cap - particles.length));
  for (let i = 0; i < target; i++) {
    const angle = options.angle != null
      ? options.angle + (Math.random() - 0.5) * (options.spread || Math.PI / 3)
      : Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      life: 0,
      maxLife: 60 + Math.random() * 30
    });
  }
  ensureLoop();
}

function ensureLoop() {
  if (rafId != null) return;
  lastTs = performance.now();
  const tick = (ts) => {
    const dt = Math.min(50, ts - lastTs) / 16.67; // normaliza pra ~60fps
    lastTs = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += 0.18 * dt; // gravity
      p.vx *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.life += dt;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      if (p.life >= p.maxLife || p.y > h + 40 || p.x < -40 || p.x > w + 40) {
        particles.splice(i, 1);
      }
    }
    if (particles.length) {
      rafId = requestAnimationFrame(tick);
    } else {
      stop();
    }
  };
  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = [];
}

function fadeOnly(color = '#6ee7a8') {
  // Reduced-motion: fade rápido sem partículas.
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; background: ${color};
    opacity: 0; transition: opacity 200ms ease; pointer-events: none; z-index: 9000;
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = '0.18';
    setTimeout(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 220); }, 200);
  });
}

export function burst({ x, y, size = 'normal' } = {}) {
  ensureCanvas();
  if (prefersReducedMotion) { fadeOnly(); return; }
  const cx = x != null ? x : window.innerWidth / 2;
  const cy = y != null ? y : window.innerHeight / 2;
  const count = size === 'big' ? 110 : size === 'small' ? 20 : 60;
  spawn(count, cx, cy);
}

// Rain de cima da tela por N ms.
export function rain({ duration = 1500 } = {}) {
  ensureCanvas();
  if (prefersReducedMotion) { fadeOnly(); return; }
  const start = performance.now();
  const tick = () => {
    if (performance.now() - start > duration) return;
    const cx = Math.random() * window.innerWidth;
    spawn(8, cx, -10, { angle: Math.PI / 2, spread: Math.PI / 8 });
    setTimeout(tick, 60);
  };
  tick();
}
