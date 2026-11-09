import {
  LITTER_CLICKS,
  LITTER_INITIAL,
  LITTER_MAX,
  LITTER_NEAR_COUNT,
  LITTER_NEAR_RADIUS_TILES,
  LITTER_RESPAWN_SECONDS,
  LITTER_SEED,
  LITTER_WORKER_CLEAN_SECONDS,
  MAP_GRID_SIZE,
  MAP_INCINERATOR_TILE,
  VO_PER_TAP,
} from './balance';
import { addVO } from './economy';
import { isLitterTile } from './mapdata';
import type { GameState, Litter } from './state';

// Malý deterministický generátor náhodných čísel (stav se ukládá ve hře, v testech je výsledek vždy stejný)
function nextRandom(s: GameState): number {
  let t = (s.litterSeed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const has = (s: GameState, x: number, y: number) => s.litter.some((l) => l.x === x && l.y === y);

// Přidá hromádku odpadu na volnou dlaždici (u spalovny, když near). Vrací true, když se podařilo.
export function spawnLitter(s: GameState, near = false): boolean {
  const a = MAP_INCINERATOR_TILE;
  for (let tries = 0; tries < 80; tries++) {
    let x: number;
    let y: number;
    if (near) {
      const r = LITTER_NEAR_RADIUS_TILES;
      x = a.x + 1 + Math.round((nextRandom(s) * 2 - 1) * r);
      y = a.y + 1 + Math.round((nextRandom(s) * 2 - 1) * r);
    } else {
      x = Math.floor(nextRandom(s) * MAP_GRID_SIZE);
      y = Math.floor(nextRandom(s) * MAP_GRID_SIZE);
    }
    if (!isLitterTile(s.unlockedParcels, x, y) || has(s, x, y)) continue;
    s.litter.push({ x, y, left: LITTER_CLICKS });
    return true;
  }
  return false;
}

// Počáteční rozsetý odpad: část blízko spalovny, zbytek po celé mapě
export function initLitter(s: GameState): void {
  s.litterSeed = LITTER_SEED;
  s.litter = [];
  for (let i = 0; i < LITTER_INITIAL; i++) spawnLitter(s, i < LITTER_NEAR_COUNT);
}

// Brigádníci pravidelně uklízejí ostrov: každý uklidí hromádku za LITTER_WORKER_CLEAN_SECONDS (zadarmo, VO dávají jinak).
// Když stojí (nejsou peníze na mzdy), neuklízejí. Uklizená hromádka se počítá do celkově uklizených (litterCleaned).
function runCrew(s: GameState, dt: number): void {
  const workers = s.upgrades.worker;
  if (workers === 0 || s.live.workersPaused || s.litter.length === 0) {
    s.litterCrewAcc = 0;
    return;
  }
  s.litterCrewAcc += (workers * dt) / LITTER_WORKER_CLEAN_SECONDS;
  while (s.litterCrewAcc >= 1 && s.litter.length > 0) {
    s.litterCrewAcc -= 1;
    s.litter.splice(Math.floor(nextRandom(s) * s.litter.length), 1);
    s.litterCleaned += 1; // hromádky uklizené četou se počítají do celkových (průběžné úkoly)
  }
}

// Nový odpad se objevuje pomalu, dokud je na mapě místo (strop LITTER_MAX)
export function runLitter(s: GameState, dt: number): void {
  runCrew(s, dt);
  // Četa stíhá uklízet víc, než odpadu přibývá: nový odpad se na mapě vůbec neukáže (jen se započítá)
  if (s.upgrades.worker > 0 && !s.live.workersPaused && s.upgrades.worker / LITTER_WORKER_CLEAN_SECONDS >= 1 / LITTER_RESPAWN_SECONDS) {
    // Odpad se uklidí „v pozadí“: na mapě se neobjeví, ale zapíše se do statistik
    s.litterTimer += dt;
    while (s.litterTimer >= LITTER_RESPAWN_SECONDS) {
      s.litterTimer -= LITTER_RESPAWN_SECONDS;
      s.litterCleaned += 1;
    }
    return;
  }
  if (s.litter.length >= LITTER_MAX) {
    s.litterTimer = 0;
    return;
  }
  s.litterTimer += dt;
  while (s.litterTimer >= LITTER_RESPAWN_SECONDS && s.litter.length < LITTER_MAX) {
    s.litterTimer -= LITTER_RESPAWN_SECONDS;
    spawnLitter(s);
  }
}

export interface CollectResult {
  removed: boolean; // hromádka zmizela (to bylo poslední klepnutí)
  left: number; // kolik klepnutí zbývá
}

// Klepnutí na hromádku na dané dlaždici: +VO, po LITTER_CLICKS klepnutích zmizí. Vrací null, když tam nic není.
export function collectLitter(s: GameState, x: number, y: number): CollectResult | null {
  const i = s.litter.findIndex((l: Litter) => l.x === x && l.y === y);
  if (i < 0) return null;
  addVO(s, VO_PER_TAP);
  s.taps += 1;
  const item = s.litter[i];
  item.left -= 1;
  if (item.left <= 0) {
    s.litter.splice(i, 1);
    s.litterCleaned += 1;
    return { removed: true, left: 0 };
  }
  return { removed: false, left: item.left };
}
