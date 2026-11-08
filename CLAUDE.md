# Watt Empire – pravidla pro Claude

Idle tycoon o elektrické síti, webová hra (mobil na výšku + PC). Design je v `GDD.md` – to je zdroj pravdy. Autor je úplný začátečník: **vysvětluj česky, jednoduše, bez zbytečného žargonu.**

## Stack
- TypeScript + Vite (build, dev server), Vitest (testy).
- Phaser 3 až od kroku 3 plánu (mapa). UI jsou HTML/CSS prvky nad herní plochou.
- Uložení: localStorage + export/import textu (krok 5). Žádný server.

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
- UI: tlačítka min. 44 px, testuj mobil na výšku. Posun mapy až po pohybu prstu (od kroku 3).
- Nové nápady mimo aktuální krok patří do sekce „Později“ v GDD, ne do kódu. Kapitolu 1 dotáhnout jako první.
- Tento soubor udržuj aktuální.

## Příkazy
- `npm run dev` – vývojový server, `npm test` – testy, `npm run build` – produkční build do `dist/`.
- `vite.config.ts` má `base: '/watt-empire/'` (GitHub Pages) – neměnit.

## Stav plánu (GDD sekce 8)
- [x] 1. Příprava
- [x] 2. Jádro v číslech (HTML tlačítka, bez mapy; debug panel ×10 a +kredity)
  - Po prvním hraní na mobilu: sklad spalovny s hysterezí, posuvník výkonu (poplatek), auto regulátor, nápověda, víc úkolů, dražší brigádníci.
- [ ] 3. Mapa a stavění … 7. Kapitola 3

## Poznatky z hraní (první test na mobilu, 8. 11. 2026)
Zapisuj sem, co ukázalo hraní, ať další agent ví, proč je hra nastavená tak, jak je.
- **Blackouty bez vysvětlení:** hráč nechápal, proč se síť přetěžuje. Proto je v UI nápověda „Jak na to" a hláška u přetížení říká, co dělat. Při dalších mechanikách vždy přidat i krátké vysvětlení pro hráče.
- **Noční spotřeba je malá** (35 % ze 10 MW = 3,5 MW). Spalovna proto musí jít stáhnout pod tuto hodnotu (min. 30 %), jinak hráč bez baterie nepřežije noc. Řešení: posuvník výkonu (poplatek) a upgrade Automatický regulátor.
- **Houpání výroby 0↔6 MW** bylo jen na startu, kdy je málo VO. Spalovna má proto sklad s hysterezí: rozjede se při 25 VO a zhasne, až když sklad nestačí.
- **Brigádníci byli moc levní a rychlí** (hráč nepotřeboval žádnou ruční práci). Zdraženo (růst ceny 1,5×) a omezeno na 15. Pozor: v kroku 4 je přidat omezení množstvím odpadu na ostrově.
- **Úkoly došly za ~10 minut** (s cheaty). Přidáno 8 úkolů s různými cíli. Další obsah přijde s krizí a postavami v kroku 4.
- **Tlačítko „Třídit odpad"** bylo moc velké a hráč ho po chvíli nepoužíval (na mapě se tříbí klepáním na odpad, krok 3). Zmenšeno.
- **Ladění:** ×10 rychlost je hodně používaná, protože pasivní fáze je nudná. Tlačítko +1000 kreditů ničí zkoušení tempa, ve finální verzi ho schovat.
- **Nevyřešeno:** čím se bude zvedat spotřeba města (budovy klikem, růst jen při online hraní, viz GDD sekce 9) a čím hráče motivovat po dokončení úkolů (toxická krize po ~90 MWh).
