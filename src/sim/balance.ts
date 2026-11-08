// VŠECHNA herní čísla jsou tady. Nikde jinde v kódu nesmí být "magická čísla".
// Chceš hru ztížit nebo zrychlit? Změň hodnotu tady a ulož.

export const TICKS_PER_SECOND = 4; // simulace se počítá 4× za sekundu

// ---- Čas ----
export const SECONDS_PER_GAME_HOUR = 15; // 1 herní hodina = 15 s => den (24 h) = 6 min
export const DAY_START_HOUR = 6; // od 6:00 je den
export const NIGHT_START_HOUR = 18; // od 18:00 je noc
export const START_HOUR = 8;

// ---- Ruční sběr a brigádníci ----
export const VO_PER_TAP = 1; // 5 tapů na odpad = 5 VO (GDD)
export const WORKER_VO_PER_SECOND = 0.5;
export const WORKER_WAGE_PER_SECOND = 0.2; // mzda v kreditech za sekundu

// ---- Spalovna ----
export const INCINERATOR_NOMINAL_MW = 10; // základní výkon (GDD)
export const INCINERATOR_VO_PER_MWH = 5; // 5 VO = 1 MWh (GDD)
export const INCINERATOR_MIN_LOAD = 0.3; // nejnižší nastavitelný výkon (30 %, pod noční spotřebu města)
export const INCINERATOR_LEVEL_STEP = 0.1; // posuvník výkonu po 10 %
export const INCINERATOR_LEVEL_CHANGE_FEE = 15; // poplatek za ruční změnu výkonu (kredity)
export const INCINERATOR_START_VO = 25; // sklad spalovny: rozjede se, až když je v něm aspoň tolik VO (hystereze)
export const EFFICIENCY_VO_FACTOR = 0.9; // každé vylepšení účinnosti: VO na MWh × 0.9

// ---- Město a síť ----
export const CREDITS_PER_MWH = 10; // 1 MWh dodaná městu = 10 kreditů (GDD)
export const CITY_BASE_DEMAND_MW = 10; // špička spotřeby ve dne
export const CITY_NIGHT_FACTOR = 0.35; // v noci spotřeba klesne na 35 %
export const DEMAND_PER_PRESTIGE = 0.25; // každá úroveň prestiže +25 % spotřeby
export const LINE_BASE_CAPACITY_MW = 10; // propustnost drátů a trafa na začátku
export const LINE_UPGRADE_MW = 5;

// ---- Baterie ----
export const BATTERY_CAPACITY_PER_LEVEL_MWH = 2;
export const BATTERY_RATE_PER_LEVEL_MW = 4; // nabíjecí i vybíjecí výkon

// ---- Přetížení a blackout ----
export const OVERLOAD_TOLERANCE_SECONDS = 4; // jak dlouho síť snese přebytek
export const BLACKOUT_SECONDS = 15;
export const BLACKOUT_FEE = 60; // poplatek za nahození (nikdy nejde do mínusu)

// ---- Prestiž ----
// Dodané MWh potřebné pro prestiž 2, 3, 4 ... (GDD: prestiž 2 po 100 MWh)
export const PRESTIGE_THRESHOLDS_MWH = [0, 100, 300, 800, 2000];

// ---- Vylepšení ----
export type UpgradeId = 'worker' | 'efficiency' | 'line' | 'battery' | 'regulator';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  baseCost: number;
  growth: number; // cena × growth s každou úrovní
  maxLevel: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'worker', name: 'Brigádník', description: 'Sbírá odpad za tebe', baseCost: 25, growth: 1.5, maxLevel: 15 },
  { id: 'efficiency', name: 'Účinnost spalovny', description: 'Z méně VO více energie', baseCost: 80, growth: 1.8, maxLevel: 10 },
  { id: 'line', name: 'Dráty a trafo', description: '+5 MW propustnost', baseCost: 120, growth: 1.7, maxLevel: 10 },
  { id: 'battery', name: 'Baterie', description: '+2 MWh uložiště, +4 MW', baseCost: 200, growth: 1.9, maxLevel: 10 },
  { id: 'regulator', name: 'Automatický regulátor', description: 'Spalovna sama drží výkon podle spotřeby města', baseCost: 250, growth: 1, maxLevel: 1 },
];

// ---- Úkoly (zatím bez postav) ----
export interface QuestDef {
  id: string;
  text: string;
  kind: 'delivered' | 'taps' | 'upgrade'; // dodáno MWh | ruční tapy | úroveň vylepšení
  target: number;
  reward: number;
  upgrade?: UpgradeId; // jen pro kind 'upgrade'
}

export const QUESTS: QuestDef[] = [
  { id: 'deliver1', text: 'Dodej městu 1 MWh', kind: 'delivered', target: 1, reward: 20 },
  { id: 'tap25', text: 'Vyčisti 25 odpadků (ruční tapy)', kind: 'taps', target: 25, reward: 30 },
  { id: 'worker3', text: 'Najmi 3 brigádníky', kind: 'upgrade', upgrade: 'worker', target: 3, reward: 40 },
  { id: 'deliver20', text: 'Dodej městu 20 MWh', kind: 'delivered', target: 20, reward: 80 },
  { id: 'battery1', text: 'Kup první baterii (přežiješ noc)', kind: 'upgrade', upgrade: 'battery', target: 1, reward: 100 },
  { id: 'line2', text: 'Posil dráty a trafo na úroveň 2', kind: 'upgrade', upgrade: 'line', target: 2, reward: 150 },
  { id: 'regulator', text: 'Kup automatický regulátor', kind: 'upgrade', upgrade: 'regulator', target: 1, reward: 200 },
  { id: 'deliver100', text: 'Dodej městu 100 MWh', kind: 'delivered', target: 100, reward: 300 },
];

// ---- Ladění ----
export const DEBUG_SPEEDS = [1, 10];
export const DEBUG_CREDITS_BONUS = 1000;
