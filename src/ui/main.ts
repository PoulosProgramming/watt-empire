import './style.css';
import {
  DEBUG_CREDITS_BONUS,
  DEBUG_SPEEDS,
  INCINERATOR_START_VO,
  TOXIC_INCOME_FACTOR,
  OVERLOAD_TOLERANCE_SECONDS,
  QUESTS,
  UPGRADES,
} from '../sim/balance';
import { isDay } from '../sim/daynight';
import { buyUpgrade, tap, upgradeCost } from '../sim/economy';
import { TICK_DT, tick } from '../sim/game';
import { batteryCapacityMWh, dumpCapacityMW, incineratorNominalMW, lineCapacityMW, prestige } from '../sim/power';
import { questProgress } from '../sim/quests';
import { newGame } from '../sim/state';

const state = newGame();
let speed = 1;
const fmt = (n: number, d = 1) => n.toFixed(d);

const app = document.getElementById('app')!;
app.innerHTML = `
  <div class="stats">
    <div class="stat"><b id="credits"></b><small id="income"></small></div>
    <div class="stat"><b id="energy"></b><small id="power"></small></div>
    <div class="stat"><b id="vo"></b><small id="vops"></small></div>
  </div>
  <div id="alerts"></div>
  <details class="card help" open>
    <summary>❓ Jak na to</summary>
    <p>♻️ <b>VO</b> (vytříděný odpad) pálí spalovna a vyrábí z něj ⚡ elektřinu. Město ji kupuje za 💰.</p>
    <p>Začni klepáním na odpad, pak najmi brigádníky. Spalovna se rozjede, až má ve skladu dost VO. Zatím běží na malý výkon, takže se nic nepřetíží.</p>
    <p>Za kredity zvyšuj <b>výkon</b>. Pozor: <b>v noci město bere málo</b>. Přebytek pak odvede 🔥 mařič (stojí peníze) nebo ho uloží 🔋 baterie. Když se přebytek nevejde nikam, síť se přetíží a přijde ⚫ blackout.</p>
  </details>
  <button class="tap" id="tap">♻️ Třídit odpad (+1 VO)</button>

  <h2>Síť</h2>
  <div class="card" id="grid"></div>

  <h2>Spalovna</h2>
  <div class="card">
    <div class="row"><span>Stav</span><b id="incstate"></b></div>
    <div class="row"><span>Sklad VO</span><b id="incstock"></b></div>
    <div class="row"><span>Výkon</span><b id="inclevel"></b></div>
    <button id="toggle" style="width:100%;margin-top:6px"></button>
  </div>

  <h2>Vylepšení</h2>
  <div id="upgrades"></div>

  <h2>Úkoly</h2>
  <div class="card" id="quests"></div>

  <h2>Ladění</h2>
  <div class="card debug" id="debug"></div>
`;

const $ = (id: string) => document.getElementById(id)!;

$('tap').addEventListener('click', () => tap(state));
$('toggle').addEventListener('click', () => {
  state.incineratorOn = !state.incineratorOn;
});

const upgradeButtons = UPGRADES.map((u) => {
  const b = document.createElement('button');
  b.className = 'up';
  b.addEventListener('click', () => buyUpgrade(state, u.id));
  $('upgrades').appendChild(b);
  return { def: u, el: b };
});

$('debug').innerHTML = `<div id="speeds"></div><button id="bonus">+${DEBUG_CREDITS_BONUS} kreditů</button>`;
DEBUG_SPEEDS.forEach((sp) => {
  const b = document.createElement('button');
  b.textContent = `×${sp}`;
  b.addEventListener('click', () => (speed = sp));
  $('speeds').appendChild(b);
});
$('bonus').addEventListener('click', () => (state.credits += DEBUG_CREDITS_BONUS));

function render(): void {
  const s = state;
  const l = s.live;
  $('credits').textContent = `💰 ${Math.floor(s.credits)}`;
  $('income').textContent = `+${fmt(l.incomePerSecond)}/s`;
  $('energy').textContent = `⚡ ${fmt(s.delivered)} MWh`;
  $('power').textContent = `${fmt(l.deliveredMW)} MW`;
  $('vo').textContent = `♻️ ${fmt(s.vo, 0)} VO`;
  $('vops').textContent = `+${fmt(l.voPerSecond)}/s`;

  const hh = Math.floor(s.hour).toString().padStart(2, '0');
  const mm = Math.floor((s.hour % 1) * 60).toString().padStart(2, '0');
  const dayNight = isDay(s.hour) ? '<span class="day">☀️ den</span>' : '<span class="night">🌙 noc</span>';
  const bcap = batteryCapacityMWh(s);
  const overPct = Math.min(100, (s.overload / OVERLOAD_TOLERANCE_SECONDS) * 100);
  $('grid').innerHTML = `
    <div class="row"><span>Čas</span><b>Den ${s.day}, ${hh}:${mm} ${dayNight}</b></div>
    <div class="row"><span>Prestiž města</span><b>${prestige(s)}</b></div>
    <div class="row"><span>Spotřeba města</span><b>${fmt(l.demandMW)} MW</b></div>
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
    const max = lvl >= def.maxLevel;
    const cost = upgradeCost(def.id, lvl);
    el.disabled = max || s.credits < cost;
    el.innerHTML = `<span>${def.name} (úr. ${lvl})<small>${def.description}</small></span><span>${max ? 'MAX' : `💰 ${cost}`}</span>`;
  }

  $('quests').innerHTML = QUESTS.map((q) => {
    const done = s.doneQuests.includes(q.id);
    const p = Math.min(q.target, questProgress(s, q));
    return `<div class="row quest ${done ? 'done' : ''}"><span>${q.text}</span><span>${done ? '✔' : `${fmt(p, 0)}/${q.target} (+${q.reward}💰)`}</span></div>`;
  }).join('');
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
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
