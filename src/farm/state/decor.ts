import { PRODUCERS, STORES, storeOf } from '../data'
import { bears, canPlaceNew, canPlaceThing, decorRect, freeSpot, isPlant, joinRun, mostOf, snap, type DecorPiece, type FarmLayout, type Fit, type Placement } from '../layout'
import { SHOP as FARM_SHOP, BEARER_KINDS, FRUIT, nextPrice, type BearerKind, type FruitKind, type ShopItemView, type ShopKind } from '../decor'
import { PIECES, type PieceType } from '../../home/catalogue'
import { canMoveOpening, canPlacePiece, findFreeSpot, type HomeFit, type HomeLayout, type HomePiece } from '../../home/layout'
import { floorById, paintById, type OpeningAt } from '../../home/shell'
import type { RoomId } from '../../data/layout'
import { bump, farm, isUnlocked, lockField, lockOf, save, type FarmData } from './core'
import { gainXp } from './levels'
import { collect, stockOf } from './producers'
import { quarter } from './shop'
import { SEASONS, type SeasonId } from '../season'
import { seasonPlaying } from './season'

// The farm's decoration and fruit plants (the edit mode's shop), and the house's furniture and shell (decorating).

/** How many of a kind the farm has: standing on it and waiting in its store (what its next price is counted from). */
export const decorOwned = (kind: ShopKind) => farm.layout.decor.filter((d) => d.kind === kind).length + farm.layout.stored[kind]
/** What the next one of a kind costs. */
export const decorPrice = (kind: ShopKind) => nextPrice(FARM_SHOP[kind].price, decorOwned(kind))
/** Whether one more of a kind can be bought: it is open at the farm's level, and a kind has a most (a fruit kind's
 *  plants). */
export const decorForSale = (kind: ShopKind) => decorOwned(kind) < mostOf(kind) && isUnlocked(`decor:${kind}`) && inItsSeason(kind)

/** A season's piece is sold only in its season (mission 10 c8; bought, it stands all year); every other kind always.
 *  While the farm's year is quiet or waits (src/farm/state/season.ts, seasonPlaying) nothing is held back. */
export function inItsSeason(kind: ShopKind) {
  const own = (FARM_SHOP[kind] as { season?: SeasonId }).season
  const now = seasonPlaying()
  return !own || now === null || own === now
}

/** Every kind of the farm's shop as it shows it: how many the farm has, the next one's price, and the level it opens at
 *  while it is locked. */
export function shopView(): ShopItemView[] {
  return (Object.keys(FARM_SHOP) as ShopKind[]).map((kind) => {
    const def = FARM_SHOP[kind]
    const price = decorPrice(kind)
    const fruit = isPlant(kind) ? FRUIT[kind as FruitKind].fruit : undefined
    return {
      kind,
      tab: def.tab,
      name: def.name,
      owned: decorOwned(kind),
      price,
      can: decorForSale(kind) && farm.coins >= price,
      ...(fruit ? { fruit } : {}),
      ...lockField(lockOf(`decor:${kind}`)),
      ...seasonField(kind),
    }
  })
}

/** A season's piece's ribbon in the shop: its season, and whether it is now. */
function seasonField(kind: ShopKind): Pick<ShopItemView, 'season'> {
  const own = (FARM_SHOP[kind] as { season?: SeasonId }).season
  if (!own) return {}
  return { season: { name: SEASONS[own].name, pic: SEASONS[own].pic, now: inItsSeason(kind) } }
}

/** The plants of a fruit kind (or the hives) standing on the farm, in order: its producer's animals. */
function plantsOf(kind: BearerKind, layout: FarmLayout = farm.layout) {
  return layout.decor.filter((d) => d.kind === kind)
}

/** A fruit kind's producer holds as many plants (each a count and a clock) as stand on the farm: a save read, the counts
 *  and clocks of the plants there kept, any more start bare. */
export function fitPlants(data: FarmData) {
  for (const kind of BEARER_KINDS) {
    const n = plantsOf(kind, data.layout).length
    const p = data.producers[kind]
    const max = PRODUCERS[kind].max
    data.producers[kind] = {
      animals: n,
      stock: Array.from({ length: n }, (_, i) => Math.min(max, p.stock[i] ?? 0)),
      timer: Array.from({ length: n }, (_, i) => p.timer[i] ?? 0),
    }
  }
}

/** A new piece stands at a spot: a fruit plant becomes one more of its producer's (bare: its fruit to come), in the order
 *  it stands in the layout. */
