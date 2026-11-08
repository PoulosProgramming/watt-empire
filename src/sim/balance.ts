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
export const WORKER_VO_PER_SECOND = 0.4; // 5 brigádníků = 2 VO/s = přesně na 6 MW
// Sklad VO u spalovny má strop = tolik sekund provozu při plném výkonu. Přebytek se automaticky prodá.
export const VO_STORAGE_SECONDS = 60;
export const VO_OVERFLOW_PRICE = 0.3; // kredity za 1 prodaný VO navíc
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
// Smlouva (kapitola 1): město odebírá stálých CONTRACT_MW bez ohledu na den a noc. Den a noc je zatím jen vizuální;
// v části hry, která není domyšlená, přijde zlom, kdy bude potřeba regulovat (pak se použije křivka níž).
export const CONTRACT_MW = 15;
export const CITY_BASE_DEMAND_MW = 14; // špička spotřeby ve dne (křivka dne a noci se zatím nepoužívá)
export const CITY_NIGHT_FACTOR = 0.5; // v noci spotřeba klesne na 50 % (zatím se nepoužívá)
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
// Ekologická krize je nachystaná pro kapitolu 2. V kapitole 1 se nespouští (null), hráč řekl, že hru moc zpomalovala.
// Až bude kapitola 2, nastav sem id úkolu, po jehož splnění krize začne.
export const TOXIC_TRIGGER_QUEST: string | null = null;
export const TOXIC_DELAY_SECONDS = 15; // krize se spustí sama za tolik sekund (bez předchozího varování)
export const TOXIC_POPUP_TITLE = '☣️ Ekologická katastrofa!';
export const TOXIC_POPUP_TEXT =
  'Přetížená spalovna se zadrhla a vyplivla na pláž toxický odpad. Město je vyděšené a platí za proud jen 60 %. Vyčistit ostrov zvládneš až s vědeckou laboratoří v kapitole 2. Do té doby drž síť v chodu a vydělávej dál.';
export const TOXIC_INCOME_FACTOR = 0.6; // během krize město platí jen 60 % (řeší se až v kapitole 2)

// ---- Prestiž ----
// Dodané MWh potřebné pro prestiž 2, 3, 4 ... (kapitola 1 končí prestiží 2 po 500 MWh, GDD původně 100)
export const PRESTIGE_THRESHOLDS_MWH = [0, 500, 1200, 2800, 6500];

// ---- Vylepšení ----
export type UpgradeId = 'worker' | 'power' | 'efficiency' | 'line' | 'battery' | 'dump' | 'regulator';

// Podmínka (pro úkoly i odemykání vylepšení): ruční tapy | dodané MWh | úroveň jiného vylepšení | autonomie (brigádníci zásobí spalovnu) | smlouva (dosažení smluvních MW) | kapitola
export interface Requirement {
  kind: 'delivered' | 'taps' | 'upgrade' | 'autonomy' | 'contract' | 'chapter';
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
  group?: 'incinerator'; // vylepšení spalovny se v UI zobrazí přímo pod kartou Spalovna
}

// Brigádníci: v kapitole 1 stačí 6 (2,4 VO/s = plný výkon 10 MW při účinnosti spalovny aspoň 4). Víc je pro pozdější kapitoly.
export const UPGRADES: UpgradeDef[] = [
  { id: 'worker', name: 'Brigádník', description: 'Sbírá odpad za tebe, bere mzdu', baseCost: 175, growth: 1.3, maxLevel: 6, unlock: { kind: 'upgrade', upgrade: 'power', target: 1, text: 'po prvním upgradu výkonu spalovny' } },
  { id: 'power', name: 'Výkon spalovny', description: '+1 MW (víc peněz za dodanou energii)', baseCost: 300, growth: 1.28, maxLevel: 12, unlock: { kind: 'delivered', target: 10, text: 'po dodání 10 MWh' }, group: 'incinerator' },
  { id: 'efficiency', name: 'Účinnost spalovny', description: 'Stejný výkon za méně VO (−10 % spotřeby odpadu)', baseCost: 400, growth: 1.9, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'worker', target: 2, text: 'po 2 brigádnících' }, group: 'incinerator' },
  { id: 'line', name: 'Dráty a trafo', description: '+3 MW propustnost', baseCost: 500, growth: 1.7, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'power', target: 3, text: 'po výkonu spalovny 6 MW' } },
  { id: 'dump', name: 'Mařič přebytku', description: 'Spálí +2 MW přebytku, ale stojí 4💰 za každou MWh', baseCost: 500, growth: 1.7, maxLevel: 5, unlock: { kind: 'chapter', target: 3, text: 'v kapitole 3 (až bude přebytek z obnovitelných zdrojů)' } },
  { id: 'battery', name: 'Baterie', description: '+10 MWh uložiště, +3 MW', baseCost: 900, growth: 1.8, maxLevel: 10, unlock: { kind: 'chapter', target: 3, text: 'v kapitole 3 (s obnovitelnými zdroji)' } },
  { id: 'regulator', name: 'Automatický regulátor', description: 'Spalovna sama drží výkon podle spotřeby města', baseCost: 12000, growth: 1, maxLevel: 1, unlock: { kind: 'chapter', target: 4, text: 'v kapitole 4 (regulace)' }, group: 'incinerator' },
];

