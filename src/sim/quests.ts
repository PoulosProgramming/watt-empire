import { QUESTS, TOXIC_DELAY_SECONDS, TOXIC_TRIGGER_QUEST, type QuestDef, type Requirement } from './balance';
import type { GameState } from './state';

export function requirementProgress(s: GameState, r: Requirement): number {
  if (r.kind === 'taps') return s.taps;
  if (r.kind === 'autonomy') return s.live.autonomous ? 1 : 0;
  if (r.kind === 'contract') return s.contractMet ? 1 : 0;
  if (r.kind === 'chapter') return s.chapter;
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


// Ekologická krize: po splnění spouštěcího úkolu začne odpočet a krize se spustí sama (bez varování).
// Spouštěcí úkol je zatím null (krize patří až do kapitoly 2), proto se nic neděje.
export function runCrisis(s: GameState, dt: number, triggerQuest: string | null = TOXIC_TRIGGER_QUEST): void {
  if (s.toxic || !triggerQuest) return;
  if (s.toxicCountdown < 0) {
    if (s.doneQuests.includes(triggerQuest)) s.toxicCountdown = TOXIC_DELAY_SECONDS;
    return;
  }
  s.toxicCountdown -= dt;
  if (s.toxicCountdown <= 0) {
    s.toxic = true;
    s.toxicCountdown = -1;
  }
}
