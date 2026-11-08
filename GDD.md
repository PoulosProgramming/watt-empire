# Watt Empire: Záchrana ostrova – GDD

Oct 30, 2026 · @Poulos

## 1. Základní informace

Watt Empire je idle tycoon o budování elektrické sítě, hratelný v prohlížeči na mobilu i PC.

| Položka | Hodnota |
| --- | --- |
| Žánr | Idle / Tycoon / Management / Grid-based puzzle |
| Platforma | Webová hra (PWA): mobil na výšku, PC v okně prohlížeče; jeden kód pro obojí |
| Technologie | TypeScript + Phaser 3 (nahrazuje původní Godot 4, zdůvodnění v sekci 7) |
| Vizuální styl | 2D mřížka (tile-based), čisté UI, free assety (Kenney.nl) doplněné AI generovanými ikonami |
| Inspirace | Reactor (idle výroba), The Simpsons: Tapped Out (odemykání parcel, rostoucí město, postavy s úkoly) |

## 2. Téma a cíl hry

Hráč začíná na zamořeném ostrově s jedinou starou spalovnou odpadu. Cílem je ostrov postupně vyčistit od toxického odpadu, vybudovat stabilní elektrickou síť, zásobovat rostoucí město a přejít na čisté, obnovitelné zdroje.

## 3. Hlavní herní pilíře a mechaniky

Od běžných klikaček se hra liší tím, že ekonomika nutí hráče optimalizovat síť, ne jen klikat.

- **Výroba = spotřeba:** hráč balancuje výrobu s aktuální spotřebou města, přebytky musí ukládat.
- **Den a noc:** 1 herní den = 6 reálných minut (3 min den, 3 min noc). **Zpočátku jen vizuální** (město odebírá stálou smluvní dodávku). Až přijde zlom, kdy bude potřeba regulovat (zatím nedomyšlené), začne spotřeba v noci klesat; bez uložení přebytků pak síť přetíží a hráč platí postihy.
- **Fyzikální limity sítě:** vedení a transformátory mají maximální propustnost v MW. Při přetížení síť vypadne a nahození stojí poplatek.
- **Toxický odpad:** špinavé technologie produkují toxický odpad, který blokuje mapu, snižuje prestiž a jeho likvidace je drahá.
- **Aktivní i pasivní hraní:** merge minihra a ruční klikání, nebo běh na pozadí s brigádníky.
- **Prevence bankrotu:** když dojdou peníze, brigádníci přestanou pracovat i účtovat mzdu. Hráč nikdy nejde do mínusu.

## 4. Průchod hrou

Hra má **pět kapitol**, každou odemyká splnění cíle předchozí. Vše je hezky odstupňované: nové technologie se odemykají postupně (hlavní úkoly odemykají technologie a dávají důležité bonusy).

### Kapitola 1: Smlouva na stálých 15 MW

Hráč je spalovna, která zásobuje ostrov. Má **nasmlouvanou dodávku 15 MW, kterou musí městu dávat stabilně, bez ohledu na den a noc**. To je hlavní bod kapitoly: začít vyrábět stabilně a dodat městu smluvních 15 MW.

- **Mapa:** mřížka cca 20×20, viditelná jen malá část, odpadky na zemi. Uprostřed spalovna (2×2), dráty vedou do trafa města v pravém dolním rohu.
- **Ekonomika:** 5 tapů na odpad = 5 vytříděného odpadu (VO). 5 VO ve spalovně = 1 MWh. 1 MWh dodaná městu = 10 kreditů. Spalovna začíná na 3 MW, výkon se zvyšuje nákupem (až na 15 MW).
- **Vylepšení:** brigádníci (automatický sběr, max 6), výkon a účinnost spalovny, kapacita drátů a trafa (nutná pro výkon nad 6 MW).
- **Bez regulace:** čím víc hráč vyrábí, tím víc město odebírá (až do smluvních 15 MW). Regulátor, baterie ani mařič v kapitole 1 nejsou.
- **Úkoly místo tutoriálu**, hlavní úkoly odemykají technologie a dávají bonusy; průběžné úkoly (po autonomii) dávají peníze za další vylepšování.
- **Konec kapitoly:** splněná smlouva (město **aspoň jednou** dostalo 15 MW) **a zároveň** dodáno 500 MWh. Na konci se ve zprávě naznačí hrozba.

### Kapitola 2: Odpad a krize

