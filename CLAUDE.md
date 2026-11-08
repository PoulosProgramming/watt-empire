# Watt Empire – pravidla pro Claude

Idle tycoon o elektrické síti, webová hra (mobil na výšku + PC). Design je v `GDD.md` – to je zdroj pravdy. Autor je úplný začátečník: **vysvětluj česky, jednoduše, bez zbytečného žargonu.**

## Stack
- TypeScript + Vite (build, dev server), Vitest (testy).
- Phaser 3 až od kroku 3 plánu (mapa). UI jsou HTML/CSS prvky nad herní plochou.
- Uložení: localStorage (automaticky jednou za minutu (`AUTOSAVE_SECONDS`) a při zavření stránky, `src/sim/save.ts` + UI) je hotové; export/import textu a offline progres zbývají na krok 5. Žádný server. Při změně `GameState` zvaž zvýšení `SAVE_VERSION` (chybějící pole se doplní výchozími hodnotami).

## Architektura (nejdůležitější pravidla)
1. **Simulace je oddělená od grafiky.** Složka `src/sim/` je čistý TypeScript – žádný Phaser, žádné `document`/`window`. Grafika a UI (`src/ui/`) jen čtou stav.
2. **Všechna čísla jsou jen v `src/sim/balance.ts`** (ceny, výkony, kapacity, časy). Žádná magická čísla jinde v kódu.
3. Simulace běží v tiku (4× za sekundu), jeden objekt `GameState` obsahuje vše, co se ukládá.
4. Moduly: `GameState`, `Economy`, `PowerNetwork` (`power.ts`), `DayNight`, `City`+`Quests`, `Save`, `balance.ts`.
5. Síť držet jednoduchou: výroba → baterie → vedení → město; přetížení = přebytek, který nejde uložit. Žádná skutečná fyzika toků.
6. Hráč nikdy nejde do mínusu; když dojdou peníze, brigádníci stojí a neúčtují mzdu.

