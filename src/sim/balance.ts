// VŠECHNA herní čísla jsou tady. Nikde jinde v kódu nesmí být "magická čísla".
// Chceš hru ztížit nebo zrychlit? Změň hodnotu tady a ulož.

export const TICKS_PER_SECOND = 4; // simulace se počítá 4× za sekundu

// ---- Čas ----
export const SECONDS_PER_GAME_HOUR = 15; // 1 "energetická hodina" = 15 s: z ní se počítá MWh, ceny i spotřeba VO (neměnit, rozhodilo by to celou ekonomiku)
export const SECONDS_PER_CLOCK_HOUR = 45; // jak rychle běží hodiny dne a noci (den = 18 min; původně 6 min, hráč chtěl pomaleji)
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

// ---- Kapitola 2: odpad a krize ----
// Krize začne sama (bez varování, s velkým popupem) TOXIC_DELAY_SECONDS po začátku kapitoly TOXIC_TRIGGER_CHAPTER.
export const TOXIC_TRIGGER_CHAPTER = 2;
export const TOXIC_DELAY_SECONDS = 15;
export const TOXIC_POPUP_TITLE = '☣️ Ekologická katastrofa!';
export const TOXIC_POPUP_TEXT =
  'Přetížená spalovna se zadrhla a vyplivla do krajiny toxický odpad. Lidé se bouří a město odmítá platit plnou cenu za špinavou energii. Odpad musíš zlikvidovat, nebo aspoň uskladnit, a už ho nevyhazovat na pole. Čím víc ho ležíš na poli, tím míň ti město zaplatí.';
export const TOXIC_INITIAL_FIELD = 200; // jednotek toxického odpadu na poli na začátku krize
export const TOXIC_PER_MWH = 2; // jednotek odpadu na každou MWh vyrobenou spalovnou (po krizi)
export const TOXIC_FIELD_FULL = 200; // při tolika jednotkách na poli město platí nejméně
export const TOXIC_INCOME_FACTOR = 0.6; // nejnižší podíl ceny, který město zaplatí (−40 %)
export const DISPOSE_PER_LEVEL = 0.5; // likvidátor: jednotek odpadu za sekundu na úroveň
export const DISPOSE_COST_PER_UNIT = 3; // likvidace stojí kredity za každou jednotku
export const STORAGE_PER_LEVEL = 150; // sklad toxického odpadu: jednotek na úroveň (bezpečně uložených)

// ---- Kapitola 3: čistý zdroj a důvěra ----
export const SOLAR_MW_PER_LEVEL = 2; // sluneční panely: špičkový výkon na úroveň (jen ve dne)
export const TRUST_PER_CLEAN_MWH = 0.6; // důvěra (v %) za každou MWh z čistého zdroje
export const TRUST_PER_DISPOSED = 0.01; // důvěra (v %) za každou zlikvidovanou jednotku odpadu
export const TRUST_DRAIN_PER_SECOND = 0.03; // důvěra klesá, dokud leží odpad na poli (násobeno zaplněností pole)
export const TRUST_PRICE_BONUS = 0.2; // při 100 % důvěře město platí o 20 % víc

// ---- Prestiž ----
// Dodané MWh potřebné pro prestiž 2, 3, 4 ... (kapitola 1 končí prestiží 2 po 500 MWh, GDD původně 100)
export const PRESTIGE_THRESHOLDS_MWH = [0, 500, 1200, 2800, 6500];

// ---- Stavění na mapě ----
// Budovy se stavějí na odemčené pevnině bez keřů a skal. Části soustav se propojují DOTYKEM po dlaždicích:
//  - síť (dráty): zdroj/baterie funguje, když k němu vede souvislý řetěz vodivých dlaždic až do města;
//  - cesty: sklad a likvidátor odpadu musí sousedit se spalovnou nebo s cestou, která ke spalovně vede.
export type BuildingType = 'road' | 'wire' | 'storage' | 'disposer' | 'battery';
export type BuildingNeeds = 'road' | 'grid' | null;

export interface BuildingDef {
  type: BuildingType;
  name: string;
  emoji: string;
  color: number; // barva čtverce na mapě
  w: number; // šířka v dlaždicích
  h: number; // výška v dlaždicích
  baseCost: number;
  growth: number; // cena × growth s každou už postavenou budovou téhož druhu
  unlockChapter: number; // od které kapitoly se dá stavět
  needs: BuildingNeeds; // čím musí být napojená, aby fungovala
  conductive?: boolean; // vede proud (součást sítě)
  description: string;
}

