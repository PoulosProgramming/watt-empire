import './style.css';
import {
  AUTOSAVE_SECONDS,
  BUILDINGS,
  BUILDING_REFUND,
  PARCEL_UNLOCK_CHAPTER,
  type BuildingType,
  DEBUG_CREDITS_BONUS,
  DEBUG_SPEEDS,
  EFFICIENCY_VO_FACTOR,
  INCINERATOR_VO_PER_MWH,
  OFFLINE_FULL_RATE_SECONDS,
  OFFLINE_REDUCED_RATE,
  SECONDS_PER_GAME_HOUR,
  INCINERATOR_POWER_STEP_MW,
  INCINERATOR_START_VO,
  TOXIC_FIELD_FULL,
  OVERLOAD_TOLERANCE_SECONDS,
  ONGOING_QUESTS_VISIBLE,
  CHAPTER_END_QUESTS,
  CHAPTER_END_TEXT,
  CHAPTER_START_TEXT,
  CHAPTER_TITLES,
  MAX_CHAPTER,
  MAYOR_AVATAR,
  MAYOR_NAME,
  ONGOING_UNLOCK_QUEST,
  TUTORIAL_STEPS,
  QUESTS,
  LITTER_CREW_SIZE,
  LITTER_RESPAWN_SECONDS,
  WORKER_VO_PER_SECOND,
  LITTER_WORKER_CLEAN_SECONDS,
  QUESTS_VISIBLE,
  STORY_INTRO,
  TOAST_SECONDS,
  TOXIC_POPUP_TEXT,
  TOXIC_POPUP_TITLE,
  VO_OVERFLOW_PRICE,
  UPGRADES,
} from '../sim/balance';
import { isDay } from '../sim/daynight';
import { buyUpgrade, clampVO, isUnlocked, upgradeCost, voPerMWh, voStorageMax } from '../sim/economy';
import { TICK_DT, simulateOffline, tick } from '../sim/game';
import { batteryCapacityMWh, cityDemandRangeMW, disposeRate, dumpCapacityMW, incineratorNominalMW, lineCapacityMW, prestige, solarCapacityMW, storageCapacity } from '../sim/power';
import { questProgress } from '../sim/quests';
import { deserialize, serialize } from '../sim/save';
import { buildingCost, buyParcel, canPlace, demolishAt, parcelCost, parcelsBought, placeBuilding, purchasableParcels, type PlaceReason } from '../sim/build';
import { collectLitter } from '../sim/litter';
import { isBuildableTile, isUnlockedTile, parcelIndex } from '../sim/mapdata';
import { buildingDef, footprint, networkInfo } from '../sim/network';
import { checkStory, storyText } from '../sim/story';
import { createMap } from './map';
import { newGame } from '../sim/state';

const SAVE_KEY = 'watt-empire-save';
function loadSaved() {
  try {
    return deserialize(localStorage.getItem(SAVE_KEY));
  } catch {
    return null; // úložiště nemusí být dostupné (např. anonymní okno)
  }
}
let resetting = false; // při mazání postupu se nesmí uložit zpátky (ukládá se i při zavření stránky)
function saveNow(): void {
  if (resetting) return;
  try {
    state.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* nejde uložit, hra běží dál */
  }
}
const savedGame = loadSaved();
const state = savedGame ?? newGame();
clampVO(state); // starší uložení mohlo mít víc VO, než se vejde do skladu
setInterval(() => {
  if (document.visibilityState === 'visible') saveNow(); // v pozadí by to přepsalo čas schování
}, AUTOSAVE_SECONDS * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveNow(); // uloží i čas schování pro idle dopočet
  } else {
    runOffline(); // telefon byl zamčený nebo stránka v pozadí
    last = performance.now();
  }
});
window.addEventListener('pagehide', saveNow);
let speed = 1;
const fmt = (n: number, d = 1) => n.toFixed(d);

const app = document.getElementById('app')!;
app.innerHTML = `
  <div id="map"></div>
  <div id="hud">
    <div class="stats">
      <button class="stat" data-stat="credits"><b id="credits"></b><small id="income"></small></button>
      <button class="stat" data-stat="energy"><b id="energy"></b><small id="power"></small></button>
      <button class="stat" data-stat="vo"><b id="vo"></b><small id="vops"></small></button>
      <button class="stat questbtn" id="questbtn" aria-label="Úkoly">📋<i id="questbang">!</i></button>
    </div>
    <div id="questpop" hidden></div>
    <div id="clock"></div>
    <div id="modebar"></div>
    <div id="statdetail"></div>
    <div id="alerts"></div>
  </div>

  <nav id="tabs">
    <button class="tab" data-tab="furnace" aria-label="Spalovna">🏭</button>
    <button class="tab" data-tab="build" aria-label="Stavba">🏗️</button>
    <button class="tab" data-tab="upgrades" aria-label="Vylepšení">🛠️</button>
    <button class="tab" data-tab="quests" aria-label="Úkoly">📋</button>
    <button class="tab" data-tab="net" aria-label="Síť">🔌</button>
    <button class="tab" data-tab="info" aria-label="Příběh a nápověda">📖</button>
    <button class="tab" data-tab="debug" aria-label="Ladění">⚙️</button>
  </nav>

  <section id="sheet" hidden>
    <header><b id="sheettitle"></b><button id="sheetclose" aria-label="Zavřít">✕</button></header>
    <div class="sheetbody">
      <div data-sheet="furnace" hidden>
        <div class="card">
          <div class="row"><span>Stav</span><b id="incstate"></b></div>
          <div class="row"><span>Sklad VO</span><b id="incstock"></b></div>
          <div class="row"><span>Cena VO navíc (nad sklad)</span><b>${VO_OVERFLOW_PRICE} 💰 / VO</b></div>
          <div class="row"><span>Výkon</span><b id="inclevel"></b></div>
          <button id="toggle" style="width:100%;margin-top:6px"></button>
        </div>
        <div id="waste"></div>
        <div id="incupgrades"></div>
      </div>
      <div data-sheet="build" hidden>
        <div id="buildmenu"></div>
      </div>
      <div data-sheet="upgrades" hidden>
        <div id="upgrades"></div>
      </div>
      <div data-sheet="quests" hidden>
        <h2>Úkoly</h2>
        <div class="card" id="quests"></div>
        <h2>Průběžné úkoly</h2>
        <div class="card" id="ongoing"></div>
      </div>
      <div data-sheet="net" hidden>
        <div class="card"><div id="grid"></div></div>
      </div>
      <div data-sheet="info" hidden>
        <div class="card story">📖 ${STORY_INTRO}</div>
        <div id="ending"></div>
        <h2>Zprávy od starosty</h2>
        <div class="card" id="mayorlog"></div>
        <div class="card help">
          <p>♻️ <b>VO</b> (vytříděný odpad) pálí spalovna a vyrábí z něj ⚡ elektřinu. Město ji kupuje za 💰.</p>
          <p><b>Klepej na odpad na mapě</b> (🥤 📦 🗑️): každé klepnutí vytřídí 1 ♻️ VO a po 5 klepnutích hromádka zmizí. Nový odpad se objevuje pomalu, takže potřebuješ i brigádníky. Spalovna se rozjede, až má ve skladu dost VO. Sklad má strop; co se nevejde, se prodá za pár kreditů. Zatím běží na malý výkon, takže se nic nepřetíží.</p>
          <p>Máš <b>smlouvu na stálých 15 MW</b>, den i noc. Za kredity zvyšuj <b>výkon</b> spalovny a vedení (dráty a trafo), ať městu dodáš celých 15 MW. Pozor: vedení musí unést tvůj výkon, jinak se síť přetíží a přijde ⚫ blackout.</p>
          <p>Mapu posuneš tažením prstu a přiblížíš dvěma prsty; klepnutím na odpad ho vytřídíš. Záložky vpravo otevírají menu: 🏭 spalovna, 🛠️ vylepšení, 📋 úkoly, 🔌 síť, 📖 nápověda, ⚙️ ladění.</p>
        </div>
      </div>
      <div data-sheet="debug" hidden>
        <div class="card debug" id="debug"></div>
      </div>
    </div>
  </section>
`;


