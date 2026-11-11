import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { BLOCKED, FREE, UNKNOWN, centreOf, makeGrid, withBlocked } from './grid'
import { Search, findPath, lineClear, nearestFree, pullString, type Field } from './path'

// The way across the land (path.ts) on any grid: a path never enters a blocked cell nor squeezes past a blocked corner;
// when the goal can be reached a path is found, and a shortest one, and none is claimed when it cannot; the string
// pulled tight along a path keeps every straight stretch on free cells. Checked against plain oracles written here
// (a flood fill, Dijkstra, the cells a segment crosses worked out from where it crosses the grid lines), and each rule
// broken on purpose to see the property catch it.

const RUNS = Number(process.env.FC_RUNS) || 300

/** A field from rows of text: '#' blocked, anything else free. */
function fieldOf(rows: string[]): Field {
  const h = rows.length
  const w = rows[0].length
  return { w, h, free: (i, j) => i >= 0 && j >= 0 && i < w && j < h && rows[j][i] !== '#' }
}
const fieldFrom = (w: number, h: number, blocked: boolean[]): Field => ({ w, h, free: (i, j) => i >= 0 && j >= 0 && i < w && j < h && !blocked[j * w + i] })
const at = (f: Field, i: number, j: number) => j * f.w + i
const ij = (f: Field, k: number) => [k % f.w, Math.floor(k / f.w)] as const

/** A grid of 2–24 cells a side, up to `most` of its cells blocked, with a start and a goal anywhere on it. */
const gridsOf = (most: number) =>
  fc
    .record({ w: fc.integer({ min: 2, max: 24 }), h: fc.integer({ min: 2, max: 24 }), density: fc.double({ min: 0, max: most, noNaN: true }) })
    .chain(({ w, h, density }) =>
      fc.record({
        w: fc.constant(w),
        h: fc.constant(h),
        blocked: fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: w * h, maxLength: w * h }).map((r) => r.map((v) => v < density)),
        start: fc.integer({ min: 0, max: w * h - 1 }),
        goal: fc.integer({ min: 0, max: w * h - 1 }),
      }),
    )
    .map((g) => {
      // the start and the goal stand on free cells (a blocked start is its own case below)
      const blocked = g.blocked.slice()
      blocked[g.start] = false
      blocked[g.goal] = false
      return { ...g, blocked, field: fieldFrom(g.w, g.h, blocked) }
    })
const grids = gridsOf(0.5)

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

/** The oracle's step rule, written out again: onto a free cell; a corner step only with both cells beside it free. */
const oracleStep = (f: Field, i: number, j: number, di: number, dj: number) => f.free(i + di, j + dj) && (!(di && dj) || (f.free(i + di, j) && f.free(i, j + dj)))

/** Every cell a flood from `start` reaches. */
function flood(f: Field, start: number): Set<number> {
  const seen = new Set([start])
  const queue = [start]
  while (queue.length) {
    const [i, j] = ij(f, queue.shift()!)
    for (const [di, dj] of STEPS) {
      if (!oracleStep(f, i, j, di, dj)) continue
      const k = at(f, i + di, j + dj)
      if (!seen.has(k)) {
        seen.add(k)
        queue.push(k)
      }
    }
  }
  return seen
}

/** The cost of a shortest way from `start` to `goal` (Dijkstra, the plain O(n²) way), Infinity when there is none. */
function shortest(f: Field, start: number, goal: number): number {
  const n = f.w * f.h
  const dist = Array.from({ length: n }, () => Infinity)
  const done = Array.from({ length: n }, () => false)
  dist[start] = 0
  for (;;) {
    let k = -1
    for (let c = 0; c < n; c++) if (!done[c] && dist[c] < Infinity && (k < 0 || dist[c] < dist[k])) k = c
    if (k < 0) return Infinity
    if (k === goal) return dist[k]
    done[k] = true
    const [i, j] = ij(f, k)
    for (const [di, dj] of STEPS) {
      if (!oracleStep(f, i, j, di, dj)) continue
      const nk = at(f, i + di, j + dj)
      dist[nk] = Math.min(dist[nk], dist[k] + (di && dj ? Math.SQRT2 : 1))
    }
  }
}