function standPiece(d: DecorPiece) {
  farm.layout = { ...farm.layout, decor: [...farm.layout.decor, d], next: Math.max(farm.layout.next, d.id + 1) }
  if (bears(d.kind)) {
    const p = farm.producers[d.kind]
    p.animals += 1
    p.stock.push(0)
    p.timer.push(0)
  }
}

/** Where a piece put down by the edit mode goes: on the half-metre grid, a fence or hedge joined to one whose end is
 *  near. */
function landing(kind: ShopKind, id: number, to: Placement): DecorPiece {
  return joinRun(farm.layout, { id, kind, x: snap(to.x), z: snap(to.z), rot: quarter(to.rot) })
}

/** Buys one of a kind (its price tag's card asked first): it waits in the farm's store until put down (the edit mode
 *  puts it down at once where there is room: `placeDecor`). Whether it was bought. */
export function buyDecor(kind: ShopKind): boolean {
  if (!Object.prototype.hasOwnProperty.call(FARM_SHOP, kind) || !decorForSale(kind)) return false
  const price = decorPrice(kind)
  if (!(farm.coins >= price)) return false
  farm.coins -= price
  farm.layout = { ...farm.layout, stored: { ...farm.layout.stored, [kind]: farm.layout.stored[kind] + 1 } }
  gainXp('build')
  bump()
  save()
  return true
}

/** Takes one of a kind out of the store and stands it at a spot, if it fits there: its id, or why not. */
export function placeDecor(kind: ShopKind, to: Placement): Fit & { id?: number } {
  if (!(farm.layout.stored[kind] > 0)) return { ok: false, reason: 'None in your store' }
  const d = landing(kind, farm.layout.next, to)
  const fit = canPlaceNew(farm.layout, kind, d)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, stored: { ...farm.layout.stored, [kind]: farm.layout.stored[kind] - 1 } }
  standPiece(d)
  bump()
  save()
  return { ok: true, id: d.id }
}

/** A free spot for one of a kind near (x, z) (on your land, clear of everything), or null. */
export const freeDecorSpot = (kind: ShopKind, x: number, z: number) => freeSpot(farm.layout, kind, x, z)

/** Moves (or turns) a piece standing on the farm, if it fits there (a fence or hedge joins one whose end is near). */
export function moveDecor(id: number, to: Placement): Fit {
  const d = farm.layout.decor.find((x) => x.id === id)
  if (!d) return { ok: false, reason: 'Not on the farm' }
  const q = landing(d.kind, id, to)
  const fit = canPlaceThing(farm.layout, { kind: 'decor', id }, q)
  if (!fit.ok) return fit
  farm.layout = { ...farm.layout, decor: farm.layout.decor.map((x) => (x.id === id ? q : x)) }
  bump()
  save()
  return fit
}

/** Where a piece would go if put down at `to` (on the grid, joined to a run's end near it), for the edit mode's drag. */
export const decorLanding = (id: number, to: Placement): Placement => {
  const d = farm.layout.decor.find((x) => x.id === id)
  if (!d) return to
  const q = landing(d.kind, id, to)
  return { x: q.x, z: q.z, rot: q.rot }
}

/** Puts a piece standing on the farm away into the store (put down again later for nothing). A fruit plant's fruit is
 *  picked first, into the silo; while the silo has no room for all of it, the plant stays. */
export function storeDecor(id: number): Fit {
  const k = farm.layout.decor.findIndex((x) => x.id === id)
  if (k < 0) return { ok: false, reason: 'Not on the farm' }
  const d = farm.layout.decor[k]
  if (bears(d.kind)) {
    const kind = d.kind
    const i = plantsOf(kind).findIndex((x) => x.id === id)
    if (stockOf(kind, i) > 0) {
      const r = decorRect(d)
      collect(kind, i, { x: (r.minX + r.maxX) / 2, y: PRODUCERS[kind].sparkle, z: (r.minZ + r.maxZ) / 2 })
      if (stockOf(kind, i) > 0)
        return { ok: false, reason: `The ${STORES[storeOf(PRODUCERS[kind].good)].name.toLowerCase()} is full: ${isPlant(kind) ? 'its fruit has' : 'what it gives has'} nowhere to go` }
    }
    const p = farm.producers[kind]
    p.animals -= 1
    p.stock.splice(i, 1)
    p.timer.splice(i, 1)
  }
  farm.layout = { ...farm.layout, decor: farm.layout.decor.filter((x) => x.id !== id), stored: { ...farm.layout.stored, [d.kind]: farm.layout.stored[d.kind] + 1 } }
  bump()
  save()
  return { ok: true }
}

