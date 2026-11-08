import { TICKS_PER_SECOND } from './balance';
import { advanceTime } from './daynight';
import { runWorkers } from './economy';
import { runPower } from './power';
import { checkQuests } from './quests';
import type { GameState } from './state';

export const TICK_DT = 1 / TICKS_PER_SECOND;

// Jeden tik simulace. Čistý TypeScript, žádný Phaser ani HTML.
export function tick(s: GameState, dt: number = TICK_DT): void {
  advanceTime(s, dt);
  runWorkers(s, dt);
  runPower(s, dt);
  checkQuests(s);
}
