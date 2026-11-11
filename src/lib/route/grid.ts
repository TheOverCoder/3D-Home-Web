import type { Field } from './path'

// The ground as square cells (src/lib/route): whether the body can stand in each, worked out the first time a cell is
// asked about (`probe`: in the game, the physics world, physics.ts) and kept until the grid is made again. A search
// only asks about the cells round its way, so a walk across the farm never waits for the whole land to be worked out.
// Plain data and arithmetic (no three.js, no physics): the tests make grids of their own.

export const UNKNOWN = 0
export const FREE = 1
export const BLOCKED = 2

export interface Grid extends Field {
  /** the corner of cell (0, 0), on the ground (x, z), and the side of a cell, metres */
  x0: number
  z0: number
  cell: number
  /** each cell: UNKNOWN until asked about, then FREE or BLOCKED */
  cells: Uint8Array
  /** how many cells have been worked out */
  probed: number
}

/**
 * A grid over the rectangle from (x0, z0) to (x1, z1) with cells `cell` metres across; `probe(x, z)` says whether the
 * body can stand with its middle at that point of the ground (a cell's middle), and is asked once per cell.
 */
export function makeGrid(x0: number, z0: number, x1: number, z1: number, cell: number, probe: (x: number, z: number) => boolean): Grid {
  const w = Math.max(1, Math.ceil((x1 - x0) / cell - 1e-9))
  const h = Math.max(1, Math.ceil((z1 - z0) / cell - 1e-9))
  const cells = new Uint8Array(w * h)
  const g: Grid = {
    x0,
    z0,
    cell,
    w,
    h,
    cells,
    probed: 0,
    free: (i, j) => {
      if (i < 0 || j < 0 || i >= w || j >= h) return false
      const k = j * w + i
      let s = cells[k]
      if (s === UNKNOWN) {
        s = probe(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) ? FREE : BLOCKED
        cells[k] = s
        g.probed++
      }
      return s === FREE
    },
  }
  return g
}

/** A point of the ground in cell units (cell (i, j) is [i, i + 1) × [j, j + 1)). */
export const toCells = (g: Grid, x: number, z: number): [number, number] => [(x - g.x0) / g.cell, (z - g.z0) / g.cell]

/** The middle of the cell with index `k`, on the ground. */
export function centreOf(g: Grid, k: number): { x: number; z: number } {
  const i = k % g.w
  return { x: g.x0 + (i + 0.5) * g.cell, z: g.z0 + ((k - i) / g.w + 0.5) * g.cell }
}

/** The grid with some more cells blocked (things that move, where they stand now): a field for one search. */
export function withBlocked(g: Grid, blocked: Set<number>): Field {
  return { w: g.w, h: g.h, free: (i, j) => g.free(i, j) && !blocked.has(j * g.w + i) }
}
