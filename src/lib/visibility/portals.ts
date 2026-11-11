// Rooms and portals: what the first-person camera can see of the house and the farm, worked out on the screen.
//
// Five cells: the four rooms and the outside. Twelve portals: the four doorways (the kitchen's door closes one), the
// seven windows and the glass garden door, each a rectangle in its wall's middle plane (src/data/layout.ts), a few
// centimetres larger than the opening: whatever is seen through an opening, however thick the wall, is seen through
// that rectangle. From the cells the eye is in, each portal in view narrows the screen rectangle the cell behind it is
// seen through, portal after portal. A thing is drawn only if its own screen rectangle meets the rectangle of a cell
// it stands in. Every step only ever grows a rectangle (the bounding rectangle of a polygon, of a box, of two
// rectangles), so the rectangles over-cover what can be seen: nothing that can be seen is left out.
//
// Pure numbers (no renderer): the unit tests run it in Node (portals.test.ts).

import { DOORWAYS, HOUSE, ROOMS, WINDOWS, roomAt, type RoomId } from '../../data/layout'

export type Cell = RoomId | 'outside'
export const CELLS: readonly Cell[] = ['living', 'office', 'kitchen', 'bedroom', 'outside']
export const OUTSIDE = 4
const INDEX: Record<Cell, number> = { living: 0, office: 1, kitchen: 2, bedroom: 3, outside: OUTSIDE }
export const cellIndex = (c: Cell) => INDEX[c]

export interface Portal {
  id: string
  /** the cell on the side with the lower coordinate, and the other one (indices into CELLS) */
  a: number
  b: number
  /** 'x': the wall runs along x (the plane z = at); 'z': the plane x = at */
  axis: 'x' | 'z'
  at: number
  /** the rectangle in the wall's plane: along the wall from lo to hi, from y0 up to y1 */
  lo: number
  hi: number
  y0: number
  y1: number
  /** closed while the kitchen's door is shut */
  door: boolean
}

/** How much larger than its opening a portal is, each way (metres). */
const PAD = 0.03
const cellAt = (x: number, z: number) => INDEX[roomAt(x, z) ?? 'outside']

function portal(id: string, axis: 'x' | 'z', at: number, centre: number, width: number, y0: number, y1: number, door: boolean): Portal {
  const a = axis === 'x' ? cellAt(centre, at - 0.5) : cellAt(at - 0.5, centre)
  const b = axis === 'x' ? cellAt(centre, at + 0.5) : cellAt(at + 0.5, centre)
  return { id, a, b, axis, at, lo: centre - width / 2 - PAD, hi: centre + width / 2 + PAD, y0: y0 - PAD, y1: y1 + PAD, door }
}

export const PORTALS: readonly Portal[] = [
  ...Object.entries(DOORWAYS).map(([id, d]) => portal(id, d.axis, d.at, d.centre, d.width, 0, HOUSE.doorHeight, id === 'kitchenBedroom')),
  ...WINDOWS.map((w) => portal(w.id, w.axis, w.at, w.centre, w.width, w.sill, w.top, false)),
]

/** The portals between the house and the outside (the windows and the garden door): the only way sunlight gets in. */
export const OUTER_PORTALS: readonly Portal[] = PORTALS.filter((p) => p.a === OUTSIDE || p.b === OUTSIDE)

/** The world box of a portal's rectangle (it has no thickness across its wall). */
export function portalBox(p: Portal, out: Float64Array) {
  if (p.axis === 'x') out.set([p.lo, p.y0, p.at, p.hi, p.y1, p.at])
  else out.set([p.at, p.y0, p.lo, p.at, p.y1, p.hi])
  return out
}

const ROOM_BOXES = (['living', 'office', 'kitchen', 'bedroom'] as RoomId[]).map((id) => ROOMS[id].bounds)
const H = HOUSE.wallHeight
const HALF_WALL = HOUSE.wallThickness / 2
/** Deepest chain of portals followed. A straight line of sight crosses at most three (outside → room → room → room,
 *  or the other way); the rest is room for an eye right beside a wall, where the near plane can cut into it. */
const MAX_DEPTH = 6

/** The bits of the eye's own cells (`start`) and the screen rectangles (NDC, x0 x1 y0 y1; empty when x0 > x1). */
export interface PortalState {
  start: number
  rects: Float64Array
}