/** Steps a path takes that the rules forbid: off a free cell, more than one cell, or past a blocked corner. */
function badSteps(f: Field, path: number[]): string[] {
  const bad: string[] = []
  path.forEach((k, n) => {
    const [i, j] = ij(f, k)
    if (!f.free(i, j)) bad.push(`cell ${i},${j} is blocked`)
    if (n === 0) return
    const [pi, pj] = ij(f, path[n - 1])
    const di = i - pi
    const dj = j - pj
    if (Math.max(Math.abs(di), Math.abs(dj)) !== 1) bad.push(`a jump from ${pi},${pj} to ${i},${j}`)
    else if (di && dj && (!f.free(pi + di, pj) || !f.free(pi, pj + dj))) bad.push(`a blocked corner cut from ${pi},${pj} to ${i},${j}`)
  })
  return bad
}

/**
 * What the straight line from a to b crosses, worked out on its own: where it crosses each grid line (sorted), the cell
 * of the middle of every stretch in between, and every grid corner it passes exactly through (with the four cells round
 * it). The line is clear when all of those cells are free.
 */
function segmentClear(f: Field, ax: number, az: number, bx: number, bz: number): boolean {
  const ts = [0, 1]
  const cross = (a: number, b: number) => {
    for (let x = Math.ceil(Math.min(a, b)); x <= Math.floor(Math.max(a, b)); x++) if (a !== b) ts.push((x - a) / (b - a))
  }
  cross(ax, bx)
  cross(az, bz)
  ts.sort((p, q) => p - q)
  const point = (t: number) => [ax + (bx - ax) * t, az + (bz - az) * t]
  for (let k = 1; k < ts.length; k++) {
    if (ts[k] - ts[k - 1] < 1e-12) continue
    const [x, z] = point((ts[k] + ts[k - 1]) / 2)
    if (!f.free(Math.floor(x), Math.floor(z))) return false
  }
  for (const t of ts) {
    const [x, z] = point(t)
    const p = Math.round(x)
    const q = Math.round(z)
    // (a line running along a grid line passes no corner crosswise: its cells are the ones on the side `floor` picks)
    if (Math.abs(x - p) > 1e-9 || Math.abs(z - q) > 1e-9 || t <= 0 || t >= 1 || ax === bx || az === bz) continue
    // through a corner: none of the four cells round it may be blocked
    if (!f.free(p - 1, q - 1) || !f.free(p, q - 1) || !f.free(p - 1, q) || !f.free(p, q)) return false
  }
  return true
}
const mid = (f: Field, k: number) => {
  const [i, j] = ij(f, k)
  return [i + 0.5, j + 0.5] as const
}
/** Every straight stretch of a pulled string is clear, by the oracle. */
function stringClear(f: Field, pts: number[]) {
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = mid(f, pts[k - 1])
    const [bx, bz] = mid(f, pts[k])
    if (!segmentClear(f, ax, az, bx, bz)) return false
  }
  return true
}

/** The straight-line distance to the goal cell, in cells: never more than the cost of getting there. */
const towards = (f: Field, goal: number) => {
  const [gi, gj] = ij(f, goal)
  return (k: number) => {
    const [i, j] = ij(f, k)
    return Math.hypot(i - gi, j - gj)
  }
}

