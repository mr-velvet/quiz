// SVGs inline reutilizáveis. Todos retornam Element (não string), prontos pra appendChild.
// Strokes seguem `currentColor` — cor controlada por CSS.

function svg(size, paths, viewBox = '0 0 24 24', strokeWidth = 1.5) {
  const NS = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(NS, 'svg');
  node.setAttribute('viewBox', viewBox);
  node.setAttribute('width', String(size));
  node.setAttribute('height', String(size));
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', 'currentColor');
  node.setAttribute('stroke-width', String(strokeWidth));
  node.setAttribute('stroke-linecap', 'round');
  node.setAttribute('stroke-linejoin', 'round');
  for (const d of paths) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    node.appendChild(p);
  }
  return node;
}

export function iconLock(size = 12) {
  // Corpo + arco. 16-grid, mas usamos viewBox 0 0 16 16 explicitamente.
  return svg(size, [
    'M5 7V5a3 3 0 0 1 6 0v2',
    'M3.5 7h9v6.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5z'
  ], '0 0 16 16', 1.3);
}

export function iconGlobe(size = 12) {
  return svg(size, [
    'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13z',
    'M1.5 8h13',
    'M8 1.5c1.8 2 2.7 4.2 2.7 6.5s-.9 4.5-2.7 6.5',
    'M8 1.5c-1.8 2-2.7 4.2-2.7 6.5s.9 4.5 2.7 6.5'
  ], '0 0 16 16', 1.3);
}

export function iconFolder(size = 14) {
  return svg(size, [
    'M2.5 5.5a1 1 0 0 1 1-1H6l1.4 1.5h5.1a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z'
  ], '0 0 16 16', 1.3);
}

export function iconSearch(size = 14) {
  return svg(size, [
    'M10.5 10.5L14 14',
    'M7 12a5 5 0 1 1 0-10a5 5 0 0 1 0 10z'
  ], '0 0 16 16', 1.5);
}

export function iconKebab(size = 16) {
  // Três pontos verticais.
  const NS = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(NS, 'svg');
  node.setAttribute('viewBox', '0 0 16 16');
  node.setAttribute('width', String(size));
  node.setAttribute('height', String(size));
  node.setAttribute('fill', 'currentColor');
  for (const y of [3.5, 8, 12.5]) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '8');
    c.setAttribute('cy', String(y));
    c.setAttribute('r', '1.4');
    node.appendChild(c);
  }
  return node;
}

export function iconCompass(size = 14) {
  // Círculo + losango interno.
  const NS = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(NS, 'svg');
  node.setAttribute('viewBox', '0 0 16 16');
  node.setAttribute('width', String(size));
  node.setAttribute('height', String(size));
  node.setAttribute('fill', 'none');
  node.setAttribute('stroke', 'currentColor');
  node.setAttribute('stroke-width', '1.4');
  node.setAttribute('stroke-linejoin', 'round');
  node.setAttribute('stroke-linecap', 'round');
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', '8'); c.setAttribute('cy', '8'); c.setAttribute('r', '6');
  node.appendChild(c);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', 'M10.5 5.5L8 9L5.5 10.5L8 7Z');
  p.setAttribute('fill', 'currentColor');
  node.appendChild(p);
  return node;
}

export function iconChevronDown(size = 12) {
  return svg(size, ['M3 6l5 4.5L13 6'], '0 0 16 16', 1.5);
}

export function iconPlus(size = 14) {
  return svg(size, ['M8 3v10', 'M3 8h10'], '0 0 16 16', 1.5);
}

// Speaker on (3 ondas)
export function iconSpeakerOn(size = 18) {
  return svg(size, [
    'M3 9v6h4l5 4V5L7 9z',
    'M16 8a4 4 0 0 1 0 8',
    'M19 5a8 8 0 0 1 0 14'
  ], '0 0 24 24', 1.6);
}

// Speaker muted (X em cima)
export function iconSpeakerOff(size = 18) {
  return svg(size, [
    'M3 9v6h4l5 4V5L7 9z',
    'M16 9l5 6',
    'M21 9l-5 6'
  ], '0 0 24 24', 1.6);
}

// User (avatar genérico)
export function iconUser(size = 18) {
  return svg(size, [
    'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z',
    'M4 20c1-4 4-6 8-6s7 2 8 6'
  ], '0 0 24 24', 1.6);
}

// Bookmark outline (estado "não marcado")
export function iconBookmark(size = 14) {
  return svg(size, [
    'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z'
  ], '0 0 24 24', 1.6);
}

// Bookmark com check (estado "marcado")
export function iconBookmarkCheck(size = 14) {
  return svg(size, [
    'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z',
    'M9 10l2.5 2.5L15 8.5'
  ], '0 0 24 24', 1.6);
}

// Copy (duas folhas sobrepostas)
export function iconCopy(size = 14) {
  return svg(size, [
    'M9 9h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z',
    'M5 15V4a1 1 0 0 1 1-1h10'
  ], '0 0 24 24', 1.6);
}

// Check simples (usado em items do menu ativos)
export function iconCheck(size = 14) {
  return svg(size, [
    'M5 12l4.5 4.5L19 7'
  ], '0 0 24 24', 1.8);
}

// Chama (streak)
export function iconFlame(size = 14) {
  return svg(size, [
    'M12 3c1 3 3 4 3 7a4 4 0 0 1-8 0c0-2 1-3 2-3c0-2-1-3 3-4z',
    'M10 14c0 1.5.8 3 2 3s2-1.5 2-3'
  ], '0 0 24 24', 1.5);
}