export const BUILDINGS: BuildingDef[] = [
  { type: 'road', name: 'Cesta', emoji: '🛤️', color: 0x8b7d6b, w: 1, h: 1, baseCost: 15, growth: 1, unlockChapter: 2, needs: null, description: 'Vede odpad od spalovny ke skladu a likvidátoru. Čím víc cest, tím víc město zaplatí.' },
  { type: 'wire', name: 'Drát', emoji: '⚡', color: 0xffd23f, w: 1, h: 1, baseCost: 25, growth: 1, unlockChapter: 3, needs: null, conductive: true, description: 'Propojí budovy se sítí. Musí se dotýkat až do města.' },
  { type: 'storage', name: 'Sklad odpadu', emoji: '🛢️', color: 0x7c3aed, w: 2, h: 2, baseCost: 1500, growth: 1.5, unlockChapter: 2, needs: 'road', description: '+150 jednotek bezpečně uloženého odpadu. Musí sousedit se spalovnou nebo s cestou k ní.' },
  { type: 'disposer', name: 'Likvidátor odpadu', emoji: '♻️', color: 0x16a34a, w: 2, h: 2, baseCost: 2000, growth: 1.5, unlockChapter: 2, needs: 'road', description: 'Ničí 0,5 jednotky odpadu za sekundu, každá jednotka stojí 3 kredity. Musí sousedit se spalovnou nebo s cestou k ní.' },
  { type: 'battery', name: 'Baterie', emoji: '🔋', color: 0x0ea5e9, w: 2, h: 2, baseCost: 900, growth: 1.8, unlockChapter: 3, needs: 'grid', conductive: true, description: '+10 MWh uložiště, +3 MW. Musí být napojená drátem na síť do města.' },
];
export const ROAD_PRICE_BONUS_PER_TILE = 0.005; // každá napojená cesta zvedá cenu energie o 0,5 %
export const ROAD_PRICE_BONUS_MAX = 0.1; // nejvýš o 10 %
export const BUILDING_REFUND = 0.5; // při zbourání se vrátí tolik z ceny

// ---- Parcely: dokupování území ----
export const PARCEL_UNLOCK_CHAPTER = 2; // od které kapitoly se dají kupovat parcely (dřív není co stavět)
export const PARCEL_BASE_COST = 1200; // cena první dokoupené parcely
export const PARCEL_GROWTH = 1.35; // každá další je o tolik dražší
export const PARCEL_MIN_LAND_TILES = 6; // parcela musí mít aspoň tolik pevniny (jinak je to voda nebo hory)

// ---- Starší vylepšení, která se změnila na budovy (pro vrácení peněz ze starých uložení) ----
export const LEGACY_UPGRADE_COSTS: Record<string, { baseCost: number; growth: number }> = {
  battery: { baseCost: 900, growth: 1.8 },
  cleanup: { baseCost: 2000, growth: 1.5 },
  storage: { baseCost: 1500, growth: 1.5 },
};

// ---- Vylepšení ----
export type UpgradeId = 'worker' | 'power' | 'efficiency' | 'line' | 'dump' | 'regulator' | 'solar';

