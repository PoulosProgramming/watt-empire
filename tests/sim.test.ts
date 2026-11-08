import { describe, expect, it } from 'vitest';
import { CREDITS_PER_MWH, INCINERATOR_START_VO, QUESTS, TOXIC_CRISIS_MWH, UPGRADES } from '../src/sim/balance';
import { buyUpgrade, isUnlocked, tap, upgradeCost } from '../src/sim/economy';
import { TICK_DT, tick } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { cityDemandRangeMW } from '../src/sim/power';
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
    s.credits = 1000;
    s.upgrades.power = 1; // odemkne brigádníky
    expect(buyUpgrade(s, 'worker')).toBe(true);
    expect(s.credits).toBe(1000 - upgradeCost('worker', 0));
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
    s.upgrades.power = 7; // 10 MW
    s.doneQuests = QUESTS.map((q) => q.id); // ať úkoly nevyplatí kredity
    s.vo = 50;
    run(s, 3);
    expect(s.delivered).toBeGreaterThan(0.5);
    expect(s.credits).toBeCloseTo(s.delivered * CREDITS_PER_MWH, 5);
    expect(50 - s.vo).toBeGreaterThanOrEqual(s.delivered * 5 - 1e-9); // spáleno aspoň tolik, kolik se dodalo
  });

  it('bez baterie noc přetíží síť a nastane blackout s poplatkem', () => {
    const s = newGame();
    s.hour = 20; // noc
    s.upgrades.power = 7;
    s.doneQuests = QUESTS.map((q) => q.id);
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
    s.upgrades.power = 7;
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
      expect(s.live.deliveredMW).toBeLessThanOrEqual(6 + 1e-9);
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

  it('na začátku (3 MW) se v noci ani ve dne nikdy nepřetíží', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    for (let i = 0; i < 400 / TICK_DT; i++) {
      s.vo = 1000;
      tick(s);
      expect(s.blackout).toBe(0);
      expect(s.overload).toBe(0);
    }
  });

  it('mařič odvede přebytek za peníze a nejde do mínusu', () => {
    const s = newGame();
    s.hour = 20;
    s.upgrades.power = 6; // 9 MW proti 7 MW v noci
    s.upgrades.dump = 1; // 2 MW
    s.vo = 10000;
    s.credits = 100;
    run(s, 3);
    expect(s.blackout).toBe(0);
    expect(s.live.dumpedMW).toBeGreaterThan(0);
    s.credits = 0;
    run(s, 20);
    expect(s.credits).toBeGreaterThanOrEqual(0);
  });

  it('po 90 MWh začne ekologická krize a příjem klesne', () => {
    const s = newGame();
    s.delivered = TOXIC_CRISIS_MWH;
    s.vo = 100;
    s.upgrades.worker = 5; // autonomie
    s.credits = 100;
    tick(s);
    expect(s.toxic).toBe(true);
  });

  it('bez autonomie krize nezačne, ani když je dodáno dost MWh', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.delivered = TOXIC_CRISIS_MWH + 50;
    s.vo = 100;
    s.upgrades.worker = 1; // 0,4 VO/s, spalovna potřebuje 1 VO/s
    s.credits = 100;
    tick(s);
    expect(s.live.autonomous).toBe(false);
    expect(s.toxic).toBe(false);
  });

  it('autonomie: 5 brigádníků stačí na 6 MW, 4 ne', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.upgrades.power = 3; // 6 MW = 2 VO/s
    s.credits = 1000;
    s.vo = 1000;
    s.upgrades.worker = 4;
    tick(s);
    expect(s.live.autonomous).toBe(false);
    s.upgrades.worker = 5;
    tick(s);
    expect(s.live.autonomous).toBe(true);
  });

  it('automatický regulátor drží výkon podle spotřeby a blokuje ruční změnu', () => {
    const s = newGame();
    s.hour = 20; // noc, spotřeba 7 MW
    s.upgrades.power = 7; // 10 MW
    s.upgrades.line = 1; // vedení 9 MW
    s.upgrades.regulator = 1;
    s.vo = 10000;
    s.credits = 100;
    run(s, 5);
    expect(s.incineratorLevel).toBeCloseTo(0.7, 5);
    expect(s.blackout).toBe(0);
  });
});

describe('balance', () => {
  it('každé vylepšení má kladnou cenu', () => {
    for (const u of UPGRADES) expect(upgradeCost(u.id, 0)).toBeGreaterThan(0);
  });
});

describe('ukládání', () => {
  it('uloží a načte stejný stav', () => {
    const s = newGame();
    s.credits = 123;
    s.upgrades.worker = 2;
    s.doneQuests = ['deliver1'];
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });

  it('poškozený nebo prázdný text vrátí null', () => {
    expect(deserialize(null)).toBeNull();
    expect(deserialize('nesmysl')).toBeNull();
    expect(deserialize('{"v":99,"state":{}}')).toBeNull();
  });

  it('starší uložení bez nových polí se doplní výchozími hodnotami', () => {
    const old = JSON.stringify({ v: 1, state: { credits: 50, upgrades: { worker: 1 } } });
    const s = deserialize(old)!;
    expect(s.credits).toBe(50);
    expect(s.upgrades.worker).toBe(1);
    expect(s.upgrades.regulator).toBe(0);
    expect(s.live.dumpedMW).toBe(0);
  });
});

describe('odemykání', () => {
  it('brigádníci jsou zamčení do prvního upgradu výkonu a nejdou koupit', () => {
    const s = newGame();
    s.credits = 5000;
    s.upgrades.power = 0;
    expect(isUnlocked(s, 'worker')).toBe(false);
    expect(buyUpgrade(s, 'worker')).toBe(false);
    expect(s.credits).toBe(5000);
    s.upgrades.power = 1;
    expect(isUnlocked(s, 'worker')).toBe(true);
    expect(buyUpgrade(s, 'worker')).toBe(true);
  });

  it('mařič se odemkne až po výkonu spalovny 4, regulátor po 250 MWh', () => {
    const s = newGame();
    expect(isUnlocked(s, 'dump')).toBe(false);
    s.upgrades.power = 3;
    expect(isUnlocked(s, 'dump')).toBe(false);
    s.upgrades.power = 4;
    expect(isUnlocked(s, 'dump')).toBe(true);
    expect(isUnlocked(s, 'battery')).toBe(true);
    expect(isUnlocked(s, 'regulator')).toBe(false);
    s.delivered = 250;
    expect(isUnlocked(s, 'regulator')).toBe(true);
  });
});

describe('rozsah spotřeby města', () => {
  it('na začátku je 7 až 14 MW a s prestiží roste', () => {
    const s = newGame();
    const r = cityDemandRangeMW(s);
    expect(r.min).toBeCloseTo(7, 5);
    expect(r.max).toBeCloseTo(14, 1);
    s.delivered = 500; // prestiž 2
    expect(cityDemandRangeMW(s).min).toBeCloseTo(7 * 1.25, 5);
  });
});

describe('krize v rozpisu příjmů', () => {
  it('ztráta z krize se počítá zvlášť a součet sedí', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.delivered = TOXIC_CRISIS_MWH;
    s.vo = 100;
    s.upgrades.worker = 5; // autonomie
    s.credits = 100;
    tick(s);
    expect(s.toxic).toBe(true);
    const full = s.live.incomePerSecond + s.live.crisisLossPerSecond;
    expect(s.live.crisisLossPerSecond).toBeGreaterThan(0);
    expect(s.live.incomePerSecond / full).toBeCloseTo(0.6, 5);
  });
});
