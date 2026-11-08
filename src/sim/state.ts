import { START_HOUR, type UpgradeId } from './balance';

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
  toxic: boolean; // ekologická krize začala (toxický odpad)
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
  };
}

export function newGame(): GameState {
  return {
    credits: 0,
    vo: 0,
    hour: START_HOUR,
    day: 1,
    taps: 0,
    delivered: 0,
    upgrades: { worker: 0, power: 0, efficiency: 0, line: 0, battery: 0, dump: 0, regulator: 0 },
    incineratorOn: true,
    incineratorRunning: false,
    incineratorLevel: 1,
    battery: 0,
    overload: 0,
    blackout: 0,
    toxic: false,
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
    },
  };
}
