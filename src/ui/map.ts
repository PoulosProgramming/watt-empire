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
  deliveredMW: number;
  demandMW: number;
  hour: number;
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
  private incinerator!: Phaser.GameObjects.Rectangle;
  private incineratorText!: Phaser.GameObjects.Text;
  private cityText!: Phaser.GameObjects.Text;
  private wire!: Phaser.GameObjects.Graphics;
  private nightEl!: HTMLElement;
  private dpr = 1;
  private dragging = false;
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
    this.drawWire();
    this.drawBuildings();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD, WORLD);
    this.applyMinZoom();
    cam.setZoom(Math.max(this.minZoom, MAP_ZOOM_START * this.dpr));
    const center = MAP_INCINERATOR_TILE;
    cam.centerOn((center.x + 1) * T, (center.y + 1) * T);

    this.scale.on('resize', () => {
      this.applyMinZoom();
      cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZoom, MAP_ZOOM_MAX * this.dpr));
    });

    this.setupInput();
  }

  // Nejmenší zoom = celá mapa se právě vejde, dál oddálit nejde
  private applyMinZoom(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.minZoom = Math.max(w / WORLD, h / WORLD, 0.1);
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

  private drawWire(): void {
    this.wire = this.add.graphics();
  }

  private drawBuildings(): void {
    const a = MAP_INCINERATOR_TILE;
    this.incinerator = this.add
      .rectangle(a.x * T, a.y * T, T * 2, T * 2, COLORS.incinerator)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5);
    this.add.text((a.x + 1) * T, (a.y + 1) * T, '🏭', { fontSize: `${T * 1.4}px` }).setOrigin(0.5);
    this.incineratorText = this.add
      .text((a.x + 1) * T, a.y * T - 6, '', { fontSize: '14px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1);

    const c = MAP_CITY_TILE;
    this.add.rectangle(c.x * T, c.y * T, T * 3, T * 3, COLORS.city).setOrigin(0).setStrokeStyle(2, 0x000000, 0.5);
    this.add.text((c.x + 1.5) * T, (c.y + 1.5) * T, '🏙️', { fontSize: `${T * 1.8}px` }).setOrigin(0.5);
    this.cityText = this.add
      .text((c.x + 1.5) * T, c.y * T - 6, '', { fontSize: '14px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 } })
      .setOrigin(0.5, 1);
  }

  // Posun až po pohybu prstu (ne při prostém klepnutí), přiblížení dvěma prsty nebo kolečkem
  private setupInput(): void {
    this.input.addPointer(1);
    const cam = this.cameras.main;

    this.input.on('pointerdown', () => {
      this.dragging = false;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchLast > 0) {
          cam.setZoom(Phaser.Math.Clamp(cam.zoom * (d / this.pinchLast), this.minZoom, MAP_ZOOM_MAX * this.dpr));
        }
        this.pinchLast = d;
        this.dragging = true;
        return;
      }
      this.pinchLast = 0;
      if (!p.isDown) return;
      if (!this.dragging) {
        const moved = Phaser.Math.Distance.Between(p.x, p.y, p.downX, p.downY);
        if (moved < MAP_DRAG_THRESHOLD_PX * this.dpr) return;
        this.dragging = true;
      }
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });

    this.input.on('pointerup', () => {
      this.pinchLast = 0;
    });

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const factor = dy > 0 ? 0.9 : 1.1;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, this.minZoom, MAP_ZOOM_MAX * this.dpr));
    });
  }

  update(): void {
    const v = this.getView();

    // Noc: tmavý závoj (HTML vrstva nad mapou, jen vizuálně)
    this.nightEl.style.opacity = v.isNight ? '1' : '0';

    // Spalovna: barva podle stavu
    const color = !v.incineratorOn ? COLORS.incineratorOff : v.incineratorRunning ? COLORS.incinerator : COLORS.incineratorIdle;
    this.incinerator.setFillStyle(color, 1);
    this.incineratorText.setText(
      !v.incineratorOn ? '⏸ vypnuta' : v.incineratorRunning ? `🔥 ${v.productionMW.toFixed(1)} MW` : '⏳ čeká na VO',
    );
    this.cityText.setText(`${v.deliveredMW.toFixed(1)} / ${v.demandMW.toFixed(0)} MW`);

    // Dráty: svítí podle toho, kolik energie teče
    const flow = v.demandMW > 0 ? Math.min(1, v.deliveredMW / v.demandMW) : 0;
    this.wire.clear();
    for (const t of this.wireTiles()) {
      this.wire.fillStyle(flow > 0.01 ? COLORS.wire : COLORS.wireDim, 0.35 + 0.65 * flow);
      this.wire.fillRect(t.x * T + T * 0.35, t.y * T + T * 0.35, T * 0.3, T * 0.3);
    }
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
