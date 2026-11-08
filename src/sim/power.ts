import {
  BATTERY_CAPACITY_PER_LEVEL_MWH,
  BATTERY_RATE_PER_LEVEL_MW,
  BLACKOUT_FEE,
  BLACKOUT_SECONDS,
  CREDITS_PER_MWH,
  DEMAND_PER_PRESTIGE,
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
  TOXIC_CRISIS_MWH,
  TOXIC_INCOME_FACTOR,
} from './balance';
import { baseDemandMW } from './daynight';
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
export const cityDemandMW = (s: GameState) =>
  baseDemandMW(s.hour) * (1 + (prestige(s) - 1) * DEMAND_PER_PRESTIGE);

// Nejnižší a nejvyšší odběr města během dne (MW), aby hráč věděl, kolik energie město vůbec vezme.
export function cityDemandRangeMW(s: GameState): { min: number; max: number } {
  const mult = 1 + (prestige(s) - 1) * DEMAND_PER_PRESTIGE;
  let min = Infinity;
  let max = 0;
  for (let h = 0; h < 24; h += 0.25) {
    const d = baseDemandMW(h) * mult;
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return { min, max };
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
  if (s.incineratorOn) {
    const vpm = voPerMWh(s, INCINERATOR_VO_PER_MWH);
    const wantedMW = incineratorNominalMW(s) * s.incineratorLevel;
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

  // 3) Dodaná energie = peníze
  const mwh = toCity * dtH;
  s.delivered += mwh;
  // Krize začne až ve chvíli, kdy je hráč autonomní (nemusí klikat a má z čeho žít)
  if (s.delivered >= TOXIC_CRISIS_MWH && live.autonomous) s.toxic = true;
  const creditsPerMWh = CREDITS_PER_MWH * (s.toxic ? TOXIC_INCOME_FACTOR : 1);
  s.credits += mwh * creditsPerMWh;

  // 3b) Mařič spálí přebytek, ale stojí peníze (nikdy do mínusu)
  let dumped = Math.min(wasted, dumpCapacityMW(s));
  if (dumped > 0) {
    const cost = dumped * dtH * DUMP_COST_PER_MWH;
    if (cost > s.credits) dumped = s.credits / (dtH * DUMP_COST_PER_MWH);
    s.credits = Math.max(0, s.credits - dumped * dtH * DUMP_COST_PER_MWH);
    wasted -= dumped;
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
  live.crisisLossPerSecond = (toCity / SECONDS_PER_GAME_HOUR) * (CREDITS_PER_MWH - creditsPerMWh);
}

