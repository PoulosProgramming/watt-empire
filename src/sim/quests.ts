import { QUESTS, type QuestDef, type Requirement } from './balance';
import type { GameState } from './state';

export function requirementProgress(s: GameState, r: Requirement): number {
  if (r.kind === 'taps') return s.taps;
  if (r.kind === 'upgrade') return r.upgrade ? s.upgrades[r.upgrade] : 0;
  return s.delivered;
}

export const questProgress = (s: GameState, q: QuestDef): number => requirementProgress(s, q);

// Splněné úkoly vyplatí odměnu (jednou).
export function checkQuests(s: GameState): void {
  for (const q of QUESTS) {
    if (!s.doneQuests.includes(q.id) && questProgress(s, q) >= q.target) {
      s.doneQuests.push(q.id);
      s.credits += q.reward;
    }
  }
}