// Podmínka (pro úkoly i odemykání vylepšení): ruční tapy | dodané MWh | úroveň jiného vylepšení | autonomie (brigádníci zásobí spalovnu) | smlouva (dosažení smluvních MW) | kapitola | uklizený odpad na mapě | začala krize | mapa je čistá | ostrov je zaplevelený (hodně hromádek) | ostrov je čistý (málo hromádek) | počet připojených budov daného druhu | počet dokoupených parcel
export interface Requirement {
  building?: BuildingType; // jen pro kind 'building'
  kind: 'delivered' | 'taps' | 'upgrade' | 'autonomy' | 'contract' | 'chapter' | 'disposed' | 'fieldclean' | 'trust' | 'litter' | 'toxic' | 'litterempty' | 'litterpile' | 'litterlow' | 'building' | 'parcels';
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

// Brigádníci: bez pevného limitu (hráč chtěl "tolik, kolik můžeme"), omezuje je jen cena (každý další +30 %) a mzda.
export const UPGRADES: UpgradeDef[] = [
  { id: 'worker', name: 'Brigádník', description: 'Sbírá odpad za tebe, bere mzdu', baseCost: 175, growth: 1.3, maxLevel: Infinity, unlock: { kind: 'upgrade', upgrade: 'power', target: 1, text: 'po prvním upgradu výkonu spalovny' } },
  { id: 'power', name: 'Výkon spalovny', description: '+1 MW (víc peněz za dodanou energii)', baseCost: 300, growth: 1.28, maxLevel: 20, unlock: { kind: 'delivered', target: 10, text: 'po dodání 10 MWh' }, group: 'incinerator' },
  { id: 'efficiency', name: 'Účinnost spalovny', description: 'Stejný výkon za méně VO (−10 % spotřeby odpadu)', baseCost: 400, growth: 1.9, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'worker', target: 2, text: 'po 2 brigádnících' }, group: 'incinerator' },
  { id: 'line', name: 'Dráty a trafo', description: '+3 MW propustnost', baseCost: 500, growth: 1.7, maxLevel: 10, unlock: { kind: 'upgrade', upgrade: 'power', target: 3, text: 'po výkonu spalovny 6 MW' } },
  { id: 'dump', name: 'Mařič přebytku', description: 'Spálí +2 MW přebytku, ale stojí 4💰 za každou MWh', baseCost: 500, growth: 1.7, maxLevel: 5, unlock: { kind: 'chapter', target: 3, text: 'v kapitole 3 (až bude přebytek z obnovitelných zdrojů)' } },
  { id: 'solar', name: 'Sluneční panely', description: '+2 MW čisté energie, ale jen ve dne', baseCost: 3000, growth: 1.45, maxLevel: 10, unlock: { kind: 'chapter', target: 3, text: 'v kapitole 3 (obnovitelné zdroje)' } },
  { id: 'regulator', name: 'Automatický regulátor', description: 'Spalovna sama drží výkon podle spotřeby města', baseCost: 12000, growth: 1, maxLevel: 1, unlock: { kind: 'chapter', target: 4, text: 'v kapitole 4 (regulace)' }, group: 'incinerator' },
];

// ---- Úkoly (zatím bez postav) ----
export interface QuestDef extends Requirement {
  id: string;
  text: string;
  reward: number;
  ongoing?: boolean; // průběžný úkol: nepočítá se do kapitoly, zobrazuje se zvlášť
  chapter?: number; // kapitola, do které úkol patří (výchozí 1); úkol se spustí až v této kapitole
}

// Kolik nejbližších nesplněných úkolů se hráči zobrazí (ostatní se odemykají postupně)
export const QUESTS_VISIBLE = 3;
export const ONGOING_UNLOCK_QUEST = 'autonomy'; // průběžné úkoly se ukážou až po tomto úkolu
export const ONGOING_QUESTS_VISIBLE = 2; // kolik průběžných úkolů se zobrazí najednou

