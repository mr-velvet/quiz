// Componente de importação com seletor de separador e de colunas.
// Retorna um objeto com:
//   .node      → DOM node pronto pra ser inserido no modal.
//   .getCards()→ array atual de { front, back } parseado.
//   .focus()   → foca no textarea.
//
// Estado interno: separador (default 'auto'), frontCol (default 0), backCol (default 1).
// Quando o usuário cola texto com >2 colunas, expõe radio buttons pra trocar
// quais colunas viram frente/verso. Pra texto com ≤2 colunas, o seletor de
// colunas fica oculto e o comportamento histórico é preservado.

import { el } from '../core/util.js';
import { parseImport, parseImportTable, detectSeparator } from '../core/store.js';

const SEP_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '\t', label: 'Tab' },
  { value: ',', label: 'Vírgula' },
  { value: ';', label: 'Ponto-e-vírgula' },
  { value: ' - ', label: 'Hífen' }
];

export function importPicker({ placeholder, initialText = '' } = {}) {
  let sep = 'auto';
  let frontCol = 0;
  let backCol = 1;
  // Quando o usuário troca manualmente uma coluna, paramos de auto-corrigir nas
  // próximas mudanças de texto — pra não sobrescrever a escolha enquanto digita.
  let userTouchedCols = false;

  const sepRow = el('div', { class: 'row gap-2 import-sep-row', style: { flexWrap: 'wrap', alignItems: 'center' } });
  const sepLabel = el('span', { class: 'tiny muted' }, ['Separador:']);
  sepRow.appendChild(sepLabel);
  const sepButtons = SEP_OPTIONS.map(opt => {
    const btn = el('button', {
      class: 'btn btn-sm',
      attrs: { type: 'button', 'data-sep': opt.value },
      onClick: () => { sep = opt.value; updateSepButtons(); recompute(); }
    }, [opt.label]);
    sepRow.appendChild(btn);
    return btn;
  });
  function updateSepButtons() {
    for (const b of sepButtons) {
      const active = b.getAttribute('data-sep') === sep;
      b.classList.toggle('btn-primary', active);
    }
  }

  const colSelector = el('div', { class: 'import-col-selector', style: { display: 'none' } });

  const previewBadge = el('div', { class: 'tiny muted' }, ['0 cartas']);
  const detectedSepBadge = el('span', { class: 'tiny muted' }, ['']);

  const textarea = el('textarea', {
    class: 'textarea',
    placeholder: placeholder || 'Cole linhas no formato frente\tverso',
    attrs: { 'data-testid': 'deck-text' }
  });
  if (initialText) textarea.value = initialText;

  function truncate(s, n) {
    const t = String(s == null ? '' : s);
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  }

  function buildColSelector(colCount, sampleRow) {
    colSelector.innerHTML = '';
    if (colCount < 3) {
      colSelector.style.display = 'none';
      return;
    }
    colSelector.style.display = '';
    colSelector.appendChild(el('div', { class: 'tiny muted', style: { marginBottom: '6px' } }, [
      `Detectei ${colCount} colunas. Escolha quais usar:`
    ]));

    // Preview do conteúdo de cada coluna (1ª linha colada). Ajuda o user
    // a identificar qual coluna é qual sem precisar contar mentalmente.
    if (sampleRow && sampleRow.length) {
      const previewRow = el('div', { class: 'import-col-preview' });
      for (let i = 0; i < colCount; i++) {
        const val = (sampleRow[i] || '').trim();
        previewRow.appendChild(el('div', { class: 'import-col-preview-cell' }, [
          el('span', { class: 'import-col-preview-label tiny muted' }, [`Col ${i + 1}`]),
          el('span', { class: 'import-col-preview-val' }, [truncate(val, 40) || '—'])
        ]));
      }
      colSelector.appendChild(previewRow);
    }

    const headerRow = el('div', { class: 'import-col-row' });
    headerRow.appendChild(el('span', { class: 'import-col-label tiny' }, ['Frente']));
    for (let i = 0; i < colCount; i++) {
      const sel = i === frontCol;
      const btn = el('button', {
        class: 'btn btn-sm import-col-btn' + (sel ? ' btn-primary' : ''),
        attrs: { type: 'button' },
        onClick: () => {
          if (backCol === i) backCol = frontCol;
          frontCol = i;
          userTouchedCols = true;
          buildColSelector(colCount, sampleRow);
          recompute();
        }
      }, [`Col ${i + 1}`]);
      headerRow.appendChild(btn);
    }
    colSelector.appendChild(headerRow);

    const backRow = el('div', { class: 'import-col-row' });
    backRow.appendChild(el('span', { class: 'import-col-label tiny' }, ['Verso']));
    for (let i = 0; i < colCount; i++) {
      const sel = i === backCol;
      const btn = el('button', {
        class: 'btn btn-sm import-col-btn' + (sel ? ' btn-primary' : ''),
        attrs: { type: 'button' },
        onClick: () => {
          if (frontCol === i) frontCol = backCol;
          backCol = i;
          userTouchedCols = true;
          buildColSelector(colCount, sampleRow);
          recompute();
        }
      }, [`Col ${i + 1}`]);
      backRow.appendChild(btn);
    }
    colSelector.appendChild(backRow);
  }

  function recompute() {
    const text = textarea.value;
    const table = parseImportTable(text, sep);
    detectedSepBadge.textContent = sep === 'auto' && text
      ? `(detectado: ${labelSep(detectSeparator(text))})`
      : '';

    // Normalização de colunas: nunca deixar valor < 0 (esse era o bug que
    // zerava o contador silenciosamente quando colCount=0). Se o usuário
    // ainda não tocou nos botões, voltar pro default 0/1 quando válido;
    // senão clampar pro range válido preservando a intenção do usuário.
    const cc = table.colCount;
    if (cc >= 2) {
      if (!userTouchedCols) {
        frontCol = 0;
        backCol = 1;
      } else {
        if (frontCol < 0 || frontCol >= cc) frontCol = 0;
        if (backCol < 0 || backCol >= cc) backCol = (frontCol === 0 ? 1 : 0);
        if (frontCol === backCol) backCol = frontCol === 0 ? 1 : 0;
      }
    }
    // Quando cc < 2, mantemos os valores anteriores (válidos) — não há
    // seleção visual exposta, então não há divergência percebida.

    // Primeira linha do texto colado (a que o user enxerga no topo do
    // textarea) — usada como amostra de conteúdo por coluna.
    const sampleRow = table.rows.length ? table.rows[0] : null;
    buildColSelector(cc, sampleRow);

    const cards = parseImport(text, { sep, frontCol, backCol });
    const n = cards.length;
    let badge = `${n} carta${n === 1 ? '' : 's'}`;
    // Feedback claro quando há linhas mas elas não viram cartas — quase
    // sempre porque o separador detectado está errado pro conteúdo.
    if (n === 0 && table.rows.length > 0) {
      if (cc < 2) {
        badge += ' · verifique o separador';
      } else {
        badge += ' · linhas inválidas';
      }
    }
    previewBadge.textContent = badge;
  }

  function labelSep(s) {
    const o = SEP_OPTIONS.find(x => x.value === s);
    return o ? o.label : s;
  }

  textarea.addEventListener('input', recompute);

  const node = el('div', { class: 'stack stack-2 import-picker' }, [
    el('div', { class: 'row-between' }, [
      el('div', { class: 'label' }, ['Cartas']),
      el('div', { class: 'row gap-2', style: { alignItems: 'center' } }, [previewBadge, detectedSepBadge])
    ]),
    sepRow,
    textarea,
    colSelector,
    el('div', { class: 'tiny muted' }, [
      'Cada linha vira uma carta. Cole direto do Quizlet, Excel ou Google Sheets.'
    ])
  ]);

  updateSepButtons();
  recompute();

  return {
    node,
    getCards: () => parseImport(textarea.value, { sep, frontCol, backCol }),
    getText: () => textarea.value,
    getConfig: () => ({ sep, frontCol, backCol }),
    focus: () => textarea.focus()
  };
}
