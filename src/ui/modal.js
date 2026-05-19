import { el } from '../core/util.js';

// Modal custom (nada de confirm() do browser).
export function openModal({ title, content, actions = [] }) {
  return new Promise(resolve => {
    const backdrop = el('div', { class: 'modal-backdrop' });
    const modal = el('div', { class: 'modal stack stack-4' }, [
      title ? el('h2', {}, [title]) : null,
      typeof content === 'string' ? el('div', { class: 'muted' }, [content]) : content,
      el('div', { class: 'row gap-2', style: { justifyContent: 'flex-end' } },
        actions.map(a => el('button', {
          class: 'btn ' + (a.variant === 'primary' ? 'btn-primary' : a.variant === 'danger' ? 'btn-danger' : ''),
          onClick: () => { document.body.removeChild(backdrop); resolve(a.value); }
        }, [a.label]))
      )
    ]);
    backdrop.appendChild(modal);
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) { document.body.removeChild(backdrop); resolve(null); }
    });
    document.body.appendChild(backdrop);
    const esc = e => {
      if (e.key === 'Escape') { document.body.removeChild(backdrop); window.removeEventListener('keydown', esc); resolve(null); }
    };
    window.addEventListener('keydown', esc);
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
