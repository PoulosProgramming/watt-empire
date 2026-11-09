import { describe, expect, it } from 'vitest';
import { LITTER_CLEAN_COUNT, LITTER_CREW_SIZE, LITTER_DIRTY_COUNT, AMBIENT_EVERY_DAYS, AMBIENT_LINES, CHAPTER_END_QUESTS, CONTRACT_MW, STORY_BEATS, LITTER_CLICKS, LITTER_INITIAL, LITTER_MAX, LITTER_NEAR_COUNT, LITTER_NEAR_RADIUS_TILES, LITTER_RESPAWN_SECONDS, MAP_INCINERATOR_TILE, CREDITS_PER_MWH, INCINERATOR_START_VO, OFFLINE_MAX_SECONDS, OFFLINE_REDUCED_RATE, QUESTS, TOXIC_DELAY_SECONDS, TOXIC_FIELD_FULL, TOXIC_INITIAL_FIELD, VO_OVERFLOW_PRICE, UPGRADES } from '../src/sim/balance';
import { addVO, buyUpgrade, isUnlocked, tap, upgradeCost, voStorageMax } from '../src/sim/economy';
import { TICK_DT, simulateOffline, tick } from '../src/sim/game';
import { solarMW } from '../src/sim/power';
import { runCrisis } from '../src/sim/quests';
import { checkStory, storyText } from '../src/sim/story';
import { collectLitter, initLitter, runLitter, spawnLitter } from '../src/sim/litter';
import { isBlockedTile } from '../src/sim/mapdata';
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


