import { carry, type Fit, type Placement } from '../farm/layout'
import { buyPiece, farm, movePiece, placeStored, storePiece } from '../farm/state'
import { aimPointOf } from '../lib/interaction'
import { useHome } from '../store'
import { footprint, type HomePiece } from './layout'

// What decorating does to the house, with what goes along with it: a thing to pick up that stands on a piece (the
// notebook on the desk, the gift on the bed) goes where the piece goes, and comes down to the floor when the piece is
// put away. (Lamps and the small things on tables follow by themselves: src/scene/Lamps.tsx, Dressing.tsx.)

const pieceById = (id: string) => farm.home.pieces.find((p) => p.id === id)

function carryPickups(before: HomePiece, after: HomePiece | null) {
  const s = useHome.getState()
  const r = footprint(before)
  for (const [id, item] of Object.entries(s.items)) {
    if (s.carrying === id) continue
    const at = aimPointOf(id) ?? { x: item.pos[0], y: item.pos[1], z: item.pos[2] }
    if (at.y < 0.2 || at.x < r.minX || at.x > r.maxX || at.z < r.minZ || at.z > r.maxZ) continue
    if (after) {
      const [x, z] = carry(before, after, at.x, at.z)
      s.placeItem(id, [x, at.y + 0.01, z])
    } else s.placeItem(id, [at.x, 0.15, at.z])
  }
}

/** Moves or turns a piece; what stands on it goes along. */
export function movePieceTo(id: string, to: Placement): Fit {
  const before = pieceById(id)
  const fit = movePiece(id, to)
  const after = pieceById(id)
  if (fit.ok && before && after) carryPickups(before, after)
  return fit
}

/** Turns a piece a quarter turn where it stands (anticlockwise; −1 the other way). */
export const turnPiece = (id: string, by: 1 | -1 = 1): Fit => {
  const p = pieceById(id)
  return p ? movePieceTo(id, { x: p.x, z: p.z, rot: p.rot + by }) : { ok: false, reason: 'Not in the house' }
}

/** Puts a piece away; what stood on it comes down to the floor. */
export function putAway(id: string) {
  const before = pieceById(id)
  if (!before || !storePiece(id)) return false
  carryPickups(before, null)
  return true
}

export { buyPiece, placeStored }
