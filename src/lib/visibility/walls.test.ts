import fc from 'fast-check'
import { afterEach, describe, expect, it } from 'vitest'
import { setWalls, updateWalls, wallHides, type WallPiece } from './walls'

// one wall along x at z = 0, 4 m long, 3 m high, 0.16 m thick
const WALL: WallPiece = { axis: 'x', at: 0, a: -2, b: 2, y0: 0, y1: 3, box: [-2, 0, -0.08, 2, 3, 0.08] }
let opaque = true
let stop: (() => void) | null = null
const use = (pieces: WallPiece[] = [WALL]) => {
  stop = setWalls({ pieces, opaque: () => opaque, drawn: () => true })
}
afterEach(() => {
  stop?.()
  stop = null
  opaque = true
})

describe('the walls hide what lies wholly behind them', () => {
  it('a box right behind the wall, seen from in front of it, is hidden; one beside it, above it or in front is not', () => {
    use()
    expect(updateWalls(0, 1.5, 3, 0.1, 500)).toBe(1)
    expect(wallHides(-0.5, 0.2, -1.5, 0.5, 1.2, -0.5)).toBe(true)
    // its edge past the wall's end, as seen from the eye
    expect(wallHides(1.5, 0.2, -1.5, 2.5, 1.2, -0.5)).toBe(false)
    // too tall: its top shows over the wall
    expect(wallHides(-0.5, 0.2, -1.5, 0.5, 3.5, -0.5)).toBe(false)
    // on the eye's side
    expect(wallHides(-0.5, 0.2, 0.5, 0.5, 1.2, 1.5)).toBe(false)
    // straddling the wall's middle plane
    expect(wallHides(-0.5, 0.2, -0.05, 0.5, 1.2, 0.5)).toBe(false)
  })

  it('far behind, the cone widens: a box wider than the wall hides behind it when far enough', () => {
    use()
    updateWalls(0, 1.5, 1, 0.1, 500)
    expect(wallHides(-5, 0.1, -10, 5, 2, -9)).toBe(true)
    expect(wallHides(-5, 0.1, -1.5, 5, 2, -1)).toBe(false)
  })

  it('a wall seen from above hides only what is low behind it', () => {
    use()
    updateWalls(0, 6, 4, 0.1, 500)
    // close behind the wall and low: hidden
    expect(wallHides(-0.5, 0, -0.6, 0.5, 0.5, -0.2)).toBe(true)
    // further behind, the eye sees over the top
    expect(wallHides(-0.5, 0, -4, 0.5, 0.5, -3)).toBe(false)
  })

  it('no wall while it fades, or while the eye is too near it (the near plane could cut it open)', () => {
    use()
    opaque = false
    expect(updateWalls(0, 1.5, 3, 0.1, 500)).toBe(0)
    expect(wallHides(-0.5, 0.2, -1.5, 0.5, 1.2, -0.5)).toBe(false)
    opaque = true
    expect(updateWalls(0, 1.5, 0.3, 0.1, 500)).toBe(0)
    expect(updateWalls(0, 1.5, 0.3, 0.01, 500)).toBe(0)
  })

  it('a wall along z, and without walls nothing is hidden', () => {
    const z: WallPiece = { axis: 'z', at: 0, a: -2, b: 2, y0: 0, y1: 3, box: [-0.08, 0, -2, 0.08, 3, 2] }
    use([z])
    updateWalls(-3, 1.5, 0, 0.1, 500)
    expect(wallHides(0.5, 0.2, -0.5, 1.5, 1.2, 0.5)).toBe(true)
    expect(wallHides(-1.5, 0.2, -0.5, -0.5, 1.2, 0.5)).toBe(false)
    stop?.()
    stop = null
    expect(updateWalls(-3, 1.5, 0, 0.1, 500)).toBe(0)
    expect(wallHides(0.5, 0.2, -0.5, 1.5, 1.2, 0.5)).toBe(false)
  })
})

