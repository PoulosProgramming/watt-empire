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
export const WORKER_VO_PER_SECOND = 0.3;
export const WORKER_WAGE_PER_SECOND = 0.2; // mzda v kreditech za sekundu

// ---- Spalovna ----
// Na začátku běží spalovna pevně na malém výkonu (pod noční spotřebou města) => žádné blackouty.
// Výkon se zvyšuje nákupem vylepšení "Výkon spalovny".
export const INCINERATOR_BASE_MW = 3;
export const INCINERATOR_POWER_STEP_MW = 1; // +1 MW za každou úroveň vylepšení
export const INCINERATOR_VO_PER_MWH = 5; // 5 VO = 1 MWh (GDD)
export const INCINERATOR_MIN_LOAD = 0.3; // nejnižší podíl výkonu, na který stáhne automatický regulátor
export const INCINERATOR_START_VO = 15; // sklad spalovny: rozjede se, až když je v něm aspoň tolik VO (hystereze)
export const EFFICIENCY_VO_FACTOR = 0.9; // každé vylepšení účinnosti: VO na MWh × 0.9

// ---- Město a síť ----
export const CREDITS_PER_MWH = 10; // 1 MWh dodaná městu = 10 kreditů (GDD)
export const CITY_BASE_DEMAND_MW = 14; // špička spotřeby ve dne
export const CITY_NIGHT_FACTOR = 0.5; // v noci spotřeba klesne na 50 % (7 MW)
export const DEMAND_PER_PRESTIGE = 0.25; // každá úroveň prestiže +25 % spotřeby
export const LINE_BASE_CAPACITY_MW = 6; // propustnost drátů a trafa na začátku
export const LINE_UPGRADE_MW = 3;

// ---- Baterie ----
export const BATTERY_CAPACITY_PER_LEVEL_MWH = 10;
export const BATTERY_RATE_PER_LEVEL_MW = 3; // nabíjecí i vybíjecí výkon

// ---- Mařič (odvádí přebytek, ale stojí peníze za každou spálenou MWh) ----
export const DUMP_MW_PER_LEVEL = 2;
export const DUMP_COST_PER_MWH = 4;

// ---- Přetížení a blackout ----
export const OVERLOAD_TOLERANCE_SECONDS = 4; // jak dlouho síť snese přebytek
export const BLACKOUT_SECONDS = 15;
export const BLACKOUT_FEE = 60; // poplatek za nahození (nikdy nejde do mínusu)

// ---- Ekologická krize (kapitola 1) ----
export const TOXIC_CRISIS_MWH = 350; // po tolika dodaných MWh vyplivne spalovna toxický odpad
export const TOXIC_INCOME_FACTOR = 0.6; // během krize město platí jen 60 % (řeší se až v kapitole 2)

// ---- Prestiž ----
// Dodané MWh potřebné pro prestiž 2, 3, 4 ... (kapitola 1 končí prestiží 2 po 500 MWh, GDD původně 100)
export const PRESTIGE_THRESHOLDS_MWH = [0, 500, 1200, 2800, 6500];

// ---- Vylepšení ----
export type UpgradeId = 'worker' | 'power' | 'efficiency' | 'line' | 'battery' | 'dump' | 'regulator';

// Podmínka (pro úkoly i odemykání vylepšení): ruční tapy | dodané MWh | úroveň jiného vylepšení
export interface Requirement {
  kind: 'delivered' | 'taps' | 'upgrade';
  target: number;
  upgrade?: UpgradeId; // jen pro kind 'upgrade'
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  baseCost: number;
  growth: number; // cena × growth s každou úrovní
  maxLevel: number;
  unlock?: Requirement & { text: string }; // bez podmínky je vylepšení dostupné hned
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'worker', name: 'Brigádník', description: 'Sbírá odpad za tebe, bere mzdu', baseCost: 400, growth: 1.4, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'power', target: 2, text: 'po 2 upgradech výkonu spalovny' } },
  { id: 'power', name: 'Výkon spalovny', description: '+1 MW (víc peněz, ale v noci hrozí přebytek)', baseCost: 300, growth: 1.8, maxLevel: 7, unlock: { kind: 'delivered', target: 10, text: 'po dodání 10 MWh' } },
  { id: 'efficiency', name: 'Účinnost spalovny', description: 'Z méně VO více energie', baseCost: 400, growth: 1.9, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'worker', target: 2, text: 'po 2 brigádnících' } },
  { id: 'line', name: 'Dráty a trafo', description: '+3 MW propustnost', baseCost: 500, growth: 1.7, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'power', target: 3, text: 'po výkonu spalovny 6 MW' } },
  { id: 'dump', name: 'Mařič přebytku', description: 'Spálí +2 MW přebytku, ale stojí 4💰 za každou MWh', baseCost: 500, growth: 1.7, maxLevel: 5, unlock: { kind: 'upgrade', upgrade: 'power', target: 4, text: 'po výkonu spalovny 7 MW (od 8 MW vzniká noční přebytek)' } },
  { id: 'battery', name: 'Baterie', description: '+10 MWh uložiště, +3 MW', baseCost: 900, growth: 1.8, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'power', target: 4, text: 'po výkonu spalovny 7 MW (od 8 MW vzniká noční přebytek)' } },
  { id: 'regulator', name: 'Automatický regulátor', description: 'Spalovna sama drží výkon podle spotřeby města', baseCost: 12000, growth: 1, maxLevel: 1, unlock: { kind: 'delivered', target: 250, text: 'po dodání 250 MWh' } },
];