// Polední špička ze slunce (kapitola 3) je jediné, co teď přetěžuje síť: 10 MW ze slunce na vedení 6 MW.
const solarPeak = () => {
  const s = newGame();
  s.doneQuests = QUESTS.map((q) => q.id);
  s.chapter = 3;
  s.toxic = true; // krize už proběhla
  s.hour = 12;
  s.incineratorOn = false; // jen slunce
  s.upgrades.solar = 5; // 10 MW v poledne
  s.upgrades.line = 0; // vedení 6 MW => přebytek 4 MW
  s.credits = 500;
  return s;
};

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

  it('bez baterie a mařiče polední špička ze slunce přetíží síť a nastane blackout s poplatkem', () => {
    const s = solarPeak();
    let blackout = false;
    for (let i = 0; i < 20 / TICK_DT; i++) {
      s.hour = 12; // drž poledne
      tick(s);
      if (s.blackout > 0) blackout = true;
    }
    expect(blackout).toBe(true);
    expect(s.credits).toBeLessThan(500 + 100);
    expect(s.credits).toBeGreaterThanOrEqual(0);
  });

  it('spalovna výkon nad vedení neposkytne: žádné přetížení a blackout z nadvýroby spalovny', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id).filter((id) => !CHAPTER_END_QUESTS[1].includes(id));
    s.upgrades.power = 8; // 11 MW, ale vedení jen 6 MW
    s.vo = 10000;
    for (let i = 0; i < 20 / TICK_DT; i++) {
      s.vo = 10000;
      tick(s);
      expect(s.blackout).toBe(0);
      expect(s.live.productionMW).toBeLessThanOrEqual(6 + 1e-9);
    }
  });

  it('baterie uloží přebytek ze slunce a síť nevypadne', () => {
    const s = solarPeak();
    s.upgrades.battery = 5;
    for (let i = 0; i < 4 / TICK_DT; i++) {
      s.hour = 12;
      tick(s);
    }
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

  it('mařič odvede přebytek ze slunce za peníze a nejde do mínusu', () => {
    const s = solarPeak();
    s.upgrades.dump = 2; // 4 MW
    s.credits = 100;
    for (let i = 0; i < 3 / TICK_DT; i++) {
      s.hour = 12;
      tick(s);
    }
    expect(s.blackout).toBe(0);
    expect(s.live.dumpedMW).toBeGreaterThan(0);
    s.credits = 0;
    for (let i = 0; i < 20 / TICK_DT; i++) {
      s.hour = 12;
      tick(s);
    }
    expect(s.credits).toBeGreaterThanOrEqual(0);
  });

  it('v kapitole 1 se krize nespouští', () => {
    const s = newGame();
    s.doneQuests = QUESTS.filter((q) => !CHAPTER_END_QUESTS[1].includes(q.id)).map((q) => q.id);
    s.vo = 100;
    run(s, 60);
    expect(s.chapter).toBe(1);
    expect(s.toxic).toBe(false);
    expect(s.toxicCountdown).toBe(-1);
  });

  it('po začátku kapitoly 2 začne odpočet a krize se spustí sama za 15 s s hromadou odpadu na poli', () => {
    const s = newGame();
    s.chapter = 2;
    runCrisis(s, TICK_DT);
    expect(s.toxic).toBe(false);
    expect(s.toxicCountdown).toBeGreaterThan(0);
    for (let t = 0; t < TOXIC_DELAY_SECONDS - 1; t += TICK_DT) runCrisis(s, TICK_DT);
    expect(s.toxic).toBe(false);
    for (let t = 0; t < 2; t += TICK_DT) runCrisis(s, TICK_DT);
    expect(s.toxic).toBe(true);
    expect(s.toxicCountdown).toBe(-1);
    expect(s.toxicField).toBe(TOXIC_INITIAL_FIELD);
  });

  it('starší uložení z kapitoly 1 s už spuštěnou krizí se při načtení vyčistí, z kapitoly 2 ne', () => {
    const old = JSON.stringify({ v: 1, state: { credits: 5, toxic: true, toxicCountdown: 3 } });
    const s = deserialize(old)!;
    expect(s.toxic).toBe(false);
    expect(s.toxicCountdown).toBe(-1);
    const ch2 = JSON.stringify({ v: 1, state: { credits: 5, chapter: 2, toxic: true, toxicField: 50 } });
    const s2 = deserialize(ch2)!;
    expect(s2.toxic).toBe(true);
    expect(s2.toxicField).toBe(50);
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
    s.upgrades.power = 7; // 10 MW
    s.upgrades.line = 1; // vedení 9 MW, smlouva 15 MW => regulátor drží 9 MW = 90 % výkonu
    s.upgrades.regulator = 1;
    s.vo = 10000;
    s.credits = 100;
    run(s, 5);
    expect(s.incineratorLevel).toBeCloseTo(0.9, 5);
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

  it('mařič a baterie se odemknou až v kapitole 3, regulátor v kapitole 4', () => {
    const s = newGame();
    s.upgrades.power = 12;
    s.delivered = 5000;
    expect(isUnlocked(s, 'dump')).toBe(false);
    expect(isUnlocked(s, 'battery')).toBe(false);
    expect(isUnlocked(s, 'regulator')).toBe(false);
    s.chapter = 3;
    expect(isUnlocked(s, 'dump')).toBe(true);
    expect(isUnlocked(s, 'battery')).toBe(true);
    expect(isUnlocked(s, 'regulator')).toBe(false);
    s.chapter = 4;
    expect(isUnlocked(s, 'regulator')).toBe(true);
  });
});

describe('smlouva na stálých 15 MW', () => {
  it('odběr města je stálý, den i noc, a nezávisí na hodině', () => {
    const s = newGame();
    const r = cityDemandRangeMW(s);
    expect(r.min).toBeCloseTo(CONTRACT_MW, 5);
    expect(r.max).toBeCloseTo(CONTRACT_MW, 5);
    for (const h of [3, 8, 12, 20]) {
      s.hour = h;
      tick(s);
      expect(s.live.demandMW).toBeCloseTo(CONTRACT_MW, 5);
    }
  });

  it('prestiž zvedá odběr až po konci kapitoly (500 MWh)', () => {
    const s = newGame();
    s.delivered = 500; // prestiž 2
    expect(cityDemandRangeMW(s).max).toBeCloseTo(CONTRACT_MW * 1.25, 5);
  });

  it('smlouva se splní, když město aspoň jednou dostane 15 MW', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id).filter((id) => id !== 'contract');
    s.upgrades.power = 12; // 15 MW
    s.upgrades.line = 3; // vedení 15 MW
    s.vo = 1000;
    expect(s.contractMet).toBe(false);
    tick(s);
    expect(s.live.deliveredMW).toBeCloseTo(CONTRACT_MW, 5);
    expect(s.contractMet).toBe(true);
    expect(s.doneQuests).toContain('contract');
  });

  it('s vedením pro 12 MW se smlouva (15 MW) nesplní', () => {
    const s = newGame();
    s.upgrades.power = 12;
    s.upgrades.line = 2; // 12 MW
    s.vo = 1000;
    tick(s);
    expect(s.contractMet).toBe(false);
  });

  it('kapitola 1 končí smlouvou a 500 MWh, ne jen jedním z toho', () => {
    expect(CHAPTER_END_QUESTS[1]).toEqual(['contract', 'deliver400']);
    const contract = QUESTS.find((q) => q.id === 'contract')!;
    const mwh = QUESTS.find((q) => q.id === 'deliver400')!;
    expect(contract.kind).toBe('contract');
    expect(mwh.target).toBe(500);
  });

  it('15 MW jde dosáhnout: výkon max 12 úrovní a vedení 3 úrovně stačí', () => {
    const power = UPGRADES.find((u) => u.id === 'power')!;
    const line = UPGRADES.find((u) => u.id === 'line')!;
    expect(3 + power.maxLevel).toBeGreaterThanOrEqual(CONTRACT_MW);
    expect(6 + 3 * line.maxLevel).toBeGreaterThanOrEqual(CONTRACT_MW);
  });
});

