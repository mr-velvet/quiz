// Anima número subindo A→B via Web Animations API (sem lib).
// Usado no topbar (XP total) e no fim de sessão (XP ganho).

export function animateNumber(node, from, to, durationMs = 900) {
  if (from === to) { node.textContent = formatNumber(to); return; }
  let prefersReducedMotion = false;
  try { prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
  if (prefersReducedMotion) { node.textContent = formatNumber(to); return; }

  const start = performance.now();
  const tick = (ts) => {
    const t = Math.min(1, (ts - start) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const val = Math.round(from + (to - from) * eased);
    node.textContent = formatNumber(val);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1).replace('.0', '') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k';
  return String(n);
}

// Cria um nó animado tipo "+10" que sobe e some.
export function floatingXp({ x, y, value, parent }) {
  const node = document.createElement('div');
  node.className = 'xp-float';
  node.textContent = `+${value} XP`;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  (parent || document.body).appendChild(node);
  let prefersReducedMotion = false;
  try { prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}
  if (prefersReducedMotion) {
    setTimeout(() => node.remove(), 600);
    return;
  }
  requestAnimationFrame(() => node.classList.add('xp-float-up'));
  setTimeout(() => node.remove(), 900);
}
