// Botão "+ Revisão" / "✓ Marcada" pós-resposta.
//
// Pequeno componente inline pra usar dentro dos modos (flashcards, MC, write)
// quando o user acabou de responder e está na janela de feedback.
//
// API:
//   revisionButton({ card, deck, onChange? })
//     → retorna Element (botão) com método `.toggle()` exposto pra atalho R.

import { el } from '../core/util.js';
import { toast } from './toast.js';
import { markCard, unmarkCard, isMarked } from '../core/reviewList.js';

export function revisionButton({ card, deck, onChange } = {}) {
  if (!card || !deck) return el('span');
  const deckId = deck.id;

  const btn = el('button', {
    class: 'btn btn-sm btn-revision',
    attrs: {
      type: 'button',
      'aria-label': 'Marcar carta para revisão depois'
    }
  });

  function render() {
    const marked = isMarked(deckId, card.id);
    btn.textContent = marked ? '✓ Marcada' : '+ Revisão';
    btn.setAttribute('aria-pressed', marked ? 'true' : 'false');
    btn.classList.toggle('btn-revision-on', marked);
  }
  render();

  async function toggle() {
    const wasMarked = isMarked(deckId, card.id);
    try {
      if (wasMarked) {
        await unmarkCard(deckId, card.id);
        toast('Removido da revisão', {
          kind: 'info',
          action: {
            label: 'Desfazer',
            onClick: () => {
              markCard(deckId, card.id, 'session_wrong').then(render).catch(() => {});
            }
          }
        });
      } else {
        await markCard(deckId, card.id, 'session_wrong');
        toast('Adicionado à revisão', {
          kind: 'success',
          action: {
            label: 'Desfazer',
            onClick: () => {
              unmarkCard(deckId, card.id).then(render).catch(() => {});
            }
          }
        });
      }
      render();
      if (onChange) onChange(isMarked(deckId, card.id));
    } catch {
      toast('Erro. Tente de novo.', { kind: 'error' });
      render();
    }
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });
  btn.toggle = toggle;
  btn.refresh = render;
  return btn;
}
