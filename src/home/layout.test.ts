import { describe, expect, it } from 'vitest'
import { ROOMS, type RoomId } from '../data/layout'
import { PIECES, PIECE_TYPES, type PieceType } from './catalogue'
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
    for (const d of defaultHome().pieces) expect(out.pieces.some((p) => p.id === d.id), d.id).toBe(true)
    expect(out.pieces.length + out.stored.length).toBe(old.pieces.length)
    expect(out.stored.length).toBeGreaterThan(0)
    expect(out.stored.every((t) => t === 'plant-tall')).toBe(true)
  })
})
