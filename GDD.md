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
- **Den a noc:** 1 herní den = 6 reálných minut (3 min den, 3 min noc). V noci klesá spotřeba; bez baterií síť přetíží a hráč platí postihy.
- **Fyzikální limity sítě:** vedení a transformátory mají maximální propustnost v MW. Při přetížení síť vypadne a nahození stojí poplatek.
- **Toxický odpad:** špinavé technologie produkují toxický odpad, který blokuje mapu, snižuje prestiž a jeho likvidace je drahá.
- **Aktivní i pasivní hraní:** merge minihra a ruční klikání, nebo běh na pozadí s brigádníky.
- **Prevence bankrotu:** když dojdou peníze, brigádníci přestanou pracovat i účtovat mzdu. Hráč nikdy nejde do mínusu.

## 4. Průchod hrou

Hra má tři kapitoly; každou odemyká dodaná energie a s ní prestiž města.

### Kapitola 1: Spalovna a start

- **Mapa:** mřížka cca 20×20, viditelná jen malá část, odpadky na zemi. Uprostřed spalovna (2×2), dráty vedou do trafa města v pravém dolním rohu.
- **Ekonomika:** 5 tapů na odpad = 5 vytříděného odpadu (VO). 5 VO ve spalovně = 1 MWh (výkonem 10 MW). 1 MWh dodaná městu = 10 kreditů.
- **Vylepšení:** brigádníci (automatický sběr), účinnost spalovny, kapacita drátů a trafa, první baterie (nutné pro noc).
- **Krize:** po cca 90 MWh vyplivne spalovna toxický odpad (2×2), příjmy města klesnou. To motivuje k postupu do kapitoly 2.
- **Úkoly místo tutoriálu:** dodej 1 MWh, vyčisti 5 políček, dodej 100 MWh.

### Kapitola 2: Laboratoř, merge a soláry

Odemyká se po dodání 100 MWh (prestiž města 2).

- **Výzkum (merge minihra):** laboratoř generuje zkumavky, spojováním (1+1=2, 2+2=4) vznikají silnější bloky.
- **Likvidátor odpadu:** první produkt výzkumu, za poplatek trvale ničí toxický odpad.
- **Solární panely (FVE):** modulární panely 1×1 lze lepit k sobě, fungují jen přes střídač s trafem a jen ve dne. Vytváří velké polední špičky; v noci dál drží síť spalovna.
- **E-odpad:** výstavba produkuje křemík, který lze recyklovat na VO.

### Kapitola 3: Biomy a obnovitelné zdroje

- **Hory:** v mlze je rozbitá přehrada. Hráč kupuje parcely, dostane se k ní a vyzkoumá opravu. Vyrábí 24/7, ale potřebuje drahé vedení vysokého napětí.
- **Oceán:** offshore větrné elektrárny vyrábí 24/7, ale výkon náhodně a drasticky kolísá. Extrémní nápor na baterie a balancování sítě.

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
- **Levý výsuvný panel:** nákup budov a parcel, vylepšení, výzkum (přepnutí do merge minihry), úkoly a statistiky.
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
6. **Kapitola 2:** laboratoř a merge, likvidátor, soláry se střídačem. Pak dekorace a časové mise.
7. **Kapitola 3:** biomy, přehrada, offshore vítr.

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

Z prvního hraní na mobilu (kroky 4 a dál):
- **Rostoucí spotřeba města:** budovy staví hráč kliknutím (krok 4). Navíc může spotřeba pomalu růst s úrovní, ale jen při aktivním hraní, ne offline.
- **Toxická krize po ~90 MWh** a úkoly od postav (krok 4); brigádníci tam budou omezeni množstvím odpadu na ostrově.
- **Tutoriál s postavami** místo textové nápovědy.
