import {
  BATTERY_CAPACITY_PER_LEVEL_MWH,
  BATTERY_RATE_PER_LEVEL_MW,
  BLACKOUT_FEE,
  BLACKOUT_SECONDS,
  CONTRACT_MW,
  CREDITS_PER_MWH,
  DEMAND_PER_PRESTIGE,
  DISPOSE_COST_PER_UNIT,
  DISPOSE_PER_LEVEL,
  DUMP_COST_PER_MWH,
  DUMP_MW_PER_LEVEL,
  INCINERATOR_MIN_LOAD,
  INCINERATOR_START_VO,
  INCINERATOR_VO_PER_MWH,
  LINE_BASE_CAPACITY_MW,
  LINE_UPGRADE_MW,
  OVERLOAD_TOLERANCE_SECONDS,
  PRESTIGE_THRESHOLDS_MWH,
  SECONDS_PER_GAME_HOUR,
  SOLAR_MW_PER_LEVEL,
  STORAGE_PER_LEVEL,
  TOXIC_FIELD_FULL,
  TOXIC_INCOME_FACTOR,
  TOXIC_PER_MWH,
  TRUST_DRAIN_PER_SECOND,
  TRUST_PER_CLEAN_MWH,
  TRUST_PER_DISPOSED,
  TRUST_PRICE_BONUS,
} from './balance';
import { sunFactor } from './daynight';
import { incineratorNominalMW, voPerMWh } from './economy';
import type { GameState } from './state';

export function prestige(s: GameState): number {
  let p = 1;
  PRESTIGE_THRESHOLDS_MWH.forEach((t, i) => {
    if (s.delivered >= t) p = i + 1;
  });
  return p;
}

export const lineCapacityMW = (s: GameState) => LINE_BASE_CAPACITY_MW + s.upgrades.line * LINE_UPGRADE_MW;
export { incineratorNominalMW };
export const dumpCapacityMW = (s: GameState) => s.upgrades.dump * DUMP_MW_PER_LEVEL;
export const batteryCapacityMWh = (s: GameState) => s.upgrades.battery * BATTERY_CAPACITY_PER_LEVEL_MWH;
export const batteryRateMW = (s: GameState) => s.upgrades.battery * BATTERY_RATE_PER_LEVEL_MW;
export const solarCapacityMW = (s: GameState) => s.upgrades.solar * SOLAR_MW_PER_LEVEL;
export const solarMW = (s: GameState) => solarCapacityMW(s) * sunFactor(s.hour); // jen ve dne
export const storageCapacity = (s: GameState) => s.upgrades.storage * STORAGE_PER_LEVEL;
export const disposeRate = (s: GameState) => s.upgrades.cleanup * DISPOSE_PER_LEVEL; // jednotek odpadu za sekundu

// Kapitola 1: smlouva, město odebírá stálých CONTRACT_MW bez ohledu na den a noc (den a noc je zatím jen vizuální).
// Prestiž zvedá odběr až po konci kapitoly 1 (prestiž 2 je od 500 MWh).
// Od kapitoly 2: čím víc hráč vyrábí, tím víc město odebírá, vezme všechno, co unese vedení.
export const cityDemandMW = (s: GameState) =>
  s.chapter >= 2 ? lineCapacityMW(s) : CONTRACT_MW * (1 + (prestige(s) - 1) * DEMAND_PER_PRESTIGE);

// Nejnižší a nejvyšší odběr města během dne (MW), aby hráč věděl, kolik energie město vůbec vezme.
export function cityDemandRangeMW(s: GameState): { min: number; max: number } {
  const d = cityDemandMW(s);
  return { min: d, max: d };
}

