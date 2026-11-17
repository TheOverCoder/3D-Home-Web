import { describe, expect, it } from 'vitest'
import { BEDS, MACHINES, MACHINE_IDS } from './data'
import { SHOP, type ShopKind } from './decor'
import {
  BLOCKERS,
  DECOR_FEET,
  PLACE_IDS,
  PLACES,
  bedHome,
  canPlace,
  canPlaceBed,
  canPlaceNew,
  canPlaceThing,
  defaultLayout,
  freeSpot,
  isShopKind,
  joinRun,
  RENAMED_KINDS,
  runEnds,
  sanitizeLayout,
  type DecorPiece,
  type FarmLayout,
} from './layout'
import { UNLOCKS } from './unlocks'

// The farm's layout with the edit mode's newer things in it: the mill, the loom and the oven as places, each built bed
// where it was moved to, and the decoration and fruit plants bought in the shop, standing or in the store.

const KINDS = Object.keys(SHOP) as ShopKind[]
/** A layout with these pieces standing (ids from 1). */
const withDecor = (pieces: Omit<DecorPiece, 'id'>[], base: FarmLayout = defaultLayout()): FarmLayout => ({
  ...base,
  decor: pieces.map((p, i) => ({ ...p, id: i + 1 })),
  next: pieces.length + 1,
})
/** Every bed built (the beds of the fields bought too). */
const ALL_BUILT = BEDS.map(() => true)

describe('the kitchen and the beds move', () => {
  it('a new farm fits as it always stood: every place (the mill, the loom, the oven among them) and every bed', () => {
    const layout = defaultLayout()
    for (const id of PLACE_IDS) expect(canPlace(layout, id, layout.places[id]), id).toEqual({ ok: true })
    BEDS.forEach((_, i) => expect(canPlaceBed(layout, i, layout.beds[i]), `bed ${i}`).toEqual({ ok: true }))
    for (const id of MACHINE_IDS) expect(PLACES[id].home).toEqual({ x: MACHINES[id].x, z: MACHINES[id].z, rot: 0 })
  })

  it('the oven moves onto free land, turned or not, and keeps the place where you stand at it open', () => {
    const layout = defaultLayout()
    for (const rot of [0, 1, 2, 3]) expect(canPlace(layout, 'oven', { x: 2, z: 0, rot }), `turned ${rot}`).toEqual({ ok: true })
    // not onto the path among the beds, nor into the way to the mill
    expect(canPlace(layout, 'oven', { x: -1.2, z: 9, rot: 0 }).ok).toBe(false)
    const mill = PLACES.mill.home
    expect(canPlace(layout, 'oven', { x: mill.x - 1.5, z: mill.z - 1.5, rot: 0 }).ok).toBe(false)
  })

  it('a bed moves off its row, but not onto the path, another bed, or into a way in', () => {
    const layout = defaultLayout()
    expect(canPlaceBed(layout, 0, { x: 2, z: 0, rot: 1 })).toEqual({ ok: true })
    expect(canPlaceBed(layout, 0, { x: -1.2, z: 8, rot: 0 })).toEqual({ ok: false, reason: 'On the path' })
    expect(canPlaceBed(layout, 0, { x: BEDS[1].x, z: BEDS[1].z, rot: 0 })).toEqual({ ok: false, reason: 'On a garden bed' })
    // the hen run's nest is reached from outside its west fence: a bed may not stand there
    const hens = PLACES.hens.home
    expect(canPlaceBed(layout, 0, { x: hens.x - 2.5, z: hens.z - 1, rot: 1 }).ok).toBe(false)
  })

  it('a place keeps clear of a bed where it was moved to, and may stand where that bed was', () => {
    const moved: FarmLayout = { ...defaultLayout(), beds: defaultLayout().beds.map((p, i) => (i === 0 ? { x: 3, z: -2, rot: 0 } : p)) }
    expect(canPlace(moved, 'lemon', { x: 3, z: -2, rot: 0 })).toEqual({ ok: false, reason: 'On a garden bed' })
    // its first spot in the row is free land now (though the path beside it is not)
    expect(canPlaceNew(moved, 'flowers', { x: BEDS[0].x - 0.3, z: BEDS[0].z, rot: 0 })).toEqual({ ok: true })
  })
})

