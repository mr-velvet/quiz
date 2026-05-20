// Registro do Service Worker. Discreto — falha silenciosa.

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // Só registra em https (ou localhost).
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isLocal && location.protocol !== 'https:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