// Jednoduchá síť: výroba -> (baterie) -> vedení -> město.
// Přebytek, který nejde nikam uložit, přetěžuje síť.
export function runPower(s: GameState, dt: number): void {
  const dtH = dt / SECONDS_PER_GAME_HOUR; // délka tiku v herních hodinách
  const live = s.live;
  live.demandMW = cityDemandMW(s);

  // Blackout: nic se neděje, jen odpočet.
  if (s.blackout > 0) {
    s.blackout = Math.max(0, s.blackout - dt);
    live.productionMW = 0;
    live.deliveredMW = 0;
    live.batteryFlowMW = 0;
    live.wastedMW = 0;
    live.dumpedMW = 0;
    live.incomePerSecond = 0;
    live.crisisLossPerSecond = 0;
    live.dumpCostPerSecond = 0;
    live.voBurnedPerSecond = 0;
    live.solarMW = 0;
    live.disposePerSecond = 0;
    live.disposeCostPerSecond = 0;
    return;
  }

  // 1) Výroba ve spalovně. Sklad VO má hysterezi: rozjede se až při INCINERATOR_START_VO
  //    a zhasne, když nestačí na další tik. Díky tomu výkon neskáče nahoru a dolů.
  if (s.upgrades.regulator > 0) {
    // Automatický regulátor: výkon podle spotřeby města (a vedení), v mezích spalovny
    const target = Math.min(live.demandMW, lineCapacityMW(s)) / incineratorNominalMW(s);
    s.incineratorLevel = Math.min(1, Math.max(INCINERATOR_MIN_LOAD, target));
  } else {
    s.incineratorLevel = 1; // bez regulátoru běží spalovna pevným výkonem
  }
  let production = 0;
  let voBurned = 0; // VO za sekundu
  // Sluneční panely (od kapitoly 3) mají přednost; spalovna se přizpůsobí zbylé kapacitě vedení a odběru města
  // (výkon nad vedení prostě nevyrobí, takže ho hráč neplatí odpadem ani nezpůsobí blackout)
  const solar = solarMW(s);
  const gridRoomMW = Math.max(0, Math.min(live.demandMW, lineCapacityMW(s)) - solar);
  if (s.incineratorOn) {
    const vpm = voPerMWh(s, INCINERATOR_VO_PER_MWH);
    const wantedMW = Math.min(incineratorNominalMW(s) * s.incineratorLevel, gridRoomMW);
    const neededVO = wantedMW * dtH * vpm;
    if (!s.incineratorRunning && s.vo >= INCINERATOR_START_VO) s.incineratorRunning = true;
    if (s.incineratorRunning) {
      if (s.vo < neededVO) {
        s.incineratorRunning = false; // sklad je prázdný, čeká na dodávky
      } else {
        s.vo -= neededVO;
        voBurned = neededVO / dt;
        production = wantedMW;
      }
    }
  } else {
    s.incineratorRunning = false;
  }

  // Sluneční panely (od kapitoly 3): čistá energie jen ve dne
  const incProduction = production; // jen spalovna (z ní vzniká toxický odpad)
  production += solar;

  // Autonomie: brigádníci dodávají aspoň tolik VO, kolik spalovna při současném výkonu potřebuje
  const needVoPerSecond = s.incineratorOn
    ? (incineratorNominalMW(s) * s.incineratorLevel / SECONDS_PER_GAME_HOUR) * voPerMWh(s, INCINERATOR_VO_PER_MWH)
    : 0;
  live.voNeedPerSecond = needVoPerSecond;
  live.autonomous = s.incineratorOn && !live.workersPaused && live.voPerSecond >= needVoPerSecond - 1e-9;

  // 2) Dodávka městu a baterie
  const demand = live.demandMW;
  const line = lineCapacityMW(s);
  const rate = batteryRateMW(s);
  const dischargeRoom = Math.min(rate, s.battery / dtH);
  const chargeRoom = Math.min(rate, (batteryCapacityMWh(s) - s.battery) / dtH);

  let toCity = Math.min(production, demand, line);
  let battery = 0; // + nabíjí, - vybíjí
  if (production > toCity) {
    battery = Math.min(production - toCity, chargeRoom);
  } else if (toCity < Math.min(demand, line)) {
    const missing = Math.min(demand, line) - toCity;
    const discharge = Math.min(missing, dischargeRoom);
    toCity += discharge;
    battery = -discharge;
  }
  let wasted = Math.max(0, production - Math.min(production, demand, line) - Math.max(0, battery));
  s.battery = Math.min(batteryCapacityMWh(s), Math.max(0, s.battery + battery * dtH));

  // Smlouva je splněna, když město aspoň jednou dostane smluvní výkon
  if (toCity >= CONTRACT_MW - 1e-6) s.contractMet = true;

  // 3) Dodaná energie = peníze
  const mwh = toCity * dtH;
  s.delivered += mwh;
  // Cena: toxický odpad na poli ji snižuje (až o 40 %), důvěra veřejnosti ji od kapitoly 3 zvedá (až o 20 %)
  const fieldFrac = s.toxic ? Math.min(1, s.toxicField / TOXIC_FIELD_FULL) : 0;
  let priceFactor = 1 - (1 - TOXIC_INCOME_FACTOR) * fieldFrac;
  if (s.chapter >= 3) priceFactor *= 1 + (TRUST_PRICE_BONUS * s.trust) / 100;
  const creditsPerMWh = CREDITS_PER_MWH * priceFactor;
  s.credits += mwh * creditsPerMWh;

  // 3b) Mařič spálí přebytek, ale stojí peníze (nikdy do mínusu)
  let dumped = Math.min(wasted, dumpCapacityMW(s));
  if (dumped > 0) {
    const cost = dumped * dtH * DUMP_COST_PER_MWH;
    if (cost > s.credits) dumped = s.credits / (dtH * DUMP_COST_PER_MWH);
    s.credits = Math.max(0, s.credits - dumped * dtH * DUMP_COST_PER_MWH);
    wasted -= dumped;
  }

  // 3c) Toxický odpad po krizi: ze spalovny vzniká odpad, nejdřív se uskladní, co se nevejde, leží na poli;
  //     likvidátor ho ničí (nejdřív z pole) a každá jednotka stojí peníze (nikdy do mínusu)
  let disposePerSecond = 0;
  let disposeCostPerSecond = 0;
  if (s.toxic) {
    const produced = incProduction * dtH * TOXIC_PER_MWH;
    const stored = Math.min(produced, Math.max(0, storageCapacity(s) - s.toxicStored));
    s.toxicStored += stored;
    s.toxicField += produced - stored;
    let units = Math.min(disposeRate(s) * dt, s.toxicField + s.toxicStored);
    if (units * DISPOSE_COST_PER_UNIT > s.credits) units = s.credits / DISPOSE_COST_PER_UNIT;
    if (units > 0) {
      s.credits = Math.max(0, s.credits - units * DISPOSE_COST_PER_UNIT);
      const fromField = Math.min(units, s.toxicField);
      s.toxicField = Math.max(0, s.toxicField - fromField);
      s.toxicStored = Math.max(0, s.toxicStored - (units - fromField));
      s.toxicDisposed += units;
      disposePerSecond = units / dt;
      disposeCostPerSecond = (units * DISPOSE_COST_PER_UNIT) / dt;
    }
  }

  // 3d) Důvěra veřejnosti (od kapitoly 3): roste s čistou energií a likvidací, klesá, dokud leží odpad na poli
  if (s.chapter >= 3) {
    const cleanMWh = Math.min(solar, toCity) * dtH;
    s.trust += cleanMWh * TRUST_PER_CLEAN_MWH + disposePerSecond * dt * TRUST_PER_DISPOSED - TRUST_DRAIN_PER_SECOND * fieldFrac * dt;
    s.trust = Math.min(100, Math.max(0, s.trust));
  }

  // 4) Přetížení
  if (wasted > 0.01) {
    s.overload += dt;
    if (s.overload >= OVERLOAD_TOLERANCE_SECONDS) {
      s.blackout = BLACKOUT_SECONDS;
      s.overload = 0;
      s.credits = Math.max(0, s.credits - BLACKOUT_FEE); // nikdy do mínusu
    }
  } else {
    s.overload = Math.max(0, s.overload - dt);
  }

  live.productionMW = production;
  live.deliveredMW = toCity;
  live.batteryFlowMW = battery;
  live.wastedMW = wasted;
  live.dumpedMW = dumped;
  live.dumpCostPerSecond = (dumped / SECONDS_PER_GAME_HOUR) * DUMP_COST_PER_MWH;
  live.voBurnedPerSecond = voBurned;
  live.incomePerSecond = (toCity / SECONDS_PER_GAME_HOUR) * creditsPerMWh;
  live.crisisLossPerSecond = Math.max(0, (toCity / SECONDS_PER_GAME_HOUR) * (CREDITS_PER_MWH - creditsPerMWh));
  live.solarMW = solar;
  live.disposePerSecond = disposePerSecond;
  live.disposeCostPerSecond = disposeCostPerSecond;
  live.priceFactor = priceFactor;
}