describe('the decoration and fruit plants', () => {
  it('each kind has a footprint, and fits on free land', () => {
    const layout = defaultLayout()
    for (const kind of KINDS) {
      expect(DECOR_FEET[kind], kind).toBeDefined()
      expect(canPlaceNew(layout, kind, { x: 2, z: 0, rot: 0 }), kind).toEqual({ ok: true })
    }
  })

  it('nothing stands off your land, on a path, a shrub, the shed, a bed or a place', () => {
    const layout = defaultLayout()
    expect(canPlaceNew(layout, 'lamp', { x: 20, z: 0, rot: 0 })).toEqual({ ok: false, reason: 'Off your land' })
    expect(canPlaceNew(layout, 'lamp', { x: -1.2, z: 9.5, rot: 0 }).ok).toBe(false)
    expect(canPlaceNew(layout, 'bush', { x: BEDS[0].x, z: BEDS[0].z, rot: 0 })).toEqual({ ok: false, reason: 'On a garden bed' })
    const hens = PLACES.hens.home
    expect(canPlaceNew(layout, 'bench', { x: hens.x, z: hens.z, rot: 0 })).toEqual({ ok: false, reason: 'On the hen run and coop' })
    for (const b of BLOCKERS) {
      const x = (b.rect.minX + b.rect.maxX) / 2
      const z = (b.rect.minZ + b.rect.maxZ) / 2
      expect(canPlaceNew(layout, 'path', { x, z, rot: 0 }).ok, b.name).toBe(false)
    }
  })

  it("a path may lie in front of a way in, a lamp may not; a place's way in may not be blocked by one", () => {
    const layout = defaultLayout()
    const hens = PLACES.hens.home
    // the nest box is reached from outside the run's west fence, 2.2 to 2.9 m from its middle
    const door = { x: hens.x - 3.1, z: hens.z - 1, rot: 0 }
    expect(canPlaceNew(layout, 'path', door)).toEqual({ ok: true })
    expect(canPlaceNew(layout, 'lamp', door)).toEqual({ ok: false, reason: 'In the way into the hen run and coop' })
    const lamped = withDecor([{ kind: 'lamp', ...door }])
    expect(canPlace(lamped, 'hens', hens).reason).toBe('Its way in is blocked by a yard lamp')
  })

  it('two pieces never stand on each other; fences and hedges meet end to end and at corners', () => {
    const one = withDecor([{ kind: 'fence', x: 2, z: 0, rot: 0 }])
    expect(canPlaceNew(one, 'lamp', { x: 2, z: 0, rot: 0 })).toEqual({ ok: false, reason: 'On a picket fence' })
    expect(canPlaceNew(one, 'fence', { x: 2.5, z: 0, rot: 0 }).ok).toBe(false)
    // in line, end to end; at a corner; a T
    expect(canPlaceNew(one, 'fence', { x: 4, z: 0, rot: 0 })).toEqual({ ok: true })
    expect(canPlaceNew(one, 'fence', { x: 3, z: 1, rot: 1 })).toEqual({ ok: true })
    expect(canPlaceNew(one, 'hedge', { x: 2, z: 1, rot: 1 })).toEqual({ ok: true })
    const hedge = withDecor([{ kind: 'hedge', x: 2, z: 0, rot: 0 }])
    expect(canPlaceNew(hedge, 'hedge', { x: 3, z: 1, rot: 1 })).toEqual({ ok: true })
    expect(canPlaceNew(hedge, 'hedge', { x: 2, z: 0.5, rot: 0 }).ok).toBe(false)
  })

  it('a section put down near the end of another is moved so the two ends meet', () => {
    const layout = withDecor([{ kind: 'fence', x: 2, z: 0, rot: 0 }])
    const near: DecorPiece = { id: 9, kind: 'fence', x: 4.4, z: 0.2, rot: 0 }
    const joined = joinRun(layout, near)
    expect([joined.x, joined.z]).toEqual([4, 0])
    expect(runEnds(joined)[0]).toEqual([3, 0])
    // far from any end: where it was put
    expect(joinRun(layout, { ...near, x: 8, z: 3 })).toEqual({ ...near, x: 8, z: 3 })
    // a lamp is never moved
    expect(joinRun(layout, { ...near, kind: 'lamp' })).toEqual({ ...near, kind: 'lamp' })
  })

  it('a free spot for a new piece is the nearest that fits, on the grid', () => {
    const layout = defaultLayout()
    const spot = freeSpot(layout, 'bench', 2, 0)!
    expect(spot).toEqual({ x: 2, z: 0, rot: 0 })
    // on the path: the nearest free spot beside it
    const beside = freeSpot(layout, 'lamp', -1.2, 9.5)!
    expect(canPlaceNew(layout, 'lamp', beside)).toEqual({ ok: true })
    expect(Math.hypot(beside.x + 1.2, beside.z - 9.5)).toBeLessThan(3)
    expect([beside.x * 2, beside.z * 2].every(Number.isInteger)).toBe(true)
  })

  it('a piece moving onto its own spot (a turn, a drag that comes back) fits', () => {
    const layout = withDecor([{ kind: 'bench', x: 2, z: 0, rot: 0 }])
    expect(canPlaceThing(layout, { kind: 'decor', id: 1 }, { x: 2, z: 0, rot: 1 })).toEqual({ ok: true })
  })
})

