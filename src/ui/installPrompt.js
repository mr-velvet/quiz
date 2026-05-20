// Botão custom "Adicionar à tela inicial".
// Android/Chrome: usa beforeinstallprompt nativo.
// iOS Safari: detecta + mostra dica "Compartilhar → Adicionar à Tela Inicial".
// Desktop: nada.
// Dismiss persiste 30 dias.

const DISMISSED_KEY = 'flashy:install-dismissed-at';
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 5000;

function isMobile() {
  try { return window.matchMedia('(pointer:coarse)').matches; } catch { return false; }
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return iOS && webkit;
}

function isStandalone() {
  return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
    || navigator.standalone === true;
}

function wasRecentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) && (Date.now() - ts < DISMISS_TTL_MS);
  } catch { return false; }
}

function markDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
}

export function mountInstallPrompt(parent) {
  if (!isMobile()) return;
  if (isStandalone()) return;
  if (wasRecentlyDismissed()) return;

  let deferredPrompt = null;
  let shownNode = null;

  function buildBanner({ title, sub, ctaText, onCta }) {
    const node = document.createElement('div');
    node.className = 'install-prompt';
    node.setAttribute('data-testid', 'install-prompt');
    node.innerHTML = `
      <div class="install-prompt-icon">F</div>
      <div class="install-prompt-body">
        <div class="install-prompt-title">${title}</div>
        <div class="install-prompt-sub">${sub}</div>
      </div>
      <div class="install-prompt-actions">
        ${ctaText ? `<button class="btn btn-primary btn-sm" data-cta>${ctaText}</button>` : ''}
        <button class="install-prompt-close" data-close aria-label="Fechar">×</button>
      </div>
    `;
    if (ctaText && onCta) {
      node.querySelector('[data-cta]').addEventListener('click', onCta);
    }
    node.querySelector('[data-close]').addEventListener('click', () => {
      markDismissed();
      node.classList.remove('install-prompt-visible');
      setTimeout(() => node.remove(), 320);
    });
    parent.appendChild(node);
    setTimeout(() => node.classList.add('install-prompt-visible'), 30);
    return node;
  }

  // Android/Chrome
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
      if (shownNode) return;
      shownNode = buildBanner({
        title: 'Instalar Flashy',
        sub: 'Adicione à tela inicial pra acesso rápido',
        ctaText: 'Instalar',
        onCta: async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          try {
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') markDismissed();
          } catch {}
          deferredPrompt = null;
          shownNode.classList.remove('install-prompt-visible');
          setTimeout(() => shownNode.remove(), 320);
        }
      });
    }, SHOW_DELAY_MS);
  });

  // iOS Safari
  if (isIOSSafari()) {
    setTimeout(() => {
      if (shownNode || isStandalone()) return;
      shownNode = buildBanner({
        title: 'Instalar Flashy',
        sub: 'Toque em Compartilhar → "Adicionar à Tela Inicial"',
        ctaText: null
      });
    }, SHOW_DELAY_MS);
  }

  // Quando app vira standalone (instalou), limpa.
  window.addEventListener('appinstalled', () => {
    markDismissed();
    if (shownNode) { shownNode.remove(); shownNode = null; }
  });
}
