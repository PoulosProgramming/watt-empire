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
  incineratorLevel: number; // nastavený výkon 0.3..1
  battery: number; // uloženo (MWh)
  overload: number; // sekundy přetížení
  blackout: number; // zbývající sekundy výpadku
  doneQuests: string[];
  // hodnoty z posledního tiku (jen pro zobrazení)
  live: {
    productionMW: number;
    demandMW: number;
    deliveredMW: number;
    batteryFlowMW: number; // + nabíjí, - vybíjí
    wastedMW: number;
    incomePerSecond: number;
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
    upgrades: { worker: 0, efficiency: 0, line: 0, battery: 0, regulator: 0 },
    incineratorOn: true,
    incineratorRunning: false,
    incineratorLevel: 1,
    battery: 0,
    overload: 0,
    blackout: 0,
    doneQuests: [],
    live: {
      productionMW: 0,
      demandMW: 0,
      deliveredMW: 0,
      batteryFlowMW: 0,
      wastedMW: 0,
      incomePerSecond: 0,
      voPerSecond: 0,
      workersPaused: false,
    },
  };
}