/**
 * Works out, for one camera, the screen rectangle each cell is seen through. Every array is made once: an update
 * allocates nothing.
 */
export class Portals {
  /** a bit per cell the eye is in (the cell under it, and any whose wall the near plane can cut into) */
  start = 0
  /** per cell: x0, x1, y0, y1 in normalized device coordinates; empty while x0 > x1 */
  readonly rects = new Float64Array(CELLS.length * 4)
  /** portals looked through in the last update (a measure of the work) */
  visits = 0
  private readonly view = new Float64Array(16)
  private readonly proj = new Float64Array(16)
  private near = 0.1
  private ex = 0
  private ez = 0
  private slack = 0
  private doorOpen = true
  /** each portal's rectangle on the screen this update (and whether it is anywhere on it) */
  private readonly portalRects = new Float64Array(PORTALS.length * 4)
  private readonly portalSeen = new Uint8Array(PORTALS.length)
  /** the rectangle at each depth of the walk through the portals */
  private readonly stack = new Float64Array((MAX_DEPTH + 1) * 4)
  // a portal's corners in view space, and the polygon left after cutting it at the near plane
  private readonly quad = new Float64Array(12)
  private readonly clipped = new Float64Array(24)

  /**
   * `view`: the camera's world → view matrix, `proj` its projection (both column-major, as three keeps them),
   * `near` its near plane, `eye` where it is; `doorOpen` whether the kitchen's door is anything but shut.
   */
  update(view: ArrayLike<number>, proj: ArrayLike<number>, near: number, eye: { x: number; y: number; z: number }, doorOpen: boolean) {
    for (let i = 0; i < 16; i++) {
      this.view[i] = view[i]
      this.proj[i] = proj[i]
    }
    this.near = near
    this.ex = eye.x
    this.ez = eye.z
    this.doorOpen = doorOpen
    const r = this.rects
    for (let c = 0; c < CELLS.length; c++) r.set(EMPTY, c * 4)
    // how far from the eye the near plane reaches (its corners): a wall closer than that is cut open on the screen,
    // and the cell behind it is seen through the cut
    const P = this.proj
    const tx = (1 + Math.abs(P[8])) / P[0]
    const ty = (1 + Math.abs(P[9])) / P[5]
    const reach = near * Math.sqrt(1 + tx * tx + ty * ty)
    this.slack = reach + HALF_WALL + 0.01
    this.start = 0
    for (let c = 0; c < 4; c++) {
      const b = ROOM_BOXES[c]
      const dx = Math.max(b.minX - eye.x, 0, eye.x - b.maxX)
      const dy = Math.max(-eye.y, 0, eye.y - H)
      const dz = Math.max(b.minZ - eye.z, 0, eye.z - b.maxZ)
      if (Math.hypot(dx, dy, dz) <= this.slack) this.start |= 1 << c
    }
    const s = this.slack
    if (eye.x < HOUSE.minX + s || eye.x > HOUSE.maxX - s || eye.z < HOUSE.minZ + s || eye.z > HOUSE.maxZ - s || eye.y > H - reach - 0.01 || eye.y < reach + 0.01) this.start |= 1 << OUTSIDE
    // every portal's rectangle on the screen
    for (let p = 0; p < PORTALS.length; p++) this.portalSeen[p] = this.portalRect(PORTALS[p], p * 4) ? 1 : 0
    this.visits = 0
    for (let c = 0; c < CELLS.length; c++) {
      if (!(this.start & (1 << c))) continue
      this.stack.set(FULL, 0)
      this.walk(c, 0, -1)
    }
  }

  /** Whether the cell is seen at all. */
  seen(cell: number) {
    return this.rects[cell * 4] <= this.rects[cell * 4 + 1]
  }

  isStart(cell: number) {
    return (this.start & (1 << cell)) !== 0
  }

