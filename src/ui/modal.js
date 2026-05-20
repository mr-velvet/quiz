import { el } from '../core/util.js';

// Modal custom (nada de confirm() do browser).
export function openModal({ title, content, actions = [] }) {
  return new Promise(resolve => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('hashchange', onHash);
      resolve(value);
    }
    const modal = el('div', { class: 'modal stack stack-4' }, [
      title ? el('h2', {}, [title]) : null,
      typeof content === 'string' ? el('div', { class: 'muted' }, [content]) : content,
      el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end' } },
        actions.map(a => el('button', {
          class: 'btn ' + (a.variant === 'primary' ? 'btn-primary' : a.variant === 'danger' ? 'btn-danger' : ''),
          onClick: () => close(a.value)
        }, [a.label]))
      )
    ]);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) close(null);
    });
    document.body.appendChild(backdrop);
    const esc = e => {
      if (e.key === 'Escape') close(null);
    };
    // Fecha se a hash mudar (user navegou com Voltar/link enquanto modal aberto).
    const onHash = () => close(null);
    window.addEventListener('keydown', esc);
    window.addEventListener('hashchange', onHash);
  });
}

// Fecha todos os modais abertos. Idempotente. Usado pelo router/topbar
// antes de re-render pra garantir que backdrop não fica preso capturando cliques.
export function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(b => {
    if (b.parentNode) b.parentNode.removeChild(b);
  });
}

export function confirmModal(title, message) {
  return openModal({
    title,
    content: message,
    actions: [
      { label: 'Cancelar', value: false },
      { label: 'Confirmar', value: true, variant: 'danger' }
    ]
  });
}
