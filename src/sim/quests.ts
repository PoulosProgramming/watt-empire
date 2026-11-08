import { QUESTS } from './balance';
import type { GameState } from './state';

export function questProgress(s: GameState, q: (typeof QUESTS)[number]): number {
  return q.kind === 'taps' ? s.taps : s.delivered;
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
