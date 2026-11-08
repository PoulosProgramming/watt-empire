import {
  CITY_BASE_DEMAND_MW,
  CITY_NIGHT_FACTOR,
  DAY_START_HOUR,
  NIGHT_START_HOUR,
  SECONDS_PER_GAME_HOUR,
} from './balance';
import type { GameState } from './state';

export function isDay(hour: number): boolean {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR;
}

// Křivka spotřeby: ve dne plynule stoupá k poledni, v noci je nízká.
export function demandFactor(hour: number): number {
  if (!isDay(hour)) return CITY_NIGHT_FACTOR;
  const t = (hour - DAY_START_HOUR) / (NIGHT_START_HOUR - DAY_START_HOUR);
  return 0.6 + 0.4 * Math.sin(Math.PI * t);
}

export function advanceTime(s: GameState, dt: number): void {
  s.hour += dt / SECONDS_PER_GAME_HOUR;
  while (s.hour >= 24) {
    s.hour -= 24;
    s.day += 1;
  }
}

export function baseDemandMW(hour: number): number {
  return CITY_BASE_DEMAND_MW * demandFactor(hour);
}

// Slunce: ve dne plynule stoupá k poledni a klesá, v noci je nula (0 až 1).
export function sunFactor(hour: number): number {
  if (!isDay(hour)) return 0;
  const t = (hour - DAY_START_HOUR) / (NIGHT_START_HOUR - DAY_START_HOUR);
  return Math.sin(Math.PI * t);
}
