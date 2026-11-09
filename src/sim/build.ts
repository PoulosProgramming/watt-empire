import {
  BUILDING_REFUND,
  PARCEL_BASE_COST,
  PARCEL_GROWTH,
  PARCEL_MIN_LAND_TILES,
  PARCEL_START,
  PARCEL_UNLOCK_CHAPTER,
  PARCEL_SIZE,
  PARCELS_PER_SIDE,
  type BuildingType,
} from './balance';
import { isBuildableTile, isUnlockedTile, parcelOrigin, terrainAt } from './mapdata';
import { buildingDef, footprint } from './network';
import type { GameState } from './state';

// Cena další budovy daného druhu (roste s počtem už postavených)
export function buildingCost(s: GameState, type: BuildingType): number {
  const d = buildingDef(type);
  const placed = s.buildings.filter((b) => b.type === type).length;
  return Math.ceil(d.baseCost * Math.pow(d.growth, placed));
}

export type PlaceReason = 'ok' | 'chapter' | 'locked' | 'terrain' | 'occupied' | 'cost';

const occupiedKeys = (s: GameState) => {
  const set = new Set<string>();
  for (const b of s.buildings) for (const t of footprint(b)) set.add(`${t.x},${t.y}`);
  return set;
};

// Dá se budovu dát na dlaždici (x, y) = levý horní roh? Důvod, proč ne.
export function canPlace(s: GameState, type: BuildingType, x: number, y: number): PlaceReason {
  const d = buildingDef(type);
  if (s.chapter < d.unlockChapter) return 'chapter';
  const occ = occupiedKeys(s);
  for (const t of footprint({ type, x, y })) {
    if (!isUnlockedTile(s.unlockedParcels, t.x, t.y)) return 'locked';
    if (!isBuildableTile(t.x, t.y)) return 'terrain';
    if (occ.has(`${t.x},${t.y}`)) return 'occupied';
  }
  if (s.credits < buildingCost(s, type)) return 'cost';
  return 'ok';
}

// Postaví budovu, když to jde (peníze se strhnou, nikdy do mínusu)
export function placeBuilding(s: GameState, type: BuildingType, x: number, y: number): PlaceReason {
  const reason = canPlace(s, type, x, y);
  if (reason !== 'ok') return reason;
  s.credits -= buildingCost(s, type);
  s.buildings.push({ type, x, y });
  s.buildVersion += 1;
  return 'ok';
}

// Zboří budovu na dané dlaždici; vrátí část ceny. Vrací null, když tam nic nestojí.
export function demolishAt(s: GameState, x: number, y: number): { type: BuildingType; refund: number } | null {
  const i = s.buildings.findIndex((b) => footprint(b).some((t) => t.x === x && t.y === y));
  if (i < 0) return null;
  const b = s.buildings[i];
  // vrací se část dnešní ceny téhož druhu (bez této budovy)
  s.buildings.splice(i, 1);
  const refund = Math.floor(buildingCost(s, b.type) * BUILDING_REFUND);
  s.credits += refund;
  s.buildVersion += 1;
  return { type: b.type, refund };
}

// ---------- Parcely ----------
export const parcelsBought = (s: GameState) => s.unlockedParcels.length - PARCEL_START.length;
export const parcelCost = (s: GameState) => Math.ceil(PARCEL_BASE_COST * Math.pow(PARCEL_GROWTH, Math.max(0, parcelsBought(s))));

function landTilesOf(index: number): number {
  const o = parcelOrigin(index);
  let n = 0;
  for (let dy = 0; dy < PARCEL_SIZE; dy++) for (let dx = 0; dx < PARCEL_SIZE; dx++) if (terrainAt(o.x + dx, o.y + dy) === 'land') n++;
  return n;
}

// Parcely, které jde teď koupit: sousedí s odemčenou, mají dost pevniny a je odemčená kapitola
export function purchasableParcels(s: GameState): number[] {
  if (s.chapter < PARCEL_UNLOCK_CHAPTER) return [];
  const have = new Set(s.unlockedParcels);
  const out: number[] = [];
  for (let i = 0; i < PARCELS_PER_SIDE * PARCELS_PER_SIDE; i++) {
    if (have.has(i)) continue;
    const px = i % PARCELS_PER_SIDE;
    const py = Math.floor(i / PARCELS_PER_SIDE);
    const touches = [
      px > 0 && have.has(i - 1),
      px < PARCELS_PER_SIDE - 1 && have.has(i + 1),
      py > 0 && have.has(i - PARCELS_PER_SIDE),
      py < PARCELS_PER_SIDE - 1 && have.has(i + PARCELS_PER_SIDE),
    ].some(Boolean);
    if (touches && landTilesOf(i) >= PARCEL_MIN_LAND_TILES) out.push(i);
  }
  return out;
}

export type BuyReason = 'ok' | 'not-available' | 'cost';

export function buyParcel(s: GameState, index: number): BuyReason {
  if (!purchasableParcels(s).includes(index)) return 'not-available';
  const cost = parcelCost(s);
  if (s.credits < cost) return 'cost';
  s.credits -= cost;
  s.unlockedParcels.push(index);
  return 'ok';
}