let openStat = '';
document.querySelectorAll<HTMLElement>('.stat').forEach((el) =>
  el.addEventListener('click', () => {
    openStat = openStat === el.dataset.stat ? '' : el.dataset.stat!;
  }),
);

// Oznámení o splněném úkolu (po načtení hry se už splněné úkoly neoznamují)
const seenQuests = new Set(state.doneQuests);
const toasts = document.createElement('div');
toasts.id = 'toasts';
document.body.appendChild(toasts);
function showToast(html: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  const close = () => el.remove();
  el.addEventListener('click', close);
  setTimeout(close, TOAST_SECONDS * 1000);
  toasts.appendChild(el);
}
// Velký popup při spuštění ekologické krize (po načtení hry s už probíhající krizí se neukazuje)
let seenToxic = state.toxic;
function showModal(title: string, text: string, good = false): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal${good ? ' good' : ''}"><h3>${title}</h3><p>${text}</p><button class="modal-ok">Rozumím</button></div>`;
  overlay.querySelector('button')!.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
// Starosta: scénky se ukazují v okénku s dialogem, jedna po druhé. Po načtení uložené hry se už proběhlé neukazují.
checkStory(state);
let seenStory = savedGame ? state.story.length : 0;
const dialogQueue: string[] = [];
let dialogOpen = false;
function showNextDialog(): void {
  if (dialogOpen) return;
  const id = dialogQueue.shift();
  if (!id) return;
  const text = storyText(id);
  if (!text) return showNextDialog();
  dialogOpen = true;
  const el = document.createElement('div');
  el.className = 'dialog';
  el.innerHTML = `<div class="dlg-avatar">${MAYOR_AVATAR}</div><div class="dlg-body"><b>${MAYOR_NAME}</b><p>${text}</p><button class="dlg-ok">OK</button></div>`;
  el.querySelector('button')!.addEventListener('click', () => {
    el.remove();
    dialogOpen = false;
    showNextDialog();
  });
  document.body.appendChild(el);
}
// Tutorial: panel dole s vysvětlením, krok se přepne sám po splnění úkolu
const tutorialEl = document.createElement('div');
tutorialEl.id = 'tutorial';
tutorialEl.hidden = true;
document.body.appendChild(tutorialEl);
const tutorialActive = () => state.tutorial < TUTORIAL_STEPS.length;
let tutorialShown = -1;
function tutorialDone(): boolean {
  const w = TUTORIAL_STEPS[state.tutorial].wait;
  switch (w.kind) {
    case 'button':
      return false;
    case 'taps':
      return state.taps >= w.n;
    case 'cleaned':
      return state.litterCleaned >= w.n;
    case 'vo':
      return state.vo >= w.n;
    case 'tab':
      return openTab === w.tab;
    case 'upgrade':
      return (state.upgrades[w.id] ?? 0) >= w.n;
  }
}
function updateTutorial(): void {
  if (tutorialActive() && tutorialDone()) state.tutorial++;
  if (state.tutorial === tutorialShown) return;
  tutorialShown = state.tutorial;
  document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow'));
  if (!tutorialActive()) {
    tutorialEl.hidden = true;
    return;
  }
  const step = TUTORIAL_STEPS[state.tutorial];
  if (step.glow) document.querySelector(step.glow)?.classList.add('tut-glow');
  const isButton = step.wait.kind === 'button';
  const last = state.tutorial === TUTORIAL_STEPS.length - 1;
  tutorialEl.hidden = false;
  tutorialEl.innerHTML =
    `<small>Tutorial ${state.tutorial + 1} / ${TUTORIAL_STEPS.length}</small><p>${step.text}</p>` +
    `<div>${isButton ? `<button class="tut-next">${last ? 'Jdeme na to!' : 'Dál'}</button>` : ''}<button class="tut-skip">Přeskočit tutoriál</button></div>`;
}
tutorialEl.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.closest('.tut-next')) state.tutorial++;
  else if (el.closest('.tut-skip')) state.tutorial = TUTORIAL_STEPS.length;
});