// ---- Úkoly (zatím bez postav) ----
export interface QuestDef extends Requirement {
  id: string;
  text: string;
  reward: number;
  ongoing?: boolean; // průběžný úkol: nepočítá se do kapitoly ani do spuštění krize, zobrazuje se zvlášť
}

// Kolik nejbližších nesplněných úkolů se hráči zobrazí (ostatní se odemykají postupně)
export const QUESTS_VISIBLE = 3;
export const ONGOING_UNLOCK_QUEST = 'autonomy'; // průběžné úkoly se ukážou až po tomto úkolu
export const ONGOING_QUESTS_VISIBLE = 2; // kolik průběžných úkolů se zobrazí najednou

export const QUESTS: QuestDef[] = [
  // --- Hlavní řetězec (kapitola 1): úkoly jdou v pořadí, jak je hráč potřebuje ---
  { id: 'deliver1', text: 'Dodej městu 1 MWh', kind: 'delivered', target: 1, reward: 20 },
  { id: 'tap25', text: 'Vyčisti 25 odpadků (ruční tapy)', kind: 'taps', target: 25, reward: 30 },
  { id: 'power1', text: 'Zvyš výkon spalovny na úroveň 1 (4 MW, odemkne brigádníky)', kind: 'upgrade', upgrade: 'power', target: 1, reward: 150 },
  { id: 'worker3', text: 'Najmi 3 brigádníky', kind: 'upgrade', upgrade: 'worker', target: 3, reward: 80 },
  { id: 'power2', text: 'Zvyš výkon spalovny na úroveň 2 (5 MW)', kind: 'upgrade', upgrade: 'power', target: 2, reward: 300 },
  { id: 'deliver30', text: 'Dodej městu 30 MWh', kind: 'delivered', target: 30, reward: 150 },
  { id: 'eff1', text: 'Vylepši účinnost spalovny na úroveň 1 (méně VO na stejný výkon)', kind: 'upgrade', upgrade: 'efficiency', target: 1, reward: 500 },
  { id: 'power3', text: 'Zvyš výkon spalovny na úroveň 3 (6 MW, tolik unese vedení)', kind: 'upgrade', upgrade: 'power', target: 3, reward: 250 },
  { id: 'line1', text: 'Posil dráty a trafo (kvůli výkonu nad 6 MW)', kind: 'upgrade', upgrade: 'line', target: 1, reward: 300 },
  { id: 'autonomy', text: 'Dosáhni autonomie: brigádníci zásobí spalovnu odpadem, nemusíš klikat', kind: 'autonomy', target: 1, reward: 400 },
  { id: 'eff2', text: 'Vylepši účinnost spalovny na úroveň 2', kind: 'upgrade', upgrade: 'efficiency', target: 2, reward: 900 },
  { id: 'power4', text: 'Zvyš výkon spalovny na úroveň 4 (7 MW)', kind: 'upgrade', upgrade: 'power', target: 4, reward: 350 },
  { id: 'deliver100', text: 'Dodej městu 100 MWh', kind: 'delivered', target: 100, reward: 600 },
  { id: 'eff3', text: 'Vylepši účinnost spalovny na úroveň 3', kind: 'upgrade', upgrade: 'efficiency', target: 3, reward: 1500 },
  { id: 'line2', text: 'Posil dráty a trafo na úroveň 2 (12 MW)', kind: 'upgrade', upgrade: 'line', target: 2, reward: 800 },
  // --- Finále kapitoly 1: smlouva na stálých 15 MW ---
  { id: 'power8', text: 'Zvyš výkon spalovny na úroveň 8 (11 MW)', kind: 'upgrade', upgrade: 'power', target: 8, reward: 800 },
  { id: 'deliver250', text: 'Dodej městu 350 MWh', kind: 'delivered', target: 350, reward: 1000 },
  { id: 'line3', text: 'Posil dráty a trafo na úroveň 3 (15 MW, vedení unese smluvní dodávku)', kind: 'upgrade', upgrade: 'line', target: 3, reward: 1000 },
  { id: 'power12', text: 'Zvyš výkon spalovny na úroveň 12 (15 MW, smluvní výkon)', kind: 'upgrade', upgrade: 'power', target: 12, reward: 1500 },
  { id: 'contract', text: 'Splň smlouvu: dodej městu 15 MW', kind: 'contract', target: 1, reward: 5000 },
  { id: 'deliver400', text: 'Dodej městu 500 MWh (konec kapitoly 1)', kind: 'delivered', target: 500, reward: 2000 },
  // --- Průběžné úkoly (nepovinné, ukážou se po autonomii) ---
  { id: 'o_eff4', ongoing: true, text: 'Vylepši účinnost spalovny na úroveň 4 (plný výkon 10 MW na 6 brigádníků)', kind: 'upgrade', upgrade: 'efficiency', target: 4, reward: 2500 },
  { id: 'o_worker6', ongoing: true, text: 'Najmi 6 brigádníků (maximum)', kind: 'upgrade', upgrade: 'worker', target: 6, reward: 600 },
  { id: 'o_eff5', ongoing: true, text: 'Vylepši účinnost spalovny na úroveň 5', kind: 'upgrade', upgrade: 'efficiency', target: 5, reward: 3500 },
  { id: 'o_deliver1000', ongoing: true, text: 'Dodej městu 1000 MWh', kind: 'delivered', target: 1000, reward: 3000 },
  { id: 'o_eff7', ongoing: true, text: 'Vylepši účinnost spalovny na úroveň 7', kind: 'upgrade', upgrade: 'efficiency', target: 7, reward: 6000 },
  { id: 'o_deliver2000', ongoing: true, text: 'Dodej městu 2000 MWh', kind: 'delivered', target: 2000, reward: 6000 },
  { id: 'o_eff10', ongoing: true, text: 'Vylepši účinnost spalovny na maximum (úroveň 10)', kind: 'upgrade', upgrade: 'efficiency', target: 10, reward: 12000 },
];