export const QUESTS: QuestDef[] = [
  // --- Hlavní řetězec (kapitola 1): úkoly jdou v pořadí, jak je hráč potřebuje ---
  { id: 'deliver1', text: 'Dodej městu 1 MWh', kind: 'delivered', target: 1, reward: 20 },
  { id: 'tap25', text: 'Klepej na odpad na mapě: vytřiď 25× (po 5 klepnutích hromádka zmizí)', kind: 'taps', target: 25, reward: 30 },
  { id: 'litter5', text: 'Uklid 5 hromádek odpadu na mapě', kind: 'litter', target: 5, reward: 50 },
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
  // --- Kapitola 2: odpad a krize ---
  { id: 'c2_parcel', chapter: 2, text: 'Rozšiř území: dokup první parcelu (menu 🏗️ Stavba)', kind: 'parcels', target: 1, reward: 1000 },
  { id: 'c2_road', chapter: 2, text: 'Postav 8 cest od spalovny (odvoz odpadu)', kind: 'building', building: 'road', target: 8, reward: 1500 },
  { id: 'c2_cleanup', chapter: 2, text: 'Zareaguj na katastrofu: postav likvidátor odpadu (musí sousedit se spalovnou nebo s cestou k ní)', kind: 'building', building: 'disposer', target: 1, reward: 1500 },
  { id: 'c2_storage', chapter: 2, text: 'Přestaň vyhazovat odpad na pole: postav sklad toxického odpadu', kind: 'building', building: 'storage', target: 1, reward: 1500 },
  { id: 'c2_dispose300', chapter: 2, text: 'Zlikviduj 300 jednotek toxického odpadu', kind: 'disposed', target: 300, reward: 2500 },
  { id: 'c2_field', chapter: 2, text: 'Vyčisti pole: ať na poli nezůstane žádný toxický odpad', kind: 'fieldclean', target: 1, reward: 3000 },
  { id: 'c2_crew', chapter: 2, text: 'Zaměstnej úklidovou četu: 12 brigádníků na pravidelný úklid ostrova', kind: 'upgrade', upgrade: 'worker', target: 12, reward: 5000 },
  { id: 'c2_island', chapter: 2, text: 'Udrž ostrov čistý: na mapě nanejvýš 5 hromádek odpadu', kind: 'litterlow', target: 1, reward: 3000 },
  { id: 'c2_cleanup3', chapter: 2, text: 'Posil likvidaci: postav 3 likvidátory odpadu', kind: 'building', building: 'disposer', target: 3, reward: 3500 },
  { id: 'c2_power14', chapter: 2, text: 'Zvyš výkon spalovny na úroveň 14 (17 MW): čím víc vyrábíš, tím víc město odebírá', kind: 'upgrade', upgrade: 'power', target: 14, reward: 4000 },
  { id: 'c2_dispose1500', chapter: 2, text: 'Zlikviduj celkem 1500 jednotek toxického odpadu (konec kapitoly 2)', kind: 'disposed', target: 1500, reward: 6000 },
  // --- Kapitola 3: čistý zdroj a obnovitelné zdroje ---
  { id: 'c3_solar', chapter: 3, text: 'První obnovitelný zdroj: kup sluneční panely', kind: 'upgrade', upgrade: 'solar', target: 1, reward: 5000 },
  { id: 'c3_trust25', chapter: 3, text: 'Dej lidem důvod věřit: důvěra veřejnosti na 25 %', kind: 'trust', target: 25, reward: 6000 },
  { id: 'c3_line5', chapter: 3, text: 'Posil dráty a trafo na úroveň 5 (21 MW, polední špičky ze slunce)', kind: 'upgrade', upgrade: 'line', target: 5, reward: 5000 },
  { id: 'c3_battery', chapter: 3, text: 'Postav baterii a napoj ji dráty do sítě, ať polední špička nepřetíží síť', kind: 'building', building: 'battery', target: 1, reward: 6000 },
  { id: 'c3_solar5', chapter: 3, text: 'Sluneční elektrárna: sluneční panely na úroveň 5', kind: 'upgrade', upgrade: 'solar', target: 5, reward: 8000 },
  { id: 'c3_trust60', chapter: 3, text: 'Důvěra veřejnosti na 60 %', kind: 'trust', target: 60, reward: 10000 },
  { id: 'c3_trust100', chapter: 3, text: 'Přesvědč veřejnost, že jsme čistý zdroj: důvěra na 100 % (konec kapitoly 3)', kind: 'trust', target: 100, reward: 20000 },
  // --- Průběžné úkoly (nepovinné, ukážou se po autonomii) ---
  { id: 'o_litterclean', ongoing: true, text: 'Vyklikej všechen odpad z mapy (mapa čistá)', kind: 'litterempty', target: 1, reward: 400 },
  { id: 'o_litter100', ongoing: true, text: 'Uklid 100 hromádek odpadu na mapě', kind: 'litter', target: 100, reward: 600 },
  { id: 'o_litter300', ongoing: true, text: 'Uklid 300 hromádek odpadu na mapě', kind: 'litter', target: 300, reward: 2500 },
  { id: 'o_litter600', ongoing: true, text: 'Uklid 600 hromádek odpadu na mapě', kind: 'litter', target: 600, reward: 6000 },
  { id: 'o_eff4', ongoing: true, text: 'Vylepši účinnost spalovny na úroveň 4 (plný výkon 10 MW na 6 brigádníků)', kind: 'upgrade', upgrade: 'efficiency', target: 4, reward: 2500 },
  { id: 'o_worker6', ongoing: true, text: 'Najmi 6 brigádníků', kind: 'upgrade', upgrade: 'worker', target: 6, reward: 600 },
  { id: 'o_eff5', ongoing: true, text: 'Vylepši účinnost spalovny na úroveň 5', kind: 'upgrade', upgrade: 'efficiency', target: 5, reward: 3500 },
  { id: 'o_deliver1000', ongoing: true, text: 'Dodej městu 1000 MWh', kind: 'delivered', target: 1000, reward: 3000 },
  { id: 'o_eff7', ongoing: true, text: 'Vylepši účinnost spalovny na úroveň 7', kind: 'upgrade', upgrade: 'efficiency', target: 7, reward: 6000 },
  { id: 'o_deliver2000', ongoing: true, text: 'Dodej městu 2000 MWh', kind: 'delivered', target: 2000, reward: 6000 },
  { id: 'o_eff10', ongoing: true, text: 'Vylepši účinnost spalovny na maximum (úroveň 10)', kind: 'upgrade', upgrade: 'efficiency', target: 10, reward: 12000 },
];


