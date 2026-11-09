import { AMBIENT_EVERY_DAYS, AMBIENT_LINES, STORY_BEATS } from './balance';
import { requirementProgress } from './quests';
import type { GameState } from './state';

// Starosta: když je splněná podmínka scénky, zapíše se její id do s.story (UI ji ukáže jednou).
// Mezi scénkami občas jen tak něco prohodí (každý AMBIENT_EVERY_DAYS. herní den).
export function checkStory(s: GameState): void {
  for (const beat of STORY_BEATS) {
    if (!s.story.includes(beat.id) && requirementProgress(s, beat.trigger) >= beat.trigger.target) s.story.push(beat.id);
  }
  if (s.day !== s.ambientDay) {
    s.ambientDay = s.day;
    const lines = AMBIENT_LINES[s.chapter];
    if (lines && lines.length > 0 && s.day % AMBIENT_EVERY_DAYS === 0) {
      const idx = (s.day / AMBIENT_EVERY_DAYS) % lines.length;
      s.story.push(`amb:${s.chapter}:${idx}:${s.day}`);
    }
  }
}

// Text scénky podle jejího id (velká scénka nebo občasná hláška), nebo null
export function storyText(id: string): string | null {
  const beat = STORY_BEATS.find((b) => b.id === id);
  if (beat) return beat.text;
  const m = /^amb:(\d+):(\d+):\d+$/.exec(id);
  if (m) return AMBIENT_LINES[Number(m[1])]?.[Number(m[2])] ?? null;
  return null;
}