// Kapitola 1 končí, když je splněna smlouva (15 MW) A zároveň dodáno aspoň CHAPTER1_END_MWH.
export const CHAPTER1_END_QUESTS = ['contract', 'deliver400']; // smlouva a 500 MWh

// ---- Příběh (zatím jen text, postavy a dialogy přijdou v kroku 4) ----
export const STORY_INTRO =
  'Zamořený ostrov. Jediná věc, která tu ještě funguje, je stará spalovna odpadu. Městečko za kopcem je bez proudu a starosta tě prosí: roztoč spalovnu a dodej městu elektřinu. Nasmlouvali jste stálou dodávku 15 MW, den i noc. Zatím máš jen zlomek, tak začni.';
export const STORY_CHAPTER_END =
  'Město svítí a ostrov dýchá. Regulátor drží síť sám a tobě zbývá jen hlídat peníze. Jenže stará spalovna pálí odpad dál a pod hladinou se probouzí něco většího. Konec kapitoly 1. V kapitole 2 přijde laboratoř, likvidátor odpadu a první soláry. Zatím jde hra dál ladit: dohraj poslední úkoly a pošli, co ti vadilo.';

// ---- Mapa (jen vzhled, simulace o ní neví) ----
export const MAP_GRID_SIZE = 20; // mřížka 20×20 dlaždic
export const MAP_TILE_PX = 32; // velikost dlaždice ve světových pixelech
export const MAP_INCINERATOR_TILE = { x: 9, y: 9 }; // levý horní roh spalovny (2×2) uprostřed
export const MAP_CITY_TILE = { x: 16, y: 16 }; // levý horní roh města (3×3) vpravo dole
export const MAP_ZOOM_START = 1.1; // počáteční přiblížení (viditelná je jen část mapy)
export const MAP_ZOOM_MAX = 2.5;
export const MAP_DRAG_THRESHOLD_PX = 8; // posun mapy až po pohybu prstu o tolik pixelů
export const MAP_HEIGHT_PERCENT = 46; // výška mapy v % obrazovky (zbytek je panel)

// ---- Oznámení ----
export const TOAST_SECONDS = 7; // jak dlouho je vidět oznámení o splněném úkolu

// ---- Idle (dopočet času, kdy hráč nehrál) ----
export const OFFLINE_MAX_SECONDS = 86400; // nejvýš 24 hodin se dopočítá
export const OFFLINE_FULL_RATE_SECONDS = 1800; // prvních 30 minut pauzy se počítá na plnou rychlost
export const OFFLINE_REDUCED_RATE = 0.05; // zbytek pauzy jen na 5 % rychlosti (ať se hra nepřeskočí spánkem)
export const OFFLINE_MIN_SECONDS = 15; // kratší pauza se nepočítá
export const OFFLINE_STEP_SECONDS = 1; // dopočet po větších krocích (rychlejší než 4× za sekundu)

// ---- Ukládání ----
export const AUTOSAVE_SECONDS = 60; // jak často se postup ukládá (navíc při zavření stránky)

// ---- Ladění ----
export const DEBUG_SPEEDS = [1, 10];
export const DEBUG_CREDITS_BONUS = 1000;
