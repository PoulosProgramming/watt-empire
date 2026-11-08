import { TOXIC_TRIGGER_CHAPTER } from './balance';
import { newGame, type GameState } from './state';

// Ukládání jako text (JSON). Čistý TypeScript: o samotné úložiště (localStorage) se stará UI.
export const SAVE_VERSION = 1;

export function serialize(s: GameState): string {
  return JSON.stringify({ v: SAVE_VERSION, state: s });
}

// Vrátí načtenou hru, nebo null, když je text poškozený. Chybějící pole se doplní výchozími
// hodnotami, takže starší uložení nerozbije novou verzi hry.
export function deserialize(text: string | null): GameState | null {
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || data.v !== SAVE_VERSION || typeof data.state !== 'object') return null;
    const base = newGame();
    const saved = data.state as Partial<GameState>;
    const loaded: GameState = {
      ...base,
      ...saved,
      upgrades: { ...base.upgrades, ...(saved.upgrades ?? {}) },
      live: { ...base.live, ...(saved.live ?? {}) },
      doneQuests: Array.isArray(saved.doneQuests) ? saved.doneQuests : [],
    };
    // Krize patří až do kapitoly 2: starší uložení z kapitoly 1 s už spuštěnou krizí se vyčistí
    if (loaded.chapter < TOXIC_TRIGGER_CHAPTER) {
      loaded.toxic = false;
      loaded.toxicCountdown = -1;
    }
    return loaded;
  } catch {
    return null;
  }
}
