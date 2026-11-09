import {
  MAP_CITY_TILE,
  MAP_GRID_SIZE,
  MAP_INCINERATOR_TILE,
  MAP_SOLAR_TILE,
  MAP_WASTE_SPOTS,
  PARCEL_SIZE,
  PARCELS_PER_SIDE,
} from './balance';

// Rozložení mapy, které potřebují simulace i vykreslení (čistá data, žádná grafika).

// ---------- Terén ----------
// Vlevo pobřeží (zálivy a mysy), na severu hory, vpravo a dole pevnina, tu a tam keř a skála, kde se nedá stavět.
export type Terrain = 'water' | 'shore' | 'mountain' | 'land';
export type Obstacle = 'bush' | 'rock' | null;

// Pobřeží: první dlaždice pevniny v řádku y (vlevo od ní je voda a pláž). Drží se mezi 2 a 6, aby nezasáhlo do odemčeného území.
export function coastX(y: number): number {
  const v = 4 + 2.2 * Math.sin(y * 0.42 + 0.6) + 1.6 * Math.sin(y * 0.17 + 2.1) + 1.1 * Math.sin(y * 0.9);
  return Math.max(2, Math.min(6, Math.round(v)));
}

// Hory na severu: řádky nad touto hranicí jsou hory (zubatá hřeben). Drží se mezi 2 a 6.
export function mountainY(x: number): number {
  const v = 4 + 1.8 * Math.sin(x * 0.35 + 1.0) + 1.4 * Math.sin(x * 0.13 + 0.3) + 1.0 * Math.sin(x * 0.8);
  return Math.max(2, Math.min(6, Math.round(v)));
}

export function terrainAt(x: number, y: number): Terrain {
  const cx = coastX(y);
  if (x < cx - 1) return 'water';
  if (x < cx) return 'shore'; // pláž
  if (y < mountainY(x)) return 'mountain';
  return 'land';
}

// Deterministické „náhodné“ číslo 0 až 1 podle dlaždice (stejná mapa při každém spuštění)
function hash01(x: number, y: number, k: number): number {
  let h = (Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263) + Math.imul(k + 1, 2147483629)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const inRect = (x: number, y: number, rx: number, ry: number, w: number, h: number) =>
  x >= rx && x < rx + w && y >= ry && y < ry + h;

// Dráty vedou od spalovny doprava a pak dolů k městu
export function wireTiles(): { x: number; y: number }[] {
  const a = MAP_INCINERATOR_TILE;
  const c = MAP_CITY_TILE;
  const tiles: { x: number; y: number }[] = [];
  const y0 = a.y + 1;
  const cx = c.x + 1;
  for (let x = a.x + 2; x <= cx; x++) tiles.push({ x, y: y0 });
  for (let y = y0 + 1; y < c.y; y++) tiles.push({ x: cx, y });
  return tiles;
}

// Dlaždice, kde stojí budova, dráty nebo hromada toxického odpadu (pevná část mapy)
export function isStructureTile(x: number, y: number): boolean {
  const a = MAP_INCINERATOR_TILE;
  if (inRect(x, y, a.x, a.y, 2, 2)) return true;
  const c = MAP_CITY_TILE;
  if (inRect(x, y, c.x, c.y, 3, 3)) return true;
  if (inRect(x, y, MAP_SOLAR_TILE.x, MAP_SOLAR_TILE.y, 4, 2)) return true;
  if (wireTiles().some((t) => t.x === x && t.y === y)) return true;
  return MAP_WASTE_SPOTS.some((t) => t.x === x && t.y === y);
}

const obstacleCache = new Map<string, Obstacle>();
// Keř nebo skála: jen na pevnině, ne tam, kde něco stojí, a kolem spalovny a města je jich méně (ať se tam dá stavět a uklízet)
export function obstacleAt(x: number, y: number): Obstacle {
  const key = `${x},${y}`;
  const cached = obstacleCache.get(key);
  if (cached !== undefined) return cached;
  let result: Obstacle = null;
  if (terrainAt(x, y) === 'land' && !isStructureTile(x, y)) {
    const a = MAP_INCINERATOR_TILE;
    const c = MAP_CITY_TILE;
    const nearCore = x >= a.x - 2 && x <= c.x + 5 && y >= a.y - 2 && y <= c.y + 5;
    const r = hash01(x, y, 7);
    result = nearCore ? (r < 0.02 ? 'bush' : r < 0.035 ? 'rock' : null) : r < 0.06 ? 'bush' : r < 0.1 ? 'rock' : null;
  }
  obstacleCache.set(key, result);
  return result;
}

// Dá se na dlaždici stavět (pevnina bez keře, skály a budovy)? Odemčení parcely se řeší zvlášť.
export function isBuildableTile(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_GRID_SIZE || y >= MAP_GRID_SIZE) return false;
  return terrainAt(x, y) === 'land' && obstacleAt(x, y) === null && !isStructureTile(x, y);
}

// ---------- Parcely ----------
export const parcelIndex = (x: number, y: number) =>
  Math.floor(y / PARCEL_SIZE) * PARCELS_PER_SIDE + Math.floor(x / PARCEL_SIZE);

export const parcelOrigin = (index: number) => ({
  x: (index % PARCELS_PER_SIDE) * PARCEL_SIZE,
  y: Math.floor(index / PARCELS_PER_SIDE) * PARCEL_SIZE,
});

// Je dlaždice v odemčené parcele? (unlocked = seznam indexů odemčených parcel)
export const isUnlockedTile = (unlocked: number[], x: number, y: number) =>
  x >= 0 && y >= 0 && x < MAP_GRID_SIZE && y < MAP_GRID_SIZE && unlocked.includes(parcelIndex(x, y));

// Obdélník (v dlaždicích) obalující všechna odemčená území: kam smí kamera
export function unlockedBounds(unlocked: number[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const i of unlocked) {
    const o = parcelOrigin(i);
    x0 = Math.min(x0, o.x);
    y0 = Math.min(y0, o.y);
    x1 = Math.max(x1, o.x + PARCEL_SIZE);
    y1 = Math.max(y1, o.y + PARCEL_SIZE);
  }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: MAP_GRID_SIZE, y1: MAP_GRID_SIZE };
  return { x0, y0, x1, y1 };
}

// Dlaždice, kde může ležet odpad: odemčená pevnina bez překážek, budov a drátů
export function isLitterTile(unlocked: number[], x: number, y: number): boolean {
  return isUnlockedTile(unlocked, x, y) && isBuildableTile(x, y);
}
