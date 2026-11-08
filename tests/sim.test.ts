import { describe, expect, it } from 'vitest';
import { CREDITS_PER_MWH, INCINERATOR_LEVEL_CHANGE_FEE, INCINERATOR_START_VO, QUESTS, UPGRADES } from '../src/sim/balance';
import { buyUpgrade, setIncineratorLevel, tap, upgradeCost } from '../src/sim/economy';
import { TICK_DT, tick } from '../src/sim/game';
import { newGame } from '../src/sim/state';

const run = (s: ReturnType<typeof newGame>, seconds: number) => {
  for (let i = 0; i < seconds / TICK_DT; i++) tick(s);
};

describe('ekonomika', () => {
  it('tap přidá VO', () => {
    const s = newGame();
    tap(s);
    expect(s.vo).toBe(1);
    expect(s.taps).toBe(1);
  });

  it('nelze koupit vylepšení bez peněz a kredity nejdou do mínusu', () => {
    const s = newGame();
    expect(buyUpgrade(s, 'worker')).toBe(false);
    expect(s.credits).toBe(0);
  });

  it('nákup vylepšení stojí správně', () => {
    const s = newGame();
    s.credits = 100;
    expect(buyUpgrade(s, 'worker')).toBe(true);
    expect(s.credits).toBe(100 - upgradeCost('worker', 0));
    expect(s.upgrades.worker).toBe(1);
  });

  it('brigádníci bez peněz nepracují a nebrání mzdu', () => {
    const s = newGame();
    s.upgrades.worker = 3;
    s.doneQuests = QUESTS.map((q) => q.id); // ať úkoly nevyplatí kredity
    s.incineratorOn = false;
    run(s, 10);
    expect(s.vo).toBe(0);
    expect(s.credits).toBe(0);
    expect(s.live.workersPaused).toBe(true);
  });
});

describe('síť', () => {
  it('spalovna vyrobí z 5 VO 1 MWh a město zaplatí 10 kreditů', () => {
    const s = newGame();
    s.vo = 50;
    run(s, 3);
    expect(s.delivered).toBeGreaterThan(0.5);
    expect(s.credits - 20).toBeCloseTo(s.delivered * CREDITS_PER_MWH, 5); // 20 = odměna za úkol "dodej 1 MWh"
    expect(50 - s.vo).toBeGreaterThanOrEqual(s.delivered * 5 - 1e-9); // spáleno aspoň tolik, kolik se dodalo
  });

  it('bez baterie noc přetíží síť a nastane blackout s poplatkem', () => {
    const s = newGame();
    s.hour = 20; // noc
    s.vo = 10000;
    s.credits = 500;
    let blackout = false;
    for (let i = 0; i < 20 / TICK_DT; i++) {
      s.vo = 10000;
      tick(s);
      if (s.blackout > 0) blackout = true;
    }
    expect(blackout).toBe(true);
    expect(s.credits).toBeLessThan(500 + 100);
    expect(s.credits).toBeGreaterThanOrEqual(0);
  });

  it('baterie ukládá přebytek v noci', () => {
    const s = newGame();
    s.hour = 20;
    s.upgrades.battery = 5;
    s.vo = 10000;
    run(s, 2);
    expect(s.battery).toBeGreaterThan(0);
    expect(s.blackout).toBe(0);
  });

  it('dodávka nikdy nepřekročí propustnost vedení', () => {
    const s = newGame();
    s.vo = 10000;
    for (let i = 0; i < 100; i++) {
      tick(s);
      expect(s.live.deliveredMW).toBeLessThanOrEqual(10 + 1e-9);
    }
  });
});

describe('spalovna', () => {
  it('nerozjede se pod hranicí skladu a pak běží bez poskakování', () => {
    const s = newGame();
    s.vo = INCINERATOR_START_VO - 1;
    run(s, 2);
    expect(s.live.productionMW).toBe(0);
    s.vo = INCINERATOR_START_VO;
    tick(s);
    expect(s.live.productionMW).toBeGreaterThan(0);
  });

  it('s pomalým přítokem VO výkon nekmitá, jen jednou zhasne a čeká', () => {
    const s = newGame();
    s.upgrades.battery = 10;
    s.credits = 0;
    let changes = 0;
    let prev = false;
    for (let i = 0; i < 120 / TICK_DT; i++) {
      s.vo += 0.2 * TICK_DT; // pomalý přítok
      tick(s);
      const on = s.live.productionMW > 0;
      if (on !== prev) changes++;
      prev = on;
    }
    expect(changes).toBeLessThan(10);
  });

  it('změna výkonu stojí poplatek a nejde do mínusu', () => {
    const s = newGame();
    expect(setIncineratorLevel(s, 0.5)).toBe(false);
    expect(s.credits).toBe(0);
    s.credits = 100;
    expect(setIncineratorLevel(s, 0.5)).toBe(true);
    expect(s.credits).toBe(100 - INCINERATOR_LEVEL_CHANGE_FEE);
    expect(s.incineratorLevel).toBe(0.5);
  });

  it('automatický regulátor drží výkon podle spotřeby a blokuje ruční změnu', () => {
    const s = newGame();
    s.hour = 20; // noc, spotřeba 3,5 MW
    s.upgrades.regulator = 1;
    s.vo = 10000;
    s.credits = 100;
    run(s, 5);
    expect(s.incineratorLevel).toBeCloseTo(0.35, 5);
    expect(s.blackout).toBe(0);
    expect(setIncineratorLevel(s, 1)).toBe(false);
  });
});

describe('balance', () => {
  it('každé vylepšení má kladnou cenu', () => {
    for (const u of UPGRADES) expect(upgradeCost(u.id, 0)).toBeGreaterThan(0);
  });
});