// ---- Kapitoly: kdy končí a jak se jmenují ----
export const MAX_CHAPTER = 3; // kolik kapitol je zatím ve hře (4 a 5 jsou jen plán v GDD)
// Kapitola končí, když jsou splněné všechny tyto úkoly. Kapitola 1: smlouva (15 MW) a zároveň 500 MWh.
export const CHAPTER_END_QUESTS: Record<number, string[]> = {
  1: ['contract', 'deliver400'],
  2: ['c2_dispose1500'],
  3: ['c3_trust100'],
};
export const CHAPTER_TITLES: Record<number, string> = {
  1: 'Smlouva na stálých 15 MW',
  2: 'Odpad a krize',
  3: 'Čistý zdroj',
};

// ---- Příběh (zatím jen text, postavy a dialogy přijdou v kroku 4) ----
export const STORY_INTRO =
  'Zamořený ostrov. Jediná věc, která tu ještě funguje, je stará spalovna odpadu. Městečko za kopcem je bez proudu a starosta tě prosí: roztoč spalovnu a dodej městu elektřinu. Nasmlouvali jste stálou dodávku 15 MW, den i noc. Zatím máš jen zlomek, tak začni.';
export const CHAPTER_END_TEXT: Record<number, string> = {
  1: 'Smlouva je splněná, město svítí. Jenže stará spalovna pálí odpad dál a pod povrchem se něco děje. Konec kapitoly 1. Přichází problém, který ostrov nenechá klidným.',
  2: 'Pole je čisté a odpad pod kontrolou. Lidé se uklidnili, ale pořád ti nevěří. Konec kapitoly 2. Teď musíš veřejnost přesvědčit, že jsi čistý zdroj.',
  3: 'Veřejnost ti věří a ostrov září čistou energií. Konec kapitoly 3. Přijde regulace a další velký zlom, ale to už je jiná kapitola (zatím není ve hře).',
};
export const CHAPTER_START_TEXT: Record<number, string> = {
  3: 'Ostrov je čistý, ale lidé ti pořád nevěří. Odemykají se obnovitelné zdroje, začni slunečními panely. Čím víc čisté energie dodáš, tím víc ti město bude věřit a tím víc ti zaplatí. Pozor na polední špičky ze slunce: vedení je musí unést.',
};

// ---- Postava: starosta ----
// Starosta se v průběhu hry ozve: úvod, žádosti (dodat výkon do města, vyčistit prostor), reakce na úspěchy a krize.
// Každá scénka se ukáže jednou, když je splněná její podmínka.
export const MAYOR_NAME = 'Starosta';
export const MAYOR_AVATAR = '👨‍💼';

export interface StoryBeat {
  id: string;
  trigger: Requirement;
  text: string;
}

