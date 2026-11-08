import {
  OFFLINE_FULL_RATE_SECONDS,
  OFFLINE_MAX_SECONDS,
  OFFLINE_MIN_SECONDS,
  OFFLINE_REDUCED_RATE,
  OFFLINE_STEP_SECONDS,
  TICKS_PER_SECOND,
} from './balance';
import { advanceTime } from './daynight';
import { runWorkers, updateOverflowRate } from './economy';
import { runPower } from './power';
import { checkQuests } from './quests';
import type { GameState } from './state';

export const TICK_DT = 1 / TICKS_PER_SECOND;

// Jeden tik simulace. Čistý TypeScript, žádný Phaser ani HTML.
export function tick(s: GameState, dt: number = TICK_DT): void {
  advanceTime(s, dt);
  runWorkers(s, dt);
  updateOverflowRate(s, dt);
  runPower(s, dt);
  checkQuests(s);
}

export interface OfflineSummary {
  seconds: number; // kolik sekund pauzy se započítalo (strop OFFLINE_MAX_SECONDS)
  playedSeconds: number; // kolik sekund hraní z toho vzniklo (po prvních 30 min jen zlomek)
  credits: number; // změna kreditů
  delivered: number; // MWh dodané městu
  vo: number; // změna zásoby VO
  blackouts: number; // kolikrát vypadla síť
}

// Jednoduchý idle: dopočítá čas, kdy hráč nehrál (bez klikání, stejná pravidla jako normálně).
// Vrací null, když byla pauza příliš krátká.
export function simulateOffline(s: GameState, elapsedSeconds: number): OfflineSummary | null {
  if (!(elapsedSeconds >= OFFLINE_MIN_SECONDS)) return null;
  const seconds = Math.min(elapsedSeconds, OFFLINE_MAX_SECONDS);
  // Prvních 30 minut na plnou rychlost, zbytek jen na zlomek (ať se hra nepřeskočí spánkem)
  const played = Math.min(seconds, OFFLINE_FULL_RATE_SECONDS) + Math.max(0, seconds - OFFLINE_FULL_RATE_SECONDS) * OFFLINE_REDUCED_RATE;
  const before = { credits: s.credits, delivered: s.delivered, vo: s.vo };
  let blackouts = 0;
  let wasBlackout = s.blackout > 0;
  for (let t = 0; t + OFFLINE_STEP_SECONDS <= played; t += OFFLINE_STEP_SECONDS) {
    tick(s, OFFLINE_STEP_SECONDS);
    const now = s.blackout > 0;
    if (now && !wasBlackout) blackouts++;
    wasBlackout = now;
  }
  return {
    seconds,
    playedSeconds: played,
    credits: s.credits - before.credits,
    delivered: s.delivered - before.delivered,
    vo: s.vo - before.vo,
    blackouts,
  };
}