function announceStory(): void {
  while (seenStory < state.story.length) {
    dialogQueue.push(state.story[seenStory++]);
    if (dialogQueue.length > 3) dialogQueue.shift(); // po delší pauze jen poslední tři
  }
  if (!tutorialActive()) showNextDialog();
}

// Velký popup při postupu do další kapitoly a na konci poslední (po načtení hry se už proběhlé neukazují)
const chapterDone = (n: number) => (CHAPTER_END_QUESTS[n] ?? []).every((id) => state.doneQuests.includes(id));
let seenChapter = state.chapter;
let seenFinal = state.chapter === MAX_CHAPTER && chapterDone(MAX_CHAPTER);
function announceChapter(): void {
  if (state.chapter > seenChapter) {
    const prev = seenChapter;
    seenChapter = state.chapter;
    const start = CHAPTER_START_TEXT[state.chapter] ? ` ${CHAPTER_START_TEXT[state.chapter]}` : '';
    showModal(`🏁 Konec kapitoly ${prev}`, `${CHAPTER_END_TEXT[prev]}${start}`, true);
  }
  if (!seenFinal && state.chapter === MAX_CHAPTER && chapterDone(MAX_CHAPTER)) {
    seenFinal = true;
    showModal(`🏁 Konec kapitoly ${MAX_CHAPTER}`, CHAPTER_END_TEXT[MAX_CHAPTER], true);
  }
}
function announceCrisis(): void {
  if (state.toxic && !seenToxic) {
    seenToxic = true;
    showModal(TOXIC_POPUP_TITLE, TOXIC_POPUP_TEXT);
  }
}

// Úkoly, které hráč právě vidí v záložce 📋 (hlavní po třech + odemčené průběžné)
function visibleQuestIds(s: typeof state): string[] {
  const main = QUESTS.filter((q) => !q.ongoing && (q.chapter ?? 1) === s.chapter && !s.doneQuests.includes(q.id));
  const leftovers = QUESTS.filter((q) => !q.ongoing && (q.chapter ?? 1) < s.chapter && !s.doneQuests.includes(q.id));
  const ids = [...main, ...leftovers].slice(0, QUESTS_VISIBLE).map((q) => q.id);
  if (s.doneQuests.includes(ONGOING_UNLOCK_QUEST)) {
    const ongoing = QUESTS.filter((q) => q.ongoing && !s.doneQuests.includes(q.id) && (!q.upgrade || isUnlocked(s, q.upgrade)));
    ids.push(...ongoing.slice(0, ONGOING_QUESTS_VISIBLE).map((q) => q.id));
  }
  return ids;
}
// Nový úkol: malý popup nahoře u tlačítka 📋
const knownVisible = new Set<string>(visibleQuestIds(state));
let questPopTimer = 0;
function announceNewQuests(): void {
  const fresh = visibleQuestIds(state).filter((id) => !knownVisible.has(id));
  if (fresh.length === 0) return;
  fresh.forEach((id) => knownVisible.add(id));
  const q = QUESTS.find((x) => x.id === fresh[0])!;
  const pop = $('questpop');
  pop.innerHTML = `📋 <b>Nový úkol</b><br>${q.text}${fresh.length > 1 ? `<br><small>…a ${fresh.length - 1} další</small>` : ''}`;
  pop.hidden = false;
  clearTimeout(questPopTimer);
  questPopTimer = window.setTimeout(() => (pop.hidden = true), TOAST_SECONDS * 1000);
}

function announceQuests(): void {
  for (const q of QUESTS) {
    if (state.doneQuests.includes(q.id) && !seenQuests.has(q.id)) {
      seenQuests.add(q.id);
      showToast(`✅ <b>Úkol splněn!</b><br>${q.text}<br><b>+${q.reward} 💰</b>`);
    }
  }
}

// Idle: dopočet času, kdy hra neběžela (zamčený telefon, zavřená stránka)
function runOffline(): void {
  if (!state.lastSeen) return;
  const elapsed = (Date.now() - state.lastSeen) / 1000;
  state.lastSeen = Date.now();
  const r = simulateOffline(state, elapsed);
  if (!r) return;
  const totalMin = Math.max(1, Math.round(r.seconds / 60));
  const away = totalMin >= 60 ? `${Math.floor(totalMin / 60)} h ${totalMin % 60} min` : `${totalMin} min`;
  const vo = r.vo >= 0 ? `+${fmt(r.vo, 0)}` : `−${fmt(Math.abs(r.vo), 0)}`;
  showToast(
    `🌙 <b>Zatímco jsi byl pryč (${away})</b><br>` +
      (r.seconds > OFFLINE_FULL_RATE_SECONDS ? `<small>První ${Math.round(OFFLINE_FULL_RATE_SECONDS / 60)} min na plno, zbytek jen na ${Math.round(OFFLINE_REDUCED_RATE * 100)} %.</small><br>` : '') +
      `💰 ${r.credits >= 0 ? '+' : '−'}${fmt(Math.abs(r.credits), 0)}, ⚡ ${fmt(r.delivered)} MWh dodáno, ♻️ ${vo} VO` +
      (r.blackouts > 0 ? `<br>⚫ ${r.blackouts}× vypadla síť` : ''),
  );
}
runOffline(); // po načtení hry dopočítat čas, kdy hráč nehrál

const $ = (id: string) => document.getElementById(id)!;

// ---- Stavění: režimy (stavět / zbourat / koupit parcelu), menu a klepnutí na mapu ----
type Mode = { kind: 'none' } | { kind: 'build'; type: BuildingType } | { kind: 'demolish' } | { kind: 'parcel' };
let mode: Mode = { kind: 'none' };
const BUILD_MESSAGES: Record<Exclude<PlaceReason, 'ok'>, string> = {
  chapter: 'Tohle se dá stavět až v pozdější kapitole.',
  locked: 'Tohle území je zamčené (v mlze). Dokup parcelu.',
  terrain: 'Tady se stavět nedá (voda, hory, keř, skála nebo jiná stavba).',
  occupied: 'Tady už něco stojí.',
  cost: 'Nemáš dost kreditů.',
};
function buildToast(html: string): void {
  document.querySelectorAll('.toast-build').forEach((e) => e.remove()); // ať se hlášky nehromadí
  showToast(html);
  toasts.lastElementChild?.classList.add('toast-build');
}
function setMode(m: Mode): void {
  mode = m;
  lastModebar = '';
  lastBuildHtml = '';
}
let lastBuildHtml = '';
let lastModebar = '';