describe('krize v rozpisu příjmů', () => {
  it('ztráta z krize se počítá zvlášť a součet sedí', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.chapter = 2;
    s.toxic = true;
    s.toxicField = TOXIC_FIELD_FULL; // plná hromada odpadu na poli => město platí 60 %
    s.vo = 100;
    s.upgrades.worker = 5;
    s.credits = 100;
    tick(s);
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
  it('jsou v seznamu až za hlavními úkoly', () => {
    const firstOngoing = QUESTS.findIndex((q) => q.ongoing);
    expect(firstOngoing).toBeGreaterThan(QUESTS.findIndex((q) => q.id === 'line2'));
    expect(QUESTS.slice(firstOngoing).every((q) => q.ongoing)).toBe(true);
  });

  it('průběžný úkol vyplatí odměnu, když je splněn', () => {
    const s = newGame();
    s.doneQuests = QUESTS.filter((q) => !q.ongoing).map((q) => q.id);
    s.upgrades.efficiency = 4;
    const before = s.credits;
    tick(s);
    expect(s.doneQuests).toContain('o_eff4');
    expect(s.credits).toBeGreaterThan(before);
  });
});

describe('brigádníci', () => {
  it('počet brigádníků není omezený, omezuje ho jen cena', () => {
    const s = newGame();
    s.upgrades.power = 1;
    s.credits = 1e9;
    for (let i = 0; i < 12; i++) buyUpgrade(s, 'worker');
    expect(s.upgrades.worker).toBe(12);
    // každý další je dražší
    expect(upgradeCost('worker', 12)).toBeGreaterThan(upgradeCost('worker', 11));
    // bez peněz už nejde koupit
    s.credits = 0;
    expect(buyUpgrade(s, 'worker')).toBe(false);
  });

  it('6 brigádníků zvládne plných 10 MW, když je účinnost aspoň 4', () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.upgrades.power = 7; // 10 MW
    s.upgrades.worker = 6;
    s.credits = 1000;
    s.vo = 100;
    s.upgrades.efficiency = 3;
    tick(s);
    expect(s.live.autonomous).toBe(false);
    s.upgrades.efficiency = 4;
    tick(s);
    expect(s.live.autonomous).toBe(true);
  });
});