describe('the way across a grid (fast-check)', () => {
  it('a path never enters a blocked cell or cuts a blocked corner, runs from the start to the goal, and is a shortest one', () => {
    let found = 0
    fc.assert(
      fc.property(grids, ({ field, start, goal }) => {
        const s = new Search(field, start, (k) => k === goal, towards(field, goal))
        if (s.step() !== 'found') return
        found++
        const path = s.path()
        expect(path[0]).toBe(start)
        expect(path[path.length - 1]).toBe(goal)
        expect(badSteps(field, path)).toEqual([])
        expect(s.cost()).toBeCloseTo(shortest(field, start, goal), 9)
      }),
      { numRuns: RUNS },
    )
    expect(found).toBeGreaterThan(RUNS / 4)
  })

  it('a path is found exactly when the goal can be reached; with none, the search ends at the reachable cell nearest the goal', () => {
    let none = 0
    fc.assert(
      fc.property(grids, ({ field, start, goal }) => {
        const reach = flood(field, start)
        const h = towards(field, goal)
        const path = findPath(field, start, (k) => k === goal, h)
        expect(path !== null).toBe(reach.has(goal))
        if (path) return
        none++
        const s = new Search(field, start, (k) => k === goal, h)
        expect(s.step()).toBe('none')
        const nearest = s.path()
        expect(badSteps(field, nearest)).toEqual([])
        const end = nearest[nearest.length - 1]
        expect(reach.has(end)).toBe(true)
        expect(h(end)).toBeCloseTo(Math.min(...[...reach].map(h)), 9)
      }),
      { numRuns: RUNS },
    )
    expect(none).toBeGreaterThan(RUNS / 20)
  })

  it('the string pulled along a path turns only at cells of the path and keeps every straight stretch clear', () => {
    let turns = 0
    fc.assert(
      fc.property(grids, ({ field, start, goal }) => {
        const path = findPath(field, start, (k) => k === goal, towards(field, goal))
        if (!path) return
        const pts = pullString(field, path)
        expect(pts[0]).toBe(start)
        expect(pts[pts.length - 1]).toBe(goal)
        // in the path's order
        let from = 0
        for (const p of pts) {
          from = path.indexOf(p, from)
          expect(from).toBeGreaterThanOrEqual(0)
        }
        expect(stringClear(field, pts)).toBe(true)
        turns += Math.max(0, pts.length - 2)
      }),
      { numRuns: RUNS },
    )
    expect(turns).toBeGreaterThan(RUNS / 10)
  })

  it('a straight line said to be clear crosses only free cells, through every corner it touches too', () => {
    let clear = 0
    // ends on a quarter-cell lattice (so lines often pass exactly through corners), up to six cells apart
    const coord = (n: number) => fc.integer({ min: 0, max: n * 4 }).map((v) => v / 4)
    const off = fc.integer({ min: -24, max: 24 }).map((v) => v / 4)
    fc.assert(
      fc.property(
        gridsOf(0.3).chain((g) => fc.record({ g: fc.constant(g), a: fc.tuple(coord(g.w), coord(g.h)), d: fc.tuple(off, off) })),
        ({ g, a, d }) => {
          const b = [a[0] + d[0], a[1] + d[1]]
          if (!lineClear(g.field, a[0], a[1], b[0], b[1])) return
          clear++
          expect(segmentClear(g.field, a[0], a[1], b[0], b[1]), `${a.join(',')} → ${b.join(',')}`).toBe(true)
        },
      ),
      { numRuns: RUNS * 3 },
    )
    expect(clear).toBeGreaterThan(RUNS / 10)
  })
})

