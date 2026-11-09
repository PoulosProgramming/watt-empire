import { PARCEL_START, START_HOUR, type BuildingType, type UpgradeId } from './balance';
import { initLitter } from './litter';

// Budova postavená hráčem: druh a levý horní roh (velikost je v BUILDINGS)
export interface Building {
  type: BuildingType;
  x: number;
  y: number;
}

// Hromádka odpadu na mapě: dlaždice a kolik klepnutí zbývá, než zmizí
export interface Litter {
  x: number;
  y: number;
  left: number;
}

// Všechno, co se ukládá, je v jednom objektu.
export interface GameState {
  credits: number;
  vo: number; // vytříděný odpad
  hour: number; // herní čas 0..24
  day: number;
  taps: number;
  delivered: number; // celkem dodáno městu (MWh)
  upgrades: Record<UpgradeId, number>;
  incineratorOn: boolean; // hlavní vypínač
  incineratorRunning: boolean; // skutečně vyrábí (sklad VO s hysterezí)
  incineratorLevel: number; // podíl nominálního výkonu 0.3..1 (1 = pevný výkon; řídí jen regulátor)
  battery: number; // uloženo (MWh)
  overload: number; // sekundy přetížení
  blackout: number; // zbývající sekundy výpadku
  lastSeen: number; // čas (ms) posledního uložení nebo schování hry, pro idle dopočet
  chapter: number; // aktuální kapitola (odemyká mařič/baterii v 3 a regulátor ve 4)
  contractMet: boolean; // splněna smlouva (město aspoň jednou dostalo smluvních MW)
  toxic: boolean; // ekologická krize začala (toxický odpad)
  toxicCountdown: number; // sekundy do spuštění krize (-1 = odpočet neběží)
  buildings: Building[]; // budovy postavené na mapě
  buildVersion: number; // zvyšuje se při každé změně budov (pro paměť propojení)
  unlockedParcels: number[]; // odemčené parcely mapy (indexy, viz mapdata)
  story: string[]; // scénky starosty, které už nastaly (id), v pořadí
  ambientDay: number; // poslední herní den, pro který se řešila občasná hláška starosty
  litter: Litter[]; // odpad rozsetý po mapě (ruční třídění klepáním)
  litterSeed: number; // stav generátoru náhodných čísel pro nový odpad
  litterTimer: number; // sekundy do dalšího nového odpadu
  litterCrewAcc: number; // rozpracovaný úklid brigádníků (hromádky, které se právě uklízejí)
  litterCleaned: number; // kolik hromádek odpadu se celkem uklidilo
  toxicField: number; // toxický odpad na poli (snižuje cenu energie)
  toxicStored: number; // toxický odpad bezpečně ve skladu
  toxicDisposed: number; // kolik jednotek odpadu se celkem zlikvidovalo
  trust: number; // důvěra veřejnosti 0 až 100 (od kapitoly 3)
  doneQuests: string[];
  // hodnoty z posledního tiku (jen pro zobrazení)
  live: {
    productionMW: number;
    demandMW: number;
    deliveredMW: number;
    batteryFlowMW: number; // + nabíjí, - vybíjí
    wastedMW: number;
    dumpedMW: number; // přebytek spálený mařičem
    incomePerSecond: number; // příjem z prodeje energie
    crisisLossPerSecond: number; // o kolik krize snížila příjem z prodeje
    wagePerSecond: number; // mzdy brigádníků
    dumpCostPerSecond: number; // náklady na mařič
    voBurnedPerSecond: number; // VO spálené ve spalovně
    overflowAccum: number; // kredity z prodeje přebytečného VO od posledního tiku
    overflowIncomePerSecond: number; // vyhlazený příjem z prodeje přebytečného VO
    voNeedPerSecond: number; // kolik VO za sekundu spalovna potřebuje při současném výkonu
    autonomous: boolean; // brigádníci stačí zásobit spalovnu (hráč nemusí klikat)
    voPerSecond: number;
    workersPaused: boolean;
    solarMW: number; // výkon sluneční elektrárny právě teď
    disposePerSecond: number; // jednotek odpadu zlikvidovaných za sekundu
    disposeCostPerSecond: number; // cena likvidace za sekundu
    priceFactor: number; // podíl plné ceny, který město platí
  };
}

export function newGame(): GameState {
  const s: GameState = {
    credits: 0,
    vo: 0,
    hour: START_HOUR,
    day: 1,
    taps: 0,
    delivered: 0,
    upgrades: { worker: 0, power: 0, efficiency: 0, line: 0, dump: 0, regulator: 0, solar: 0 },
    incineratorOn: true,
    incineratorRunning: false,
    incineratorLevel: 1,
    battery: 0,
    overload: 0,
    blackout: 0,
    lastSeen: 0,
    chapter: 1,
    contractMet: false,
    toxic: false,
    toxicCountdown: -1,
    buildings: [],
    buildVersion: 0,
    unlockedParcels: [...PARCEL_START],
    story: [],
    ambientDay: 1,
    litter: [],
    litterSeed: 0,
    litterTimer: 0,
    litterCrewAcc: 0,
    litterCleaned: 0,
    toxicField: 0,
    toxicStored: 0,
    toxicDisposed: 0,
    trust: 0,
    doneQuests: [],
    live: {
      productionMW: 0,
      demandMW: 0,
      deliveredMW: 0,
      batteryFlowMW: 0,
      wastedMW: 0,
      dumpedMW: 0,
      incomePerSecond: 0,
      crisisLossPerSecond: 0,
      wagePerSecond: 0,
      dumpCostPerSecond: 0,
      voBurnedPerSecond: 0,
      overflowAccum: 0,
      overflowIncomePerSecond: 0,
      voNeedPerSecond: 0,
      autonomous: false,
      voPerSecond: 0,
      workersPaused: false,
      solarMW: 0,
      disposePerSecond: 0,
      disposeCostPerSecond: 0,
      priceFactor: 1,
    },
  };
  initLitter(s);
  return s;
}