  private walk(cell: number, depth: number, via: number) {
    const s = this.stack
    const o = depth * 4
    const r = this.rects
    const c = cell * 4
    if (r[c] > r[c + 1]) {
      r[c] = s[o]
      r[c + 1] = s[o + 1]
      r[c + 2] = s[o + 2]
      r[c + 3] = s[o + 3]
    } else {
      r[c] = Math.min(r[c], s[o])
      r[c + 1] = Math.max(r[c + 1], s[o + 1])
      r[c + 2] = Math.min(r[c + 2], s[o + 2])
      r[c + 3] = Math.max(r[c + 3], s[o + 3])
    }
    if (depth >= MAX_DEPTH) return
    for (let p = 0; p < PORTALS.length; p++) {
      if (p === via || !this.portalSeen[p]) continue
      const q = PORTALS[p]
      if (q.door && !this.doorOpen) continue
      let next: number
      if (q.a === cell) next = q.b
      else if (q.b === cell) next = q.a
      else continue
      // a portal is looked through from its own cell's side (or from right beside its plane)
      const d = q.axis === 'x' ? this.ez - q.at : this.ex - q.at
      if (cell === q.a ? d > this.slack : d < -this.slack) continue
      const pr = p * 4
      const n = o + 4
      const pr2 = this.portalRects
      s[n] = Math.max(s[o], pr2[pr])
      s[n + 1] = Math.min(s[o + 1], pr2[pr + 1])
      s[n + 2] = Math.max(s[o + 2], pr2[pr + 2])
      s[n + 3] = Math.min(s[o + 3], pr2[pr + 3])
      if (s[n] > s[n + 1] || s[n + 2] > s[n + 3]) continue
      this.visits++
      this.walk(next, depth + 1, p)
    }
  }

  /** A portal's rectangle on the screen: its corners in view space, cut at the near plane, then projected. */
  private portalRect(p: Portal, at: number): boolean {
    const q = this.quad
    const V = this.view
    for (let k = 0; k < 4; k++) {
      const along = k === 1 || k === 2 ? p.hi : p.lo
      const y = k >= 2 ? p.y1 : p.y0
      const x = p.axis === 'x' ? along : p.at
      const z = p.axis === 'x' ? p.at : along
      q[k * 3] = V[0] * x + V[4] * y + V[8] * z + V[12]
      q[k * 3 + 1] = V[1] * x + V[5] * y + V[9] * z + V[13]
      q[k * 3 + 2] = V[2] * x + V[6] * y + V[10] * z + V[14]
    }
    // keep what lies beyond the near plane (z ≤ -near in view space)
    const zc = -this.near
    const out = this.clipped
    let m = 0
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      const pz = q[i * 3 + 2]
      const qz = q[j * 3 + 2]
      const pin = pz <= zc
      const qin = qz <= zc
      if (pin) {
        out[m * 3] = q[i * 3]
        out[m * 3 + 1] = q[i * 3 + 1]
        out[m * 3 + 2] = pz
        m++
      }
      if (pin !== qin) {
        const t = (zc - pz) / (qz - pz)
        out[m * 3] = q[i * 3] + (q[j * 3] - q[i * 3]) * t
        out[m * 3 + 1] = q[i * 3 + 1] + (q[j * 3 + 1] - q[i * 3 + 1]) * t
        out[m * 3 + 2] = zc
        m++
      }
    }
    if (m === 0) return false
    const P = this.proj
    let x0 = Infinity
    let x1 = -Infinity
    let y0 = Infinity
    let y1 = -Infinity
    for (let i = 0; i < m; i++) {
      const x = out[i * 3]
      const y = out[i * 3 + 1]
      const z = out[i * 3 + 2]
      const w = P[3] * x + P[7] * y + P[11] * z + P[15]
      const nx = (P[0] * x + P[4] * y + P[8] * z + P[12]) / w
      const ny = (P[1] * x + P[5] * y + P[9] * z + P[13]) / w
      if (nx < x0) x0 = nx
      if (nx > x1) x1 = nx
      if (ny < y0) y0 = ny
      if (ny > y1) y1 = ny
    }
    const r = this.portalRects
    r[at] = Math.max(-1, x0)
    r[at + 1] = Math.min(1, x1)
    r[at + 2] = Math.max(-1, y0)
    r[at + 3] = Math.min(1, y1)
    // not a number (a degenerate camera): seen, whole
    if (!(r[at] <= r[at + 1] && r[at + 2] <= r[at + 3])) {
      if (Number.isNaN(x0 + x1 + y0 + y1)) {
        r.set(FULL, at)
        return true
      }
      return false
    }
    return true
  }

  /**
   * Whether a world box can be seen: `outside` true for a thing of the outside (the farm, the garden round the
   * house), else the cells it stands in by where it is — the rooms it overlaps, and the outside if it reaches past
   * the walls' middle lines, above the ceiling or under the floor.
   */
  seesBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, outside: boolean): boolean {
    let cells: number
    if (outside) cells = 1 << OUTSIDE
    else {
      cells = 0
      for (let c = 0; c < 4; c++) {
        const b = ROOM_BOXES[c]
        if (minX <= b.maxX && maxX >= b.minX && minZ <= b.maxZ && maxZ >= b.minZ) cells |= 1 << c
      }
      if (minX < HOUSE.minX || maxX > HOUSE.maxX || minZ < HOUSE.minZ || maxZ > HOUSE.maxZ || maxY > H || minY < 0) cells |= 1 << OUTSIDE
    }
    // in a cell the eye is in: seen through the whole screen
    if (cells & this.start) return true
    let seenAny = false
    for (let c = 0; c < CELLS.length; c++) if (cells & (1 << c) && this.seen(c)) seenAny = true
    if (!seenAny) return false
    const r = boxRect(minX, minY, minZ, maxX, maxY, maxZ, this.view, this.proj, this.near, BOX_RECT)
    if (r === BEHIND) return false
    if (r === WHOLE) return true
    for (let c = 0; c < CELLS.length; c++) {
      if (!(cells & (1 << c))) continue
      const o = c * 4
      const R = this.rects
      if (R[o] <= R[o + 1] && BOX_RECT[0] <= R[o + 1] && BOX_RECT[1] >= R[o] && BOX_RECT[2] <= R[o + 3] && BOX_RECT[3] >= R[o + 2]) return true
    }
    return false
  }
}