export const STORY_BEATS: StoryBeat[] = [
  // --- Kapitola 1: smlouva ---
  { id: 's_start', trigger: { kind: 'chapter', target: 1 }, text: 'Konečně někdo, kdo se nevzdal! Město je bez proudu a tvoje spalovna je naše jediná naděje. Máme nasmlouvanou stálou dodávku 15 MW. Nejdřív ale potřebuješ palivo: po krajině se válí odpad, klepej na něj a vytřiď ho.' },
  { id: 's_litter5', trigger: { kind: 'litter', target: 5 }, text: 'Krajina už vypadá o trochu lépe! Prosím, pokračuj. Lidé nesnesou pohled na ten nepořádek a ty z něj uděláš proud.' },
  { id: 's_first_mwh', trigger: { kind: 'delivered', target: 1 }, text: 'Svítí! První elektřina dorazila do města. Slyšel jsi ten potlesk? Teď potřebujeme víc výkonu, jinak pomalu zhasneme.' },
  { id: 's_power1', trigger: { kind: 'upgrade', upgrade: 'power', target: 1 }, text: 'Silnější spalovna, skvělé! Sám ale všechno nevyklikáš. Najmi si brigádníky, ať ti s odpadem pomáhají.' },
  { id: 's_worker1', trigger: { kind: 'upgrade', upgrade: 'worker', target: 1 }, text: 'První brigádník! Ať ti pomáhá, ale nezapomeň, že ho musíš platit.' },
  { id: 's_mwh30', trigger: { kind: 'delivered', target: 30 }, text: 'Nemocnice už má proud aspoň na pár hodin denně. Prosím tě, dodávej město dál a zvedej výkon.' },
  { id: 's_autonomy', trigger: { kind: 'autonomy', target: 1 }, text: 'Spalovna jede sama a ty si můžeš oddechnout. Teď se soustřeď na to hlavní: slíbili jsme městu 15 MW a všichni na to čekají.' },
  { id: 's_line1', trigger: { kind: 'upgrade', upgrade: 'line', target: 1 }, text: 'Nové dráty! Starý rozvod už dlouho nevydržel. Dej pozor, ať výkon neprojde jen do země.' },
  { id: 's_mwh300', trigger: { kind: 'delivered', target: 300 }, text: 'Už svítí většina města. Ale mám divný pocit z toho, co spalovna za sebou nechává. Ostrov není čistý a lidé si toho všímají.' },
  { id: 's_contract', trigger: { kind: 'contract', target: 1 }, text: 'Patnáct megawattů! Splnil jsi smlouvu, o které se říkalo, že je nesplnitelná. Děkuju ti za celý ostrov.' },
  { id: 's_litter_empty', trigger: { kind: 'litterempty', target: 1 }, text: 'Ostrov je čistý jako ze škatulky! Škoda jen, že moře splaví další odpad. Ale děkuju, že ti na tom záleží.' },
  { id: 's_dirty', trigger: { kind: 'litterpile', target: 45 }, text: 'Ostrov se zase plní odpadem! Moře ho splavuje a sám to nikdy nestihneš vyklikat. Na pravidelný úklid potřebuješ dost brigádníků, aspoň dvanáct. Jen tak zůstane ostrov čistý.' },
  // --- Kapitola 2: odpad a krize ---
  { id: 's_toxic', trigger: { kind: 'toxic', target: 1 }, text: 'Co se to děje?! Spalovna vyplivla toxický odpad do krajiny a lidé se bouří. Město odmítá platit plnou cenu za špinavou energii. Musíš to uklidit, jinak nám přestanou platit úplně!' },
  { id: 's_crew_start', trigger: { kind: 'chapter', target: 2 }, text: 'Lidé chtějí čistý ostrov. Zaměstnej úklidovou četu, dvanáct brigádníků, ať ostrov uklízí pravidelně. Ty se starej o spalovnu.' },
  { id: 's_crew12', trigger: { kind: 'upgrade', upgrade: 'worker', target: 12 }, text: 'Dvanáct lidí na úklid! Hned je na ostrově vidět, že se o něj někdo stará. Díky!' },
  { id: 's_cleanup1', trigger: { kind: 'building', building: 'disposer', target: 1 }, text: 'Likvidátor odpadu, konečně se něco děje. Jen ať to nestojí celé město, každá jednotka něco stojí.' },
  { id: 's_storage1', trigger: { kind: 'building', building: 'storage', target: 1 }, text: 'Aspoň část odpadu už neleží na poli. Děti si tam hrávaly. Prosím, ať tam už nic nezůstane.' },
  { id: 's_field_clean', trigger: { kind: 'fieldclean', target: 1 }, text: 'Pole je čisté! Poprvé po dlouhé době se tam dá chodit. Lidé si trochu vydechli.' },
  { id: 's_disposed1000', trigger: { kind: 'disposed', target: 1000 }, text: 'Tolik odpadu pryč... Lidé se uklidňují, ale pořád říkají, že je to špinavá energie.' },
  // --- Kapitola 3: čistý zdroj ---
  { id: 's_chapter3', trigger: { kind: 'chapter', target: 3 }, text: 'Teď musíš lidi přesvědčit, že jsi čistý zdroj. Zkus slunce: panely nic nepálí a nezanechávají odpad. A hlavně žádný nový nepořádek na poli!' },
  { id: 's_solar1', trigger: { kind: 'upgrade', upgrade: 'solar', target: 1 }, text: 'Sluneční panely! Přes den to vydělá, ale v noci pořád potřebujeme spalovnu. Hlídej, ať polední slunce nepřetíží vedení.' },
  { id: 's_battery1', trigger: { kind: 'building', building: 'battery', target: 1 }, text: 'Baterie! Polední špičky už se neztratí, uloží se na večer. To je chytré.' },
  { id: 's_parcel1', trigger: { kind: 'parcels', target: 1 }, text: 'Další kus země je náš! Teď tam něco postav, ať se nezapomene, že vlastníme víc, než umíme využít.' },
  { id: 's_trust25', trigger: { kind: 'trust', target: 25 }, text: 'Lidé o tobě začínají mluvit hezky. Je to teprve začátek, ale mám radost.' },
  { id: 's_trust60', trigger: { kind: 'trust', target: 60 }, text: 'Už tě zdraví na ulici! Skoro nikdo neříká špinavá energie. Pokračuj.' },
  { id: 's_trust100', trigger: { kind: 'trust', target: 100 }, text: 'Důvěra veřejnosti je na sto procent! Dokázal jsi, že ostrov má čistý zdroj. Jsi hrdina tohoto ostrova.' },
];

