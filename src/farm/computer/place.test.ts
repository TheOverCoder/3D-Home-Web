import { describe, expect, it } from 'vitest'
import { roomAt } from '../../data/layout'
import { PIECES } from '../../home/catalogue'
import { ROOM_WEIGHT, canPlacePiece, defaultHome, roomWeight } from '../../home/layout'
import { deskOf, hasComputer, spotNear } from './place'

// Where the house's computer goes (./place.ts): sold in the furniture shop (Tables) and by the studio desk's price
// tag while the house has none, it stands at the free spot nearest the desk — inside the studio's weight like any
// piece, and refused by a full room.

describe("the house's computer", () => {
  it('is a piece of the furniture shop: 500 coins, under Tables, standing on the floor, with its weight', () => {
    const c = PIECES.computer
    expect([c.price, c.group, c.layer]).toEqual([500, 'tables', 'floor'])
    expect(c.weight).toBeGreaterThan(0)
    expect(c.weight).toBeLessThan(ROOM_WEIGHT - roomWeight(defaultHome(), 'office'))
  })

  it('today’s house has none, and the desk that sells one is the studio’s', () => {
    const home = defaultHome()
    expect(hasComputer(home)).toBe(false)
    const desk = deskOf(home)!
    expect(desk.id).toBe('desk')
    expect(roomAt(desk.x, desk.z)).toBe('office')
    // a computer in storage is one the house has
    expect(hasComputer({ ...home, stored: ['computer'] })).toBe(true)
    expect(deskOf({ ...home, pieces: home.pieces.filter((p) => p.type !== 'desk') })).toBeNull()
  })

  it('bought at the desk, it stands at the free spot nearest it, in the studio, where it fits and blocks nothing', () => {
    const home = defaultHome()
    const desk = deskOf(home)!
    const spot = spotNear(home, desk)!
    expect(spot).not.toBeNull()
    expect(spot.type).toBe('computer')
    expect(roomAt(spot.x, spot.z)).toBe('office')
    expect(canPlacePiece(home, spot)).toEqual({ ok: true })
    // beside the desk, against the same wall
    expect(Math.hypot(spot.x - desk.x, spot.z - desk.z)).toBeLessThan(2.5)
    expect(spot.rot).toBe(desk.rot)
    const placed = { ...home, pieces: [...home.pieces, spot] }
    expect(hasComputer(placed)).toBe(true)
  })

  it('a studio as heavy as it may draw refuses it ("This room is full"): it waits in storage', () => {
    const home = defaultHome()
    const desk = deskOf(home)!
    // the studio's pieces weigh up to ROOM_WEIGHT, less than a computer's weight short
    const books = Math.ceil((ROOM_WEIGHT - roomWeight(home, 'office') - PIECES.computer.weight + 1) / PIECES.bookshelf.weight)
    const shelf = home.pieces.find((p) => p.id === 'bookshelf')!
    const heavy = { ...home, pieces: [...home.pieces, ...Array.from({ length: books }, (_, k) => ({ ...shelf, id: `shelf-${k}` }))] }
    expect(roomWeight(heavy, 'office') + PIECES.computer.weight).toBeGreaterThan(ROOM_WEIGHT)
    expect(spotNear(heavy, desk)).toBeNull()
  })
})