describe('the layout as saved', () => {
  it('a farm from before the decoration loads with none, nothing stored, the beds and the kitchen where they stood', () => {
    const old = sanitizeLayout({ places: { hens: { x: 11.6, z: 6.7, rot: 0 } }, land: ['east'] }, ALL_BUILT)
    expect(old.decor).toEqual([])
    expect(Object.values(old.stored).every((n) => n === 0)).toBe(true)
    expect(old.beds).toEqual(BEDS.map((_, i) => bedHome(i)))
    for (const id of MACHINE_IDS) expect(old.places[id]).toEqual(PLACES[id].home)
    expect(old.next).toBe(1)
  })

  it('a built bed loads where it was moved; one not built where it was staked out', () => {
    const beds = defaultLayout().beds.map((p, i) => (i === 0 || i === 6 ? { x: 2, z: i === 0 ? 0 : 3, rot: 1 } : p))
    const built = BEDS.map((_, i) => i !== 6)
    const l = sanitizeLayout({ ...defaultLayout(), beds }, built)
    expect(l.beds[0]).toEqual({ x: 2, z: 0, rot: 1 })
    expect(l.beds[6]).toEqual(bedHome(6))
  })

  it('a piece loads where it stood with its id; one that no longer fits (a field not bought, on another) goes into the store', () => {
    const saved = {
      ...defaultLayout(),
      decor: [
        { id: 4, kind: 'lamp', x: 2, z: 0, rot: 0 },
        { id: 7, kind: 'bench', x: 20, z: 0, rot: 0 },
        { id: 8, kind: 'bush', x: 2, z: 0, rot: 0 },
        { id: 9, kind: 'teapot', x: 4, z: 4, rot: 0 },
        { id: 10, kind: 'constructor', x: 4, z: 4, rot: 0 },
        { id: 4, kind: 'apple-tree', x: 5, z: -3, rot: 2 },
      ],
      stored: { ...defaultLayout().stored, lamp: 2 },
      next: 11,
    }
    const l = sanitizeLayout(saved, ALL_BUILT)
    expect(l.decor.map((d) => [d.id, d.kind])).toEqual([
      [4, 'lamp'],
      // a second piece saved with the same id gets a new one
      [11, 'apple-tree'],
    ])
    expect(l.stored.lamp).toBe(2)
    expect(l.stored.bench).toBe(1)
    expect(l.stored.bush).toBe(1)
    expect(l.next).toBe(12)
    expect(Object.keys(l.stored).sort()).toEqual([...KINDS].sort())
  })

  it('a farm that owns the first three scarecrows keeps every one, standing or stored, as the kind it is now', () => {
    // the squire, the ploughman and the bogle the shop sold before the nine (RENAMED_KINDS), standing on free land and
    // waiting in the store, beside a farmer bought since
    const saved = {
      ...defaultLayout(),
      decor: [
        { id: 3, kind: 'scarecrow-squire', x: 2, z: 0, rot: 2 },
        { id: 5, kind: 'scarecrow-ploughman', x: 2, z: 3, rot: 1 },
        { id: 6, kind: 'scarecrow-bogle', x: 5, z: 0, rot: 0 },
        { id: 8, kind: 'scarecrow-farmer', x: 5, z: 3, rot: 0 },
      ],
      stored: { 'scarecrow-bogle': 2, 'scarecrow-squire': 1, 'scarecrow-haymaker': 1, lamp: 1 },
      next: 9,
    }
    const l = sanitizeLayout(saved, ALL_BUILT)
    expect(l.decor).toEqual([
      { id: 3, kind: 'scarecrow-witch', x: 2, z: 0, rot: 2 },
      { id: 5, kind: 'scarecrow-farmer', x: 2, z: 3, rot: 1 },
      { id: 6, kind: 'scarecrow-haymaker', x: 5, z: 0, rot: 0 },
      { id: 8, kind: 'scarecrow-farmer', x: 5, z: 3, rot: 0 },
    ])
    expect(l.stored['scarecrow-haymaker']).toBe(3)
    expect(l.stored['scarecrow-witch']).toBe(1)
    expect(l.stored.lamp).toBe(1)
    expect(l.next).toBe(9)
    // the old names are no kinds of the shop's any more, nor kept in the store
    for (const old of Object.keys(RENAMED_KINDS)) {
      expect(isShopKind(old), old).toBe(false)
      expect(Object.keys(l.stored)).not.toContain(old)
      expect(isShopKind(RENAMED_KINDS[old]), RENAMED_KINDS[old]).toBe(true)
    }
    // each opens at the level the one it was opened at
    expect(UNLOCKS['decor:scarecrow-farmer']).toBe(8)
    expect(UNLOCKS['decor:scarecrow-haymaker']).toBe(9)
    expect(UNLOCKS['decor:scarecrow-witch']).toBe(11)
    // nothing lost: what was owned of the three is owned of the new kinds, piece for piece
    const owned = (x: FarmLayout) => x.decor.length + Object.values(x.stored).reduce((a, b) => a + b, 0)
    expect(owned(l)).toBe(saved.decor.length + 5)
  })

  it('garbage, numbers far off and counts that are not counts never throw: a layout that keeps the rules', () => {
    const odd: unknown[] = [
      null,
      7,
      'layout',
      { decor: 'many' },
      { decor: [null, 3, { kind: 'lamp' }, { kind: 'lamp', x: 1e308, z: -1e308, rot: 1e308, id: -1 }] },
      { stored: { lamp: -4, fence: 1e9, path: 'six', well: Number.NaN }, next: 'x' },
      { beds: [{ x: 'a' }, null, { x: 2, z: 0, rot: Infinity }] },
      { decor: Array.from({ length: 50 }, (_, i) => ({ id: 1, kind: 'path', x: 2 + (i % 5), z: Math.floor(i / 5) - 4, rot: 0 })) },
    ]
    for (const raw of odd) {
      const l = sanitizeLayout(raw, ALL_BUILT)
      for (const d of l.decor) expect(canPlaceThing(l, { kind: 'decor', id: d.id }, d), JSON.stringify(raw).slice(0, 60)).toEqual({ ok: true })
      for (const kind of KINDS) expect(Number.isInteger(l.stored[kind]) && l.stored[kind] >= 0 && l.stored[kind] <= 999).toBe(true)
      expect(new Set(l.decor.map((d) => d.id)).size).toBe(l.decor.length)
      expect(l.decor.every((d) => d.id >= 1 && d.id < l.next)).toBe(true)
    }
    // fifty tiles saved with one id: each gets its own, every one that fits stands (the rest wait in the store)
    const tiles = sanitizeLayout(odd[odd.length - 1], ALL_BUILT)
    expect(tiles.decor.length + tiles.stored.path).toBe(50)
  })
})
