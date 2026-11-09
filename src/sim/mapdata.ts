import {
  MAP_CITY_TILE,
  MAP_GRID_SIZE,
  MAP_INCINERATOR_TILE,
  MAP_SOLAR_TILE,
  MAP_WASTE_SPOTS,
} from './balance';

// Rozložení mapy, které potřebují simulace i vykreslení (čistá data, žádná grafika).

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

const inRect = (x: number, y: number, rx: number, ry: number, w: number, h: number) =>
  x >= rx && x < rx + w && y >= ry && y < ry + h;

// Dlaždice, kde nesmí ležet odpad: voda a pobřeží, budovy, dráty, sluneční panely, hromady toxického odpadu
export function isBlockedTile(x: number, y: number): boolean {
  const last = MAP_GRID_SIZE - 3; // poslední dlaždice pevniny (kolem je pobřeží a voda)
  if (x < 2 || y < 2 || x > last || y > last) return true;
  const a = MAP_INCINERATOR_TILE;
  if (inRect(x, y, a.x, a.y, 2, 2)) return true;
  const c = MAP_CITY_TILE;
  if (inRect(x, y, c.x, c.y, 3, 3)) return true;
  if (inRect(x, y, MAP_SOLAR_TILE.x, MAP_SOLAR_TILE.y, 4, 2)) return true;
  if (wireTiles().some((t) => t.x === x && t.y === y)) return true;
  return MAP_WASTE_SPOTS.some((t) => t.x === x && t.y === y);
}
