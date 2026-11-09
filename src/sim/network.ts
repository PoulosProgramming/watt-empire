import { BUILDINGS, MAP_CITY_TILE, MAP_INCINERATOR_TILE, type BuildingDef, type BuildingType } from './balance';
import { wireTiles } from './mapdata';
import type { Building, GameState } from './state';

// Propojení budov DOTYKEM po dlaždicích (čistá logika, žádná grafika):
//  - síť: z města se šíří přes vodivé dlaždice (hlavní vedení, spalovna, dráty, baterie), co se dotýká, je napojené;
//  - cesty: od spalovny se šíří přes cesty; sklad a likvidátor musí sousedit se spalovnou nebo s napojenou cestou.

export const buildingDef = (type: BuildingType): BuildingDef => BUILDINGS.find((d) => d.type === type)!;

export function footprint(b: { type: BuildingType; x: number; y: number }): { x: number; y: number }[] {
  const d = buildingDef(b.type);
  const tiles: { x: number; y: number }[] = [];
  for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) tiles.push({ x: b.x + dx, y: b.y + dy });
  return tiles;
}

const key = (x: number, y: number) => `${x},${y}`;
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface NetworkInfo {
  gridTiles: Set<string>; // dlaždice napojené na síť (z města)
  roadTiles: Set<string>; // cesty napojené na spalovnu
  connected: boolean[]; // pro každou budovu (podle pořadí ve s.buildings): je napojená?
  counts: Record<BuildingType, number>; // počet NAPOJENÝCH budov daného druhu
}

function rect(x: number, y: number, w: number, h: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

function flood(start: { x: number; y: number }[], passable: Set<string>): Set<string> {
  const seen = new Set<string>();
  const queue: { x: number; y: number }[] = [];
  for (const t of start) {
    const k = key(t.x, t.y);
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(t);
    }
  }
  while (queue.length > 0) {
    const t = queue.shift()!;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = t.x + dx;
      const ny = t.y + dy;
      const k = key(nx, ny);
      if (!seen.has(k) && passable.has(k)) {
        seen.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

function compute(buildings: Building[]): NetworkInfo {
  const a = MAP_INCINERATOR_TILE;
  const c = MAP_CITY_TILE;
  const inc = rect(a.x, a.y, 2, 2);
  const city = rect(c.x, c.y, 3, 3);

  // Síť: vodivé dlaždice = hlavní vedení, spalovna, město a vodivé budovy hráče
  const conductive = new Set<string>();
  for (const t of wireTiles()) conductive.add(key(t.x, t.y));
  for (const t of [...inc, ...city]) conductive.add(key(t.x, t.y));
  for (const b of buildings) if (buildingDef(b.type).conductive) for (const t of footprint(b)) conductive.add(key(t.x, t.y));
  const gridTiles = flood(city, conductive);

  // Cesty: od spalovny přes dlaždice cest
  const roads = new Set<string>();
  for (const b of buildings) if (b.type === 'road') roads.add(key(b.x, b.y));
  const roadFlood = flood(inc, new Set([...roads, ...inc.map((t) => key(t.x, t.y))]));
  const roadTiles = new Set<string>();
  for (const k of roadFlood) if (roads.has(k)) roadTiles.add(k);
  const roadSources = new Set<string>([...inc.map((t) => key(t.x, t.y)), ...roadTiles]);

  const counts = { road: 0, wire: 0, storage: 0, disposer: 0, battery: 0 } as Record<BuildingType, number>;
  const connected = buildings.map((b) => {
    const d = buildingDef(b.type);
    const fp = footprint(b);
    let ok: boolean;
    if (b.type === 'road') ok = roadTiles.has(key(b.x, b.y));
    else if (b.type === 'wire') ok = gridTiles.has(key(b.x, b.y));
    else if (d.needs === 'road') ok = fp.some((t) => NEIGHBORS.some(([dx, dy]) => roadSources.has(key(t.x + dx, t.y + dy))));
    else if (d.needs === 'grid') ok = fp.some((t) => gridTiles.has(key(t.x, t.y)));
    else ok = true;
    if (ok) counts[b.type] += 1;
    return ok;
  });
  return { gridTiles, roadTiles, connected, counts };
}

// Výsledek se pamatuje, dokud se budovy nezmění (s.buildVersion), ať se nepočítá znovu při každém dotazu
const cache = new WeakMap<GameState, { version: number; info: NetworkInfo }>();
export function networkInfo(s: GameState): NetworkInfo {
  const hit = cache.get(s);
  if (hit && hit.version === s.buildVersion && hit.info.connected.length === s.buildings.length) return hit.info;
  const info = compute(s.buildings);
  cache.set(s, { version: s.buildVersion, info });
  return info;
}

export const connectedCount = (s: GameState, type: BuildingType): number => networkInfo(s).counts[type];