// ---- Úkoly (zatím bez postav) ----
export interface QuestDef extends Requirement {
  id: string;
  text: string;
  reward: number;
}

// Kolik nejbližších nesplněných úkolů se hráči zobrazí (ostatní se odemykají postupně)
export const QUESTS_VISIBLE = 3;

export const QUESTS: QuestDef[] = [
  { id: 'deliver1', text: 'Dodej městu 1 MWh', kind: 'delivered', target: 1, reward: 20 },
  { id: 'tap25', text: 'Vyčisti 25 odpadků (ruční tapy)', kind: 'taps', target: 25, reward: 30 },
  { id: 'power2', text: 'Zvyš výkon spalovny na úroveň 2 (5 MW)', kind: 'upgrade', upgrade: 'power', target: 2, reward: 300 },
  { id: 'worker3', text: 'Najmi 3 brigádníky', kind: 'upgrade', upgrade: 'worker', target: 3, reward: 80 },
  { id: 'deliver30', text: 'Dodej městu 30 MWh', kind: 'delivered', target: 30, reward: 150 },
  { id: 'power4', text: 'Zvyš výkon spalovny na úroveň 4 (7 MW, tolik město bere v noci)', kind: 'upgrade', upgrade: 'power', target: 4, reward: 350 },
  { id: 'dump1', text: 'Kup mařič přebytku (odvede přebytek v noci)', kind: 'upgrade', upgrade: 'dump', target: 1, reward: 400 },
  { id: 'battery1', text: 'Kup první baterii', kind: 'upgrade', upgrade: 'battery', target: 1, reward: 500 },
  { id: 'deliver100', text: 'Dodej městu 100 MWh', kind: 'delivered', target: 100, reward: 600 },
  { id: 'line2', text: 'Posil dráty a trafo na úroveň 2 (kvůli výkonu nad 6 MW)', kind: 'upgrade', upgrade: 'line', target: 2, reward: 800 },
  { id: 'deliver250', text: 'Přežij ekologickou krizi: dodej městu 350 MWh', kind: 'delivered', target: 350, reward: 1000 },
  { id: 'regulator', text: 'Kup automatický regulátor', kind: 'upgrade', upgrade: 'regulator', target: 1, reward: 1500 },
  { id: 'deliver400', text: 'Dodej městu 500 MWh (konec kapitoly 1)', kind: 'delivered', target: 500, reward: 2000 },
];

// ---- Příběh (zatím jen text, postavy a dialogy přijdou v kroku 4) ----
export const STORY_INTRO =
  'Zamořený ostrov. Jediná věc, která tu ještě funguje, je stará spalovna odpadu. Městečko za kopcem je bez proudu a starosta tě prosí: roztoč spalovnu, vyčisti pláž a dodej městu elektřinu, než zhasne naposledy.';
export const STORY_CHAPTER_END =
  'Město svítí a ostrov dýchá, ale spalovna vyplivla toxický odpad a pod hladinou se probouzí něco většího. Konec kapitoly 1. V kapitole 2 přijde laboratoř, likvidátor odpadu a první soláry. Zatím jde hra dál ladit: dohraj poslední úkoly a pošli, co ti vadilo.';

// ---- Ukládání ----
export const AUTOSAVE_SECONDS = 60; // jak často se postup ukládá (navíc při zavření stránky)

// ---- Ladění ----
export const DEBUG_SPEEDS = [1, 10];
export const DEBUG_CREDITS_BONUS = 1000;