describe('pořadí úkolů', () => {
  it('účinnost má v hlavním řetězci tři úkoly před úkolem line2', () => {
    const main = QUESTS.filter((q) => !q.ongoing && (q.chapter ?? 1) === 1);
    const idx = main.findIndex((q) => q.id === 'line2');
    expect(idx).toBeGreaterThan(0);
    expect(main.slice(0, idx).filter((q) => q.upgrade === 'efficiency').length).toBe(3);
  });

  it('mařič a baterie už nejsou v hlavním řetězci kapitoly 1', () => {
    const main = QUESTS.filter((q) => !q.ongoing && (q.chapter ?? 1) === 1);
    expect(main.some((q) => q.upgrade === 'dump' || q.upgrade === 'battery')).toBe(false);
  });

  it('každý úkol na vylepšení má dosažitelnou úroveň', () => {
    for (const q of QUESTS) {
      if (q.kind === 'upgrade' && q.upgrade) {
        const def = UPGRADES.find((u) => u.id === q.upgrade)!;
        expect(q.target).toBeLessThanOrEqual(def.maxLevel);
      }
    }
  });
});

// ---------------- Kapitoly 2 a 3 ----------------
describe('postup kapitol', () => {
  it('po splnění závěrečných úkolů kapitoly 1 se začne kapitola 2, pak 3, a tam to končí', () => {
    const s = newGame();
    s.doneQuests = [...CHAPTER_END_QUESTS[1]];
    tick(s);
    expect(s.chapter).toBe(2);
    s.doneQuests.push(...CHAPTER_END_QUESTS[2]);
    tick(s);
    expect(s.chapter).toBe(3);
    s.doneQuests.push(...CHAPTER_END_QUESTS[3]);
    tick(s);
    expect(s.chapter).toBe(3); // dál zatím nic (kapitoly 4 a 5 jsou jen plán)
  });

  it('úkoly pozdějších kapitol se nesplní předčasně', () => {
    const s = newGame();
    s.upgrades.cleanup = 3; // splňuje úkoly kapitoly 2, ale jsme v kapitole 1
    tick(s);
    expect(s.doneQuests).not.toContain('c2_cleanup');
    s.chapter = 2;
    tick(s);
    expect(s.doneQuests).toContain('c2_cleanup');
  });

  it('každá kapitola má závěrečný úkol v seznamu a úkoly kapitol jdou za sebou', () => {
    for (const ends of Object.values(CHAPTER_END_QUESTS)) for (const id of ends) expect(QUESTS.some((q) => q.id === id)).toBe(true);
    const chapters = QUESTS.filter((q) => !q.ongoing).map((q) => q.chapter ?? 1);
    expect([...chapters].sort((a, b) => a - b)).toEqual(chapters);
  });
});

