// Heatmap estilo GitHub. 7 linhas × N colunas (N semanas).
// Cor por intensidade de XP no dia.

import { el } from '../core/util.js';

export function heatmap(data, opts = {}) {
  // data: [{ date: 'YYYY-MM-DD', xp, sessions }]
  const days = opts.days || 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - days + 1);

  // Indexa por date string
  const byDate = new Map((data || []).map(d => [d.date, d]));
  const maxXp = Math.max(1, ...(data || []).map(d => d.xp || 0));

  // Construir array de days items (do start até today, inclusive)
  const items = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = byDate.get(key) || { date: key, xp: 0, sessions: 0 };
    items.push({ ...day, dayOfWeek: d.getDay(), label: `${d.getDate()}/${d.getMonth() + 1}` });
  }

  // Layout: 7 colunas (dias da semana) × N semanas? Aqui simplificamos pra grid linear:
  // grid horizontal de 30 quadrados, em até 7 linhas? Vamos por linhas de semana.
  const weeks = Math.ceil(days / 7);
  const cells = [];
  // Começa preenchendo da posição certa (alinhamento de dia da semana)
  const firstDow = items[0].dayOfWeek;
  for (let i = 0; i < firstDow; i++) {
    cells.push(el('div', { class: 'heatmap-cell heatmap-cell-empty' }));
  }
  for (const it of items) {
    const intensity = it.xp === 0 ? 0
      : it.xp < maxXp * 0.25 ? 1
      : it.xp < maxXp * 0.5  ? 2
      : it.xp < maxXp * 0.75 ? 3
      : 4;
    cells.push(el('div', {
      class: `heatmap-cell heatmap-cell-${intensity}`,
      attrs: {
        title: `${it.label}: ${it.xp} XP, ${it.sessions} sessões`,
        'data-date': it.date
      }
    }));
  }

  return el('div', { class: 'heatmap', attrs: { 'data-testid': 'me-heatmap' } }, [
    el('div', { class: 'heatmap-grid' }, cells),
    el('div', { class: 'heatmap-legend' }, [
      el('span', { class: 'tiny muted' }, ['Menos']),
      el('div', { class: 'heatmap-cell heatmap-cell-0' }),
      el('div', { class: 'heatmap-cell heatmap-cell-1' }),
      el('div', { class: 'heatmap-cell heatmap-cell-2' }),
      el('div', { class: 'heatmap-cell heatmap-cell-3' }),
      el('div', { class: 'heatmap-cell heatmap-cell-4' }),
      el('span', { class: 'tiny muted' }, ['Mais'])
    ])
  ]);
}
