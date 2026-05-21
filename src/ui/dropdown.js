// Dropdown custom. Botão + popup com lista de items.
// Sem libs, sem <select>. Reusado em pasta, ordenação, popup do topbar.

import { el } from '../core/util.js';
import { iconChevronDown } from './icons.js';

/**
 * dropdown({ trigger, items, align?, getItems?, menu? })
 *   - `trigger` pode ser string ou Element. Se string, vira <button> default.
 *   - items podem ser { label, onSelect, value, active, icon, role?, ariaChecked? }
 *     ou separator: { separator: true }.
 *   - `icon`: Element SVG (ou função que retorna Element) renderizado à esquerda
 *     do label, dentro do `.dropdown-item`.
 *   - `align` = 'left' | 'right' (default 'left').
 *   - `menu`: quando true, popup ganha role="menu" e items role="menuitem" +
 *     navegação por setas. Default false pra compat com chamadores antigos.
 *   - Retorna o wrapper. Toggle automático em outside-click e Escape.
 *   - Detecta espaço vertical: se não cabe abaixo, flipa pra cima (.dropdown-popup-up).
 *   - Suporta `trigger` async: passe `getItems` e o popup pega o conteúdo a cada open.
 */
export function dropdown({ trigger, items = [], align = 'left', getItems, menu = false } = {}) {
  const wrap = el('div', { class: 'dropdown' });
  const btn = (typeof trigger === 'string' || trigger == null)
    ? el('button', { class: 'btn btn-sm dropdown-trigger', attrs: { type: 'button' } }, [
        trigger || '',
        iconChevronDown(12)
      ])
    : trigger;
  if (!btn.classList.contains('dropdown-trigger')) btn.classList.add('dropdown-trigger');
  if (menu && !btn.hasAttribute('aria-haspopup')) btn.setAttribute('aria-haspopup', 'menu');
  if (!btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', 'false');
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

  function focusableItems() {
    if (!popup) return [];
    return Array.from(popup.querySelectorAll('.dropdown-item'));
  }

  function focusNext(delta) {
    const items = focusableItems();
    if (!items.length) return;
    const active = document.activeElement;
    let idx = items.indexOf(active);
    if (idx === -1) idx = delta > 0 ? -1 : items.length;
    let next = idx + delta;
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    items[next].focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      btn.focus();
      return;
    }
    if (!menu) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); focusNext(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusNext(-1); }
    else if (e.key === 'Home') {
      const its = focusableItems(); if (its.length) { e.preventDefault(); its[0].focus(); }
    } else if (e.key === 'End') {
      const its = focusableItems(); if (its.length) { e.preventDefault(); its[its.length - 1].focus(); }
    }
  }

  function resolveIcon(maybe) {
    if (!maybe) return null;
    try {
      const node = typeof maybe === 'function' ? maybe() : maybe;
      if (node && node.nodeType === 1) return node;
    } catch {}
    return null;
  }

  function buildPopup(itemsForOpen) {
    popup = el('div', { class: 'dropdown-popup ' + (align === 'right' ? 'dropdown-popup-right' : '') });
    if (menu) popup.setAttribute('role', 'menu');

    for (const it of itemsForOpen) {
      if (it && it.separator) {
        const sep = el('div', { class: 'dropdown-sep' });
        if (menu) sep.setAttribute('role', 'separator');
        popup.appendChild(sep);
        continue;
      }
      if (!it) continue;

      const itemEl = el('button', {
        class: 'dropdown-item' + (it.active ? ' dropdown-item-active' : ''),
        attrs: { type: 'button' }
      });

      if (menu) {
        itemEl.setAttribute('role', it.role || 'menuitem');
        if (it.role === 'menuitemcheckbox' || it.ariaChecked != null) {
          itemEl.setAttribute('aria-checked', it.ariaChecked ? 'true' : 'false');
        }
      }

      const iconNode = resolveIcon(it.icon);
      if (iconNode) {
        iconNode.classList && iconNode.classList.add('dropdown-item-icon');
        itemEl.appendChild(iconNode);
      }
      const labelNode = el('span', { class: 'dropdown-item-label' });
      if (typeof it.label === 'string') labelNode.textContent = it.label;
      else if (it.label) labelNode.appendChild(it.label);
      itemEl.appendChild(labelNode);

      itemEl.addEventListener('click', (e) => {
        e.preventDefault();
        close();
        try { it.onSelect && it.onSelect(it.value); } catch (err) { console.error(err); }
      });
      popup.appendChild(itemEl);
    }
    wrap.appendChild(popup);

    // Detecção de espaço vertical: se há menos que ~popupHeight + 12 pixels
    // abaixo do botão, flipa pra cima. Evita popup cobrindo botões finais
    // (relevante em sessionEndModal). Usa rAF pra medir só após o paint.
    requestAnimationFrame(() => {
      if (!popup) return;
      const btnRect = btn.getBoundingClientRect();
      const popupHeight = popup.offsetHeight || 200;
      const spaceBelow = window.innerHeight - btnRect.bottom;
      const spaceAbove = btnRect.top;
      if (spaceBelow < popupHeight + 12 && spaceAbove > spaceBelow) {
        popup.classList.add('dropdown-popup-up');
      }
    });
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

    // Foca primeiro item se modo menu.
    if (menu) {
      requestAnimationFrame(() => {
        const first = popup && popup.querySelector('.dropdown-item');
        if (first) first.focus();
      });
    }
  }

  btn.addEventListener('click', toggleOpen);

  wrap.close = close;
  wrap.toggle = toggleOpen;
  return wrap;
}
