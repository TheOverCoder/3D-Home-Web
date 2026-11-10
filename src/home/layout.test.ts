import { describe, expect, it } from 'vitest'
import { ROOMS, type RoomId } from '../data/layout'
import { endsWithin } from '../lib/endsWithin'
import { PIECES, PIECE_TYPES, isPieceType, type PieceType } from './catalogue'
import { ROOM_WEIGHT, canPlacePiece, defaultHome, findFreeSpot, roomFull, roomWeight, sanitizeHome, snapPiece, unreachable, type HomeLayout, type HomePiece } from './layout'
import { pieceUrl } from './pictures'

const ROOM_IDS = Object.keys(ROOMS) as RoomId[]
const forSale = PIECE_TYPES.filter((t) => PIECES[t].price > 0)
const heaviest = [...forSale].sort((a, b) => PIECES[b].weight - PIECES[a].weight)[0]

/** Buys and stands pieces of a kind in a room, at the free spot nearest its middle each time, until none fits. */
function fill(home: HomeLayout, type: PieceType, room: RoomId): HomeLayout {
  let out = home
  for (let n = 0; n < 100; n++) {
    const spot = findFreeSpot(out, type, room, `${type}-${out.next}`)
    if (!spot) return out
    out = { ...out, pieces: [...out.pieces, spot], next: out.next + 1 }
  }
  throw new Error('the room never filled up')
}