function renderBuildMenu(): void {
  const s = state;
  const info = networkInfo(s);
  const unconnected = info.connected.filter((c) => !c).length;
  const rows = BUILDINGS.map((d) => {
    if (s.chapter < d.unlockChapter) return `<div class="bld locked">🔒 <b>${d.name}</b><small>Odemkne se v kapitole ${d.unlockChapter}.</small></div>`;
    const cost = buildingCost(s, d.type);
    const poor = s.credits < cost;
    const sel = mode.kind === 'build' && mode.type === d.type;
    return `<button class="bld${sel ? ' sel' : ''}" data-build="${d.type}"><span class="bld-ico">${d.emoji}</span><span class="bld-txt"><b>${d.name} (${d.w}×${d.h})</b><small>${d.description}</small></span><span class="bld-cost${poor ? ' poor' : ''}">💰 ${cost}</span></button>`;
  }).join('');
  const parcelOpen = s.chapter >= PARCEL_UNLOCK_CHAPTER;
  const parcelBtn = parcelOpen
    ? `<button class="bld${mode.kind === 'parcel' ? ' sel' : ''}" data-mode="parcel"><span class="bld-ico">🗺️</span><span class="bld-txt"><b>Dokoupit území (parcela 4×4)</b><small>Klepni na zamlžený kus země vedle odemčeného. Dokoupeno: ${parcelsBought(s)}.</small></span><span class="bld-cost${s.credits < parcelCost(s) ? ' poor' : ''}">💰 ${parcelCost(s)}</span></button>`
    : `<div class="bld locked">🔒 <b>Dokoupit území</b><small>Odemkne se v kapitole ${PARCEL_UNLOCK_CHAPTER}.</small></div>`;
  const demo = `<button class="bld${mode.kind === 'demolish' ? ' sel' : ''}" data-mode="demolish"><span class="bld-ico">🧹</span><span class="bld-txt"><b>Zbourat budovu</b><small>Klepni na budovu na mapě. Vrátí se ${Math.round(BUILDING_REFUND * 100)} % ceny.</small></span></button>`;
  const status = `<small class="bld-status">Postaveno: ${s.buildings.length}${unconnected > 0 ? ` · ⚠️ nenapojených: ${unconnected}` : ''}</small>`;
  const html = `${status}${rows}${parcelBtn}${demo}`;
  if (html !== lastBuildHtml) {
    $('buildmenu').innerHTML = html;
    lastBuildHtml = html;
  }
}

function renderModebar(): void {
  let html = '';
  if (mode.kind === 'build') {
    const d = buildingDef(mode.type);
    html = `🏗️ Stavím: <b>${d.name}</b> · 💰 ${buildingCost(state, mode.type)} · klepni na mapu <button class="modeoff">✕ Hotovo</button>`;
  } else if (mode.kind === 'demolish') html = `🧹 Bourání: klepni na budovu <button class="modeoff">✕ Hotovo</button>`;
  else if (mode.kind === 'parcel') html = `🗺️ Koupě území: klepni na zlatě ohraničenou parcelu · 💰 ${parcelCost(state)} <button class="modeoff">✕ Hotovo</button>`;
  if (html !== lastModebar) {
    $('modebar').innerHTML = html;
    $('modebar').style.display = html ? 'block' : 'none';
    lastModebar = html;
  }
}

$('buildmenu').addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-build],[data-mode]');
  if (!el) return;
  if (el.dataset.build) setMode({ kind: 'build', type: el.dataset.build as BuildingType });
  else if (el.dataset.mode === 'demolish') setMode({ kind: 'demolish' });
  else if (el.dataset.mode === 'parcel') setMode({ kind: 'parcel' });
  showTab(''); // menu se zavře, ať je vidět mapa
});
$('modebar').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('.modeoff')) setMode({ kind: 'none' });
});