const EMPTY = [1, -1, 1, -1]
const FULL = [-1, 1, -1, 1]
const BOX_RECT = new Float64Array(4)

export const BEHIND = 0
export const WHOLE = 1
export const RECT = 2

/**
 * The screen rectangle (NDC) of a world box, for a perspective camera: the box in view space (a box round the
 * turned box), then the extremes of x/−z and y/−z over it. BEHIND: wholly behind the near plane; WHOLE: it reaches
 * through the near plane (or the numbers are not numbers), so it is taken as the whole screen; RECT: `out` holds it.
 */
export function boxRect(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, V: ArrayLike<number>, P: ArrayLike<number>, near: number, out: Float64Array): number {
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const hx = (maxX - minX) / 2
  const hy = (maxY - minY) / 2
  const hz = (maxZ - minZ) / 2
  const vx = V[0] * cx + V[4] * cy + V[8] * cz + V[12]
  const vy = V[1] * cx + V[5] * cy + V[9] * cz + V[13]
  const vz = V[2] * cx + V[6] * cy + V[10] * cz + V[14]
  const ex = Math.abs(V[0]) * hx + Math.abs(V[4]) * hy + Math.abs(V[8]) * hz
  const ey = Math.abs(V[1]) * hx + Math.abs(V[5]) * hy + Math.abs(V[9]) * hz
  const ez = Math.abs(V[2]) * hx + Math.abs(V[6]) * hy + Math.abs(V[10]) * hz
  const zFar = vz - ez // the farthest (most negative)
  const zNear = vz + ez
  if (!(zFar === zFar && zNear === zNear && ex === ex && ey === ey && vx === vx && vy === vy)) return WHOLE
  if (zFar > -near) return BEHIND
  if (zNear > -near) return WHOLE
  const dn = -zNear
  const df = -zFar
  const x0 = vx - ex
  const x1 = vx + ex
  const y0 = vy - ey
  const y1 = vy + ey
  const xl = x0 < 0 ? x0 / dn : x0 / df
  const xh = x1 > 0 ? x1 / dn : x1 / df
  const yl = y0 < 0 ? y0 / dn : y0 / df
  const yh = y1 > 0 ? y1 / dn : y1 / df
  // x_ndc = P00·x/(−z) − P02 (and the same for y): three's perspective projection
  out[0] = P[0] * xl - P[8]
  out[1] = P[0] * xh - P[8]
  out[2] = P[5] * yl - P[9]
  out[3] = P[5] * yh - P[9]
  return RECT
}
