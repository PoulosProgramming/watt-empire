import {
  CHAPTER_END_QUESTS,
  MAX_CHAPTER,
  ONGOING_UNLOCK_QUEST,
  QUESTS,
  TOXIC_DELAY_SECONDS,
  TOXIC_INITIAL_FIELD,
  TOXIC_TRIGGER_CHAPTER,
  type QuestDef,
  type Requirement,
} from './balance';
import type { GameState } from './state';

export function requirementProgress(s: GameState, r: Requirement): number {
  if (r.kind === 'taps') return s.taps;
  if (r.kind === 'autonomy') return s.live.autonomous ? 1 : 0;
  if (r.kind === 'contract') return s.contractMet ? 1 : 0;
  if (r.kind === 'chapter') return s.chapter;
  if (r.kind === 'disposed') return s.toxicDisposed;
  if (r.kind === 'fieldclean') return s.toxic && s.toxicDisposed > 0 && s.toxicField < 0.5 ? 1 : 0;
  if (r.kind === 'trust') return s.trust;
  if (r.kind === 'litter') return s.litterCleaned;
  if (r.kind === 'upgrade') return r.upgrade ? s.upgrades[r.upgrade] : 0;
  return s.delivered;
}

export const questProgress = (s: GameState, q: QuestDef): number => requirementProgress(s, q);

// Splněné úkoly vyplatí odměnu (jednou).
export function checkQuests(s: GameState): void {
  for (const q of QUESTS) {
    if ((q.chapter ?? 1) > s.chapter) continue; // úkol z pozdější kapitoly se ještě nespustil
    if (q.ongoing && !s.doneQuests.includes(ONGOING_UNLOCK_QUEST)) continue; // průběžné úkoly se počítají až po odemknutí (po autonomii)
    if (!s.doneQuests.includes(q.id) && questProgress(s, q) >= q.target) {
      s.doneQuests.push(q.id);
      s.credits += q.reward;
    }
  }
}


// Kapitola postoupí, když jsou splněné všechny její závěrečné úkoly. Vrací číslo nové kapitoly, nebo 0.
export function advanceChapter(s: GameState): number {
  if (s.chapter >= MAX_CHAPTER) return 0;
  const ends = CHAPTER_END_QUESTS[s.chapter] ?? [];
  if (ends.length > 0 && ends.every((id) => s.doneQuests.includes(id))) {
    s.chapter += 1;
    return s.chapter;
  }
  return 0;
}

// Ekologická krize: po začátku kapitoly TOXIC_TRIGGER_CHAPTER začne odpočet a krize se spustí sama
// (bez varování). Při spuštění je na poli počáteční hromada odpadu.
export function runCrisis(s: GameState, dt: number, triggerChapter: number = TOXIC_TRIGGER_CHAPTER): void {
  if (s.toxic) return;
  if (s.toxicCountdown < 0) {
    if (s.chapter >= triggerChapter) s.toxicCountdown = TOXIC_DELAY_SECONDS;
    return;
  }
  s.toxicCountdown -= dt;
  if (s.toxicCountdown <= 0) {
    s.toxic = true;
    s.toxicCountdown = -1;
    s.toxicField += TOXIC_INITIAL_FIELD;
  }
}