describe('kapitola 2: odpad', () => {
  const ch2 = () => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id); // ať úkoly nevyplatí kredity
    s.chapter = 2;
    s.toxic = true;
    s.upgrades.power = 2; // 5 MW
    s.upgrades.line = 1;
    s.vo = 1000;
    s.credits = 10000;
    return s;
  };

  it('po krizi ze spalovny vzniká odpad: nejdřív do skladu, co se nevejde, leží na poli', () => {
    const s = ch2();
    s.upgrades.storage = 1; // 150 j.
    run(s, 30);
    expect(s.toxicStored).toBeGreaterThan(0);
    run(s, 300);
    expect(s.toxicStored).toBeCloseTo(150, 5); // sklad je plný
    expect(s.toxicField).toBeGreaterThan(0); // zbytek leží na poli
  });

  it('bez krize žádný odpad nevzniká', () => {
    const s = ch2();
    s.toxic = false;
    run(s, 10); // krize začne až 15 s po začátku kapitoly
    expect(s.toxic).toBe(false);
    expect(s.toxicField).toBe(0);
    expect(s.toxicStored).toBe(0);
  });

  it('město platí míň, dokud leží odpad na poli (0 j. = plná cena, plné pole = 60 %)', () => {
    const s = ch2();
    s.toxicField = 0;
    tick(s);
    expect(s.live.priceFactor).toBeCloseTo(1, 5);
    s.toxicField = TOXIC_FIELD_FULL * 5;
    tick(s);
    expect(s.live.priceFactor).toBeCloseTo(0.6, 5);
  });

  it('likvidátor ničí odpad z pole, stojí peníze a nikdy nejde do mínusu', () => {
    const s = ch2();
    s.toxicField = 100;
    s.upgrades.cleanup = 2; // 1 j/s
    run(s, 10);
    expect(s.toxicDisposed).toBeGreaterThan(5);
    expect(s.live.disposeCostPerSecond).toBeGreaterThan(0);
    // bez peněz (a bez příjmu ze spalovny) se neničí
    s.credits = 0;
    s.incineratorOn = false;
    s.vo = 0;
    const before = s.toxicDisposed;
    run(s, 10);
    expect(s.credits).toBeGreaterThanOrEqual(0);
    expect(s.toxicDisposed - before).toBeLessThan(1);
  });

  it('úkol "vyčisti pole" se splní, až když je pole prázdné po likvidaci', () => {
    const s = ch2();
    s.doneQuests = QUESTS.map((q) => q.id).filter((id) => id !== 'c2_field');
    s.toxicField = 5;
    s.upgrades.cleanup = 8;
    s.incineratorOn = false; // ať nové odpadky nevznikají
    tick(s);
    expect(s.doneQuests).not.toContain('c2_field');
    run(s, 30);
    expect(s.toxicField).toBeLessThan(0.5);
    expect(s.doneQuests).toContain('c2_field');
  });

  it('od kapitoly 2 město bere všechno, co unese vedení (čím víc vyrábíš, tím víc odebírá)', () => {
    const s = newGame();
    s.chapter = 2;
    s.upgrades.line = 2;
    tick(s);
    expect(s.live.demandMW).toBeCloseTo(12, 5);
    s.upgrades.line = 4;
    tick(s);
    expect(s.live.demandMW).toBeCloseTo(18, 5);
  });
});

describe('kapitola 3: čistý zdroj a důvěra', () => {
  const ch3 = (hour: number) => {
    const s = newGame();
    s.doneQuests = QUESTS.map((q) => q.id);
    s.chapter = 3;
    s.hour = hour;
    s.upgrades.power = 1;
    s.upgrades.line = 3;
    s.upgrades.solar = 5; // 10 MW špičkově
    s.toxic = true; // krize už proběhla (ať se v testu nespouští znovu)
    s.toxicField = 0;
    s.incineratorOn = false; // ať ze spalovny nevzniká odpad; ve zkoušce slunce stačí
    s.vo = 1000;
    s.credits = 10000;
    return s;
  };

  it('sluneční panely vyrábějí jen ve dne a nejvíc v poledne', () => {
    const s = ch3(12);
    expect(solarMW(s)).toBeCloseTo(10, 5);
    s.hour = 8;
    expect(solarMW(s)).toBeGreaterThan(0);
    expect(solarMW(s)).toBeLessThan(10);
    s.hour = 22;
    expect(solarMW(s)).toBe(0);
  });

  it('čistá energie ze slunce zvedá důvěru veřejnosti', () => {
    const s = ch3(12);
    run(s, 20);
    expect(s.trust).toBeGreaterThan(0);
    const t0 = s.trust;
    s.hour = 22; // v noci slunce nesvítí
    run(s, 5);
    expect(s.trust).toBeCloseTo(t0, 1);
  });

  it('odpad na poli důvěru snižuje a důvěra se drží mezi 0 a 100', () => {
    const s = ch3(22);
    s.toxic = true;
    s.toxicField = TOXIC_FIELD_FULL;
    s.incineratorOn = false;
    s.trust = 50;
    run(s, 20);
    expect(s.trust).toBeLessThan(50);
    s.toxicField = 0;
    s.trust = 99.99;
    s.hour = 12;
    run(s, 60);
    expect(s.trust).toBeLessThanOrEqual(100);
    s.trust = 0;
    s.toxicField = TOXIC_FIELD_FULL;
    s.hour = 22;
    run(s, 10);
    expect(s.trust).toBeGreaterThanOrEqual(0);
  });

  it('vysoká důvěra zvedá cenu (až o 20 %)', () => {
    const s = ch3(12);
    s.trust = 100;
    tick(s);
    expect(s.live.priceFactor).toBeCloseTo(1.2, 5);
  });

  it('polední špička ze slunce přetíží slabé vedení (proto je v kapitole 3 baterie a silnější vedení)', () => {
    const s = ch3(12);
    s.upgrades.line = 0; // vedení 6 MW
    s.upgrades.power = 12; // 15 MW ze spalovny + 10 MW ze slunce
    s.incineratorOn = true;
    let blackout = false;
    for (let i = 0; i < 20 / TICK_DT; i++) {
      s.vo = 10000;
      tick(s);
      if (s.blackout > 0) blackout = true;
    }
    expect(blackout).toBe(true);
  });
});