// Mezi velkými scénkami se starosta občas jen tak ozve (každý druhý herní den, řádek podle kapitoly)
export const AMBIENT_EVERY_DAYS = 2;
export const AMBIENT_LINES: Record<number, string[]> = {
  1: [
    'Slyšel jsem, že v přístavu zase našli bednu odpadu. Nemáš chvilku?',
    'Lidé se ptají, kdy se rozsvítí lampy na náměstí. Já říkám: brzy.',
    'Dnes ráno jsem potkal rybáře. Ryby tu prý ještě jsou, doufám, že ta spalovna nic nepokazí.',
    'Máš dost odpadu? Kdyby ne, po ostrově ho najdeš habaděj po celém ostrově.',
  ],
  2: [
    'Lidé chodí kolem pole s transparenty. Ať už je ten odpad pryč!',
    'Novináři se ptají, kdo za to může. Říkám jim, že ty to napravíš.',
    'Děti se mě ptají, jestli je vzduch bezpečný. Co jim mám říct?',
    'Vím, že likvidace stojí peníze. Ale mlčet nemůžeme.',
  ],
  3: [
    'Na náměstí si lidé povídají o sluneční elektrárně. To je dobré znamení.',
    'Dnes svítí slunce, doufám, že panely makají!',
    'Paní z pekárny říká, že chleba z čisté elektřiny chutná líp. Hloupost, ale pomáhá to.',
    'Pozor na polední špičky, ať nám nevypadne proud.',
  ],
};

// ---- Mapa (jen vzhled, simulace o ní neví) ----
export const MAP_GRID_SIZE = 32; // mřížka 32×32 dlaždic
export const MAP_TILE_PX = 32; // velikost dlaždice ve světových pixelech
export const MAP_INCINERATOR_TILE = { x: 11, y: 11 }; // levý horní roh spalovny (2×2)
export const MAP_CITY_TILE = { x: 16, y: 16 }; // levý horní roh města (3×3) vpravo dole od spalovny
export const MAP_SOLAR_TILE = { x: 9, y: 16 }; // sluneční panely vlevo dole od spalovny (4×2 dlaždice), než je nahradí stavění
// Místa kolem spalovny, kde se objevují hromady toxického odpadu (dlaždice)
export const MAP_WASTE_SPOTS = [
  { x: 9, y: 10 },
  { x: 9, y: 13 },
  { x: 14, y: 10 },
  { x: 10, y: 14 },
  { x: 13, y: 14 },
  { x: 8, y: 12 },
  { x: 14, y: 13 },
  { x: 12, y: 9 },
];
// Parcely: území se odemyká po čtvercích PARCEL_SIZE×PARCEL_SIZE dlaždic. Na začátku je odemčené okolí spalovny a města (3×3 parcely = 12×12 dlaždic).
export const PARCEL_SIZE = 4;
export const PARCELS_PER_SIDE = MAP_GRID_SIZE / PARCEL_SIZE; // 8 × 8 parcel
export const PARCEL_START: number[] = [1, 2, 3, 4, 5, 6].flatMap((py) => [1, 2, 3, 4, 5, 6].map((px) => py * PARCELS_PER_SIDE + px)); // 6×6 parcel = 24×24 dlaždic odemčeno na začátku
export const MAP_RUBBER_STRETCH_TILES = 3; // jak daleko se dá mapu „natáhnout“ za okraj odemčeného území (gumové natažení)
export const MAP_RUBBER_SPRING = 9; // jak rychle se mapa po puštění vrací zpět (větší = rychleji)
export const MAP_FOG_ALPHA = 0.4; // průhlednost mlhy nad zamčenými parcelami (0 = nic, 1 = zakrývá úplně)
export const MAP_ZOOM_START = 1.1; // počáteční přiblížení (viditelná je jen část mapy)
export const MAP_ZOOM_MAX = 2.5;
export const MAP_DRAG_THRESHOLD_PX = 8; // posun mapy až po pohybu prstu o tolik pixelů
export const MAP_HEIGHT_PERCENT = 46; // výška mapy v % obrazovky (zbytek je panel)

