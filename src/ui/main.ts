import './style.css';
import {
  AUTOSAVE_SECONDS,
  DEBUG_CREDITS_BONUS,
  DEBUG_SPEEDS,
  INCINERATOR_POWER_STEP_MW,
  INCINERATOR_START_VO,
  TOXIC_INCOME_FACTOR,
  OVERLOAD_TOLERANCE_SECONDS,
  QUESTS,
  QUESTS_VISIBLE,
  STORY_CHAPTER_END,
  STORY_INTRO,
  TOAST_SECONDS,
  UPGRADES,
} from '../sim/balance';
import { isDay } from '../sim/daynight';
import { buyUpgrade, isUnlocked, tap, upgradeCost } from '../sim/economy';
import { TICK_DT, tick } from '../sim/game';
import { batteryCapacityMWh, cityDemandRangeMW, dumpCapacityMW, incineratorNominalMW, lineCapacityMW, prestige } from '../sim/power';
import { questProgress } from '../sim/quests';
import { deserialize, serialize } from '../sim/save';
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
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    /* nejde uložit, hra běží dál */
  }
}
const state = loadSaved() ?? newGame();
setInterval(saveNow, AUTOSAVE_SECONDS * 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});
window.addEventListener('pagehide', saveNow);
let speed = 1;
const fmt = (n: number, d = 1) => n.toFixed(d);

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="sticky"><div class="stats">
    <button class="stat" data-stat="credits"><b id="credits"></b><small id="income"></small></button>
    <button class="stat" data-stat="energy"><b id="energy"></b><small id="power"></small></button>
    <button class="stat" data-stat="vo"><b id="vo"></b><small id="vops"></small></button>
  </div>
  <div id="statdetail"></div></div>
  <div id="alerts"></div>
  <div class="card story">📖 ${STORY_INTRO}</div>
  <div id="ending"></div>
  <details class="card help" open>
    <summary>❓ Jak na to</summary>
    <p>♻️ <b>VO</b> (vytříděný odpad) pálí spalovna a vyrábí z něj ⚡ elektřinu. Město ji kupuje za 💰.</p>
    <p>Začni klepáním na odpad, pak najmi brigádníky. Spalovna se rozjede, až má ve skladu dost VO. Zatím běží na malý výkon, takže se nic nepřetíží.</p>
    <p>Za kredity zvyšuj <b>výkon</b>. Pozor: <b>v noci město bere málo</b>. Přebytek pak odvede 🔥 mařič (stojí peníze) nebo ho uloží 🔋 baterie. Když se přebytek nevejde nikam, síť se přetíží a přijde ⚫ blackout.</p>
  </details>
  <button class="tap" id="tap">♻️ Třídit odpad (+1 VO)</button>

  <h2>Spalovna</h2>
  <div class="card">
    <div class="row"><span>Stav</span><b id="incstate"></b></div>
    <div class="row"><span>Sklad VO</span><b id="incstock"></b></div>
    <div class="row"><span>Výkon</span><b id="inclevel"></b></div>
    <button id="toggle" style="width:100%;margin-top:6px"></button>
  </div>

  <div id="incupgrades"></div>

  <h2>Vylepšení</h2>
  <div id="upgrades"></div>

  <h2>Úkoly</h2>
  <div class="card" id="quests"></div>

  <details class="card netdetail">
    <summary>🔌 Síť (podrobnosti)</summary>
    <div id="grid"></div>
  </details>

  <h2>Ladění</h2>
  <div class="card debug" id="debug"></div>
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
function announceQuests(): void {
  for (const q of QUESTS) {
    if (state.doneQuests.includes(q.id) && !seenQuests.has(q.id)) {
      seenQuests.add(q.id);
      showToast(`✅ <b>Úkol splněn!</b><br>${q.text}<br><b>+${q.reward} 💰</b>`);
    }
  }
}

const $ = (id: string) => document.getElementById(id)!;

$('tap').addEventListener('click', () => tap(state));
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
$('bonus').addEventListener('click', () => (state.credits += DEBUG_CREDITS_BONUS));