describe('each rule broken on purpose is caught (negative controls)', () => {
  /** A breadth-first search that squeezes past corners: its paths must fail the corner rule on some grid. */
  function cornerCutter(f: Field, start: number, goal: number): number[] | null {
    const from = new Map<number, number>([[start, -1]])
    const queue = [start]
    while (queue.length) {
      const k = queue.shift()!
      if (k === goal) {
        const out: number[] = []
        for (let c = k; c >= 0; c = from.get(c)!) out.push(c)
        return out.reverse()
      }
      const [i, j] = ij(f, k)
      // the corners first, so it takes them whenever it can
      for (const [di, dj] of [...STEPS].reverse()) {
        if (!f.free(i + di, j + dj)) continue
        const nk = at(f, i + di, j + dj)
        if (!from.has(nk)) {
          from.set(nk, k)
          queue.push(nk)
        }
      }
    }
    return null
  }
  it('a search that cuts corners fails the corner rule', () => {
    const run = fc.check(
      fc.property(grids, ({ field, start, goal }) => {
        const path = cornerCutter(field, start, goal)
        return !path || badSteps(field, path).length === 0
      }),
      { numRuns: RUNS * 3 },
    )
    expect(run.failed).toBe(true)
  })

  it('a string pulled by looking only at its ends fails the clear-stretch rule', () => {
    const run = fc.check(
      fc.property(grids, ({ field, start, goal }) => {
        const path = findPath(field, start, (k) => k === goal)
        // keeps only the two ends, both free: it never looks along the line between them
        const naive = path && path.length > 2 ? [path[0], path[path.length - 1]] : path
        return !naive || stringClear(field, naive)
      }),
      { numRuns: RUNS * 3 },
    )
    expect(run.failed).toBe(true)
  })

  it('a line check that looks only at points along the line slips between two cells touching at a corner', () => {
    // the corner rule left out: the cells of points along the line, never the two beside a corner it passes through
    const sampled = (f: Field, ax: number, az: number, bx: number, bz: number) => {
      for (let n = 0; n <= 64; n++) if (!f.free(Math.floor(ax + ((bx - ax) * n) / 64), Math.floor(az + ((bz - az) * n) / 64))) return false
      return true
    }
    const run = fc.check(
      fc.property(
        grids.chain((g) => fc.record({ g: fc.constant(g), k: fc.integer({ min: 0, max: g.w * g.h - 1 }), d: fc.constantFrom(...STEPS.slice(4)) })),
        ({ g, k, d }) => {
          const [ax, az] = mid(g.field, k)
          return !sampled(g.field, ax, az, ax + d[0], az + d[1]) || segmentClear(g.field, ax, az, ax + d[0], az + d[1])
        },
      ),
      { numRuns: RUNS * 3 },
    )
    expect(run.failed).toBe(true)
  })
})

