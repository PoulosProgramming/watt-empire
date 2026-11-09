import {
  EFFICIENCY_VO_FACTOR,
  INCINERATOR_BASE_MW,
  INCINERATOR_POWER_STEP_MW,
  UPGRADES,
  VO_OVERFLOW_PRICE,
  VO_PER_TAP,
  VO_STORAGE_MAX,
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

export const incineratorNominalMW = (s: GameState) =>
  INCINERATOR_BASE_MW + s.upgrades.power * INCINERATOR_POWER_STEP_MW;

// Kolik VO se vejde do skladu spalovny (pevné číslo)
export const voStorageMax = (_s: GameState) => VO_STORAGE_MAX;

// Přidá VO do skladu; co se nevejde, se automaticky prodá za kredity.
export function addVO(s: GameState, amount: number): void {
  const stored = Math.min(amount, Math.max(0, voStorageMax(s) - s.vo));
  s.vo += stored;
  const overflow = amount - stored;
  if (overflow > 0) {
    const gain = overflow * VO_OVERFLOW_PRICE;
    s.credits += gain;
    s.live.overflowAccum += gain;
  }
}

// Vyhlazený příjem z prodeje přebytečného VO (jen pro zobrazení v rozpisu)
export function updateOverflowRate(s: GameState, dt: number): void {
  const k = 0.1;
  s.live.overflowIncomePerSecond = s.live.overflowIncomePerSecond * (1 - k) + (s.live.overflowAccum / dt) * k;
  s.live.overflowAccum = 0;
}

// Starší uložení mohlo mít víc VO, než se teď vejde do skladu
export function clampVO(s: GameState): void {
  const over = s.vo - voStorageMax(s);
  if (over > 0) {
    s.vo -= over;
    s.credits += over * VO_OVERFLOW_PRICE;
  }
}

export function tap(s: GameState): void {
  addVO(s, VO_PER_TAP);
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
  addVO(s, workers * WORKER_VO_PER_SECOND * dt);
  s.live.voPerSecond = workers * WORKER_VO_PER_SECOND;
  s.live.wagePerSecond = workers * WORKER_WAGE_PER_SECOND;
}
