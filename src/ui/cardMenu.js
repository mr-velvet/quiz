// Menu contextual de carta — kebab que abre dropdown com:
//   - Adicionar/Remover da revisão (toggle)
//   - Ouvir frente
//   - Ouvir verso
//   - Copiar texto
//
// Usado em: lista de cards no deck, sessionEndModal, explore.
//
// Persistência local: otimista via `core/reviewList.js`. Toast com "Desfazer".

import { el } from '../core/util.js';
import { dropdown } from './dropdown.js';
import { toast } from './toast.js';
import {
  iconKebab, iconBookmark, iconBookmarkCheck,
  iconSpeakerOn, iconCopy
} from './icons.js';
import { markCard, unmarkCard, isMarked, onReviewChange } from '../core/reviewList.js';
import { playCardAudio, detectDeckLang } from '../core/audio.js';

/**
 * cardMenu({ card, deck, context, lang?, onChange? })
 *
 *   - `card`: { id, front, back }.
 *   - `deck`: deck completo (precisa pra detectar lang e pra deckId).
 *   - `context`: 'deck' | 'sessionEnd' | 'explore' — afeta `source` na API e
 *     classes CSS opcionais. Não muda os items.
 *   - `lang`: opcional override de detectDeckLang(deck).
 *   - `onChange(isInReview)`: callback após toggle bem-sucedido. Útil pra UI
 *     externa reagir (ex: re-render do item).
 *
 * Retorna o wrapper do dropdown (Element) já com o botão kebab dentro.
 */
export function cardMenu({ card, deck, context = 'deck', lang, onChange } = {}) {
  if (!card || !deck) {
    return el('span'); // defensivo — não quebra a UI.
  }
  const deckId = deck.id;
  const deckLang = lang || detectDeckLang(deck);
  const source = sourceFor(context);

  const kebabBtn = el('button', {
    class: 'btn btn-icon btn-sm card-action-kebab',
    attrs: {
      type: 'button',
      'aria-label': 'Mais opções da carta'
    }
  });
  kebabBtn.appendChild(iconKebab(16));

  async function toggleReview() {
    const wasMarked = isMarked(deckId, card.id);
    if (wasMarked) {
      try {
        await unmarkCard(deckId, card.id);
        toast('Removido da revisão', {
          kind: 'info',
          action: {
            label: 'Desfazer',
            onClick: () => {
              markCard(deckId, card.id, source).catch(() => {
                toast('Erro ao desfazer.', { kind: 'error' });
              });
            }
          }
        });
        if (onChange) onChange(false);
      } catch {
        toast('Erro ao remover.', { kind: 'error' });
      }
    } else {
      try {
        await markCard(deckId, card.id, source);
        toast('Adicionado à revisão', {
          kind: 'success',
          action: {
            label: 'Desfazer',
            onClick: () => {
              unmarkCard(deckId, card.id).catch(() => {
                toast('Erro ao desfazer.', { kind: 'error' });
              });
            }
          }
        });
        if (onChange) onChange(true);
      } catch {
        toast('Erro ao marcar.', { kind: 'error' });
      }
    }
  }

  function copyText() {
    const text = `${card.front}\t${card.back}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => toast('Texto copiado', { kind: 'success' }),
          () => fallbackCopy(text)
        );
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Texto copiado', { kind: 'success' });
    } catch {
      toast('Não foi possível copiar.', { kind: 'error' });
    }
  }

  const wrap = dropdown({
    trigger: kebabBtn,
    align: 'right',
    menu: true,
    getItems: () => {
      const marked = isMarked(deckId, card.id);
      return [
        {
          label: marked ? 'Remover da revisão' : 'Adicionar à revisão',
          icon: () => marked ? iconBookmarkCheck(14) : iconBookmark(14),
          role: 'menuitemcheckbox',
          ariaChecked: marked,
          onSelect: toggleReview
        },
        { separator: true },
        {
          label: 'Ouvir frente',
          icon: () => iconSpeakerOn(14),
          onSelect: () => playCardAudio(deckId, card.id, 'front', deckLang?.front).catch(() => {})
        },
        {
          label: 'Ouvir verso',
          icon: () => iconSpeakerOn(14),
          onSelect: () => playCardAudio(deckId, card.id, 'back', deckLang?.back).catch(() => {})
        },
        {
          label: 'Copiar texto',
          icon: () => iconCopy(14),
          onSelect: copyText
        }
      ];
    }
  });

  // Re-renderiza interno do popup quando a marca muda externamente
  // (ex: user clicou "Marcar todos" e este card faz parte). Como o popup é
  // construído on-open via `getItems`, basta garantir que próximo open lê o
  // estado fresco. Nada a fazer aqui.
  return wrap;
}

function sourceFor(context) {
  switch (context) {
    case 'sessionEnd': return 'session_end_modal';
    case 'explore':    return 'explore';
    case 'deck':       return 'manual_deck';
    default:           return 'manual_deck';
  }
}

// Helper: cria um listener que dispara `fn(deckId)` quando QUALQUER mudança
// de revisão acontece. Útil pra UI externa (CTA contador, etc).
export function onAnyReviewChange(fn) {
  return onReviewChange(({ deckId }) => fn(deckId));
}
