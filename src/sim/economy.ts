import {
  EFFICIENCY_VO_FACTOR,
  INCINERATOR_LEVEL_CHANGE_FEE,
  INCINERATOR_MIN_LOAD,
  UPGRADES,
  VO_PER_TAP,
  WORKER_VO_PER_SECOND,
  WORKER_WAGE_PER_SECOND,
  type UpgradeId,
} from './balance';
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

export function buyUpgrade(s: GameState, id: UpgradeId): boolean {
  const def = upgradeDef(id);
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
    return;
  }
  const wage = workers * WORKER_WAGE_PER_SECOND * dt;
  if (s.credits < wage) {
    s.live.workersPaused = true;
    s.live.voPerSecond = 0;
    return;
  }
  s.live.workersPaused = false;
  s.credits -= wage;
  s.vo += workers * WORKER_VO_PER_SECOND * dt;
  s.live.voPerSecond = workers * WORKER_VO_PER_SECOND;
}

// Ruční změna výkonu spalovny stojí poplatek. S regulátorem to nejde (řídí se sám).
export function setIncineratorLevel(s: GameState, level: number): boolean {
  if (s.upgrades.regulator > 0) return false;
  const l = Math.min(1, Math.max(INCINERATOR_MIN_LOAD, level));
  if (Math.abs(l - s.incineratorLevel) < 1e-9) return true;
  if (s.credits < INCINERATOR_LEVEL_CHANGE_FEE) return false; // nikdy do mínusu
  s.credits -= INCINERATOR_LEVEL_CHANGE_FEE;
  s.incineratorLevel = l;
  return true;
}
