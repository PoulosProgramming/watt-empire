import {
  EFFICIENCY_VO_FACTOR,
  UPGRADES,
  VO_PER_TAP,
  WORKER_VO_PER_SECOND,
  WORKER_WAGE_PER_SECOND,
  type UpgradeId,
} from './balance';
import { requirementProgress } from './quests';
import type { GameState } from './state';

export function upgradeDef(id: UpgradeId) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) throw new Error(`Neznámé vylepšení ${id}`);
  return def;
}

export function upgradeCost(id: UpgradeId, level: number): number {
  const def = upgradeDef(id);
  return Math.ceil(def.baseCost * Math.pow(def.growth, level));
}

export function tap(s: GameState): void {
  s.vo += VO_PER_TAP;
  s.taps += 1;
}

// Vylepšení bez podmínky je odemčené hned; jinak musí hráč splnit podmínku.
export function isUnlocked(s: GameState, id: UpgradeId): boolean {
  const u = upgradeDef(id).unlock;
  return !u || requirementProgress(s, u) >= u.target;
}

export function buyUpgrade(s: GameState, id: UpgradeId): boolean {
  const def = upgradeDef(id);
  if (!isUnlocked(s, id)) return false;
  const level = s.upgrades[id];
  if (level >= def.maxLevel) return false;
  const cost = upgradeCost(id, level);
  if (s.credits < cost) return false; // nikdy do mínusu
  s.credits -= cost;
  s.upgrades[id] += 1;
  return true;
}

export function voPerMWh(s: GameState, base: number): number {
  return base * Math.pow(EFFICIENCY_VO_FACTOR, s.upgrades.efficiency);
}

// Brigádníci: pracují a berou mzdu jen dokud jsou peníze (prevence bankrotu).
export function runWorkers(s: GameState, dt: number): void {
  const workers = s.upgrades.worker;
  if (workers === 0) {
    s.live.workersPaused = false;
    s.live.voPerSecond = 0;
    s.live.wagePerSecond = 0;
    return;
  }
  const wage = workers * WORKER_WAGE_PER_SECOND * dt;
  if (s.credits < wage) {
    s.live.workersPaused = true;
    s.live.voPerSecond = 0;
    s.live.wagePerSecond = 0;
    return;
  }
  s.live.workersPaused = false;
  s.credits -= wage;
  s.vo += workers * WORKER_VO_PER_SECOND * dt;
  s.live.voPerSecond = workers * WORKER_VO_PER_SECOND;
  s.live.wagePerSecond = workers * WORKER_WAGE_PER_SECOND;
}