/** The fruit plant a piece is, with its place among its kind's plants (its producer's animal), or null. */
export function plantOf(id: number): { kind: BearerKind; index: number } | null {
  const d = farm.layout.decor.find((x) => x.id === id)
  if (!d || !bears(d.kind)) return null
  const kind = d.kind
  return { kind, index: plantsOf(kind).findIndex((x) => x.id === id) }
}

/** Moves (or turns) a piece of furniture to where it fits; if it does not, nothing moves and the reason comes back. */
export function movePiece(id: string, to: Placement): HomeFit {
  const p = farm.home.pieces.find((q) => q.id === id)
  if (!p) return { ok: false, reason: 'Not in the house' }
  if (PIECES[p.type].fitted) return { ok: false, reason: 'Built in' }
  const q: HomePiece = { ...p, x: to.x, z: to.z, rot: quarter(to.rot) }
  const fit = canPlacePiece(farm.home, q)
  if (!fit.ok) return fit
  farm.home = { ...farm.home, pieces: farm.home.pieces.map((o) => (o.id === id ? q : o)) }
  bump()
  save()
  return fit
}

/** Puts a piece away into storage (what is built in stays, and a screen). */
export function storePiece(id: string) {
  const p = farm.home.pieces.find((q) => q.id === id)
  if (!p || PIECES[p.type].fitted || PIECES[p.type].keep) return false
  farm.home = { ...farm.home, pieces: farm.home.pieces.filter((o) => o.id !== id), stored: [...farm.home.stored, p.type] }
  bump()
  save()
  return true
}

/** Takes a piece of this kind out of storage and stands it here, if it fits: its id, or the reason it does not. */
export function placeStored(type: PieceType, to: Placement): Fit & { id?: string } {
  const k = farm.home.stored.indexOf(type)
  if (k < 0) return { ok: false, reason: 'None in storage' }
  const id = `${type}-${farm.home.next}`
  const q: HomePiece = { id, type, x: to.x, z: to.z, rot: quarter(to.rot) }
  const fit = canPlacePiece(farm.home, q)
  if (!fit.ok) return fit
  const stored = farm.home.stored.filter((_, j) => j !== k)
  farm.home = { ...farm.home, pieces: [...farm.home.pieces, q], stored, next: farm.home.next + 1 }
  bump()
  save()
  return { ok: true, id }
}

/** Buys a piece of furniture: it waits in storage until you stand it somewhere. */
export function buyPiece(type: PieceType) {
  const def = PIECES[type]
  if (!def || !def.price || farm.coins < def.price) return false
  farm.coins -= def.price
  farm.home = { ...farm.home, stored: [...farm.home.stored, type] }
  bump()
  save()
  return true
}

/** Slides a doorway, a window or the garden door along its wall, or closes or opens one, where it fits (the house's
 *  shell: src/home/shell.ts); if it does not, nothing changes and the reason comes back. */
export function moveOpening(id: string, at: OpeningAt): HomeFit {
  const fit = canMoveOpening(farm.home, id, at)
  if (!fit.ok) return fit
  farm.home = { ...farm.home, shell: { ...farm.home.shell, openings: { ...farm.home.shell.openings, [id]: { run: at.run, centre: at.centre, closed: at.closed } } } }
  bump()
  save()
  return fit
}

/** Paints a room's walls (its own side of each; null: as it was built), or lays another floor in it. Free. */
export function paintRoom(room: RoomId, paint: string | null) {
  if (paint !== null && !paintById(paint)) return false
  farm.home = { ...farm.home, shell: { ...farm.home.shell, paint: { ...farm.home.shell.paint, [room]: paint } } }
  bump()
  save()
  return true
}
export function floorRoom(room: RoomId, floor: string) {
  if (!floorById(floor)) return false
  farm.home = { ...farm.home, shell: { ...farm.home.shell, floors: { ...farm.home.shell.floors, [room]: floor } } }
  bump()
  save()
  return true
}

/** Puts the house back as it was a moment ago (the decorate mode's undo), with the coins of a purchase it undoes. */
export function restoreHome(layout: HomeLayout, refund = 0) {
  farm.home = layout
  farm.coins += refund
  bump()
  save()
}

/** A free spot for a piece in a room, for placing one from storage without dragging it there. */
export const freeSpotFor = (type: PieceType, room: Parameters<typeof findFreeSpot>[2]) => findFreeSpot(farm.home, type, room)