describe('odpad na mapě', () => {
  it('na začátku je na mapě odpad, část blízko spalovny, nic na budovách, drátech ani na vodě', () => {
    const s = newGame();
    expect(s.litter.length).toBe(LITTER_INITIAL);
    for (const l of s.litter) {
      expect(isBlockedTile(l.x, l.y)).toBe(false);
      expect(l.left).toBe(LITTER_CLICKS);
    }
    const a = MAP_INCINERATOR_TILE;
    const near = s.litter.filter((l) => Math.abs(l.x - (a.x + 1)) <= LITTER_NEAR_RADIUS_TILES && Math.abs(l.y - (a.y + 1)) <= LITTER_NEAR_RADIUS_TILES);
    expect(near.length).toBeGreaterThanOrEqual(LITTER_NEAR_COUNT);
    // žádné dvě hromádky na stejné dlaždici
    expect(new Set(s.litter.map((l) => `${l.x},${l.y}`)).size).toBe(s.litter.length);
  });

  it('klepnutí dá 1 VO a po 5 klepnutích hromádka zmizí a započítá se jako uklizená', () => {
    const s = newGame();
    const { x, y } = s.litter[0];
    const n = s.litter.length;
    for (let i = 1; i < LITTER_CLICKS; i++) {
      const r = collectLitter(s, x, y)!;
      expect(r.removed).toBe(false);
      expect(r.left).toBe(LITTER_CLICKS - i);
    }
    expect(s.vo).toBe(LITTER_CLICKS - 1);
    expect(s.litterCleaned).toBe(0);
    const last = collectLitter(s, x, y)!;
    expect(last.removed).toBe(true);
    expect(s.vo).toBe(LITTER_CLICKS);
    expect(s.taps).toBe(LITTER_CLICKS);
    expect(s.litterCleaned).toBe(1);
    expect(s.litter.length).toBe(n - 1);
    expect(collectLitter(s, x, y)).toBeNull(); // už tam nic není
  });

  it('nový odpad se objevuje pomalu a nepřekročí strop', () => {
    const s = newGame();
    s.litter.splice(0, 10);
    const n = s.litter.length;
    runLitter(s, LITTER_RESPAWN_SECONDS * 3);
    expect(s.litter.length).toBe(n + 3);
    runLitter(s, 10000);
    expect(s.litter.length).toBeLessThanOrEqual(LITTER_MAX);
    expect(s.litter.length).toBe(LITTER_MAX);
  });

  it('rozmístění je deterministické a po spawnu nikdy nevznikne dvakrát stejná dlaždice', () => {
    const a = newGame();
    const b = newGame();
    expect(a.litter).toEqual(b.litter);
    for (let i = 0; i < 20; i++) spawnLitter(a);
    expect(new Set(a.litter.map((l) => `${l.x},${l.y}`)).size).toBe(a.litter.length);
    initLitter(b);
    expect(b.litter).toEqual(newGame().litter);
  });

  it('vytříděný odpad jde do skladu VO a když je plný, přebytek se prodá', () => {
    const s = newGame();
    s.vo = 59.5; // sklad 60 VO
    const { x, y } = s.litter[0];
    collectLitter(s, x, y);
    expect(s.vo).toBeCloseTo(60, 5);
    expect(s.credits).toBeGreaterThan(0);
  });

  it('úkol "uklid 5 hromádek" se splní a odměna se vyplatí', () => {
    const s = newGame();
    s.litterCleaned = 5;
    tick(s);
    expect(s.doneQuests).toContain('litter5');
  });

  it('odpad se uloží a načte (včetně už uklizeného)', () => {
    const s = newGame();
    const { x, y } = s.litter[0];
    for (let i = 0; i < LITTER_CLICKS; i++) collectLitter(s, x, y);
    const back = deserialize(serialize(s))!;
    expect(back.litter).toEqual(s.litter);
    expect(back.litterCleaned).toBe(1);
    // starší uložení bez odpadu dostane čerstvý odpad na mapě
    const old = deserialize(JSON.stringify({ v: 1, state: { credits: 5 } }))!;
    expect(old.litter.length).toBe(LITTER_INITIAL);
  });

  it('průběžné úkoly na uklízení se nezapočítají před odemknutím (autonomie), jinak by se přeskočila hra', () => {
    const s = newGame();
    s.litterCleaned = 120;
    tick(s);
    expect(s.doneQuests).not.toContain('o_litter100');
    s.doneQuests.push('autonomy');
    tick(s);
    expect(s.doneQuests).toContain('o_litter100');
    expect(s.credits).toBeGreaterThanOrEqual(600);
  });

  it('při dopočtu času pryč (idle) odpad dál přibývá', () => {
    const s = newGame();
    s.litter.splice(0, 20);
    const n = s.litter.length;
    simulateOffline(s, 120);
    expect(s.litter.length).toBeGreaterThan(n);
  });
});

