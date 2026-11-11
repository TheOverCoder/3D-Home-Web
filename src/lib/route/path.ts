// Finding the way on a field of square cells (src/lib/route): A* with eight neighbours that never cuts a blocked
// corner, a straight-line check that walks every cell a segment crosses, and the string pulled tight along a path so
// the walk goes straight wherever it can. Plain arithmetic on any `Field` (no three.js, no physics, no React): the unit
// tests run it on any grid, the game on the land worked out from the physics world (grid.ts, physics.ts).
//
// Cell (i, j) is the square [i, i + 1) × [j, j + 1) in cell units; its index is j * w + i, its middle (i + ½, j + ½).

export interface Field {
  /** cells across (i) and along (j) */
  w: number
  h: number
  /** whether the body can stand in cell (i, j); false off the field */
  free: (i: number, j: number) => boolean
}

const SQRT2 = Math.SQRT2
// the eight neighbours: the four sides first, then the corners
const DI = [1, -1, 0, 0, 1, 1, -1, -1]
const DJ = [0, 0, 1, -1, 1, -1, 1, -1]

/** A step from (i, j) by (di, dj) is allowed: onto a free cell, and a corner step only with both cells beside it free
 *  (never squeezing past a blocked corner). */
export function canStep(f: Field, i: number, j: number, di: number, dj: number) {
  if (!f.free(i + di, j + dj)) return false
  return !(di && dj) || (f.free(i + di, j) && f.free(i, j + dj))
}

/** The smallest-first queue of the search: cell indices by their score (a binary heap; an entry made stale by a better
 *  score later is skipped when it comes out). */
class Heap {
  keys = new Float64Array(256)
  vals = new Int32Array(256)
  size = 0
  push(key: number, val: number) {
    if (this.size === this.keys.length) {
      const keys = new Float64Array(this.size * 2)
      const vals = new Int32Array(this.size * 2)
      keys.set(this.keys)
      vals.set(this.vals)
      this.keys = keys
      this.vals = vals
    }
    let n = this.size++
    while (n > 0) {
      const up = (n - 1) >> 1
      if (this.keys[up] <= key) break
      this.keys[n] = this.keys[up]
      this.vals[n] = this.vals[up]
      n = up
    }
    this.keys[n] = key
    this.vals[n] = val
  }
  pop(): number {
    const top = this.vals[0]
    const key = this.keys[--this.size]
    const val = this.vals[this.size]
    let n = 0
    for (;;) {
      let c = 2 * n + 1
      if (c >= this.size) break
      if (c + 1 < this.size && this.keys[c + 1] < this.keys[c]) c++
      if (this.keys[c] >= key) break
      this.keys[n] = this.keys[c]
      this.vals[n] = this.vals[c]
      n = c
    }
    this.keys[n] = key
    this.vals[n] = val
    return top
  }
}

export type Status = 'running' | 'found' | 'none'

/**
 * A* from `start` to the nearest cell where `goal` holds, a step at a time so the game can spread a long search over
 * frames (`step` with a budget of cells). Costs are in cells (1 a side, √2 a corner); `h` must never overestimate the
 * cost to a goal cell (the straight-line distance to the goal's region, in cells, does not), so the path found is a
 * shortest one. When no goal can be reached, `path()` leads to the reachable cell nearest the goal by `h` instead.
 */
export class Search {
  status: Status = 'running'
  /** cells taken off the queue so far */
  expanded = 0
  private readonly g: Float64Array
  private readonly from: Int32Array
  private readonly closed: Uint8Array
  private readonly heap = new Heap()
  private reached = -1
  private best = -1
  private bestH = Infinity

  constructor(
    readonly field: Field,
    readonly start: number,
    private readonly goal: (k: number) => boolean,
    private readonly h: (k: number) => number,
  ) {
    const n = field.w * field.h
    this.g = new Float64Array(n).fill(Infinity)
    this.from = new Int32Array(n).fill(-1)
    this.closed = new Uint8Array(n)
    const i = start % field.w
    const j = (start - i) / field.w
    if (start < 0 || start >= n || !field.free(i, j)) {
      this.status = 'none'
      return
    }
    this.g[start] = 0
    this.heap.push(h(start), start)
  }

  /** Works through at most `budget` more cells; says whether it is still running, found the goal, or cannot. */
  step(budget = Infinity): Status {
    const { field: f, g, from, closed, heap } = this
    const w = f.w
    let n = 0
    while (this.status === 'running' && n < budget) {
      if (!heap.size) {
        this.status = 'none'
        break
      }
      const k = heap.pop()
      if (closed[k]) continue
      closed[k] = 1
      n++
      if (this.goal(k)) {
        this.reached = k
        this.status = 'found'
        break
      }
      const hk = this.h(k)
      if (hk < this.bestH) {
        this.best = k
        this.bestH = hk
      }
      const i = k % w
      const j = (k - i) / w
      for (let d = 0; d < 8; d++) {
        const di = DI[d]
        const dj = DJ[d]
        if (!canStep(f, i, j, di, dj)) continue
        const nk = k + dj * w + di
        if (closed[nk]) continue
        const ng = g[k] + (di && dj ? SQRT2 : 1)
        if (ng < g[nk]) {
          g[nk] = ng
          from[nk] = k
          heap.push(ng + this.h(nk), nk)
        }
      }
    }
    this.expanded += n
    return this.status
  }