// ---- Odpad na mapě (ruční třídění) ----
// Po mapě je rozsetý odpad. Každé klepnutí dá VO_PER_TAP vytříděného odpadu, po LITTER_CLICKS klepnutích hromádka zmizí.
// Nový odpad se objevuje pomalu a přibývá dál, i když hráč nehraje (strop LITTER_MAX). Ze začátku jde odpad stíhat
// klepáním, později je potřeba úklidová četa z brigádníků.
export const LITTER_CLICKS = 10; // kolik klepnutí na jednu hromádku
export const LITTER_INITIAL = 36; // kolik hromádek je na mapě na začátku
export const LITTER_NEAR_COUNT = 14; // z toho blízko spalovny (ať je hned vidět, kam klikat)
export const LITTER_NEAR_RADIUS_TILES = 6; // co je „blízko“ spalovny
export const LITTER_MAX = 80; // víc hromádek na mapě naráz nebude
export const LITTER_RESPAWN_SECONDS = 5; // jak často se objeví nová hromádka (když je místo)
export const LITTER_DIRTY_COUNT = 45; // od tolika hromádek se ostrov „zaplevelí“ a starosta se ozve
export const LITTER_CLEAN_COUNT = 5; // „čistý ostrov“ = nanejvýš tolik hromádek
export const LITTER_CREW_SIZE = 12; // tolik brigádníků udrží ostrov čistý (nový odpad přibývá stejně rychle, jak ho uklízejí)
// Každý brigádník uklidí jednu hromádku za tuto dobu; četa LITTER_CREW_SIZE brigádníků tak zvládne právě tolik, kolik odpadu přibývá
export const LITTER_WORKER_CLEAN_SECONDS = LITTER_CREW_SIZE * LITTER_RESPAWN_SECONDS;
export const LITTER_SEED = 20261109; // semínko pro náhodné rozmístění (stejné rozmístění v testech)

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

// ---------- Tutorial (první minuty hry) ----------
// Krok se přepne sám, když hráč splní podmínku `wait` (nebo klepne na „Dál“, když je podmínka `button`).
export type TutorialWait =
  | { kind: 'button' }
  | { kind: 'taps'; n: number } // celkem klepnutí na odpad
  | { kind: 'cleaned'; n: number } // uklizených hromádek
  | { kind: 'vo'; n: number } // zásoba VO
  | { kind: 'tab'; tab: string } // otevřená záložka
  | { kind: 'upgrade'; id: UpgradeId; n: number };
export interface TutorialStep {
  text: string;
  wait: TutorialWait;
  glow?: string; // CSS selektor prvku, který se rozsvítí
}
export const TUTORIAL_STEPS: TutorialStep[] = [
  { text: 'Vítej! Máš spalovnu odpadu a město bez proudu. Odpad se mění na elektřinu a elektřina na peníze. Ukážu ti to krok za krokem, nikam nespěchej.', wait: { kind: 'button' } },
  { text: 'Mapu posouváš tažením prstu a přibližuješ dvěma prsty. Hned se na ni podíváme.', wait: { kind: 'button' } },
  { text: 'Po ostrově se válí odpad. Klepni na jednu hromádku odpadu na mapě.', wait: { kind: 'taps', n: 1 } },
  { text: 'Každé klepnutí vytřídí 1 ♻️ VO (vytříděný odpad). Klepej na hromádku dál, až zmizí.', wait: { kind: 'cleaned', n: 1 } },
  { text: '♻️ VO nahoře je palivo pro spalovnu. Spalovna se rozjede, až ho bude aspoň 15. Sbírej další odpad.', wait: { kind: 'vo', n: 15 } },
  { text: 'Spalovna se rozjela! ⚡ MW je výkon, který míří do města. Město ti za něj platí 💰 kredity, ty nahoře rostou samy.', wait: { kind: 'button' } },
  { text: 'Za kredity se vylepšuje. Otevři záložku 🏭 Spalovna vpravo.', wait: { kind: 'tab', tab: 'furnace' }, glow: '.tab[data-tab="furnace"]' },
  { text: 'Až budeš mít dost 💰, kup vylepšení „Výkon spalovny“. Mezitím můžeš zavřít menu a dál klepat na odpad.', wait: { kind: 'upgrade', id: 'power', n: 1 } },
  { text: 'Skvěle! Další vylepšení (třeba brigádníci, kteří třídí odpad za tebe) se odemknou postupně. Za každým krokem tě vede záložka 📋 Úkoly: červený vykřičník ukazuje, že se v ní něco změnilo, a za splněné úkoly jsou odměny. Hodně štěstí!', wait: { kind: 'button' }, glow: '#questbtn' },
];
