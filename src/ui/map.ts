import Phaser from 'phaser';
import {
  LITTER_CLICKS,
  MAP_CITY_TILE,
  MAP_DRAG_THRESHOLD_PX,
  MAP_FOG_ALPHA,
  MAP_GRID_SIZE,
  MAP_INCINERATOR_TILE,
  MAP_RUBBER_SPRING,
  MAP_RUBBER_STRETCH_TILES,
  MAP_SOLAR_TILE,
  MAP_TILE_PX,
  MAP_WASTE_SPOTS,
  MAP_ZOOM_MAX,
  MAP_ZOOM_START,
  PARCEL_SIZE,
  PARCELS_PER_SIDE,
} from '../sim/balance';
import { obstacleAt, parcelOrigin, terrainAt, unlockedBounds, wireTiles } from '../sim/mapdata';

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
  unlocked: number[]; // odemčené parcely (zbytek je v mlze)
  buildings: { type: string; x: number; y: number; w: number; h: number; emoji: string; color: number; connected: boolean }[];
  mode: 'none' | 'build' | 'demolish' | 'parcel'; // co hráč zrovna dělá (stavění, bourání, koupě parcel)
  ghost: { w: number; h: number; valid: (x: number, y: number) => boolean } | null; // náhled budovy pod prstem/myší
  freeTile: (x: number, y: number) => boolean; // dlaždice, kam jde stavět (pro zvýraznění)
  purchasable: number[]; // parcely, které jde koupit
  parcelCost: number; // cena další parcely
}
// Klepnutí na dlaždici: vrací true, když ho zpracovala stavba (pak se klepnutí na odpad už neřeší)
export type TileTapFn = (x: number, y: number) => boolean;

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
  water: 0x0e5a8f,
  landA: 0x6fa33f,
  landB: 0x649836,
  shore: 0xe6c978,
  mountainA: 0x8a7458,
  mountainB: 0x7c684e,
  peak: 0xe5e7eb,
  fog: 0x3b4a63,
  incinerator: 0xf0561a,
  incineratorIdle: 0x7a2e12,
  incineratorOff: 0x555a60,
  city: 0x3f6fe0,
  wire: 0xffd23f,
  wireDim: 0x6b5a1e,
};

class MapScene extends Phaser.Scene {
  private getView!: () => MapView;
  private nightVeil!: Phaser.GameObjects.Rectangle;
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
  // Kamera: skutečný střed, kam hráč táhne (může být i za okrajem odemčeného území), a gumové natažení
  private cx = 0;
  private cy = 0;
  private held = false; // prst nebo myš je dole
  private fog!: Phaser.GameObjects.Graphics;
  private hints!: Phaser.GameObjects.Graphics; // zvýraznění volných dlaždic a parcel k nákupu
  private hintKey = '';
  private ghostGfx!: Phaser.GameObjects.Graphics;
  private parcelLabels: Phaser.GameObjects.Text[] = [];
  private selected: 'incinerator' | 'city' | 'wire' | 'solar' | null = null; // popisek se ukáže až po klepnutí na budovu
  private hover: { x: number; y: number } | null = null;
  private onTileTap!: TileTapFn;
  private buildObjs = new Map<string, { box: Phaser.GameObjects.Container; warn: Phaser.GameObjects.Text | null; w: number }>();
  private fogKey = '';
  private bounds = { x0: 0, y0: 0, x1: MAP_GRID_SIZE, y1: MAP_GRID_SIZE };

  constructor() {
    super('map');
  }

  init(data: { getView: () => MapView; onCollect: CollectFn; onTileTap: TileTapFn; dpr: number }): void {
    this.getView = data.getView;
    this.onCollect = data.onCollect;
    this.onTileTap = data.onTileTap;
    this.dpr = data.dpr;
  }