describe('starosta (děj)', () => {
  it('na začátku hry se ozve starosta s úvodem', () => {
    const s = newGame();
    checkStory(s);
    expect(s.story).toContain('s_start');
    expect(storyText('s_start')).toContain('15 MW');
  });

  it('scénka se ukáže jednou, i když se kontroluje víckrát', () => {
    const s = newGame();
    s.litterCleaned = 5;
    checkStory(s);
    checkStory(s);
    checkStory(s);
    expect(s.story.filter((x) => x === 's_litter5').length).toBe(1);
  });

  it('scénky chodí v pořadí podle toho, co hráč dělá (první MWh, brigádník, autonomie, smlouva)', () => {
    const s = newGame();
    s.doneQuests = [];
    s.delivered = 1;
    checkStory(s);
    expect(s.story).toContain('s_first_mwh');
    expect(s.story).not.toContain('s_worker1');
    s.upgrades.worker = 1;
    checkStory(s);
    expect(s.story).toContain('s_worker1');
    s.contractMet = true;
    checkStory(s);
    expect(s.story).toContain('s_contract');
  });

  it('krize, čistá pole a důvěra spouštějí scénky kapitol 2 a 3', () => {
    const s = newGame();
    s.chapter = 2;
    s.toxic = true;
    s.toxicDisposed = 5;
    s.toxicField = 0;
    checkStory(s);
    expect(s.story).toContain('s_toxic');
    expect(s.story).toContain('s_field_clean');
    s.chapter = 3;
    s.trust = 61;
    checkStory(s);
    expect(s.story).toContain('s_chapter3');
    expect(s.story).toContain('s_trust25');
    expect(s.story).toContain('s_trust60');
    expect(s.story).not.toContain('s_trust100');
  });

  it('vyklikaná mapa spustí scénku o čisté pláži', () => {
    const s = newGame();
    s.litter.length = 0;
    s.litterCleaned = 36;
    checkStory(s);
    expect(s.story).toContain('s_litter_empty');
  });

  it('občas se starosta ozve jen tak (každý druhý den), s textem podle kapitoly', () => {
    const s = newGame();
    s.chapter = 2;
    s.day = AMBIENT_EVERY_DAYS; // druhý den
    checkStory(s);
    const amb = s.story.find((x) => x.startsWith('amb:'))!;
    expect(amb).toBeDefined();
    expect(AMBIENT_LINES[2]).toContain(storyText(amb)!);
    // v lichý den nic
    const n = s.story.length;
    s.day = AMBIENT_EVERY_DAYS + 1;
    checkStory(s);
    expect(s.story.length).toBe(n);
  });

  it('všechna id scének jsou jedinečná a každá má text', () => {
    const ids = STORY_BEATS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of STORY_BEATS) expect(b.text.length).toBeGreaterThan(10);
  });

  it('scénky se ukládají a po načtení se nezačnou znovu', () => {
    const s = newGame();
    checkStory(s);
    const back = deserialize(serialize(s))!;
    expect(back.story).toEqual(s.story);
  });
});

