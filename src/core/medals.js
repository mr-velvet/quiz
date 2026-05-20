// Catálogo local de medalhas + checker pra antecipação visual.
//
// Servidor é autoritativo. Aqui apenas:
// 1) Espelho do catálogo (pra renderizar imediatamente sem aguardar /me/medals)
// 2) Predição de medalhas "óbvias" durante a sessão (combo X, primeira sessão)
//    pra que o toast apareça no momento do gatilho, não só no finish.
//
// Predição NUNCA é gravada localmente — só visual. Servidor reconcilia no finish.

import { emit } from './events.js';
import { getStats, getMedals } from './stats.js';

// Catálogo fallback caso backend ainda não tenha respondido. Mesmos códigos.
const CATALOG = [
  { code: 'first_session',  name: 'Primeira vez',    description: 'Concluir sua primeira sessão de estudo (≥10 cards).', icon: '🎯', tier: 'bronze',    category: 'onboarding'  },
  { code: 'first_deck',     name: 'Caçula do deck',  description: 'Criar seu primeiro deck.',                              icon: '📦', tier: 'bronze',    category: 'onboarding'  },
  { code: 'big_importer',   name: 'Importador',      description: 'Criar um deck com 50 ou mais cards de uma vez.',        icon: '📥', tier: 'silver',    category: 'creation'    },
  { code: 'librarian',      name: 'Bibliotecário',   description: 'Ter 5 decks ativos.',                                   icon: '📚', tier: 'silver',    category: 'creation'    },
  { code: 'curator',        name: 'Curador',         description: 'Ter 10 decks ativos.',                                  icon: '🗂', tier: 'gold',      category: 'creation'    },
  { code: 'flawless_20',    name: 'Sem deslizes',    description: 'Sessão 100% acerto com ≥20 cards.',                     icon: '✨', tier: 'silver',    category: 'performance' },
  { code: 'flawless_50',    name: 'Imbatível',       description: 'Sessão 100% acerto com ≥50 cards.',                     icon: '💎', tier: 'gold',      category: 'performance' },
  { code: 'combo_10',       name: 'Combo 10',        description: 'Atingir combo 10 em qualquer modo.',                    icon: '🔟', tier: 'bronze',    category: 'combo'       },
  { code: 'combo_25',       name: 'Combo 25',        description: 'Atingir combo 25 em qualquer modo.',                    icon: '🚀', tier: 'silver',    category: 'combo'       },
  { code: 'combo_50',       name: 'Combo 50',        description: 'Atingir combo 50 em qualquer modo.',                    icon: '🔥', tier: 'gold',      category: 'combo'       },
  { code: 'speedster_30',   name: 'Velocista',       description: 'Bater 30 acertos em uma rodada de Speed.',              icon: '⚡', tier: 'silver',    category: 'mode'        },
  { code: 'typist_100',     name: 'Datilógrafo',     description: 'Acertar 100 cards em modo Escrever (lifetime).',        icon: '⌨',  tier: 'silver',    category: 'mode'        },
  { code: 'deck_lv5',       name: 'Olho clínico',    description: 'Atingir nível 5 de qualquer deck.',                     icon: '🔍', tier: 'silver',    category: 'mastery'     },
  { code: 'deck_lv8',       name: 'Mestre do deck',  description: 'Atingir nível 8 de qualquer deck.',                     icon: '🎓', tier: 'gold',      category: 'mastery'     },
  { code: 'deck_lv10',      name: 'Lenda do deck',   description: 'Atingir nível 10 de qualquer deck.',                    icon: '👑', tier: 'legendary', category: 'mastery'     },
  { code: 'streak_7',       name: 'Streak 7',        description: 'Manter ofensiva por 7 dias.',                           icon: '🔥', tier: 'silver',    category: 'streak'      },
  { code: 'streak_30',      name: 'Streak 30',       description: 'Manter ofensiva por 30 dias.',                          icon: '🌟', tier: 'gold',      category: 'streak'      },
  { code: 'streak_100',     name: 'Streak 100',      description: 'Manter ofensiva por 100 dias.',                         icon: '🏆', tier: 'legendary', category: 'streak'      }
];

const catalogByCode = new Map(CATALOG.map(m => [m.code, m]));

export function getMedalMeta(code) {
  // Prefere a versão vinda do backend (que pode ter texto atualizado).
  const m = getMedals();
  if (m && m.all && m.all.length) {
    const remote = m.all.find(x => x.code === code);
    if (remote) return remote;
  }
  return catalogByCode.get(code) || null;
}

// Predição local. Disparada por sessionLoop sempre que combo cruza marco.
// Não persiste — só dispatcha 'medalEarned' pra UI. Backend confirma no finish.
const anticipated = new Set();

export function resetAnticipated() { anticipated.clear(); }

export function maybeAnticipateCombo(combo) {
  const milestones = [
    { combo: 10, code: 'combo_10' },
    { combo: 25, code: 'combo_25' },
    { combo: 50, code: 'combo_50' }
  ];
  const m = getMedals();
  const alreadyEarned = new Set((m.all || []).filter(x => x.earned).map(x => x.code));
  for (const milestone of milestones) {
    if (combo >= milestone.combo && !alreadyEarned.has(milestone.code) && !anticipated.has(milestone.code)) {
      anticipated.add(milestone.code);
      const meta = getMedalMeta(milestone.code);
      if (meta) emit('medalEarned', { ...meta, anticipated: true });
    }
  }
}

export function getCatalog() {
  const m = getMedals();
  if (m && m.all && m.all.length) return m.all;
  return CATALOG.map(c => ({ ...c, earned: false, earned_at: null }));
}