  create(): void {
    this.drawTerrain();
    this.wire = this.add.graphics();
    this.drawBuildings();
    // Noční závoj leží nad terénem a keři, ale pod budovami, dráty, odpadem a popisky: budovy v noci zůstávají světlé
    const terrainGfx = this.children.list[0];
    this.nightVeil = this.add.rectangle(0, 0, WORLD, WORLD, 0x101c6e, 0.45).setOrigin(0).setDepth(2.5).setAlpha(0);
    this.children.list.forEach((o) => {
      const d = o as unknown as Phaser.GameObjects.Components.Depth;
      if (o !== terrainGfx && o !== this.nightVeil && d.depth === 0) d.setDepth(3);
    });
    this.fog = this.add.graphics().setDepth(8);
    this.hints = this.add.graphics().setDepth(7);
    this.ghostGfx = this.add.graphics().setDepth(9);

    const cam = this.cameras.main;
    this.applyMinZoom();
    cam.setZoom(Math.max(this.minZoom, MAP_ZOOM_START * this.dpr));
    const a = MAP_INCINERATOR_TILE;
    this.cx = (a.x + 1) * T;
    this.cy = (a.y + 1) * T;
    cam.centerOn(this.cx, this.cy);

    this.scale.on('resize', () => {
      this.applyMinZoom();
      cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZoom, MAP_ZOOM_MAX * this.dpr));
    });

    this.setupInput();

    // Ladicí háček pro testy v prohlížeči (jen čtení)
    (window as unknown as { __wattMap?: unknown }).__wattMap = {
      zoom: () => cam.zoom,
      litter: () => this.lastLitter,
      center: () => ({ x: this.cx / T, y: this.cy / T, shownX: (cam.scrollX + cam.width / 2) / T, shownY: (cam.scrollY + cam.height / 2) / T }),
      // střed dlaždice na obrazovce (CSS pixely vůči plátnu), pro ruční testy
      tileScreen: (x: number, y: number) => ({
        x: (((x + 0.5) * T - cam.worldView.x) * cam.zoom) / this.dpr,
        y: (((y + 0.5) * T - cam.worldView.y) * cam.zoom) / this.dpr,
      }),
    };
  }

  // Nejmenší zoom = celý ostrov se právě vejde (i s trochou vody kolem), dál oddálit nejde
  private applyMinZoom(): void {
    this.minZoom = Math.max(Math.min(this.scale.width, this.scale.height) / (WORLD * 1.05), 0.1);
  }

  // Terén: pobřeží vlevo (voda a pláž), hory na severu, pevnina, keře a skály
  private drawTerrain(): void {
    const g = this.add.graphics();
    const emojiFont = 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const terrain = terrainAt(x, y);
        let color: number;
        if (terrain === 'water') color = COLORS.water;
        else if (terrain === 'shore') color = COLORS.shore;
        else if (terrain === 'mountain') color = (x + y) % 2 === 0 ? COLORS.mountainA : COLORS.mountainB;
        else color = (x + y) % 2 === 0 ? COLORS.landA : COLORS.landB;
        g.fillStyle(color, 1);
        g.fillRect(x * T, y * T, T, T);
        if (terrain === 'mountain') {
          // hřebeny: trojúhelníky, nejvyšší se sněhovou čepičkou
          const px = x * T;
          const py = y * T;
          g.fillStyle(0x5e4a35, 1);
          g.fillTriangle(px + T * 0.1, py + T * 0.95, px + T * 0.5, py + T * 0.1, px + T * 0.9, py + T * 0.95);
          if ((x * 7 + y * 3) % 5 === 0) {
            g.fillStyle(COLORS.peak, 1);
            g.fillTriangle(px + T * 0.38, py + T * 0.36, px + T * 0.5, py + T * 0.1, px + T * 0.62, py + T * 0.36);
          }
        }
      }
    }
    // Keře a skály (nedá se na nich stavět, v budoucnu půjdou kácet)
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const o = obstacleAt(x, y);
        if (!o) continue;
        this.add
          .text((x + 0.5) * T, (y + 0.55) * T, o === 'bush' ? '🌳' : '🪨', { fontFamily: emojiFont, fontSize: `${T * 0.9}px` })
          .setOrigin(0.5)
          .setResolution(Math.min(4, MAP_ZOOM_MAX * this.dpr))
          .setDepth(2);
      }
    }
  }

  // Mlha: zamčené parcely se zakryjí poloprůhlednou clonou, aby byl vidět terén i hranice
  private drawFog(unlocked: number[]): void {
    const key = unlocked.join(',');
    if (key === this.fogKey) return;
    this.fogKey = key;
    const set = new Set(unlocked);
    this.fog.clear();
    for (let i = 0; i < PARCELS_PER_SIDE * PARCELS_PER_SIDE; i++) {
      if (set.has(i)) continue;
      const o = parcelOrigin(i);
      this.fog.fillStyle(COLORS.fog, MAP_FOG_ALPHA);
      this.fog.fillRect(o.x * T, o.y * T, PARCEL_SIZE * T, PARCEL_SIZE * T);
    }
    // jemné ohraničení odemčené oblasti
    this.fog.lineStyle(3, 0xffffff, 0.35);
    for (const i of unlocked) {
      const o = parcelOrigin(i);
      const x0 = o.x * T;
      const y0 = o.y * T;
      const s = PARCEL_SIZE * T;
      if (!set.has(i - 1) || o.x === 0) this.fog.lineBetween(x0, y0, x0, y0 + s);
      if (!set.has(i + 1) || o.x + PARCEL_SIZE >= N) this.fog.lineBetween(x0 + s, y0, x0 + s, y0 + s);
      if (!set.has(i - PARCELS_PER_SIDE)) this.fog.lineBetween(x0, y0, x0 + s, y0);
      if (!set.has(i + PARCELS_PER_SIDE)) this.fog.lineBetween(x0, y0 + s, x0 + s, y0 + s);
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
      if (e.touches.length === 0) {
        this.pinching = false; // posun až po zvednutí všech prstů, ať mapa neskočí
        this.held = false;
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);

    this.input.on('pointerdown', () => {
      this.dragging = false;
      this.held = true;
    });
    this.input.on('pointerupoutside', () => {
      this.held = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) {
        const w = cam.getWorldPoint(p.x, p.y);
        this.hover = { x: Math.floor(w.x / T), y: Math.floor(w.y / T) };
      }
      if (this.pinching || !p.isDown) return;
      if (!this.dragging) {
        const moved = Phaser.Math.Distance.Between(p.x, p.y, p.downX, p.downY);
        if (moved < MAP_DRAG_THRESHOLD_PX * this.dpr) return;
        this.dragging = true;
      }
      this.cx -= (p.x - p.prevPosition.x) / cam.zoom;
      this.cy -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    // Klepnutí (ne tažení, ne přiblížení) na odpad: vytřídí 1 VO, po LITTER_CLICKS klepnutích hromádka zmizí
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pinchLast = 0;
      this.held = false;
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
    if (this.onTileTap(Math.floor(w.x / T), Math.floor(w.y / T))) return; // stavění / bourání / koupě parcely
    let best: { x: number; y: number; left: number } | null = null;
    let bestD = T * 0.9;
    for (const l of this.lastLitter) {
      const d = Phaser.Math.Distance.Between(w.x, w.y, (l.x + 0.5) * T, (l.y + 0.5) * T);
      if (d < bestD) {
        bestD = d;
        best = l;
      }
    }
    if (!best) {
      this.selected = this.structureAt(Math.floor(w.x / T), Math.floor(w.y / T));
      return;
    }
    this.selected = null;
    const cx = (best.x + 0.5) * T;
    const cy = (best.y + 0.5) * T;
    const key = `${best.x},${best.y}`;
    const res = this.onCollect(best.x, best.y);
    if (!res) return;
    this.collectEffects(cx, cy, key, res.removed);
  }

  // Která velká budova je na dané dlaždici (pro zobrazení popisku)
  private structureAt(x: number, y: number): 'incinerator' | 'city' | 'wire' | 'solar' | null {
    const inR = (rx: number, ry: number, w: number, h: number) => x >= rx && x < rx + w && y >= ry && y < ry + h;
    if (inR(MAP_INCINERATOR_TILE.x, MAP_INCINERATOR_TILE.y, 2, 2)) return 'incinerator';
    if (inR(MAP_CITY_TILE.x, MAP_CITY_TILE.y, 3, 3)) return 'city';
    if (inR(SOLAR_TILE.x, SOLAR_TILE.y, 4, 2)) return 'solar';
    if (wireTiles().some((q) => q.x === x && q.y === y)) return 'wire';
    return null;
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

  // Budovy hráče: čtverec v barvě budovy s ikonou; nenapojené jsou průhlednější a mají ⚠️
  private syncBuildings(list: MapView['buildings']): void {
    const seen = new Set<string>();
    for (const b of list) {
      const key = `${b.type},${b.x},${b.y}`;
      seen.add(key);
      let obj = this.buildObjs.get(key);
      if (!obj) {
        const rect = this.add.rectangle(1, 1, b.w * T - 2, b.h * T - 2, b.color).setOrigin(0).setStrokeStyle(2, 0x000000, 0.55);
        const parts: Phaser.GameObjects.GameObject[] = [rect];
        if (b.w >= 2) {
          parts.push(
            this.add
              .text((b.w * T) / 2, (b.h * T) / 2, b.emoji, { fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: `${T * b.w * 0.55}px` })
              .setOrigin(0.5)
              .setResolution(Math.min(8, MAP_ZOOM_MAX * this.dpr)),
          );
        }
        let warn: Phaser.GameObjects.Text | null = null;
        if (b.w >= 2) {
          warn = this.add
            .text(T * 0.2, T * 0.1, '⚠️', { fontFamily: 'system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif', fontSize: `${T * 0.7}px` })
            .setResolution(Math.min(8, MAP_ZOOM_MAX * this.dpr));
          parts.push(warn);
        }
        const box = this.add.container(b.x * T, b.y * T, parts).setDepth(4);
        obj = { box, warn, w: b.w };
        this.buildObjs.set(key, obj);
        this.tweens.add({ targets: box, scale: { from: 0.6, to: 1 }, duration: 180, ease: 'Back.Out' });
      }
      obj.box.setAlpha(b.connected ? 1 : 0.5);
      obj.warn?.setVisible(!b.connected);
    }
    for (const [key, obj] of this.buildObjs) {
      if (!seen.has(key)) {
        this.buildObjs.delete(key);
        obj.box.destroy();
      }
    }
  }

  // Zvýraznění: v režimu stavění zeleně volné dlaždice, v režimu koupě zlatě parcely k nákupu (s cenou)
  private drawHints(v: MapView, factor: number, labelScale: number): void {
    const key = [v.mode, v.unlocked.join(','), v.buildings.length, v.purchasable.join(','), v.parcelCost].join('|');
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.hints.clear();
      if (v.mode === 'build') {
        this.hints.fillStyle(0x4ade80, 0.22);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (v.freeTile(x, y)) this.hints.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      } else if (v.mode === 'parcel') {
        this.hints.lineStyle(4, 0xfbbf24, 1);
        this.hints.fillStyle(0xfbbf24, 0.12);
        for (const i of v.purchasable) {
          const o = parcelOrigin(i);
          this.hints.fillRect(o.x * T, o.y * T, PARCEL_SIZE * T, PARCEL_SIZE * T);
          this.hints.strokeRect(o.x * T + 2, o.y * T + 2, PARCEL_SIZE * T - 4, PARCEL_SIZE * T - 4);
        }
      }
    }
    // popisky s cenou parcel
    const showParcels = v.mode === 'parcel';
    while (this.parcelLabels.length < v.purchasable.length) this.parcelLabels.push(this.label().setOrigin(0.5).setVisible(false));
    this.parcelLabels.forEach((l, i) => {
      const idx = v.purchasable[i];
      if (!showParcels || idx === undefined) {
        l.setVisible(false);
        return;
      }
      const o = parcelOrigin(idx);
      l.setVisible(true).setText(`💰 ${v.parcelCost}`).setScale(labelScale).setPosition((o.x + PARCEL_SIZE / 2) * T, (o.y + PARCEL_SIZE / 2) * T);
    });
    void factor;

    // náhled budovy pod myší (na PC): zelený = jde postavit, červený = ne
    this.ghostGfx.clear();
    if (v.mode === 'build' && v.ghost && this.hover) {
      const ok = v.ghost.valid(this.hover.x, this.hover.y);
      this.ghostGfx.fillStyle(ok ? 0x22c55e : 0xef4444, 0.45);
      this.ghostGfx.fillRect(this.hover.x * T, this.hover.y * T, v.ghost.w * T, v.ghost.h * T);
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

  // Kam smí střed kamery: v odemčeném území (s malým okrajem). Když je výřez větší než území, drží se na středu území.
  private clampedCenter(): { x: number; y: number } {
    const cam = this.cameras.main;
    const b = this.bounds;
    const margin = T * 1.5;
    const hw = cam.width / cam.zoom / 2;
    const hh = cam.height / cam.zoom / 2;
    const fit = (lo: number, hi: number, half: number, c: number) => {
      let min = lo * T - margin + half;
      let max = hi * T + margin - half;
      if (min > max) {
        // výřez je větší než odemčené území (oddálení): drž ho aspoň uvnitř celé mapy
        min = half;
        max = WORLD - half;
        if (min > max) return WORLD / 2;
      }
      return Phaser.Math.Clamp(c, min, max);
    };
    return { x: fit(b.x0, b.x1, hw, this.cx), y: fit(b.y0, b.y1, hh, this.cy) };
  }

  // Gumové natažení: za okrajem odemčeného území se mapa táhne čím dál hůř (nejvýš MAP_RUBBER_STRETCH_TILES dlaždic)
  private elastic(over: number): number {
    const r = MAP_RUBBER_STRETCH_TILES * T;
    return Math.sign(over) * r * (1 - Math.exp(-Math.abs(over) / r));
  }

  // Každý snímek: po puštění se mapa pružně vrací ke kraji odemčeného území, zobrazuje se se „gumou“
  private updateCamera(deltaMs: number): void {
    const cam = this.cameras.main;
    const c = this.clampedCenter();
    if (!this.held && !this.pinching) {
      const k = 1 - Math.exp(-(deltaMs / 1000) * MAP_RUBBER_SPRING);
      this.cx += (c.x - this.cx) * k;
      this.cy += (c.y - this.cy) * k;
      if (Math.abs(c.x - this.cx) < 0.3) this.cx = c.x;
      if (Math.abs(c.y - this.cy) < 0.3) this.cy = c.y;
    }
    const c2 = this.clampedCenter();
    cam.centerOn(c2.x + this.elastic(this.cx - c2.x), c2.y + this.elastic(this.cy - c2.y));
  }

  update(_time: number, delta: number): void {
    const v = this.getView();
    this.bounds = unlockedBounds(v.unlocked);
    this.drawFog(v.unlocked);
    this.updateCamera(delta);
    const cam = this.cameras.main;
    // Popisky mají stálou velikost na obrazovce, při velkém oddálení se zmenší (ať se nepřekrývají)
    const factor = Phaser.Math.Clamp(cam.zoom / this.dpr, 0.5, 1);
    const labelScale = (this.dpr / cam.zoom) * factor;
    if (v.mode !== 'none') this.selected = null;
    this.wireLabel.setVisible(this.selected === 'wire');
    this.incineratorLabel.setVisible(this.selected === 'incinerator');
    this.cityLabel.setVisible(this.selected === 'city');

    this.syncLitter(v.litter);
    this.syncBuildings(v.buildings);

    this.drawHints(v, factor, labelScale);

    // Noc: tmavý závoj (HTML vrstva nad mapou, jen vizuálně)
    this.nightVeil.setAlpha(this.nightVeil.alpha + ((v.isNight ? 1 : 0) - this.nightVeil.alpha) * Math.min(1, delta / 600));

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
      .setVisible(hasSolar && this.selected === 'solar')
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

export function createMap(parent: HTMLElement, getView: () => MapView, onCollect: CollectFn, onTileTap: TileTapFn): Phaser.Game {
  // Ostrý obraz na displejích s vysokým rozlišením: plátno má fyzické pixely a CSS ho zmenší
  let lowFx = false;
  try {
    lowFx = localStorage.getItem('watt-empire-lowfx') === '1';
  } catch {
    /* nic */
  }
  const dpr = lowFx ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0e5a8f',
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, Math.round((parent.clientWidth || 360) * dpr)),
      height: Math.max(1, Math.round((parent.clientHeight || 360) * dpr)),
      zoom: 1 / dpr,
    },
    scene: [],
    ...(lowFx ? { fps: { limit: 30 } } : {}),
    input: { touch: true, mouse: true },
    callbacks: {
      postBoot: (g) => {
        g.scene.add('map', MapScene, true, { getView, onCollect, onTileTap, dpr });
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
