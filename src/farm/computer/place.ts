import { roomAt } from '../../data/layout'
import { PIECES } from '../../home/catalogue'
import { canPlacePiece, roomFull, snapPiece, type HomeLayout, type HomePiece } from '../../home/layout'

// Where the house's computer goes (src/home/Computer.tsx): whether the house has one, the studio's desk whose price tag
// sells it, and the free spot nearest that desk for one just bought. Pure: a house in, an answer out.

/** The house has a computer: standing, or in storage. */
export const hasComputer = (home: HomeLayout) => home.pieces.some((p) => p.type === 'computer') || home.stored.includes('computer')

/** The studio's desk (where it stands now), or null while it is put away. */
export const deskOf = (home: HomeLayout) => home.pieces.find((p) => p.id === 'desk') ?? home.pieces.find((p) => p.type === 'desk') ?? null

/** Where a computer would stand right beside `near`, its back to the same wall: to its left and to its right. */
function besides(near: HomePiece): { x: number; z: number }[] {
  const [w, , d] = PIECES[near.type].size
  const [cw, , cd] = PIECES.computer.size
  const a = (near.rot * Math.PI) / 2
  // a point of the piece's own (lx across, lz out of its front) on the floor
  const at = (lx: number, lz: number) => ({ x: near.x + lx * Math.cos(a) + lz * Math.sin(a), z: near.z - lx * Math.sin(a) + lz * Math.cos(a) })
  const side = w / 2 + cw / 2 + 0.05
  const back = -d / 2 + cd / 2
  return [at(side, back), at(-side, back)]
}

/** A free spot for a computer in the room of the piece `near` (the studio's desk): the one nearest a place right beside
 *  it, its back to the same wall, turned as it is first; one that blocks nothing if one fits (else one that does, as
 *  the decorate mode allows, with a word); null when the room is full or nothing fits. */
export function spotNear(home: HomeLayout, near: HomePiece): HomePiece | null {
  const room = roomAt(near.x, near.z)
  if (!room || roomFull(home, room, 'computer')) return null
  const goals = besides(near)
  const from = (x: number, z: number) => Math.min(...goals.map((g) => Math.hypot(x - g.x, z - g.z)))
  const spots: [number, number][] = []
  for (let dx = -4; dx <= 4; dx += 0.25) for (let dz = -4; dz <= 4; dz += 0.25) spots.push([near.x + dx, near.z + dz])
  spots.sort((a, b) => from(a[0], a[1]) - from(b[0], b[1]))
  let blocking: HomePiece | null = null
  for (const rot of [near.rot, near.rot + 1, near.rot + 2, near.rot + 3].map((r) => r % 4))
    for (const [x, z] of spots) {
      const p = snapPiece({ id: 'new', type: 'computer', x, z, rot }, x, z)
      if (roomAt(p.x, p.z) !== room) continue
      const fit = canPlacePiece(home, p)
      if (!fit.ok) continue
      if (!fit.warn) return p
      blocking ??= p
    }
  return blocking
}