Přijde problém: **odpad ze spalovny**. Lidé se bouří, město platí méně (nechce „špinavou energii").

- Hráč začne odpad **likvidovat a rozebírat** (v budoucnu merge minihra), pak ho **uskladňovat a nevyhazovat na pole**.
- **Regulace stále není potřeba:** čím víc se vyrábí, tím víc město odebírá, byť za snížený poplatek.
- Ekologická katastrofa (toxický odpad na mapě, velký popup) se spouští 15 s po začátku kapitoly. **První verze v kódu:** odpad ze spalovny se ukládá do skladu nebo leží na poli (snižuje cenu až o 40 %); likvidátor ho ničí za peníze; od kapitoly 2 město bere vše, co unese vedení.

### Kapitola 3: Čistý zdroj a obnovitelné zdroje

- **Úkol:** přesvědčit veřejnost, že jsme čistý zdroj.
- Vytříděný toxický odpad něco stojí a začne zabírat vzácnou hrací plochu; vyčistit ji stojí hodně peněz.
- **Odemykají se obnovitelné zdroje (OZE):** soláry (panely 1×1 lepené k sobě, přes střídač s trafem, jen ve dne), hory (rozbitá přehrada, vyrábí 24/7, drahé vysoké napětí) a oceán (offshore vítr, výkon kolísá).
- Odemykají se také **baterie** a **mařič přebytku** (s OZE vznikají přebytky).
- **První verze v kódu:** sluneční panely (jen ve dne), důvěra veřejnosti (roste s čistou energií a likvidací odpadu, klesá s odpadem na poli; při 100 % město platí o 20 % víc). Polední špička ze slunce přetěžuje vedení, proto je potřeba vedení, baterie a mařič. Hory a oceán zatím nejsou.

### Kapitola 4: Regulace

- Odemyká se **regulace** (automatický regulátor). Zde přijde velký zlom: den a noc začnou hrát roli a hráč musí síť regulovat (podrobnosti zatím nedomyšlené).

### Kapitola 5: Jaderné elektrárny

- Odemykají se **jaderky**. Podrobnosti zatím nedomyšlené.

## 5. Metahra inspirovaná TSTO

Z TSTO bereme jen čtyři prvky, které stojí na už existující ekonomice a nepotřebují nové systémy. Síť běží v reálném čase (minuty), metahra na delší ose (hodiny až dny); obě vrstvy jsou oddělené.

| Prvek | Jak funguje ve Watt Empire | Proč je levný na výrobu | Fáze |
| --- | --- | --- | --- |
| Rostoucí město | Městská čtvrť má vlastní parcely. Každá úroveň prestiže přidá budovu (dům, pekárna, nemocnice, továrna) a každá budova zvedne spotřebu a její špičky. | Prestiž i spotřeba už existují; jde jen o seznam budov a jejich sprity. | MVP |
| Postavy v úkolech | Starosta a 2 až 3 postavy (technik, vědkyně) zadávají úkoly krátkým dialogem, např. starosta si stěžuje na smog ze spalovny. | Úkoly už v GDD jsou; přidává se jen text a portrét. | MVP |
| Dekorace s bonusem | Parky, stromy a vyčištěné pláže na uvolněných políčkách zvyšují prestiž, a tím výkupní cenu energie. | Využívá mřížku a prestiž; jen nové položky v obchodě. | Fáze 2 |
| Časové mise | Brigádník se pošle na misi (oprava vedení 30 min, průzkum mlhy 4 h) a vrátí se s odměnou. Hlavní důvod vracet se do hry. | Jeden časovač na postavu; offline výpočet už je potřeba kvůli idle. | Fáze 2 |

Záměrně vynecháno: prémiová měna, sezónní eventy, návštěvy přátel. Každé z toho potřebuje server nebo velký objem obsahu.

Pravidlo pro rostoucí město: nová budova se postaví až po kliknutí hráče. Hráč tak sám rozhodne, kdy si přidá spotřebu, a nepřijde o síť jen proto, že dosáhl prestiže.

Město není samostatná obrazovka ani druhá hra. Zůstává na stejné mapě v rohu, kam vede vedení, a jen viditelně roste. Klik na město otevře panel se spotřebou, seznamem budov a tlačítkem pro stavbu další. Dialogy postav vyskakují jako okno přes mapu.

## 6. Uživatelské rozhraní a ovládání

UI je navržené pro mobil na výšku (720×1280) a na PC se škáluje do okna; myš nahrazuje dotyk.

- **Horní lišta:** kredity (stav + příjem), energie (dodáno MWh + aktuální výkon v MW), VO (stav + těžba za sekundu).
- **Menu (od 9. 11. 2026 záložky na boku):** mapa je přes celou plochu a menu (spalovna, vylepšení, úkoly, síť, nápověda, ladění) jsou záložky s emoji na boku, které otevřou panel přes mapu. Dřívější popis: **Levý výsuvný panel:** nákup budov a parcel, vylepšení, výzkum (přepnutí do merge minihry), úkoly a statistiky.
- **Herní plocha:** klik na budovu otevře okno se statistikami (vyrobeno, uloženo, účinnost, ztráty) a upgrady.
- **Město:** pevný bod v pravém dolním rohu, rostoucí podle sekce 5.
- **Náhodné nabídky:** časově omezené, např. dodej 100 VO za dvojnásobek peněz.
- **Ovládání mapy:** tažení posouvá mapu, pinch nebo kolečko myši přibližuje.

## 7. Technický základ: webová hra

Hra poběží v prohlížeči jako PWA: jeden kód, hratelný na PC i mobilu, s ikonou na ploše telefonu.

### Proč web místo Godotu

- **Vibecoding:** Claude Code píše TypeScript nejspolehlivěji. V Godotu se velká část práce dělá v editoru (scény, nody, signály), kam Claude nevidí, takže by to zbylo na tobě.
- **Export na web z Godotu 4** je těžký (desítky MB), na iOS Safari bývá problémový a pomalu startuje.
- **Rychlý cyklus:** změna v kódu je za sekundu vidět v prohlížeči, na mobilu přes odkaz. Hosting je zdarma (GitHub Pages, Netlify).

### Stack

| Vrstva | Volba | Účel |
| --- | --- | --- |
| Jazyk a build | TypeScript + Vite | Typy chytají chyby, které by Claude jinak zanesl |
| Herní plocha | Phaser 3 | Mřížka, sprity, posun a zoom mapy |
| UI | HTML/CSS nad canvasem | Lišty a panely se snáz přizpůsobí mobilu i PC |
| Uložení | localStorage + export/import save jako text | Žádný server |
| Testy | Vitest | Kontrola ekonomiky a sítě bez spouštění hry |

### Architektura

Klíčové pravidlo: **simulace je oddělená od grafiky.** Simulace je čistý TypeScript bez Phaseru, běží v tiku (např. 4× za sekundu) a grafika jen čte její stav.

1. `GameState`: jeden objekt se vším, co se ukládá.
2. `Economy`: kredity, VO, mzdy, prevence bankrotu.
3. `PowerNetwork`: výroba, ztráty, kapacity vedení, baterie, blackout.
4. `DayNight`: herní čas a křivka spotřeby města.
5. `City` a `Quests`: prestiž, budovy města, postavy a úkoly.
6. `Save`: ukládání a offline progres (simulace se při návratu přetočí rychle vpřed).
7. `balance.ts`: všechna čísla na jednom místě (ceny, výkony, kapacity).

## 8. Plán vývoje s Claude Code

Nejdřív ověřit, že je jádro zábavné bez grafiky, a teprve pak stavět mapu a obsah. Každý krok končí hratelnou verzí na mobilu.

### Postup

1. **Příprava:** repozitář na GitHubu, tento GDD jako soubor v repu, `CLAUDE.md` s pravidly (stack, architektura, „čísla jen v balance.ts“, „simulace bez Phaseru“).
2. **Jádro v číslech:** tlačítka a čísla v HTML, žádná mapa. Tap na odpad, spalovna, dodávka městu, den a noc, baterie. Otázka: baví to 10 minut?
3. **Mapa a stavění:** mřížka v Phaseru, posun a zoom, stavění budov a drátů, mlha a parcely.
4. **Kapitola 1 komplet + TSTO MVP:** toxický odpad, úkoly s postavami, rostoucí město.
5. **Uložení a mobil:** save, offline progres, PWA, ladění dotyků na telefonu.
6. **Kapitola 2:** odpad a krize, likvidace a rozebírání odpadu (merge minihra), uskladnění. Pak dekorace a časové mise.
7. **Kapitoly 3 až 5:** OZE (soláry, hory, oceán) a čistý zdroj; regulace; jaderky.

### Rizika a jak je vyladit

| Riziko | Co se stane | Jak tomu předejít |
| --- | --- | --- |
| Kód se rozpadá s velikostí | Claude při velkých změnách přepisuje fungující věci a ztrácí přehled | Malé zadání na jeden úkol, commit po každém kroku, `CLAUDE.md` udržovat aktuální, Claude ať po změně spustí testy |
| Ekonomika nebaví | Čísla od AI jsou odhad, zábavu nepozná | Všechna čísla v `balance.ts`, debug panel se zrychlením času ×10 a přidáním kreditů, ladit hraním |
| Síťový algoritmus je přehnaný | Pokus o skutečnou fyziku toků zabije týdny | Zjednodušit: síť jako graf, propustnost cesty = nejslabší článek, přetížení = výkon nad kapacitou |
| Offline progres | Den, noc a baterie se při přetočení špatně počítají | Přetočit simulaci ve větších krocích, strop např. 8 h, ukázat hráči souhrn „zatímco jsi byl pryč“ |
| Mobil vs PC | Tap vs posun mapy, malé prvky, iOS Safari | Testovat na telefonu od kroku 2, minimální velikost tlačítek 44 px, posun mapy až po pohybu prstu |
| Ztráta uložené hry | Prohlížeč (hlavně iOS) může data webu smazat | Instalace jako PWA na plochu, export a import save jako text |
| Nekonzistentní grafika | Kenney + AI ikony nesedí dohromady | Jeden Kenney balík jako základ, AI ikony generovat ve stejné paletě a stylu |
| Rozrůstání rozsahu | Nové nápady před dokončením kapitoly 1 | Nové nápady psát do sekce „Později“, kapitolu 1 dotáhnout jako první |

## 9. Později (nápady mimo aktuální krok)

- **Hlavní úkoly odemykají technologie a dávají důležité bonusy** (ne jen peníze). Hlavní úkol má dát buď odemčení technologie, nebo trvalý bonus; průběžné úkoly dávají peníze.

Z prvního hraní na mobilu (kroky 4 a dál):
- **Rostoucí spotřeba města:** budovy staví hráč kliknutím (krok 4). Navíc může spotřeba pomalu růst s úrovní, ale jen při aktivním hraní, ne offline.
- **Toxická krize** je zatím jen v číslech (přesunuto do kapitoly 2, příjem 60 %); vizuální toxický odpad a úkoly od postav přijdou v kroku 4; brigádníci tam budou omezeni množstvím odpadu na ostrově.
- **Sběr na mapě** má být omezený (odpad se objevuje s limitem), aby nešlo hru dohrát rychlým klikáním; ceny brigádníků pak přeladit.
- **Tutoriál s postavami** místo textové nápovědy.

### Rozhodnutí o přestavbě kapitol (8. 11. 2026)

Autor schválil pětikapitolovou strukturu (sekce 4). Rozhodnuto takto:
1. **Pět kapitol** (smlouva 15 MW, odpad a krize, čistý zdroj a OZE, regulace, jaderky). Původní tři kapitoly jsou níž jako nápady do budoucna.
2. **Soláry patří k OZE do kapitoly 3.**
3. **Den a noc je zpočátku jen vizuální**, dodává se smluvně; později přijde zlom, kdy bude nutné regulovat (nedomyšleno).
4. **Mařič, baterie a regulátor se zamykají do pozdějších kapitol** (baterie a mařič kapitola 3, regulátor kapitola 4); v kapitole 1 nejsou.
5. **Konec kapitoly 1:** splněná smlouva a zároveň 500 MWh. Smlouva se splní **jednou** dosažením 15 MW.

### Původní tři kapitoly (nápady do budoucna)

Dřívější struktura, ponechaná jako zdroj nápadů:

- **Původní kapitola 1:** spalovna a start; krize po cca 250 MWh (spalovna vyplivne toxický odpad), úkoly dodej 1 MWh, vyčisti 5 políček, dodej 100 MWh.
- **Původní kapitola 2: Laboratoř, merge a soláry** (po 500 MWh): výzkum merge minihrou (zkumavky 1+1=2, 2+2=4), likvidátor odpadu (za poplatek trvale ničí toxický odpad), solární panely 1×1 přes střídač (jen ve dne, polední špičky, v noci drží síť spalovna), e-odpad (křemík lze recyklovat na VO).
- **Původní kapitola 3: Biomy a obnovitelné zdroje:** hory (rozbitá přehrada v mlze, 24/7, drahé vysoké napětí), oceán (offshore vítr, výkon náhodně kolísá, nápor na baterie).