function render(): void {
  const s = state;
  const l = s.live;
  $('credits').textContent = `💰 ${Math.floor(s.credits)}`;
  {
    const n = l.incomePerSecond - l.wagePerSecond - l.dumpCostPerSecond;
    $('income').textContent = `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}/s`;
  }
  $('energy').textContent = `⚡ ${fmt(l.productionMW)} MW`;
  $('power').textContent = `chce ${fmt(l.demandMW)} MW`;
  $('vo').textContent = `♻️ ${fmt(s.vo, 0)} VO`;
  $('vops').textContent = `+${fmt(l.voPerSecond)}/s`;

  const line = (name: string, value: string, cls = '') => `<div class="row ${cls}"><span>${name}</span><b>${value}</b></div>`;
  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n), 2)}/s`;
  const net = l.incomePerSecond - l.wagePerSecond - l.dumpCostPerSecond;
  let detail = '';
  if (openStat === 'credits') {
    detail =
      line('Prodej energie městu (běžná cena)', `+${fmt(l.incomePerSecond + l.crisisLossPerSecond, 2)}/s`, 'plus') +
      (s.toxic ? line('☣️ Ekologická krize (město platí jen ' + Math.round(TOXIC_INCOME_FACTOR * 100) + ' %)', `−${fmt(l.crisisLossPerSecond, 2)}/s`, 'minus') : '') +
      line('Mzdy brigádníků', `−${fmt(l.wagePerSecond, 2)}/s`, 'minus') +
      line('Mařič přebytku', `−${fmt(l.dumpCostPerSecond, 2)}/s`, 'minus') +
      line('Celkem', signed(net), 'total') +
      (s.toxic ? '<small>Krizi vyřeší až kapitola 2 (likvidátor odpadu).</small>' : '');
  } else if (openStat === 'energy') {
    const toBattery = Math.max(0, l.batteryFlowMW);
    const fromBattery = Math.max(0, -l.batteryFlowMW);
    detail =
      line('Výroba spalovny', `${fmt(l.productionMW)} MW`, 'plus') +
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
      line('Ruční třídění', `${s.taps} tapů celkem`) +
      line('Spálí spalovna', `−${fmt(l.voBurnedPerSecond, 2)}/s`, 'minus') +
      line('Spalovna potřebuje', `${fmt(l.voNeedPerSecond, 2)}/s`) +
      line('Autonomie', l.autonomous ? '✔ brigádníci stačí, nemusíš klikat' : `✖ chybí ${fmt(Math.max(0, l.voNeedPerSecond - l.voPerSecond), 2)} VO/s (najmi brigádníka, kup účinnost nebo klikej)`, l.autonomous ? 'plus' : 'minus') +
      line('Celkem (bez tapů)', signed(voNet), 'total') +
      line('Sklad', `${fmt(s.vo, 0)} VO`);
  }
  $('statdetail').innerHTML = detail ? `<div class="card detail">${detail}</div>` : '';

  const hh = Math.floor(s.hour).toString().padStart(2, '0');
  const mm = Math.floor((s.hour % 1) * 60).toString().padStart(2, '0');
  const dayNight = isDay(s.hour) ? '<span class="day">☀️ den</span>' : '<span class="night">🌙 noc</span>';
  const bcap = batteryCapacityMWh(s);
  const range = cityDemandRangeMW(s);
  const overPct = Math.min(100, (s.overload / OVERLOAD_TOLERANCE_SECONDS) * 100);
  $('grid').innerHTML = `
    <div class="row"><span>Čas</span><b>Den ${s.day}, ${hh}:${mm} ${dayNight}</b></div>
    <div class="row"><span>Prestiž města</span><b>${prestige(s)}</b></div>
    <div class="row"><span>Spotřeba města</span><b>${fmt(l.demandMW)} MW</b></div>
    <div class="row"><span>Rozsah spotřeby</span><b>${fmt(range.min)} (noc) – ${fmt(range.max)} MW (poledne)</b></div>
    <div class="row"><span>Výroba</span><b>${fmt(l.productionMW)} MW</b></div>
    <div class="row"><span>Dodáváme</span><b>${fmt(l.deliveredMW)} / ${lineCapacityMW(s)} MW (vedení)</b></div>
    <div class="row"><span>Baterie</span><b>${fmt(s.battery)} / ${bcap} MWh ${l.batteryFlowMW > 0.01 ? '⬆' : l.batteryFlowMW < -0.01 ? '⬇' : ''}</b></div>
    <div class="row"><span>Mařič (${dumpCapacityMW(s)} MW)</span><b>${fmt(l.dumpedMW)} MW</b></div>
    <div class="row"><span>Přetížení sítě</span><b>${fmt(l.wastedMW)} MW přebytek</b></div>
    <div class="bar red"><i style="width:${overPct}%"></i></div>`;

  let alerts = '';
  if (s.blackout > 0) alerts += `<div class="alert">⚫ BLACKOUT! Síť naběhne za ${Math.ceil(s.blackout)} s</div>`;
  else if (s.overload > 0.5) alerts += `<div class="alert warn">⚠️ Síť se přetěžuje! Kup mařič nebo baterii, nebo vypni spalovnu.</div>`;
  if (s.toxic) alerts += `<div class="alert warn">☣️ Ekologická krize! Spalovna vyplivla toxický odpad, město platí jen ${Math.round(TOXIC_INCOME_FACTOR * 100)} %. Řešení přijde v kapitole 2.</div>`;
  if (l.workersPaused) alerts += `<div class="alert warn">💸 Brigádníci stojí: nejsou peníze na mzdy.</div>`;
  $('alerts').innerHTML = alerts;

  const regulated = s.upgrades.regulator > 0;
  $('incstate').textContent = !s.incineratorOn
    ? '⏸ vypnutá'
    : s.incineratorRunning
      ? '🔥 vyrábí'
      : `⏳ čeká na VO (rozjede se při ${INCINERATOR_START_VO})`;
  $('incstock').textContent = `${fmt(s.vo, 0)} VO`;
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
      if (next > range.max) desc = `⚠️ Po koupi ${next} MW, ale město vezme nejvýš ${fmt(range.max)} MW. Zbytek by se zbytečně pálil.`;
      else if (next > lineCapacityMW(s)) desc = `⚠️ Po koupi ${next} MW, ale vedení unese jen ${lineCapacityMW(s)} MW. Potřebuješ dráty.`;
      else if (next > range.min) desc = `Po koupi ${next} MW. Město v noci bere jen ${fmt(range.min)} MW, přebytek ${fmt(next - range.min)} MW pak potřebuje mařič nebo baterii.`;
      else desc = `Po koupi ${next} MW. Město ho vždy vezme (v noci aspoň ${fmt(range.min)} MW).`;
    }
    el.innerHTML = `<span>${def.name} (úr. ${lvl})<small>${desc}</small></span><span>${max ? 'MAX' : `💰 ${cost}`}</span>`;
  }

  const chapterDone = QUESTS.every((q) => s.doneQuests.includes(q.id));
  $('ending').innerHTML = chapterDone
    ? `<div class="card ending"><b>🏁 Konec kapitoly 1</b><p>${STORY_CHAPTER_END}</p></div>`
    : '';

  const open = QUESTS.filter((q) => !s.doneQuests.includes(q.id));
  const shown = open.slice(0, QUESTS_VISIBLE);
  $('quests').innerHTML =
    `<div class="row"><span>Splněno</span><b>${s.doneQuests.length} / ${QUESTS.length}</b></div>` +
    shown
      .map((q) => {
        const p = Math.min(q.target, questProgress(s, q));
        return `<div class="row quest"><span>${q.text}</span><span>${fmt(p, 0)}/${q.target} (+${q.reward}💰)</span></div>`;
      })
      .join('') +
    (open.length > shown.length ? `<small>…a ${open.length - shown.length} dalších úkolů se odemkne postupně.</small>` : '');
}

// Herní smyčka: simulace v pevných tících, vykreslení hladce
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  acc += Math.min(0.5, (now - last) / 1000) * speed;
  last = now;
  while (acc >= TICK_DT) {
    tick(state);
    acc -= TICK_DT;
  }
  announceQuests();
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