## Pracovní postup
- Malé zadání = jeden úkol. Nepřepisuj fungující věci, které s úkolem nesouvisí.
- Po každé změně spusť `npm test` a `npm run build`; commit po každém dokončeném kroku.
- UI: horní tři karty (💰 ⚡ ♻️) jsou klikací a rozbalují rozpis příjmů, výdajů a toků (hodnoty „live" ze simulace). UI: tlačítka min. 44 px, testuj mobil na výšku. Posun mapy až po pohybu prstu (od kroku 3).
- Nové nápady mimo aktuální krok patří do sekce „Později“ v GDD, ne do kódu. Kapitolu 1 dotáhnout jako první.
- Tento soubor udržuj aktuální.

## Příkazy
- `npm run dev` – vývojový server, `npm test` – testy, `npm run build` – produkční build do `dist/`.
- `vite.config.ts` má `base: '/watt-empire/'` (GitHub Pages) – neměnit.

## Stav plánu (GDD sekce 8)
- [x] 1. Příprava
- [x] 2. Jádro v číslech (HTML tlačítka, bez mapy; debug panel ×10 a +kredity)
  - Po prvním hraní na mobilu (2 kola): sklad spalovny s hysterezí, pevný start 3 MW a výkon nákupem, mařič, větší baterie, auto regulátor až na konci kapitoly, nápověda, úkoly postupně (viz QUESTS), krize po 350 MWh.
- [ ] 3. Mapa a stavění … 7. Kapitola 3

## Poznatky z hraní (první testy na mobilu, 8. 11. 2026)
Zapisuj sem, co ukázalo hraní, ať další agent ví, proč je hra nastavená tak, jak je.
- **Blackouty bez vysvětlení / moc složité na začátku:** hráč nechápal přetížení a posuvník výkonu reagoval divně a stál kredity. Proto je posuvník pryč. Spalovna běží pevně na 3 MW (pod noční spotřebou 7 MW), takže se na začátku nic nepřetíží. Výkon se zvyšuje nákupem (+1 MW za úroveň). V UI je nápověda „Jak na to".
- **Přebytek v noci řeší hráč nákupem:** mařič (odvede 2 MW za úroveň, stojí 4 kredity za MWh) a baterie (10 MWh/úroveň). Automatický regulátor je záměrně velmi drahý (12000) a patří na konec kapitoly 1, protože řeší vše naráz.
- **Město limitovalo hráče** a dráty byly zbytečné. Základní spotřeba zvýšena na 14 MW (ve dne 8–14, v noci 7 MW). Vedení má teď základ 6 MW (+3 za úroveň).
- **Brigádníci byli moc levní a rychlí;** účinnost spalovny nikdo nekupoval. Proto dražší brigádníci (základ 500, růst 1,45×, max 10: první si hráč koupí po ~5 min klikání), těžba na brigádníka 0,4 VO/s a odpad je úzké hrdlo při vyšším výkonu, takže účinnost má smysl.
- **Kapitola 1 se dala dohrát za ~10 min.** Hranice jsme zvedli: krize po 350 MWh (hráč řekl, že původních 250 přišlo dřív, než si stihl postavit autonomii), konec kapitoly (prestiž 2) po 500 MWh. Bot s rozumnou strategií ji dohraje za ~24 min (člověk pomaleji). Brigádníci: základ 175, růst 1,3× (hráč chtěl 5–10 min bez autonomie celkem; bot: první brigádník ~2,3 min po 1. upgradu výkonu, autonomie ~7 min).
- **Houpání výroby 0↔6 MW** bylo jen na startu (málo VO). Řeší sklad s hysterezí: spalovna se rozjede při 15 VO a zhasne, když sklad nestačí.
- **Ekologická krize chyběla.** Zatím jen v číslech: po 350 MWh se objeví upozornění a město platí 60 %. Vizuální toxický odpad (2×2 na mapě) přijde s mapou (krok 3/4), řešení v kapitole 2.
- **Tlačítko „Třídit odpad"** bylo moc velké a hráč ho po chvíli nepoužíval (na mapě se tříbí klepáním na odpad, krok 3). Zmenšeno.
- **Ladění:** ×10 rychlost je hodně používaná, protože pasivní fáze je nudná. Tlačítko +1000 kreditů ničí zkoušení tempa, ve finální verzi ho schovat.
- **Baterie** dlouho nic nepřinášela (přebytek se prostě ztrácel). Zvětšena na 10 MWh/úroveň. Vyplatí se až při výkonu nad ~8 MW, kam hráč v kapitole 1 dojde pozdě. Zkontrolovat v dalším testu.
- **Klikání vs. mapa:** teď hráč 100× klikne na tlačítko. Na mapě (krok 3) musí odpad najít a sebrat, což bude pomalejší. Až bude mapa, přeladit ceny brigádníků a sběr, aby 5 min ručního sběru zůstalo stejně dlouhých.
- **Ztráta postupu po obnovení stránky** hráče naštvala, proto se ukládá už teď (předčasně před krokem 5). V ladění je tlačítko „Smazat postup" (pozor: při mazání se musí vypnout ukládání, protože se ukládá i při zavření stránky, jinak se postup zapíše zpátky).
- **Postupné odemykání:** vylepšení mají podmínku `unlock` v `balance.ts` (např. brigádníci až po 1. upgradu výkonu spalovny, takže hráč první minuty jen klikne) a úkoly se zobrazují po třech (`QUESTS_VISIBLE`). Pořadí úkolů musí odpovídat odemykání, aby žádný úkol nečekal na zamčené vylepšení bez důvodu.
- **Transparentní limity:** hráč vidí rozsah odběru města (noc až poledne, `cityDemandRangeMW`) a upgrade výkonu spalovny před koupí varuje, když by výkon přesáhl noční odběr, vedení nebo maximum města. Nové upgrady s nějakou pastí mají takhle varovat taky.
- **Oznámení o splněném úkolu:** hráč dostal náhodně 2000 kreditů bez vysvětlení, proto se po splnění úkolu ukáže zelené oznámení s názvem a odměnou (klepnutím se zavře, `TOAST_SECONDS`). Každá další odměna nebo událost, která mění kredity, by měla být oznámená.
- **Autonomie a krize:** hráč po ~20 min nebyl autonomní (5 brigádníků po 0,3 VO/s nestačilo na 6 MW) a krize už začala. Teď je těžba 0,4 VO/s (5 brigádníků = 6 MW), autonomie (`live.autonomous`: brigádníci dodají aspoň tolik VO, kolik spalovna potřebuje) je vidět v rozpisu ♻️ a je na ni úkol. **Krize začne až při autonomii** a zároveň po 350 MWh, ne dřív. Hráči nechybí zásoba VO (ten má naklikanou), chybí mu čas na kredity pro brigádníky.
- **Upgrady spalovny pod kartou Spalovna:** vylepšení s `group: 'incinerator'` v `balance.ts` (výkon, účinnost, regulátor) se v UI zobrazují přímo pod kartou Spalovna, ostatní v sekci Vylepšení.
- **Síť dole jako rozpad:** karta „Síť“ (čas, prestiž, spotřeba, rozsah, výroba, baterie, mařič, přetížení) je sbalená dole nad Laděním. Nahoře jsou jen karty 💰 ⚡ ♻️ a upozornění.
- **Peníze brzdí výkon, ne odpad:** hráč měl odpadu kupu a peněz málo, protože peníze jdou jen za prodanou elektřinu (MW). Proto má sklad VO strop (`VO_STORAGE_SECONDS` = 60 s provozu při plném výkonu, roste s výkonem) a přebytek se automaticky prodá (`VO_OVERFLOW_PRICE` = 0,3 kreditu za VO, řádek v rozpisu 💰). Klikání tak dává smysl pořád, ale nejde si naklikat nekonečnou zásobu. Měřeno botem: autonomie za 5–8 min podle rychlosti klikání (hráč: autonomie za ~9 min hry, 1032 tapů).
- **Karta ⚡** ukazuje bilanci výkonu (výroba, baterie, mařič, ztráty, dodávka vs. co město chce), ne celkově dodané MWh (to je jen malá poznámka v rozpisu).
- **Nevyřešeno:** čím se bude zvedat spotřeba města (budovy klikem, růst jen při online hraní, viz GDD sekce 9).