function confirmDialog(text: string, yes: string, onYes: () => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal good"><h3>🗺️ Koupě území</h3><p>${text}</p><button class="modal-ok" data-yes>${yes}</button><button class="modal-cancel" data-no>Zrušit</button></div>`;
  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-yes]')) {
      overlay.remove();
      onYes();
    } else if (target.closest('[data-no]') || target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

// Klepnutí na dlaždici mapy: v režimu stavění ho zpracuje stavba, jinak se klepnutí nechá na třídění odpadu (vrací false)
function onTileTap(x: number, y: number): boolean {
  if (mode.kind === 'build') {
    const r = placeBuilding(state, mode.type, x, y);
    if (r !== 'ok') buildToast(`🏗️ ${BUILD_MESSAGES[r]}${r === 'cost' ? ` (cena ${buildingCost(state, mode.type)})` : ''}`);
    return true;
  }
  if (mode.kind === 'demolish') {
    const r = demolishAt(state, x, y);
    buildToast(r ? `🧹 Zbouráno: ${buildingDef(r.type).name}. Vráceno 💰 ${r.refund}.` : '🧹 Tady nic nestojí.');
    return true;
  }
  if (mode.kind === 'parcel') {
    const idx = parcelIndex(x, y);
    if (!purchasableParcels(state).includes(idx)) {
      buildToast(isUnlockedTile(state.unlockedParcels, x, y) ? '🗺️ Tohle území už máš.' : '🗺️ Tuhle parcelu koupit nejde (musí sousedit s odemčeným územím a mít pevninu).');
      return true;
    }
    const cost = parcelCost(state);
    confirmDialog(`Dokoupit parcelu za <b>💰 ${cost}</b>? Odemkne se nové území pro stavění a uklízení.`, `Koupit za ${cost}`, () => {
      const r = buyParcel(state, idx);
      buildToast(r === 'ok' ? '🗺️ Parcela koupena! Mlha zmizí a můžeš tu stavět.' : r === 'cost' ? '🗺️ Nemáš dost kreditů.' : '🗺️ Tuhle parcelu koupit nejde.');
    });
    return true;
  }
  return false;
}

// Záložky na boku: klepnutí otevře menu přes mapu, další klepnutí (nebo ✕) ho zavře
const TAB_TITLES: Record<string, string> = {
  furnace: '🏭 Spalovna',
  build: '🏗️ Stavba',
  upgrades: '🛠️ Vylepšení',
  quests: '📋 Úkoly',
  net: '🔌 Síť',
  info: '📖 Příběh a nápověda',
  debug: '⚙️ Ladění',
};
let openTab = '';
let questsSeenCount = -1; // kolik úkolů bylo hotových, když hráč naposled otevřel úkoly (-1 = ještě nikdy)
function showTab(name: string): void {
  openTab = name;
  if (name === 'quests') questsSeenCount = state.doneQuests.length;
  $('sheet').hidden = !name;
  $('sheettitle').textContent = TAB_TITLES[name] ?? '';
  document.querySelectorAll<HTMLElement>('[data-sheet]').forEach((el) => (el.hidden = el.dataset.sheet !== name));
  document.querySelectorAll<HTMLElement>('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === name));
}
document.querySelectorAll<HTMLElement>('.tab').forEach((el) =>
  el.addEventListener('click', () => showTab(openTab === el.dataset.tab ? '' : el.dataset.tab!)),
);
$('questpop').addEventListener('click', () => {
  $('questpop').hidden = true;
  showTab('quests');
});
$('questbtn').addEventListener('click', () => showTab(openTab === 'quests' ? '' : 'quests'));
$('sheetclose').addEventListener('click', () => showTab(''));

$('toggle').addEventListener('click', () => {
  state.incineratorOn = !state.incineratorOn;
});

const upgradeButtons = UPGRADES.map((u) => {
  const b = document.createElement('button');
  b.className = 'up';
  b.addEventListener('click', () => buyUpgrade(state, u.id));
  $(u.group === 'incinerator' ? 'incupgrades' : 'upgrades').appendChild(b);
  return { def: u, el: b };
});

$('debug').innerHTML = `<div id="speeds"></div><button id="bonus">+${DEBUG_CREDITS_BONUS} kreditů</button>`;
DEBUG_SPEEDS.forEach((sp) => {
  const b = document.createElement('button');
  b.textContent = `×${sp}`;
  b.addEventListener('click', () => (speed = sp));
  $('speeds').appendChild(b);
});
const resetBtn = document.createElement('button');
resetBtn.textContent = 'Smazat postup';
resetBtn.addEventListener('click', () => {
  if (confirm('Opravdu smazat celý postup a začít od nuly?')) {
    resetting = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* nic */
    }
    location.reload();
  }
});
$('debug').appendChild(resetBtn);
// Výkon: FPS a úsporná grafika (nižší rozlišení mapy a 30 snímků/s) pro slabší telefony
const LOWFX_KEY = 'watt-empire-lowfx';
const lowFx = (() => {
  try {
    return localStorage.getItem(LOWFX_KEY) === '1';
  } catch {
    return false;
  }
})();
const fpsEl = document.createElement('div');
fpsEl.className = 'row';
$('debug').appendChild(fpsEl);
const lowBtn = document.createElement('button');
lowBtn.textContent = lowFx ? '✔ Úsporná grafika zapnutá (vypnout)' : 'Úsporná grafika (zapnout)';
lowBtn.addEventListener('click', () => {
  try {
    localStorage.setItem(LOWFX_KEY, lowFx ? '0' : '1');
  } catch {
    /* nic */
  }
  location.reload();
});
$('debug').appendChild(lowBtn);
let fpsFrames = 0;
let fpsSince = performance.now();
$('bonus').addEventListener('click', () => (state.credits += DEBUG_CREDITS_BONUS));

function render(): void {
  $('questbang').style.display = state.doneQuests.length !== questsSeenCount && openTab !== 'quests' ? 'block' : 'none';
  renderBuildMenu();
  renderModebar();
  const s = state;
  const l = s.live;
  $('credits').textContent = `💰 ${Math.floor(s.credits)}`;
  {
    const n = l.incomePerSecond + l.overflowIncomePerSecond - l.wagePerSecond - l.dumpCostPerSecond - l.disposeCostPerSecond;
    $('income').textContent = `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}/s`;
  }
  $('energy').textContent = `⚡ ${fmt(l.productionMW)} MW`;
  $('power').textContent = `chce ${fmt(l.demandMW)} MW`;
  $('vo').textContent = `♻️ ${fmt(s.vo, 0)} VO`;
  $('vops').textContent = `+${fmt(l.voPerSecond)}/s`;

  const line = (name: string, value: string, cls = '') => `<div class="row ${cls}"><span>${name}</span><b>${value}</b></div>`;
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), 2)}/s`;
  const net = l.incomePerSecond + l.overflowIncomePerSecond - l.wagePerSecond - l.dumpCostPerSecond - l.disposeCostPerSecond;
  let detail = '';
  if (openStat === 'credits') {
    detail =
      line('Prodej energie městu (běžná cena)', `+${fmt(l.incomePerSecond + l.crisisLossPerSecond, 2)}/s`, 'plus') +
      (s.toxic ? line('☣️ Odpad na poli (město platí ' + Math.round(l.priceFactor * 100) + ' % ceny)', `−${fmt(l.crisisLossPerSecond, 2)}/s`, 'minus') : '') +
      line('Prodej přebytečného VO (plný sklad)', `+${fmt(l.overflowIncomePerSecond, 2)}/s`, 'plus') +
      line('Mzdy brigádníků', `−${fmt(l.wagePerSecond, 2)}/s`, 'minus') +
      line('Mařič přebytku', `−${fmt(l.dumpCostPerSecond, 2)}/s`, 'minus') +
      (s.toxic ? line('Likvidace odpadu', `−${fmt(l.disposeCostPerSecond, 2)}/s`, 'minus') : '') +
      line('Celkem', signed(net), 'total') +
      (s.toxic ? '<small>Čím míň odpadu leží na poli, tím víc město zaplatí. Odpad uskladni nebo zlikviduj.</small>' : '');
  } else if (openStat === 'energy') {
    const toBattery = Math.max(0, l.batteryFlowMW);
    const fromBattery = Math.max(0, -l.batteryFlowMW);
    detail =
      line('Výroba spalovny', `${fmt(l.productionMW)} MW`, 'plus') +
      (solarCapacityMW(s) > 0 ? line('☀️ Sluneční panely', `${fmt(l.solarMW)} / ${solarCapacityMW(s)} MW`, 'plus') : '') +
      line('Z baterie', `+${fmt(fromBattery)} MW`, fromBattery > 0.01 ? 'plus' : '') +
      line('Do baterie', `−${fmt(toBattery)} MW`, toBattery > 0.01 ? 'minus' : '') +
      line('Spálí mařič', `−${fmt(l.dumpedMW)} MW`, l.dumpedMW > 0.01 ? 'minus' : '') +
      line('Ztraceno (přetížení)', `−${fmt(l.wastedMW)} MW`, l.wastedMW > 0.01 ? 'minus' : '') +
      line('Dodáváme městu', `${fmt(l.deliveredMW)} MW`, 'total') +
      line('Město chce', `${fmt(l.demandMW)} MW`) +
      line('Vedení unese', `${lineCapacityMW(s)} MW`) +
      line('Baterie', `${fmt(s.battery)} / ${batteryCapacityMWh(s)} MWh`) +
      `<small>Dodáno celkem: ${fmt(s.delivered)} MWh</small>`;
  } else if (openStat === 'vo') {
    const voNet = l.voPerSecond - l.voBurnedPerSecond;
    detail =
      line('Brigádníci', `+${fmt(l.voPerSecond, 2)}/s`, 'plus') +
      line('Úklid ostrova (brigádníci)', `${fmt((s.upgrades.worker * 60) / LITTER_WORKER_CLEAN_SECONDS, 1)} hromádek/min`, 'plus') +
      line('Odpadu přibývá', `${fmt(60 / LITTER_RESPAWN_SECONDS, 1)} hromádek/min`, 'minus') +
      line('Ostrov', s.upgrades.worker * 60 / LITTER_WORKER_CLEAN_SECONDS >= 60 / LITTER_RESPAWN_SECONDS ? '✔ četa stíhá, odpad se na mapě neukazuje' : '✖ četa nestíhá, uklízej taky ručně') +
      line('Ruční třídění', `${s.taps} klepnutí, ${s.litterCleaned} hromádek`) +
      line('Spálí spalovna', `−${fmt(l.voBurnedPerSecond, 2)}/s`, 'minus') +
      line('Spalovna potřebuje', `${fmt(l.voNeedPerSecond, 2)}/s`) +
      line('Celkem (bez tapů)', signed(voNet), 'total') +
      line('Sklad', `${fmt(s.vo, 0)} / ${fmt(voStorageMax(s), 0)} VO`) +
      line('Cena VO navíc (nad sklad)', `${VO_OVERFLOW_PRICE} 💰 / VO`) +
      line('Prodej přebytku teď', `+${fmt(l.overflowIncomePerSecond, 2)} 💰/s`, l.overflowIncomePerSecond > 0.01 ? 'plus' : '') +
      `<small>Co se do skladu nevejde, se automaticky prodá.</small>`;
  }
  $('statdetail').innerHTML = detail ? `<div class="card detail">${detail}</div>` : '';

  const hh = Math.floor(s.hour).toString().padStart(2, '0');
  const mm = Math.floor((s.hour % 1) * 60).toString().padStart(2, '0');
  $('clock').textContent = `${isDay(s.hour) ? '☀️' : '🌙'} Den ${s.day} · ${hh}:${mm}`;
  const dayNight = isDay(s.hour) ? '<span class="day">☀️ den</span>' : '<span class="night">🌙 noc</span>';
  const bcap = batteryCapacityMWh(s);
  const range = cityDemandRangeMW(s);
  const overPct = Math.min(100, (s.overload / OVERLOAD_TOLERANCE_SECONDS) * 100);
  $('grid').innerHTML = `
    <div class="row"><span>Čas</span><b>Den ${s.day}, ${hh}:${mm} ${dayNight}</b></div>
    <div class="row"><span>Prestiž města</span><b>${prestige(s)}</b></div>
    <div class="row"><span>Spotřeba města</span><b>${fmt(l.demandMW)} MW</b></div>
    <div class="row"><span>${s.chapter >= 2 ? 'Odběr města (bere, co vedení unese)' : 'Smlouva (stálý odběr)'}</span><b>${s.chapter >= 2 ? fmt(range.max) + ' MW' : fmt(range.max) + ' MW, den i noc'}</b></div>
    <div class="row"><span>Autonomie</span><b class="${l.autonomous ? 'plus' : 'minus'}">${l.autonomous ? '✔ brigádníci stačí, nemusíš klikat' : '✖ chybí ' + fmt(Math.max(0, l.voNeedPerSecond - l.voPerSecond), 2) + ' VO/s'}</b></div>
    <div class="row"><span>VO: brigádníci dodají / spalovna potřebuje</span><b>${fmt(l.voPerSecond, 2)} / ${fmt(l.voNeedPerSecond, 2)} /s</b></div>
    ${l.autonomous ? '' : '<small>Najmi brigádníka, kup účinnost spalovny, nebo klepej na odpad.</small>'}
    <div class="row"><span>Výroba</span><b>${fmt(l.productionMW)} MW</b></div>
    <div class="row"><span>Dodáváme</span><b>${fmt(l.deliveredMW)} / ${lineCapacityMW(s)} MW (vedení)</b></div>
    <div class="row"><span>Baterie</span><b>${fmt(s.battery)} / ${bcap} MWh ${l.batteryFlowMW > 0.01 ? '⬆' : l.batteryFlowMW < -0.01 ? '⬇' : ''}</b></div>
    <div class="row"><span>Mařič (${dumpCapacityMW(s)} MW)</span><b>${fmt(l.dumpedMW)} MW</b></div>
    <div class="row"><span>Přetížení sítě</span><b>${fmt(l.wastedMW)} MW přebytek</b></div>
    <div class="bar red"><i style="width:${overPct}%"></i></div>`;

  let alerts = '';
  if (s.blackout > 0) alerts += `<div class="alert">⚫ BLACKOUT! Síť naběhne za ${Math.ceil(s.blackout)} s</div>`;
  else if (s.overload > 0.5) alerts += `<div class="alert warn">⚠️ Síť se přetěžuje! Kup mařič nebo baterii, nebo vypni spalovnu.</div>`;
  if (s.toxic && s.toxicField > 0.5) alerts += `<div class="alert warn">☣️ Na poli leží ${fmt(s.toxicField, 0)} j. odpadu, město platí jen ${Math.round(l.priceFactor * 100)} % ceny.</div>`;
  if (l.workersPaused) alerts += `<div class="alert warn">💸 Brigádníci stojí: nejsou peníze na mzdy.</div>`;
  $('alerts').innerHTML = alerts;

  const regulated = s.upgrades.regulator > 0;
  $('incstate').textContent = !s.incineratorOn
    ? '⏸ vypnutá'
    : s.incineratorRunning
      ? '🔥 vyrábí'
      : `⏳ čeká na VO (rozjede se při ${INCINERATOR_START_VO})`;
  $('incstock').textContent = `${fmt(s.vo, 0)} / ${fmt(voStorageMax(s), 0)} VO`;
  $('inclevel').textContent = `${fmt(incineratorNominalMW(s) * s.incineratorLevel)} / ${incineratorNominalMW(s)} MW${regulated ? ' 🤖 auto' : ''}`;
  $('toggle').textContent = s.incineratorOn ? '🔥 Spalovna zapnutá (klepni = vypnout)' : '⏸ Spalovna vypnutá (klepni = zapnout)';

  for (const { def, el } of upgradeButtons) {
    const lvl = s.upgrades[def.id];
    if (!isUnlocked(s, def.id)) {
      el.disabled = true;
      el.innerHTML = `<span>🔒 ${def.name}<small>Odemkne se ${def.unlock!.text}</small></span>`;
      continue;
    }
    const max = lvl >= def.maxLevel;
    const cost = upgradeCost(def.id, lvl);
    el.disabled = max || s.credits < cost;
    let desc = def.description;
    if (def.id === 'power' && !max) {
      const next = incineratorNominalMW(s) + INCINERATOR_POWER_STEP_MW;
      if (s.chapter < 2 && next > range.max) desc = `⚠️ Po koupi ${next} MW, ale město odebere jen ${fmt(range.max)} MW (smlouva).`;
      else if (next > lineCapacityMW(s)) desc = `⚠️ Po koupi ${next} MW, ale vedení unese jen ${lineCapacityMW(s)} MW. Potřebuješ dráty a trafo.`;
      else desc = s.chapter >= 2 ? `Po koupi ${next} MW. Vedení unese ${lineCapacityMW(s)} MW.` : `Po koupi ${next} MW z ${fmt(range.max)} MW smluvních.`;
    }
    if (def.id === 'efficiency' && !max) {
      const now = (incineratorNominalMW(s) * s.incineratorLevel / SECONDS_PER_GAME_HOUR) * voPerMWh(s, INCINERATOR_VO_PER_MWH);
      desc = `Stejný výkon za méně VO: spalovna spálí ${fmt(now, 2)} VO/s, po koupi ${fmt(now * EFFICIENCY_VO_FACTOR, 2)} VO/s.`;
    }
    if (def.id === 'worker') {
      const need = l.voNeedPerSecond;
      const have = lvl * WORKER_VO_PER_SECOND;
      const after = (lvl + 1) * WORKER_VO_PER_SECOND;
      desc += `<br>⚙️ Autonomie výroby: ${fmt(have, 1)} / ${fmt(need, 1)} VO/s ${have >= need ? '✔' : '✖'}${max ? '' : `, po koupi ${fmt(after, 1)}`}` +
        `<br>🧹 Autonomie úklidu: ${lvl} / ${LITTER_CREW_SIZE} brigádníků ${lvl >= LITTER_CREW_SIZE ? '✔ ostrov je čistý' : '✖ odpad na mapě přibývá'}`;
    }
    el.innerHTML = `<span>${def.name} (úr. ${lvl})<small>${desc}</small></span><span>${max ? 'MAX' : `💰 ${cost}`}</span>`;
  }

  // Zprávy od starosty (posledních 8, nejnovější nahoře)
  $('mayorlog').innerHTML =
    s.story
      .slice(-8)
      .reverse()
      .map((id) => storyText(id))
      .filter((x): x is string => !!x)
      .map((x) => `<p class="mayor-msg">${MAYOR_AVATAR} ${x}</p>`)
      .join('') || '<small>Zatím žádné zprávy.</small>';

  // Odpad (od kapitoly 2) a důvěra veřejnosti (od kapitoly 3)
  let waste = '';
  if (s.toxic) {
    waste +=
      line('☣️ Odpad na poli', `${fmt(s.toxicField, 0)} / ${TOXIC_FIELD_FULL} j.`, s.toxicField > 0.5 ? 'minus' : 'plus') +
      line('Sklad odpadu', `${fmt(s.toxicStored, 0)} / ${storageCapacity(s)} j.`) +
      line('Cena energie', `${Math.round(l.priceFactor * 100)} % (odpad na poli ji snižuje${s.chapter >= 3 ? ', důvěra zvedá' : ''})`, l.priceFactor < 0.999 ? 'minus' : 'plus') +
      line('Likvidace', `${fmt(l.disposePerSecond, 2)} / ${fmt(disposeRate(s), 1)} j/s · ${fmt(l.disposeCostPerSecond, 2)} 💰/s`) +
      line('Zlikvidováno celkem', `${fmt(s.toxicDisposed, 0)} j.`);
  }
  if (s.chapter >= 3) {
    waste +=
      line('☀️ Sluneční panely', `${fmt(l.solarMW)} / ${solarCapacityMW(s)} MW (jen ve dne)`) +
      line('🤝 Důvěra veřejnosti', `${fmt(s.trust, 0)} %`) +
      `<div class="bar trust"><i style="width:${Math.round(s.trust)}%"></i></div>`;
  }
  $('waste').innerHTML = waste ? `<div class="card">${waste}</div>` : '';

  const mainQuests = QUESTS.filter((q) => !q.ongoing && (q.chapter ?? 1) === s.chapter);
  const mainDone = mainQuests.filter((q) => s.doneQuests.includes(q.id)).length;
  const finalDone = s.chapter === MAX_CHAPTER && chapterDone(MAX_CHAPTER);
  $('ending').innerHTML = finalDone
    ? `<div class="card ending"><b>🏁 Konec kapitoly ${MAX_CHAPTER}</b><p>${CHAPTER_END_TEXT[MAX_CHAPTER]}</p></div>`
    : '';

  const questRow = (q: (typeof QUESTS)[number]) => {
    const p = Math.min(q.target, questProgress(s, q));
    return `<div class="row quest"><span>${q.text}</span><span>${fmt(p, 0)}/${q.target} (+${q.reward}💰)</span></div>`;
  };

  // nejdřív nesplněné úkoly aktuální kapitoly, pak případné nedokončené z dřívějších
  const leftovers = QUESTS.filter((q) => !q.ongoing && (q.chapter ?? 1) < s.chapter && !s.doneQuests.includes(q.id));
  const open = [...mainQuests.filter((q) => !s.doneQuests.includes(q.id)), ...leftovers];
  const shown = open.slice(0, QUESTS_VISIBLE);
  $('quests').innerHTML =
    `<div class="row"><b>Kapitola ${s.chapter}: ${CHAPTER_TITLES[s.chapter]}</b></div>` +
    `<div class="row"><span>Splněno</span><b>${mainDone} / ${mainQuests.length}</b></div>` +
    shown.map(questRow).join('') +
    (open.length > shown.length ? `<small>…a ${open.length - shown.length} dalších úkolů se odemkne postupně.</small>` : '');

  // Průběžné úkoly: dál vylepšovat; ukáží se jen ty, jejichž vylepšení už je odemčené
  const ongoing = QUESTS.filter(
    (q) => q.ongoing && !s.doneQuests.includes(q.id) && (!q.upgrade || isUnlocked(s, q.upgrade)),
  );
  const ongoingDone = QUESTS.filter((q) => q.ongoing && s.doneQuests.includes(q.id)).length;
  const ongoingTotal = QUESTS.filter((q) => q.ongoing).length;
  const ongoingUnlocked = s.doneQuests.includes(ONGOING_UNLOCK_QUEST);
  $('ongoing').innerHTML = !ongoingUnlocked
    ? '<small>Odemknou se po úkolu „Dosáhni autonomie“.</small>'
    : `<div class="row"><span>Splněno</span><b>${ongoingDone} / ${ongoingTotal}</b></div>` +
      ongoing.slice(0, ONGOING_QUESTS_VISIBLE).map(questRow).join('');
}

// Mapa (Phaser): jen čte stav hry, nic v simulaci nemění
createMap($('map'), () => ({
  incineratorOn: state.incineratorOn,
  incineratorRunning: state.incineratorRunning,
  productionMW: state.live.productionMW,
  nominalMW: incineratorNominalMW(state),
  deliveredMW: state.live.deliveredMW,
  demandMW: state.live.demandMW,
  lineMW: lineCapacityMW(state),
  vo: state.vo,
  voMax: voStorageMax(state),
  incomePerSecond: state.live.incomePerSecond + state.live.overflowIncomePerSecond - state.live.wagePerSecond - state.live.dumpCostPerSecond,
  isNight: !isDay(state.hour),
  toxic: state.toxic,
  toxicField: state.toxicField,
  toxicFieldFull: TOXIC_FIELD_FULL,
  toxicStored: state.toxicStored,
  storageCap: storageCapacity(state),
  solarLevel: state.upgrades.solar,
  solarMW: state.live.solarMW,
  solarCapMW: solarCapacityMW(state),
  litter: state.litter,
  unlocked: state.unlockedParcels,
  buildings: state.buildings.map((b, i) => {
    const d = buildingDef(b.type);
    return { type: b.type, x: b.x, y: b.y, w: d.w, h: d.h, emoji: d.emoji, color: d.color, connected: networkInfo(state).connected[i] ?? true };
  }),
  mode: mode.kind,
  ghost: mode.kind === 'build' ? { w: buildingDef(mode.type).w, h: buildingDef(mode.type).h, valid: (x: number, y: number) => canPlace(state, (mode as { type: BuildingType }).type, x, y) === 'ok' } : null,
  freeTile: (x: number, y: number) =>
    isUnlockedTile(state.unlockedParcels, x, y) && isBuildableTile(x, y) && !state.buildings.some((b) => footprint(b).some((t) => t.x === x && t.y === y)),
  purchasable: purchasableParcels(state),
  parcelCost: parcelCost(state),
}), (x, y) => collectLitter(state, x, y), onTileTap);

// Herní smyčka: simulace v pevných tících, vykreslení hladce
let last = performance.now();
let lastRender = 0;
const RENDER_EVERY_MS = 100; // texty a menu stačí překreslit 10× za sekundu
let acc = 0;
function frame(now: number): void {
  fpsFrames++;
  if (now - fpsSince >= 1000) {
    fpsEl.innerHTML = `<span>Snímků za sekundu</span><b>${Math.round((fpsFrames * 1000) / (now - fpsSince))} FPS${lowFx ? ' (úsporná grafika)' : ''}</b>`;
    fpsFrames = 0;
    fpsSince = now;
  }
  acc += Math.min(0.5, (now - last) / 1000) * speed;
  last = now;
  while (acc >= TICK_DT) {
    tick(state);
    acc -= TICK_DT;
  }
  announceQuests();
  announceNewQuests();
  announceCrisis();
  announceChapter();
  updateTutorial();
  announceStory();
  if (now - lastRender >= RENDER_EVERY_MS) {
    lastRender = now;
    render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
