import { LEGACY_UPGRADE_COSTS, TOXIC_TRIGGER_CHAPTER } from './balance';
import { isLitterTile } from './mapdata';
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
    // Sklad, likvidátor a baterie jsou teď budovy na mapě: staré vylepšení se zruší a peníze se vrátí
    const legacy = loaded.upgrades as unknown as Record<string, number>;
    for (const [name, c] of Object.entries(LEGACY_UPGRADE_COSTS)) {
      const level = Number(legacy[name] ?? 0);
      for (let k = 0; k < level; k++) loaded.credits += Math.ceil(c.baseCost * Math.pow(c.growth, k));
      delete legacy[name];
    }
    // Mapa se zvětšila a dostala terén: odpad na dlaždicích, kde už ležet nesmí, se zahodí (nový se dosype sám)
    loaded.litter = loaded.litter.filter((l) => isLitterTile(loaded.unlockedParcels, l.x, l.y));
    return loaded;
  } catch {
    return null;
  }
}