describe('the way, in a few places', () => {
  it('round the end of a wall: the string turns once, just past the wall’s end', () => {
    const f = fieldOf([
      '..........', //
      '.....#....',
      '.....#....',
      '.....#....',
      '.....#....',
      '..........',
    ])
    const path = findPath(f, at(f, 2, 2), (k) => k === at(f, 8, 2))!
    expect(badSteps(f, path)).toEqual([])
    const pts = pullString(f, path).map((k) => ij(f, k))
    // over the top of the wall (row 0) or under it (row 5), never through it
    expect(pts.length).toBe(3)
    expect(pts[1][0]).toBe(5)
    expect([0, 5]).toContain(pts[1][1])
  })

  it('through a doorway: the only way into the next room', () => {
    const f = fieldOf([
      '.....#.....', //
      '.....#.....',
      '...........', // the doorway, at row 2
      '.....#.....',
      '.....#.....',
    ])
    const path = findPath(f, at(f, 1, 4), (k) => k === at(f, 9, 0))!
    expect(path.map((k) => ij(f, k)).filter(([i]) => i === 5)).toEqual([[5, 2]])
    expect(stringClear(f, pullString(f, path))).toBe(true)
  })

  it('a door shut is a wall: with no other way through, there is no path', () => {
    const rows = (door: string) => ['.........', '.........', `####${door}####`, '.........', '.........']
    const open = fieldOf(rows('.'))
    const shut = fieldOf(rows('#'))
    expect(findPath(open, at(open, 4, 4), (k) => k === at(open, 4, 0))!.some((k) => k === at(open, 4, 2))).toBe(true)
    expect(findPath(shut, at(shut, 4, 4), (k) => k === at(shut, 4, 0))).toBeNull()
  })

  it('a door shut sends the walk through the far doorway, a longer way', () => {
    // two rooms side by side; the wall between has a door near the top and a doorway at the bottom
    const rows = (door: string) => ['......#......', `......${door}......`, '......#......', '......#......', '......#......', '......#......', '.............', '......#......']
    const open = fieldOf(rows('.'))
    const shut = fieldOf(rows('#'))
    const route = (f: Field) => {
      const s = new Search(f, at(f, 1, 1), (k) => k === at(f, 11, 1), towards(f, at(f, 11, 1)))
      expect(s.step()).toBe('found')
      return s
    }
    const a = route(open)
    const b = route(shut)
    expect(a.path().some((k) => k === at(open, 6, 1))).toBe(true)
    expect(b.path().some((k) => k === at(shut, 6, 6))).toBe(true)
    expect(b.cost()).toBeGreaterThan(a.cost() + 4)
    expect(stringClear(shut, pullString(shut, b.path()))).toBe(true)
  })

  it('never squeezes between two blocked cells that touch at a corner', () => {
    const f = fieldOf([
      '#...', //
      '.#..',
      '..#.',
      '...#',
    ])
    // from below-left of the diagonal to above-right of it: the diagonal of blocked cells is a wall
    expect(findPath(f, at(f, 0, 3), (k) => k === at(f, 3, 0))).toBeNull()
    expect(lineClear(f, 0.5, 1.5, 1.5, 0.5)).toBe(false)
  })

  it('a goal inside a blocked thing: the nearest free cell within reach of it is the goal instead', () => {
    const f = fieldOf([
      '.......', //
      '..###..',
      '..###..',
      '..###..',
      '.......',
    ])
    const thing = { x: 3.5, z: 2.5 }
    const within = (k: number) => {
      const [i, j] = ij(f, k)
      return Math.hypot(i + 0.5 - thing.x, j + 0.5 - thing.z) <= 2
    }
    const path = findPath(f, at(f, 0, 4), within, (k) => Math.max(0, Math.hypot(ij(f, k)[0] + 0.5 - thing.x, ij(f, k)[1] + 0.5 - thing.z) - 2))!
    const [i, j] = ij(f, path[path.length - 1])
    expect(f.free(i, j)).toBe(true)
    expect(within(path[path.length - 1])).toBe(true)
    expect(nearestFree(f, thing.x, thing.z, 2)).not.toBe(at(f, 3, 2))
  })

  it('a blocked start finds nothing; the nearest free cell is where to start from', () => {
    const f = fieldOf(['....', '.##.', '....'])
    const s = new Search(
      f,
      at(f, 1, 1),
      (k) => k === at(f, 3, 0),
      () => 0,
    )
    expect(s.status).toBe('none')
    expect(s.path()).toEqual([])
    const k = nearestFree(f, 1.4, 1.4, 2)
    expect(f.free(...ij(f, k))).toBe(true)
    expect(Math.hypot(ij(f, k)[0] + 0.5 - 1.4, ij(f, k)[1] + 0.5 - 1.4)).toBeLessThanOrEqual(1)
  })

  it('spread over several calls, the search finds the same path as in one', () => {
    const f = fieldOf(['..........', '.########.', '.#......#.', '.#.####.#.', '.#....#...', '.######.#.', '..........'])
    const goal = at(f, 3, 4)
    const one = findPath(f, at(f, 0, 0), (k) => k === goal, towards(f, goal))!
    const s = new Search(f, at(f, 0, 0), (k) => k === goal, towards(f, goal))
    let calls = 0
    while (s.step(3) === 'running') calls++
    expect(calls).toBeGreaterThan(3)
    expect(s.path()).toEqual(one)
  })
})

describe('the grid', () => {
  it('works out each cell once, the first time it is asked about, at its middle; off the grid is blocked', () => {
    const asked: string[] = []
    const g = makeGrid(-1, 2, 1, 3, 0.25, (x, z) => {
      asked.push(`${x},${z}`)
      return x < 0
    })
    expect([g.w, g.h]).toEqual([8, 4])
    expect(g.cells.every((c) => c === UNKNOWN)).toBe(true)
    expect(g.free(0, 0)).toBe(true)
    expect(g.free(0, 0)).toBe(true)
    expect(g.free(7, 3)).toBe(false)
    expect(g.free(-1, 0) || g.free(8, 0) || g.free(0, 4)).toBe(false)
    expect(asked).toEqual(['-0.875,2.125', '0.875,2.875'])
    expect(g.probed).toBe(2)
    expect([g.cells[0], g.cells[31]]).toEqual([FREE, BLOCKED])
    expect(centreOf(g, 31)).toEqual({ x: 0.875, z: 2.875 })
  })

  it('with more cells blocked for one search, only those change', () => {
    const g = makeGrid(0, 0, 1, 1, 0.25, () => true)
    const f = withBlocked(g, new Set([5]))
    expect(f.free(1, 1)).toBe(false)
    expect(f.free(2, 1)).toBe(true)
    expect(g.free(1, 1)).toBe(true)
  })
})