// Any eye, any box: when the walls say a box is hidden, every line from the eye to any point of it must pass through
// the wall's box first (a point of the wall nearer the eye than the point). The property must meet hidden boxes (one
// that found none would prove nothing), and boxes the eye can see past the wall's ends or over its top.
const RUNS = Number(process.env.FC_RUNS) || 300
describe('a box the walls hide is behind the wall from every point of it (fast-check)', () => {
  const crosses = (e: number[], p: number[], b: readonly number[]) => {
    // the slab test: the segment from e to p meets the box b
    let t0 = 0
    let t1 = 1
    for (let k = 0; k < 3; k++) {
      const d = p[k] - e[k]
      if (Math.abs(d) < 1e-12) {
        if (e[k] < b[k] || e[k] > b[k + 3]) return false
        continue
      }
      let a = (b[k] - e[k]) / d
      let c = (b[k + 3] - e[k]) / d
      if (a > c) [a, c] = [c, a]
      t0 = Math.max(t0, a)
      t1 = Math.min(t1, c)
      if (t0 > t1) return false
    }
    return true
  }
  it('every corner and inner point of a hidden box is behind the wall', () => {
    use()
    let hidden = 0
    let seen = 0
    const coord = (lo: number, hi: number) => fc.double({ min: lo, max: hi, noNaN: true })
    fc.assert(
      fc.property(
        fc.tuple(coord(-6, 6), coord(0.2, 7), coord(0.6, 8)),
        fc.tuple(coord(-6, 6), coord(0, 4), coord(-9, 1), coord(0.05, 3), coord(0.05, 2), coord(0.05, 3)),
        fc.array(fc.tuple(coord(0, 1), coord(0, 1), coord(0, 1)), { minLength: 12, maxLength: 12 }),
        ([ex, ey, ez], [x, y, z, w, h, d], inner) => {
          updateWalls(ex, ey, ez, 0.05, 500)
          const box = [x, y, z, x + w, y + h, z + d]
          if (!wallHides(box[0], box[1], box[2], box[3], box[4], box[5])) {
            seen++
            return true
          }
          hidden++
          const points = [
            ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k & 1 ? box[3] : box[0], k & 2 ? box[4] : box[1], k & 4 ? box[5] : box[2]]),
            ...inner.map(([u, v, t]) => [x + u * w, y + v * h, z + t * d]),
          ]
          for (const p of points) expect(crosses([ex, ey, ez], p, WALL.box), `the eye ${[ex, ey, ez].join(', ')} sees ${p.join(', ')} past the wall`).toBe(true)
          return true
        },
      ),
      { numRuns: RUNS * 10 },
    )
    expect(hidden).toBeGreaterThan(RUNS / 10)
    expect(seen).toBeGreaterThan(RUNS / 10)
  })
})

describe('several walls in several planes, with a doorway between two pieces (fast-check)', () => {
  // the wall z = 0 in two pieces with a doorway from -0.8 to 0.8, a lintel over it, and a wall x = 3 across
  const PIECES: WallPiece[] = [
    { axis: 'x', at: 0, a: -4, b: -0.8, y0: 0, y1: 3, box: [-4, 0, -0.08, -0.8, 3, 0.08] },
    { axis: 'x', at: 0, a: 0.8, b: 4, y0: 0, y1: 3, box: [0.8, 0, -0.08, 4, 3, 0.08] },
    { axis: 'x', at: 0, a: -0.8, b: 0.8, y0: 2.1, y1: 3, box: [-0.8, 2.1, -0.08, 0.8, 3, 0.08] },
    { axis: 'z', at: 3, a: -4, b: 4, y0: 0, y1: 3, box: [2.92, 0, -4, 3.08, 3, 4] },
  ]
  const crossesAny = (e: number[], p: number[]) =>
    PIECES.some((w) => {
      const b = w.box
      let t0 = 0
      let t1 = 1
      for (let k = 0; k < 3; k++) {
        const d = p[k] - e[k]
        if (Math.abs(d) < 1e-12) {
          if (e[k] < b[k] || e[k] > b[k + 3]) return false
          continue
        }
        let a = (b[k] - e[k]) / d
        let c = (b[k + 3] - e[k]) / d
        if (a > c) [a, c] = [c, a]
        t0 = Math.max(t0, a)
        t1 = Math.min(t1, c)
        if (t0 > t1) return false
      }
      return true
    })
  it('a hidden box is behind some wall from each of its points; through the doorway it is seen', () => {
    use(PIECES)
    let hidden = 0
    const coord = (lo: number, hi: number) => fc.double({ min: lo, max: hi, noNaN: true })
    fc.assert(
      fc.property(
        fc.tuple(coord(-5, 2), coord(0.2, 7), coord(0.6, 6)),
        fc.tuple(coord(-6, 6), coord(0, 3), coord(-6, 1), coord(0.05, 2), coord(0.05, 2), coord(0.05, 2)),
        fc.array(fc.tuple(coord(0, 1), coord(0, 1), coord(0, 1)), { minLength: 12, maxLength: 12 }),
        ([ex, ey, ez], [x, y, z, w, h, d], inner) => {
          updateWalls(ex, ey, ez, 0.05, 500)
          const box = [x, y, z, x + w, y + h, z + d]
          if (!wallHides(box[0], box[1], box[2], box[3], box[4], box[5])) return true
          hidden++
          const points = [
            ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k & 1 ? box[3] : box[0], k & 2 ? box[4] : box[1], k & 4 ? box[5] : box[2]]),
            ...inner.map(([u, v, t]) => [x + u * w, y + v * h, z + t * d]),
          ]
          for (const p of points) expect(crossesAny([ex, ey, ez], p), `the eye ${[ex, ey, ez].join(', ')} sees ${p.join(', ')}`).toBe(true)
          return true
        },
      ),
      { numRuns: RUNS * 10 },
    )
    expect(hidden).toBeGreaterThan(RUNS / 10)
    // straight through the doorway, low: seen
    updateWalls(0, 1.2, 4, 0.05, 500)
    expect(wallHides(-0.3, 0.2, -2, 0.3, 1.5, -1.5)).toBe(false)
    // behind the piece beside it: hidden
    expect(wallHides(-3, 0.2, -1.5, -2, 1.5, -1)).toBe(true)
  })
})