describe('the house layout rules', () => {
  it('every piece of the default house fits where it stands', () => {
    const home = defaultHome()
    const misfits = home.pieces.map((p) => ({ id: p.id, fit: canPlacePiece(home, p) })).filter((r) => !r.fit.ok)
    expect(misfits).toEqual([])
    expect(unreachable(home)).toBeNull()
  })

  it('a saved house with a piece that no longer fits puts it into storage, never loses it', () => {
    const saved = defaultHome()
    // the sofa dragged onto the bed in an old save
    const bed = saved.pieces.find((p) => p.id === 'bed')!
    saved.pieces = saved.pieces.map((p) => (p.id === 'sofa' ? { ...p, x: bed.x, z: bed.z } : p))
    const out = sanitizeHome(JSON.parse(JSON.stringify(saved)))
    expect(out.pieces.some((p) => p.id === 'sofa')).toBe(false)
    expect(out.stored).toContain('sofa')
    expect(out.pieces.length + out.stored.length).toBe(saved.pieces.length)
  })

  it('drops unknown pieces and keeps fitted ones where they were built', () => {
    const saved = defaultHome()
    const fridge = saved.pieces.find((p) => p.id === 'fridge')!
    const raw = { ...saved, pieces: [...saved.pieces.map((p) => (p.id === 'fridge' ? { ...p, x: 0 } : p)), { id: 'x', type: 'piano', x: 0, z: 0, rot: 0 }] }
    const out = sanitizeHome(raw)
    expect(out.pieces.find((p) => p.id === 'fridge')).toEqual(fridge)
    expect(out.pieces.some((p) => p.id === 'x')).toBe(false)
    expect(sanitizeHome('garbage')).toEqual(defaultHome())
  })

  it('snaps to a quarter-metre grid and finds a free spot that fits', () => {
    const home = defaultHome()
    const p = snapPiece({ id: 'n', type: 'pouf', x: 0, z: 0, rot: 0 }, -2.13, 2.8)
    expect([p.x, p.z]).toEqual([-2.25, 2.75])
    const spot = findFreeSpot(home, 'stool', 'kitchen')
    expect(spot).not.toBeNull()
    expect(canPlacePiece(home, spot!).ok).toBe(true)
  })

  it('a kind of piece is one in the catalogue, never a name every object has ("valueOf", "constructor")', () => {
    for (const t of ['valueOf', 'constructor', '__proto__', 'toString', 'hasOwnProperty']) expect(isPieceType(t), t).toBe(false)
    expect(PIECE_TYPES.filter((t) => !isPieceType(t))).toEqual([])
    // a saved house with such kinds, standing and in storage: they are dropped, the rest kept
    const saved = defaultHome()
    const pieces = [...saved.pieces, { id: 'v', type: 'valueOf', x: -2, z: 2, rot: 0 }, { id: 'c', type: 'constructor', x: 30, z: 0, rot: 0 }]
    const out = sanitizeHome({ ...saved, pieces, stored: ['__proto__', 'stool', 'toString'] })
    expect(out.pieces).toEqual(saved.pieces)
    expect(out.stored).toEqual(['stool'])
  })

  it('a piece saved far off (±1.79e308, 1e16) goes into storage, and checking the house ends', () => {
    // the lamp on the desk or the nightstand goes where the piece goes, and the walk-to check looks round the lamp's cell
    // on the floor: from −∞, or past 2^53, `z++` never moved and loading never ended
    const far: [string, PieceType, number, number][] = [
      ['desk', 'desk', -3.5, -1.79e308],
      ['desk', 'desk', -3.5, 1.79e308],
      ['nightstand', 'nightstand', 1.79e308, 5.6],
      ['desk', 'desk', -3.5, 1e16],
    ]
    for (const [id, type, x, z] of far) {
      const saved = defaultHome()
      saved.pieces = saved.pieces.map((p) => (p.id === id ? { ...p, x, z } : p))
      let out: HomeLayout | undefined
      const ended = endsWithin(2000, () => (out = sanitizeHome(JSON.parse(JSON.stringify(saved)))))
      expect(ended, `${id} at ${x}, ${z}`).toBe(true)
      // put away, never lost; everything else stays where it stood
      expect(out!.stored).toEqual([type])
      expect(out!.pieces).toEqual(defaultHome().pieces.filter((p) => p.id !== id))
    }
  })

  it('a built-in piece saved as another kind is the built-in again, where it was built (it cannot be bought again)', () => {
    // the counter saved as a wardrobe stood as a wardrobe, and the counter never came back: one with its id was there
    const saved = defaultHome()
    const raw = { ...saved, pieces: saved.pieces.map((p) => (p.id === 'counter' ? { ...p, type: 'wardrobe' } : p.id === 'fridge' ? { ...p, type: 'stool', x: 0.5 } : p)) }
    const out = sanitizeHome(JSON.parse(JSON.stringify(raw)))
    expect(out.pieces).toEqual(saved.pieces)
    expect(out.stored).toEqual([])
  })

  it('the next piece taken out of storage gets an id of its own, whatever was saved as `next`', () => {
    // a stool bought and stood is stool-1; with `next` lost or edited, the next one was stool-1 too, and putting one of
    // the two away put both away (the second was lost)
    const saved = { ...defaultHome(), pieces: [...defaultHome().pieces, { id: 'stool-1', type: 'stool', x: 3.5, z: -3.25, rot: 0 }] }
    for (const next of [undefined, [], '7', 1, 0.5, -3, null]) expect(sanitizeHome({ ...saved, next }).next, JSON.stringify(next)).toBe(2)
    expect(sanitizeHome({ ...saved, next: 7 }).next).toBe(7)
    expect(sanitizeHome({ ...saved, next: 1e300 }).next).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('a save with more pieces than any house holds (thirty thousand stools, 2 MB) loads at once; none is lost', () => {
    // every piece was weighed against every other: this took over a minute, at every start
    const stools = Array.from({ length: 30_000 }, (_, i) => ({ id: `stool-${i + 1}`, type: 'stool' as const, x: 3.5, z: -3.25, rot: 0 }))
    let out: HomeLayout | undefined
    const ended = endsWithin(2000, () => (out = sanitizeHome({ pieces: [...defaultHome().pieces, ...stools], stored: [], next: 30_001 })))
    expect(ended).toBe(true)
    // today's furniture stands, and one of the stools (they all stood in one spot): the others wait in storage
    expect(out!.pieces.slice(0, -1)).toEqual(defaultHome().pieces)
    expect(out!.pieces.at(-1)).toMatchObject({ type: 'stool', x: 3.5, z: -3.25 })
    expect(out!.stored.length).toBe(stools.length - 1)
  })

  it('the walk-to check ends whatever the numbers: a lamp carried off to ±1.79e308, ±1e16, ±Infinity or NaN is out of reach', () => {
    for (const z of [-1.79e308, 1.79e308, 1e16, -1e16, Infinity, -Infinity, NaN]) {
      const home = defaultHome()
      const layout = { ...home, pieces: home.pieces.map((p) => (p.id === 'desk' ? { ...p, z } : p)) }
      let blocked: string | null = null
      const ended = endsWithin(2000, () => (blocked = unreachable(layout)))
      expect(ended, `the desk at z = ${z}`).toBe(true)
      expect(blocked).toBe('the lamp')
    }
  })

  it('import.meta.glob: every kind of piece has its picture', () => {
    const missing = PIECE_TYPES.filter((t) => !pieceUrl(t))
    expect(missing).toEqual([])
  })
})

describe('what a room may draw', () => {
  it('every kind of piece has a weight, and every room of the default house is within the limit', () => {
    expect(PIECE_TYPES.filter((t) => !(PIECES[t].weight > 0))).toEqual([])
    const home = defaultHome()
    for (const room of ROOM_IDS) expect(roomWeight(home, room), room).toBeLessThanOrEqual(ROOM_WEIGHT)
    // the sum of the rooms is the sum of the pieces (each piece stands in exactly one room)
    expect(ROOM_IDS.reduce((s, r) => s + roomWeight(home, r), 0)).toBe(home.pieces.reduce((s, p) => s + PIECES[p.type].weight, 0))
  })

  it('a room filled with the heaviest piece stops at the limit: "This room is full"', () => {
    for (const room of ROOM_IDS) {
      const full = fill(defaultHome(), heaviest, room)
      expect(full.pieces.length, room).toBeGreaterThan(defaultHome().pieces.length)
      expect(roomWeight(full, room), room).toBeLessThanOrEqual(ROOM_WEIGHT)
      expect(roomWeight(full, room) + PIECES[heaviest].weight, room).toBeGreaterThan(ROOM_WEIGHT)
      expect(roomFull(full, room, heaviest)).toBe(true)
      // anywhere in it, the next one is refused for that reason
      const b = ROOMS[room].bounds
      const probe: HomePiece = { id: 'probe', type: heaviest, x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, rot: 0 }
      expect(canPlacePiece(full, probe)).toEqual({ ok: false, reason: 'This room is full' })
      // what is there still fits where it stands, and the house can still be walked through
      expect(full.pieces.filter((p) => !canPlacePiece(full, p).ok).map((p) => p.id)).toEqual([])
      expect(unreachable(full)).toBeNull()
    }
  })

  it('a full room still lets its own pieces move about in it, and other rooms take more', () => {
    const full = fill(defaultHome(), heaviest, 'bedroom')
    // a piece's own weight is not counted twice: the last chair bought can go elsewhere in the room
    const chair = full.pieces[full.pieces.length - 1]
    const b = ROOMS.bedroom.bounds
    let elsewhere: HomePiece | null = null
    for (let x = b.minX + 0.5; x < b.maxX && !elsewhere; x += 0.25)
      for (let z = b.minZ + 0.5; z < b.maxZ && !elsewhere; z += 0.25) {
        const q = { ...chair, x, z }
        if ((x !== chair.x || z !== chair.z) && canPlacePiece(full, q).ok) elsewhere = q
      }
    expect(elsewhere).not.toBeNull()
    expect(roomFull(full, 'office', heaviest)).toBe(false)
  })

  it('a saved house over the limit (from before it) puts its newest pieces away first, never loses one', () => {
    // the old game had no limit: six more tall plants in the living room
    const extra: HomePiece[] = [
      [-1.5, 1.5],
      [-1.0, 4.5],
      [-6.3, 1.6],
      [-2.0, 4.75],
      [-0.6, 3.0],
      [-5.5, 4.6],
    ].map(([x, z], i) => ({ id: `plant-tall-${50 + i}`, type: 'plant-tall', x, z, rot: 0 }))
    const old: HomeLayout = { pieces: [...defaultHome().pieces, ...extra], stored: [], next: 60 }
    expect(roomWeight(old, 'living')).toBeGreaterThan(ROOM_WEIGHT)
    const out = sanitizeHome(JSON.parse(JSON.stringify(old)))
    expect(roomWeight(out, 'living')).toBeLessThanOrEqual(ROOM_WEIGHT)
    // the living room keeps the furniture it always had; the plants that do not fit wait in storage
    for (const d of defaultHome().pieces)
      expect(
        out.pieces.some((p) => p.id === d.id),
        d.id,
      ).toBe(true)
    expect(out.pieces.length + out.stored.length).toBe(old.pieces.length)
    expect(out.stored.length).toBeGreaterThan(0)
    expect(out.stored.every((t) => t === 'plant-tall')).toBe(true)
  })
})
