// Dropdown custom. Botão + popup com lista de items.
// Sem libs, sem <select>. Reusado em pasta, ordenação, popup do topbar.

import { el } from '../core/util.js';
import { iconChevronDown } from './icons.js';

/**
 * dropdown({ trigger, items: [{ label, value, onSelect, icon? }], align?, onOpen? })
 *   - `trigger` pode ser string ou Element. Se string, vira <button> default.
 *   - items podem ser { label, onSelect } ou separator: { separator: true }.
 *   - `align` = 'left' | 'right' (default 'left').
 *   - Retorna o wrapper. Toggle automático em outside-click e Escape.
 *   - Suporta `trigger` async: passe uma função e o popup pega o conteúdo a cada open.
 */
export function dropdown({ trigger, items = [], align = 'left', getItems } = {}) {
  const wrap = el('div', { class: 'dropdown' });
  const btn = (typeof trigger === 'string' || trigger == null)
    ? el('button', { class: 'btn btn-sm dropdown-trigger', attrs: { type: 'button' } }, [
        trigger || '',
        iconChevronDown(12)
      ])
    : trigger;
  if (!btn.classList.contains('dropdown-trigger')) btn.classList.add('dropdown-trigger');
  wrap.appendChild(btn);

  let popup = null;
  let open = false;

  function close() {
    if (!open) return;
    open = false;
    if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
    popup = null;
    document.removeEventListener('mousedown', onDocDown, true);
    document.removeEventListener('keydown', onKey, true);
    btn.setAttribute('aria-expanded', 'false');
  }

  function onDocDown(e) {
    if (!popup) return;
    if (popup.contains(e.target) || wrap.contains(e.target)) return;
    close();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
  }

  function buildPopup(itemsForOpen) {
    popup = el('div', { class: 'dropdown-popup ' + (align === 'right' ? 'dropdown-popup-right' : '') });
    for (const it of itemsForOpen) {
      if (it && it.separator) {
        popup.appendChild(el('div', { class: 'dropdown-sep' }));
        continue;
      }
      if (!it) continue;
      const itemEl = el('button', {
        class: 'dropdown-item' + (it.active ? ' dropdown-item-active' : ''),
        attrs: { type: 'button' }
      }, [it.label]);
      itemEl.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        try { it.onSelect && it.onSelect(it.value); } catch (err) { console.error(err); }
      });
      popup.appendChild(itemEl);
    }
    wrap.appendChild(popup);
  }

  function toggleOpen(e) {
    if (e) e.preventDefault();
    if (open) { close(); return; }
    const its = (typeof getItems === 'function') ? getItems() : items;
    open = true;
    buildPopup(its);
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('keydown', onKey, true);
    btn.setAttribute('aria-expanded', 'true');
  }

  btn.addEventListener('click', toggleOpen);

  wrap.close = close;
  wrap.toggle = toggleOpen;
  return wrap;
}
