import Phaser from 'phaser';
import {
  LITTER_CLICKS,
  MAP_CITY_TILE,
  MAP_DRAG_THRESHOLD_PX,
  MAP_GRID_SIZE,
  MAP_INCINERATOR_TILE,
  MAP_SOLAR_TILE,
  MAP_TILE_PX,
  MAP_WASTE_SPOTS,
  MAP_ZOOM_MAX,
  MAP_ZOOM_START,
} from '../sim/balance';
import { wireTiles } from '../sim/mapdata';

// Co mapa potřebuje vědět o hře (jen čtení, simulace zůstává bez grafiky)
export interface MapView {
  incineratorOn: boolean;
  incineratorRunning: boolean;
  productionMW: number;
  nominalMW: number; // nejvyšší výkon spalovny
  deliveredMW: number;
  demandMW: number; // smluvní odběr města
  lineMW: number; // propustnost vedení
  vo: number;
  voMax: number;
  incomePerSecond: number;
  isNight: boolean;
  toxic: boolean; // krize už začala
  toxicField: number; // odpad na poli
  toxicFieldFull: number; // při kolika jednotkách je pole „plné“ (město platí nejméně)
  toxicStored: number;
  storageCap: number;
  solarLevel: number; // úroveň sluneční elektrárny (0 = nemáme)
  solarMW: number; // výkon panelů právě teď
  solarCapMW: number; // nejvyšší výkon panelů
  litter: { x: number; y: number; left: number }[]; // odpad rozsetý po mapě
}

// Výsledek klepnutí na odpad (null = nic tam nebylo)
export type CollectFn = (x: number, y: number) => { removed: boolean; left: number } | null;

const LITTER_ICONS = ['🥤', '📦', '🗑️', '🍾', '🛢️', '🥫'];

const WASTE_SPOTS = MAP_WASTE_SPOTS;
const SOLAR_TILE = MAP_SOLAR_TILE;

const T = MAP_TILE_PX;
const N = MAP_GRID_SIZE;
const WORLD = N * T;

// Barvy (zatím jen jednoduché čtverce a emoji místo grafiky)
const COLORS = {
  water: 0x0b3b5c,
  landA: 0x6b7d4f,
  landB: 0x62744a,
  shore: 0xb5a06a,
  incinerator: 0xd9531e,
  incineratorIdle: 0x7a2e12,
  incineratorOff: 0x555a60,
  city: 0x4b6cb7,
  wire: 0xffd23f,
  wireDim: 0x6b5a1e,
};

class MapScene extends Phaser.Scene {
  private getView!: () => MapView;
  private nightEl!: HTMLElement;
  private dpr = 1;
  private incinerator!: Phaser.GameObjects.Rectangle;
  private incineratorLabel!: Phaser.GameObjects.Text;
  private cityLabel!: Phaser.GameObjects.Text;
  private wireLabel!: Phaser.GameObjects.Text;
  private wasteObjs: Phaser.GameObjects.GameObject[][] = [];
  private solarObjs: Phaser.GameObjects.GameObject[] = [];
  private solarLabel!: Phaser.GameObjects.Text;
  private wire!: Phaser.GameObjects.Graphics;
  private onCollect!: CollectFn;
  private litterObjs = new Map<string, { box: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Text }>();
  private litterSynced = false; // první vykreslení bez „vyskakování“
  private lastLitter: { x: number; y: number; left: number }[] = [];
  private pinchedAt = 0;
  private dragging = false;
  private pinching = false;
  private pinchLast = 0;
  private minZoom = 0.5;

  constructor() {
    super('map');
  }

  init(data: { getView: () => MapView; onCollect: CollectFn; nightEl: HTMLElement; dpr: number }): void {
    this.getView = data.getView;
    this.onCollect = data.onCollect;
    this.nightEl = data.nightEl;
    this.dpr = data.dpr;
  }

