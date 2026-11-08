import Phaser from 'phaser';
import {
  MAP_GRID_SIZE,
  MAP_INCINERATOR_TILE,
  MAP_CITY_TILE,
  MAP_TILE_PX,
  MAP_ZOOM_MAX,
  MAP_ZOOM_START,
  MAP_DRAG_THRESHOLD_PX,
} from '../sim/balance';

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
}

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
  private wire!: Phaser.GameObjects.Graphics;
  private dragging = false;
  private pinching = false;
  private pinchLast = 0;
  private minZoom = 0.5;

  constructor() {
    super('map');
  }

  init(data: { getView: () => MapView; nightEl: HTMLElement; dpr: number }): void {
    this.getView = data.getView;
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

    // Ladicí háček pro testy v prohlížeči (jen čtení zoomu)
    (window as unknown as { __wattMap?: { zoom: () => number } }).__wattMap = { zoom: () => cam.zoom };
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

  // Dráty vedou od spalovny doprava a pak dolů k městu
  private wireTiles(): { x: number; y: number }[] {
    const a = MAP_INCINERATOR_TILE;
    const c = MAP_CITY_TILE;
    const tiles: { x: number; y: number }[] = [];
    const y0 = a.y + 1;
    const cx = c.x + 1;
    for (let x = a.x + 2; x <= cx; x++) tiles.push({ x, y: y0 });
    for (let y = y0 + 1; y < c.y; y++) tiles.push({ x: cx, y });
    return tiles;
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
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.9 : 1.1;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, this.minZoom, maxZoom));
    });
  }

  update(): void {
    const v = this.getView();
    const cam = this.cameras.main;
    // Popisky mají stálou velikost na obrazovce, při velkém oddálení se zmenší (ať se nepřekrývají)
    const factor = Phaser.Math.Clamp(cam.zoom / this.dpr, 0.5, 1);
    const labelScale = (this.dpr / cam.zoom) * factor;
    this.wireLabel.setVisible(factor >= 0.75);

    // Noc: tmavý závoj (HTML vrstva nad mapou, jen vizuálně)
    this.nightEl.style.opacity = v.isNight ? '1' : '0';

    // Spalovna: barva podle stavu + popisek s čísly
    const a = MAP_INCINERATOR_TILE;
    const color = !v.incineratorOn ? COLORS.incineratorOff : v.incineratorRunning ? COLORS.incinerator : COLORS.incineratorIdle;
    this.incinerator.setFillStyle(color, 1);
    const state = !v.incineratorOn ? '⏸ vypnutá' : v.incineratorRunning ? '🔥 vyrábí' : '⏳ čeká na VO';
    this.incineratorLabel
      .setText(`Spalovna\n${state} ${v.productionMW.toFixed(1)} / ${v.nominalMW} MW\n♻️ sklad ${v.vo.toFixed(0)} / ${v.voMax.toFixed(0)} VO`)
      .setScale(labelScale)
      .setPosition((a.x + 1) * T, a.y * T - 4);

    // Město: popisek s dodávkou
    const c = MAP_CITY_TILE;
    this.cityLabel
      .setText(`Město\n⚡ ${v.deliveredMW.toFixed(1)} / ${v.demandMW.toFixed(0)} MW\n💰 +${v.incomePerSecond.toFixed(1)}/s`)
      .setScale(labelScale)
      .setPosition((c.x + 1.5) * T, c.y * T - 4);

    // Dráty: svítí podle toho, kolik energie teče, s popiskem propustnosti
    const flow = v.demandMW > 0 ? Math.min(1, v.deliveredMW / v.demandMW) : 0;
    this.wire.clear();
    for (const t of this.wireTiles()) {
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

export function createMap(parent: HTMLElement, getView: () => MapView): Phaser.Game {
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
        g.scene.add('map', MapScene, true, { getView, nightEl, dpr });
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
