import { QUESTS, type QuestDef } from './balance';
import type { GameState } from './state';

export function questProgress(s: GameState, q: QuestDef): number {
  if (q.kind === 'taps') return s.taps;
  if (q.kind === 'upgrade') return q.upgrade ? s.upgrades[q.upgrade] : 0;
  return s.delivered;
}

// Splněné úkoly vyplatí odměnu (jednou).
export function checkQuests(s: GameState): void {
  for (const q of QUESTS) {
    if (!s.doneQuests.includes(q.id) && questProgress(s, q) >= q.target) {
      s.doneQuests.push(q.id);
      s.credits += q.reward;
    }
  }
}