  create(): void {
    this.drawGround();
    this.wire = this.add.graphics();
    this.drawBuildings();

    const cam = this.cameras.main;
    const pad = WORLD * 0.5; // kolem ostrova je jen voda, ať jde oddálit a vidět celý ostrov
    cam.setBounds(-pad, -pad, WORLD + 2 * pad, WORLD + 2 * pad);
    this.applyMinZoom();
    cam.setZoom(Math.max(this.minZoom, MAP_ZOOM_START * this.dpr));
    const a = MAP_INCINERATOR_TILE;
    cam.centerOn((a.x + 1) * T, (a.y + 1) * T);

    this.scale.on('resize', () => {
      this.applyMinZoom();
      cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZoom, MAP_ZOOM_MAX * this.dpr));
    });

    this.setupInput();

    // Ladicí háček pro testy v prohlížeči (jen čtení)
    (window as unknown as { __wattMap?: unknown }).__wattMap = {
      zoom: () => cam.zoom,
      litter: () => this.lastLitter,
      // střed dlaždice na obrazovce (CSS pixely vůči plátnu), pro ruční testy
      tileScreen: (x: number, y: number) => ({
        x: (((x + 0.5) * T - cam.worldView.x) * cam.zoom) / this.dpr,
        y: (((y + 0.5) * T - cam.worldView.y) * cam.zoom) / this.dpr,
      }),
    };
  }

  // Nejmenší zoom = celý ostrov se právě vejde (i s trochou vody kolem), dál oddálit nejde
  private applyMinZoom(): void {
    this.minZoom = Math.max(Math.min(this.scale.width, this.scale.height) / (WORLD * 1.1), 0.1);
  }

  private drawGround(): void {
    const g = this.add.graphics();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
        const nearEdge = x === 1 || y === 1 || x === N - 2 || y === N - 2;
        const color = edge ? COLORS.water : nearEdge ? COLORS.shore : (x + y) % 2 === 0 ? COLORS.landA : COLORS.landB;
        g.fillStyle(color, 1);
        g.fillRect(x * T, y * T, T, T);
      }
    }
  }

  // Ostré emoji i při velkém přiblížení: textura s vysokým rozlišením
  private icon(x: number, y: number, emoji: string, sizeTiles: number): void {
    this.add
      .text(x, y, emoji, { fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: `${T * sizeTiles}px` })
      .setOrigin(0.5)
      .setResolution(Math.min(8, MAP_ZOOM_MAX * this.dpr));
  }

  // Popisek má stále stejnou velikost na obrazovce (nezávisle na přiblížení)
  private label(): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, '', {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#0b1220dd',
        padding: { x: 6, y: 4 },
        align: 'center',
        lineSpacing: 2,
      })
      .setOrigin(0.5, 1)
      .setResolution(this.dpr * 2)
      .setDepth(10);
  }

  private drawBuildings(): void {
    const a = MAP_INCINERATOR_TILE;
    this.incinerator = this.add
      .rectangle(a.x * T, a.y * T, T * 2, T * 2, COLORS.incinerator)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5);
    this.icon((a.x + 1) * T, (a.y + 1) * T, '🏭', 1.4);
    this.incineratorLabel = this.label();

    const c = MAP_CITY_TILE;
    this.add.rectangle(c.x * T, c.y * T, T * 3, T * 3, COLORS.city).setOrigin(0).setStrokeStyle(2, 0x000000, 0.5);
    this.icon((c.x + 1.5) * T, (c.y + 1.5) * T, '🏙️', 1.8);
    this.cityLabel = this.label();
    this.wireLabel = this.label();

    // Hromady toxického odpadu kolem spalovny (ukážou se po krizi podle toho, kolik ho leží na poli)
    for (const spot of WASTE_SPOTS) {
      const box = this.add.rectangle(spot.x * T, spot.y * T, T, T, 0x5b2a86, 0.85).setOrigin(0).setVisible(false);
      const mark = this.add
        .text((spot.x + 0.5) * T, (spot.y + 0.5) * T, '☣️', { fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: `${T * 0.8}px` })
        .setOrigin(0.5)
        .setResolution(Math.min(8, MAP_ZOOM_MAX * this.dpr))
        .setVisible(false);
      this.wasteObjs.push([box, mark]);
    }

    // Sluneční panely (ukážou se, když je máme)
    const sol = SOLAR_TILE;
    const panel = this.add.rectangle(sol.x * T, sol.y * T, T * 4, T * 2, 0x2b4f9e).setOrigin(0).setStrokeStyle(2, 0x000000, 0.5).setVisible(false);
    const sun = this.add
      .text((sol.x + 2) * T, (sol.y + 1) * T, '☀️', { fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: `${T * 1.2}px` })
      .setOrigin(0.5)
      .setResolution(Math.min(8, MAP_ZOOM_MAX * this.dpr))
      .setVisible(false);
    this.solarObjs = [panel, sun];
    this.solarLabel = this.label().setVisible(false);
  }

  // Posun až po pohybu prstu (ne při prostém klepnutí). Přiblížení dvěma prsty čteme přímo
  // z dotykových událostí prohlížeče (spolehlivější než přiřazení prstů ve hře), kolečko na PC.
  private setupInput(): void {
    const cam = this.cameras.main;
    const el = this.game.canvas;
    const maxZoom = MAP_ZOOM_MAX * this.dpr;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length >= 2) {
          this.pinching = true;
          this.pinchLast = dist(e.touches);
        }
      },
      { passive: false },
    );
    el.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length < 2) return;
        e.preventDefault();
        const d = dist(e.touches);
        // roztahování prstů (d roste) = přiblížení, sevření = oddálení
        if (this.pinchLast > 0 && d > 0) cam.setZoom(Phaser.Math.Clamp(cam.zoom * (d / this.pinchLast), this.minZoom, maxZoom));
        this.pinchLast = d;
        this.pinching = true;
        this.pinchedAt = performance.now();
      },
      { passive: false },
    );
    const end = (e: TouchEvent) => {
      if (e.touches.length < 2) this.pinchLast = 0;
      if (e.touches.length === 0) this.pinching = false; // posun až po zvednutí všech prstů, ať mapa neskočí
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);

    this.input.on('pointerdown', () => {
      this.dragging = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pinching || !p.isDown) return;
      if (!this.dragging) {
        const moved = Phaser.Math.Distance.Between(p.x, p.y, p.downX, p.downY);
        if (moved < MAP_DRAG_THRESHOLD_PX * this.dpr) return;
        this.dragging = true;
      }
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    // Klepnutí (ne tažení, ne přiblížení) na odpad: vytřídí 1 VO, po LITTER_CLICKS klepnutích hromádka zmizí
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pinchLast = 0;
      if (this.dragging || this.pinching || performance.now() - this.pinchedAt < 350) return;
      this.tapAt(p);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.9 : 1.1;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, this.minZoom, maxZoom));
    });
  }

  // Najde nejbližší hromádku odpadu u prstu (štědrý dosah, prst je nepřesný) a zkusí ji vytřídit
  private tapAt(p: Phaser.Input.Pointer): void {
    const cam = this.cameras.main;
    const w = cam.getWorldPoint(p.x, p.y);
    let best: { x: number; y: number; left: number } | null = null;
    let bestD = T * 0.9;
    for (const l of this.lastLitter) {
      const d = Phaser.Math.Distance.Between(w.x, w.y, (l.x + 0.5) * T, (l.y + 0.5) * T);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    if (!best) return;
    const cx = (best.x + 0.5) * T;
    const cy = (best.y + 0.5) * T;
    const key = `${best.x},${best.y}`;
    const res = this.onCollect(best.x, best.y);
    if (!res) return;
    this.collectEffects(cx, cy, key, res.removed);
  }

  // Efekty při klepnutí: zatřesení, +1 VO nahoru, jiskry; při zmizení hromádky větší výbuch a krátká vibrace telefonu
  private collectEffects(x: number, y: number, key: string, removed: boolean): void {
    const px = this.dpr / this.cameras.main.zoom; // kolik světových pixelů je jeden CSS pixel
    const obj = this.litterObjs.get(key);
    if (obj && !removed) {
      this.tweens.add({ targets: obj.box, scale: { from: 1.3, to: 1 }, angle: { from: -10, to: 0 }, duration: 160, ease: 'Back.Out' });
    }
    this.floatText(x, y - 10 * px, '+1 ♻️', '#bbf7d0', 16);
    this.burst(x, y, 0x86efac, removed ? 14 : 6, px);
    if (removed) {
      this.floatText(x, y - 34 * px, '✨ uklizeno!', '#fde68a', 15);
      this.burst(x, y, 0xfde68a, 10, px);
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(removed ? 25 : 8);
  }

  private floatText(x: number, y: number, text: string, color: string, sizeCss: number): void {
    const px = this.dpr / this.cameras.main.zoom;
    const tx = this.add
      .text(x, y, text, {
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        fontSize: `${sizeCss}px`,
        fontStyle: 'bold',
        color,
        stroke: '#052e16',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setResolution(this.dpr * 2)
      .setScale(px)
      .setDepth(30);
    this.tweens.add({ targets: tx, y: y - 42 * px, alpha: 0, duration: 700, ease: 'Cubic.Out', onComplete: () => tx.destroy() });
  }

  private burst(x: number, y: number, color: number, count: number, px: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (22 + Math.random() * 30) * px;
      const dot = this.add.circle(x, y, (2.5 + Math.random() * 2) * px, color).setDepth(29);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        alpha: 0,
        scale: 0.2,
        duration: 380 + Math.random() * 200,
        ease: 'Cubic.Out',
        onComplete: () => dot.destroy(),
      });
    }
  }

  // Hromádky odpadu na mapě podle stavu hry: nové se objeví (s „vyskočením“), uklizené zmizí
  private syncLitter(litter: { x: number; y: number; left: number }[]): void {
    this.lastLitter = litter;
    const seen = new Set<string>();
    for (const l of litter) {
      const key = `${l.x},${l.y}`;
      seen.add(key);
      let obj = this.litterObjs.get(key);
      if (!obj) {
        const bg = this.add.circle(0, 0, T * 0.5, 0x000000, 0.28);
        const icon = this.add
          .text(0, 0, LITTER_ICONS[(l.x * 7 + l.y * 3) % LITTER_ICONS.length], {
            fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
            fontSize: `${T * 0.85}px`,
          })
          .setOrigin(0.5)
          .setResolution(Math.min(8, MAP_ZOOM_MAX * this.dpr));
        const box = this.add.container((l.x + 0.5) * T, (l.y + 0.5) * T, [bg, icon]).setDepth(5);
        obj = { box, icon };
        this.litterObjs.set(key, obj);
        if (this.litterSynced) this.tweens.add({ targets: box, scale: { from: 0, to: 1 }, duration: 260, ease: 'Back.Out' });
      }
      // čím míň klepnutí zbývá, tím je hromádka menší
      obj.icon.setScale(0.6 + 0.4 * (l.left / LITTER_CLICKS));
    }
    for (const [key, obj] of this.litterObjs) {
      if (!seen.has(key)) {
        // zmizela (vyklepaná, nebo ji uklidila četa brigádníků): krátké zmenšení
        this.litterObjs.delete(key);
        this.tweens.add({ targets: obj.box, scale: 0, alpha: 0, duration: 180, ease: 'Cubic.In', onComplete: () => obj.box.destroy() });
      }
    }
    this.litterSynced = true;
  }

  update(): void {
    const v = this.getView();
    const cam = this.cameras.main;
    // Popisky mají stálou velikost na obrazovce, při velkém oddálení se zmenší (ať se nepřekrývají)
    const factor = Phaser.Math.Clamp(cam.zoom / this.dpr, 0.5, 1);
    const labelScale = (this.dpr / cam.zoom) * factor;
    this.wireLabel.setVisible(factor >= 0.75);

    this.syncLitter(v.litter);

    // Noc: tmavý závoj (HTML vrstva nad mapou, jen vizuálně)
    this.nightEl.style.opacity = v.isNight ? '1' : '0';

    // Spalovna: barva podle stavu + popisek s čísly
    const a = MAP_INCINERATOR_TILE;
    const color = !v.incineratorOn ? COLORS.incineratorOff : v.incineratorRunning ? COLORS.incinerator : COLORS.incineratorIdle;
    this.incinerator.setFillStyle(color, 1);
    const state = !v.incineratorOn ? '⏸ vypnutá' : v.incineratorRunning ? '🔥 vyrábí' : '⏳ čeká na VO';
    const wasteLine = v.toxic ? `\n☣️ pole ${v.toxicField.toFixed(0)} · sklad ${v.toxicStored.toFixed(0)} / ${v.storageCap.toFixed(0)}` : '';
    this.incineratorLabel
      .setText(`Spalovna\n${state} ${(v.productionMW - v.solarMW).toFixed(1)} / ${v.nominalMW} MW\n♻️ sklad ${v.vo.toFixed(0)} / ${v.voMax.toFixed(0)} VO${wasteLine}`)
      .setScale(labelScale)
      .setPosition((a.x + 1) * T, a.y * T - 4);

    // Město: popisek s dodávkou
    const c = MAP_CITY_TILE;
    this.cityLabel
      .setText(`Město\n⚡ ${v.deliveredMW.toFixed(1)} / ${v.demandMW.toFixed(0)} MW\n💰 +${v.incomePerSecond.toFixed(1)}/s`)
      .setScale(labelScale)
      .setPosition((c.x + 1.5) * T, c.y * T - 4);

    // Hromady odpadu: kolik jich je vidět, podle zaplněnosti pole
    const shown = v.toxic && v.toxicField > 0.5 ? Math.max(1, Math.ceil(WASTE_SPOTS.length * Math.min(1, v.toxicField / v.toxicFieldFull))) : 0;
    this.wasteObjs.forEach((objs, i) => objs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(i < shown)));

    // Sluneční panely
    const hasSolar = v.solarLevel > 0;
    this.solarObjs.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(hasSolar));
    this.solarLabel
      .setVisible(hasSolar && factor >= 0.75)
      .setText(`Sluneční panely\n☀️ ${v.solarMW.toFixed(1)} / ${v.solarCapMW} MW`)
      .setScale(labelScale)
      .setPosition((SOLAR_TILE.x + 2) * T, SOLAR_TILE.y * T - 4);

    // Dráty: svítí podle toho, kolik energie teče, s popiskem propustnosti
    const flow = v.demandMW > 0 ? Math.min(1, v.deliveredMW / v.demandMW) : 0;
    this.wire.clear();
    for (const t of wireTiles()) {
      this.wire.fillStyle(flow > 0.01 ? COLORS.wire : COLORS.wireDim, 0.35 + 0.65 * flow);
      this.wire.fillRect(t.x * T + T * 0.35, t.y * T + T * 0.35, T * 0.3, T * 0.3);
    }
    const midX = (a.x + 2 + c.x + 1) / 2;
    this.wireLabel
      .setText(`🔌 vedení ${v.deliveredMW.toFixed(1)} / ${v.lineMW} MW`)
      .setScale(labelScale)
      .setPosition(midX * T, (a.y + 1) * T - 6);
  }
}

export function createMap(parent: HTMLElement, getView: () => MapView, onCollect: CollectFn): Phaser.Game {
  // Ostrý obraz na displejích s vysokým rozlišením: plátno má fyzické pixely a CSS ho zmenší
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const nightEl = document.createElement('div');
  nightEl.className = 'map-night';
  parent.appendChild(nightEl);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0b3b5c',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, Math.round((parent.clientWidth || 360) * dpr)),
      height: Math.max(1, Math.round((parent.clientHeight || 360) * dpr)),
      zoom: 1 / dpr,
    },
    scene: [],
    input: { touch: true, mouse: true },
    callbacks: {
      postBoot: (g) => {
        g.scene.add('map', MapScene, true, { getView, onCollect, nightEl, dpr });
      },
    },
  });

  new ResizeObserver(() => {
    const w = Math.max(1, Math.round(parent.clientWidth * dpr));
    const h = Math.max(1, Math.round(parent.clientHeight * dpr));
    game.scale.resize(w, h);
  }).observe(parent);

  return game;
}