describe('úklidová četa a přibývání odpadu', () => {
  const crew = (workers: number) => {
    const s = newGame();
    s.doneQuests = QUESTS.filter((q) => !CHAPTER_END_QUESTS[1].includes(q.id)).map((q) => q.id);
    s.upgrades.worker = workers;
    s.credits = 1e9; // ať brigádníci nestojí
    s.incineratorOn = false;
    return s;
  };

  it('bez brigádníků odpad dál přibývá až na strop (i při dopočtu času pryč)', () => {
    const s = crew(0);
    simulateOffline(s, 86400);
    expect(s.litter.length).toBe(LITTER_MAX);
  });

  it('četa o počtu LITTER_CREW_SIZE odpad udrží, víc brigádníků ostrov vyčistí', () => {
    const hold = crew(LITTER_CREW_SIZE);
    const n0 = hold.litter.length;
    run(hold, 3000);
    expect(Math.abs(hold.litter.length - n0)).toBeLessThanOrEqual(3);
    const clean = crew(LITTER_CREW_SIZE * 2);
    run(clean, 3000);
    expect(clean.litter.length).toBeLessThanOrEqual(LITTER_CLEAN_COUNT);
    const few = crew(3);
    run(few, 3000);
    expect(few.litter.length).toBeGreaterThan(n0); // 3 brigádníci nestačí, odpad přibývá
  });

  it('brigádníci bez peněz na mzdy neuklízejí', () => {
    const s = crew(20);
    s.credits = 0;
    const n0 = s.litter.length;
    run(s, 600);
    expect(s.litter.length).toBeGreaterThanOrEqual(n0);
  });

  it('úklid četou se nezapočítává mezi hráčem uklizené hromádky', () => {
    const s = crew(LITTER_CREW_SIZE * 2);
    run(s, 3000);
    expect(s.litterCleaned).toBe(0);
  });

  it('starosta upozorní, když se ostrov zaplevelí, a v kapitole 2 žádá četu', () => {
    const s = newGame();
    checkStory(s);
    expect(s.story).not.toContain('s_dirty');
    while (s.litter.length < LITTER_DIRTY_COUNT) spawnLitter(s);
    checkStory(s);
    expect(s.story).toContain('s_dirty');
    s.chapter = 2;
    checkStory(s);
    expect(s.story).toContain('s_crew_start');
    s.upgrades.worker = 12;
    checkStory(s);
    expect(s.story).toContain('s_crew12');
  });

  it('úkoly kapitoly 2: četa 12 brigádníků a čistý ostrov', () => {
    const s = newGame();
    s.chapter = 2;
    s.upgrades.worker = 12;
    tick(s);
    expect(s.doneQuests).toContain('c2_crew');
    expect(s.doneQuests).not.toContain('c2_island'); // odpad na mapě ještě je
    s.litter.length = 0;
    s.litter.push({ x: 4, y: 4, left: 5 });
    tick(s);
    expect(s.doneQuests).toContain('c2_island');
  });
});