  /** The cells from the start to the goal found — or, when there is none, to the reachable cell nearest it; empty when
   *  the start itself is blocked. */
  path(): number[] {
    const end = this.reached >= 0 ? this.reached : this.best
    if (end < 0) return []
    const out: number[] = []
    for (let k = end; k >= 0; k = this.from[k]) out.push(k)
    return out.reverse()
  }

  /** What the path costs (cells), or Infinity before it is found. */
  cost(): number {
    return this.reached >= 0 ? this.g[this.reached] : Infinity
  }
}

/** The cells of a shortest path from `start` to a cell where `goal` holds, or null when none can be reached. */
export function findPath(field: Field, start: number, goal: (k: number) => boolean, h: (k: number) => number = () => 0): number[] | null {
  const s = new Search(field, start, goal, h)
  return s.step() === 'found' ? s.path() : null
}

/**
 * Whether the straight line from (ax, az) to (bx, bz) (cell units) crosses only free cells — every cell it passes
 * through, and where it passes exactly through a corner of four cells, both cells beside that corner too (no slipping
 * between two blocked cells that touch at a corner). `fromAnywhere` leaves out the cell it starts in (the body may be
 * brushing a wall, its middle in a cell too near it).
 */
export function lineClear(f: Field, ax: number, az: number, bx: number, bz: number, fromAnywhere = false): boolean {
  let i = Math.floor(ax)
  let j = Math.floor(az)
  const ei = Math.floor(bx)
  const ej = Math.floor(bz)
  if (!fromAnywhere && !f.free(i, j)) return false
  const dx = bx - ax
  const dz = bz - az
  const si = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const sj = dz > 0 ? 1 : dz < 0 ? -1 : 0
  const tdx = si ? 1 / Math.abs(dx) : Infinity
  const tdz = sj ? 1 / Math.abs(dz) : Infinity
  // the line's parameter (0 at a, 1 at b) where it next crosses a vertical / horizontal grid line
  let tx = si > 0 ? (i + 1 - ax) * tdx : si < 0 ? (ax - i) * tdx : Infinity
  let tz = sj > 0 ? (j + 1 - az) * tdz : sj < 0 ? (az - j) * tdz : Infinity
  let left = Math.abs(ei - i) + Math.abs(ej - j)
  while (left > 0) {
    if (si && sj && Math.abs(tx - tz) <= 1e-9 * Math.max(1, tx)) {
      // through a corner: the two cells beside it as well as the one beyond
      if (!f.free(i + si, j) || !f.free(i, j + sj)) return false
      i += si
      j += sj
      tx += tdx
      tz += tdz
      left -= 2
    } else if (tx < tz) {
      i += si
      tx += tdx
      left--
    } else {
      j += sj
      tz += tdz
      left--
    }
    if (!f.free(i, j)) return false
  }
  return true
}

/** The straight line between the middles of two cells (by index) is clear. */
const clearBetween = (f: Field, a: number, b: number) => lineClear(f, (a % f.w) + 0.5, Math.floor(a / f.w) + 0.5, (b % f.w) + 0.5, Math.floor(b / f.w) + 0.5)

/**
 * The string pulled tight along a path of cells: the cells where it turns, from the first to the last, each one in
 * plain sight of the one before (`lineClear` between their middles). A forward pass keeps a cell only where the one
 * after it cannot be seen from the last kept; a second pass drops any that its two neighbours see past.
 */
export function pullString(f: Field, path: number[]): number[] {
  if (path.length <= 2) return path.slice()
  const out = [path[0]]
  for (let k = 1; k < path.length - 1; k++) if (!clearBetween(f, out[out.length - 1], path[k + 1])) out.push(path[k])
  out.push(path[path.length - 1])
  for (let k = 1; k < out.length - 1;) {
    if (clearBetween(f, out[k - 1], out[k + 1])) out.splice(k, 1)
    else k++
  }
  return out
}

/** The free cell nearest the point (x, z) (cell units) within `reach` cells of it, or -1. */
export function nearestFree(f: Field, x: number, z: number, reach: number): number {
  const ci = Math.floor(x)
  const cj = Math.floor(z)
  let best = -1
  let bestD = Infinity
  for (let j = cj - reach; j <= cj + reach; j++)
    for (let i = ci - reach; i <= ci + reach; i++) {
      if (i < 0 || j < 0 || i >= f.w || j >= f.h || !f.free(i, j)) continue
      const d = (i + 0.5 - x) ** 2 + (j + 0.5 - z) ** 2
      if (d < bestD) {
        bestD = d
        best = j * f.w + i
      }
    }
  return best
}
