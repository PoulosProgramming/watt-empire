import { describe, expect, it } from 'vitest';
import { CREDITS_PER_MWH, INCINERATOR_START_VO, OFFLINE_MAX_SECONDS, OFFLINE_REDUCED_RATE, QUESTS, VO_OVERFLOW_PRICE, TOXIC_CRISIS_QUESTS, UPGRADES } from '../src/sim/balance';
import { addVO, buyUpgrade, isUnlocked, tap, upgradeCost, voStorageMax } from '../src/sim/economy';
import { TICK_DT, simulateOffline, tick } from '../src/sim/game';
import { deserialize, serialize } from '../src/sim/save';
import { cityDemandRangeMW } from '../src/sim/power';
import { mainQuestsDone } from '../src/sim/quests';
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

  const doneQuests = (n: number) => QUESTS.slice(0, n).map((q) => q.id);

  it('po splnění 15. úkolu (a při autonomii) začne ekologická krize', () => {
    const s = newGame();
    s.doneQuests = doneQuests(TOXIC_CRISIS_QUESTS);
    s.vo = 100;
    s.upgrades.worker = 5; // autonomie
    s.credits = 100;
    tick(s);
    expect(s.toxic).toBe(true);
  });

  it('před 15. úkolem krize nezačne, i když je hráč autonomní a dodal hodně MWh', () => {
    const s = newGame();
    s.doneQuests = doneQuests(TOXIC_CRISIS_QUESTS - 1);
    s.delivered = 1000;
    s.vo = 100;
    s.upgrades.worker = 5;
    s.credits = 100;
    tick(s);
    expect(s.live.autonomous).toBe(true);
    expect(s.toxic).toBe(false);
  });

  it('bez autonomie krize nezačne, ani když je splněno 15 úkolů', () => {
    const s = newGame();
    s.doneQuests = doneQuests(TOXIC_CRISIS_QUESTS);
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

describe('sklad VO', () => {
  it('sklad má strop a přebytek se prodá', () => {
    const s = newGame();
    const max = voStorageMax(s);
    expect(max).toBeCloseTo(60, 5); // 3 MW = 1 VO/s, 60 s
    s.vo = max - 1;
    addVO(s, 3);
    expect(s.vo).toBeCloseTo(max, 5);
    expect(s.credits).toBeCloseTo(2 * VO_OVERFLOW_PRICE, 5);
  });

  it('strop roste s výkonem spalovny', () => {
    const s = newGame();
    const low = voStorageMax(s);
    s.upgrades.power = 3;
    expect(voStorageMax(s)).toBeGreaterThan(low);
  });

  it('tap do plného skladu přidá kredity místo VO', () => {
    const s = newGame();
    s.vo = voStorageMax(s);
    tap(s);
    expect(s.vo).toBeCloseTo(voStorageMax(s), 5);
    expect(s.credits).toBeCloseTo(VO_OVERFLOW_PRICE, 5);
    expect(s.taps).toBe(1);
  });
});

describe('idle (offline dopočet)', () => {
  const autonomous = () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id); // ať úkoly nevyplatí kredity
    s.upgrades.power = 1; // 4 MW
    s.upgrades.worker = 4; // autonomie
    s.credits = 100;
    s.vo = 60;
    return s;
  };

  it('autonomní hráč si za idle vydělá a dodá energii', () => {
    const s = autonomous();
    const r = simulateOffline(s, 600)!;
    expect(r.seconds).toBe(600);
    expect(r.credits).toBeGreaterThan(100);
    expect(r.delivered).toBeGreaterThan(5);
    expect(s.credits).toBeGreaterThanOrEqual(0);
  });

  it('krátká pauza se nepočítá', () => {
    const s = autonomous();
    expect(simulateOffline(s, 5)).toBeNull();
    expect(s.credits).toBe(100);
  });

  it('dopočet je omezený horním limitem 24 hodin', () => {
    const s = autonomous();
    const r = simulateOffline(s, 10 * OFFLINE_MAX_SECONDS)!;
    expect(r.seconds).toBe(OFFLINE_MAX_SECONDS);
  });

  it('po prvních 30 minutách se počítá jen zlomek (hodina ≈ 1,05× půl hodiny)', () => {
    const half = simulateOffline(autonomous(), 1800)!;
    const hour = simulateOffline(autonomous(), 3600)!;
    expect(half.playedSeconds).toBe(1800);
    expect(hour.playedSeconds).toBeCloseTo(1800 + 1800 * OFFLINE_REDUCED_RATE, 5);
    expect(hour.delivered / half.delivered).toBeLessThan(1.2);
    expect(hour.delivered).toBeGreaterThan(half.delivered);
  });

  it('celý den (24 h) vyjde výrazně méně než 24 h plné hry', () => {
    const day = simulateOffline(autonomous(), OFFLINE_MAX_SECONDS)!;
    expect(day.playedSeconds).toBeLessThan(OFFLINE_MAX_SECONDS * 0.1);
  });

  it('bez brigádníků dojde odpad a výroba se zastaví', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.vo = 60;
    const r = simulateOffline(s, 1200)!;
    expect(s.vo).toBeLessThan(15); // sklad se vyčerpal
    expect(r.delivered).toBeGreaterThan(0);
    expect(r.delivered).toBeLessThan(60 / 5 + 1); // nejvýš z 60 VO
    expect(s.credits).toBeGreaterThanOrEqual(0);
  });

  it('uložení zachová čas posledního uložení', () => {
    const s = newGame();
    s.lastSeen = 123456;
    expect(deserialize(serialize(s))!.lastSeen).toBe(123456);
  });
});

describe('průběžné úkoly', () => {
  it('jsou za hlavními a nepočítají se do hlavních úkolů ani do krize', () => {
    const firstOngoing = QUESTS.findIndex((q) => q.ongoing);
    expect(firstOngoing).toBeGreaterThan(TOXIC_CRISIS_QUESTS);
    expect(QUESTS.slice(firstOngoing).every((q) => q.ongoing)).toBe(true);
    const s = newGame();
    s.doneQuests = QUESTS.filter((q) => q.ongoing).map((q) => q.id);
    expect(mainQuestsDone(s)).toBe(0);
    s.vo = 100;
    s.upgrades.worker = 5;
    s.credits = 100;
    tick(s);
    expect(s.toxic).toBe(false);
  });

  it('průběžný úkol vyplatí odměnu, když je splněn', () => {
    const s = newGame();
    s.doneQuests = QUESTS.filter((q) => !q.ongoing).map((q) => q.id);
    s.upgrades.efficiency = 1;
    const before = s.credits;
    tick(s);
    expect(s.doneQuests).toContain('o_eff1');
    expect(s.credits).toBeGreaterThan(before);
  });
});
