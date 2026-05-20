// Toggle switch custom. Nada de <input type=checkbox> — botão puro,
// role=switch, ativável por Espaço/Enter.

import { el } from '../core/util.js';

/**
 * toggle({ checked, onChange, labels?: {on, off}, description? })
 *   - retorna um wrapper com o switch + label dinâmico + descrição.
 *   - onChange recebe o novo valor booleano.
 */
export function toggle({ checked = false, onChange, labels = { on: 'Sim', off: 'Não' }, description } = {}) {
  const knob = el('div', { class: 'toggle-knob' });
  const track = el('div', { class: 'toggle-track' }, [knob]);

  const labelText = el('span', { class: 'toggle-label-text tiny' }, [checked ? labels.on : labels.off]);
  const desc = description
    ? el('div', { class: 'tiny muted toggle-desc' }, [typeof description === 'function' ? description(checked) : description])
    : null;

  const btn = el('button', {
    class: 'toggle' + (checked ? ' toggle-on' : ''),
    attrs: { 'role': 'switch', 'aria-checked': String(checked), 'type': 'button' }
  }, [track, labelText]);

  function setChecked(next) {
    checked = !!next;
    btn.classList.toggle('toggle-on', checked);
    btn.setAttribute('aria-checked', String(checked));
    labelText.textContent = checked ? labels.on : labels.off;
    if (desc) {
      desc.textContent = typeof description === 'function' ? description(checked) : description;
    }
    if (typeof onChange === 'function') onChange(checked);
  }

  btn.addEventListener('click', e => { e.preventDefault(); setChecked(!checked); });
  btn.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setChecked(!checked); }
  });

  const wrap = el('div', { class: 'toggle-wrap stack stack-2' }, [btn, desc]);
  // Expor API pra quem consome ler o estado atual sem precisar de closure externa.
  wrap.getChecked = () => checked;
  wrap.setChecked = (v) => setChecked(v);
  return wrap;
}
