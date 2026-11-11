import fc from 'fast-check'
import { afterEach, describe, expect, it } from 'vitest'
import { addWalls, setWalls, updateWalls, wallHides, type WallPiece } from './walls'

// one wall along x at z = 0, 4 m long, 3 m high, 0.16 m thick
const WALL: WallPiece = { axis: 'x', at: 0, a: -2, b: 2, y0: 0, y1: 3, box: [-2, 0, -0.08, 2, 3, 0.08] }
let opaque = true
let stop: (() => void) | null = null
const use = (pieces: WallPiece[] = [WALL]) => {
  stop = setWalls({ pieces, opaque: () => opaque, drawn: () => true })
}
// the walk-in buildings' walls, each a source of its own (addWalls)
const more: (() => void)[] = []
afterEach(() => {
  stop?.()
  stop = null
  opaque = true
  for (const off of more.splice(0)) off()
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

describe('walls from several sources: the house and each walk-in building', () => {
  // a building's wall along z at x = 10 (its west wall), 0.15 thick, seen from the west
  const BUILDING: WallPiece = { axis: 'z', at: 10, a: 16.03, b: 20.47, y0: 0.03, y1: 3.37, box: [9.925, 0, 16, 10.075, 3.4, 20.5] }
  const behindHouse = [-0.5, 0.2, -1.5, 0.5, 1.2, -0.5] as const
  const inBuilding = [11, 0.4, 17.5, 11.6, 1.4, 18.1] as const
  const hides = (b: readonly number[]) => wallHides(b[0], b[1], b[2], b[3], b[4], b[5])

  it('two sources at once: each hides what is behind it, and taking one away leaves the other', () => {
    use()
    more.push(addWalls({ pieces: [BUILDING], opaque: () => true, drawn: () => true }))
    // from in front of the house's wall, looking south-east: the house's wall and the building's both in use
    expect(updateWalls(0, 1.5, 3, 0.1, 500)).toBe(2)
    expect(hides(behindHouse)).toBe(true)
    // the eye west of the building, so its west wall stands between them
    expect(updateWalls(4, 1.5, 18, 0.1, 500)).toBe(2)
    expect(hides(inBuilding)).toBe(true)
    // the house's walls gone: the building's still hide
    stop?.()
    stop = null
    expect(updateWalls(4, 1.5, 18, 0.1, 500)).toBe(1)
    expect(hides(inBuilding)).toBe(true)
    updateWalls(0, 1.5, 3, 0.1, 500)
    expect(hides(behindHouse)).toBe(false)
    // and the building's gone too: nothing hides
    more.pop()!()
    expect(updateWalls(4, 1.5, 18, 0.1, 500)).toBe(0)
    expect(hides(inBuilding)).toBe(false)
  })

  it('a source not drawn hides nothing while the others still do; one always opaque never fades with the house', () => {
    let shown = true
    use()
    more.push(addWalls({ pieces: [BUILDING], opaque: () => true, drawn: () => shown }))
    shown = false
    expect(updateWalls(4, 1.5, 18, 0.1, 500)).toBe(1)
    expect(hides(inBuilding)).toBe(false)
    updateWalls(0, 1.5, 3, 0.1, 500)
    expect(hides(behindHouse)).toBe(true)
    // the house's walls fading (third person): the building's are still walls
    shown = true
    opaque = false
    expect(updateWalls(4, 1.5, 18, 0.1, 500)).toBe(1)
    expect(hides(inBuilding)).toBe(true)
    updateWalls(0, 1.5, 3, 0.1, 500)
    expect(hides(behindHouse)).toBe(false)
  })

  it('pieces of two sources in one plane are used together, each hiding only what is behind itself', () => {
    // two halves of a wall z = 0 with a gap between them, one from each source
    use([{ axis: 'x', at: 0, a: -4, b: -1, y0: 0, y1: 3, box: [-4, 0, -0.08, -1, 3, 0.08] }])
    more.push(addWalls({ pieces: [{ axis: 'x', at: 0, a: 1, b: 4, y0: 0, y1: 3, box: [1, 0, -0.08, 4, 3, 0.08] }], opaque: () => true, drawn: () => true }))
    expect(updateWalls(0, 1.5, 4, 0.1, 500)).toBe(2)
    expect(wallHides(-3, 0.2, -1.2, -2.4, 1.2, -0.6)).toBe(true)
    expect(wallHides(2.4, 0.2, -1.2, 3, 1.2, -0.6)).toBe(true)
    // through the gap between them: seen
    expect(wallHides(-0.3, 0.2, -1.2, 0.3, 1.2, -0.6)).toBe(false)
  })

  it('at most 128 pieces are used in one render, whatever the sources hold', () => {
    const row = (from: number, n: number): WallPiece[] =>
      Array.from({ length: n }, (_, i) => {
        const at = -2 - (from + i) * 0.5
        return { axis: 'x', at, a: -2, b: 2, y0: 0, y1: 3, box: [-2, 0, at - 0.08, 2, 3, at + 0.08] }
      })
    use(row(0, 100))
    more.push(addWalls({ pieces: row(100, 60), opaque: () => true, drawn: () => true }))
    expect(updateWalls(0, 1.5, 3, 0.1, 500)).toBe(128)
    // the nearest wall still hides what is right behind it
    expect(wallHides(-0.5, 0.2, -2.4, 0.5, 1.2, -2.2)).toBe(true)
  })
})

describe('a building closed all round hides what is in its rooms from an eye outside it (fast-check)', () => {
  // a building 6 × 4 m, walls 0.15 thick and 3.4 high, a roof slab at 3.0–3.15 over its room, a door 1.1 m wide in the
  // north wall (z = 0) shut by a 4 cm leaf in the wall's middle (reaching 2 cm into the wall at each side)
  const shell: number[][] = [
    [0, 0, 0, 2.5, 3.4, 0.15],
    [3.6, 0, 0, 6, 3.4, 0.15],
    [2.5, 2.2, 0, 3.6, 3.4, 0.15],
    [0, 0, 3.85, 6, 3.4, 4],
    [0, 0, 0.15, 0.15, 3.4, 3.85],
    [5.85, 0, 0.15, 6, 3.4, 3.85],
    [0.15, 3.0, 0.15, 5.85, 3.15, 3.85],
  ]
  const leaf = [2.48, 0, 0.055, 3.62, 2.23, 0.095]
  const room = [0.15, 0, 0.15, 5.85, 3.0, 3.85]
  let shut = true
  const close = () => more.push(addWalls({ pieces: [], opaque: () => true, drawn: () => true, enclosure: { outer: [-0.1, 0, -0.1, 6.1, 3.5, 4.1], rooms: [room], shut: () => shut } }))
  afterEach(() => {
    shut = true
  })
  const hides = (b: readonly number[]) => wallHides(b[0], b[1], b[2], b[3], b[4], b[5])
  const shelf = [2, 0.4, 3, 2.4, 0.8, 3.4]

  it('from outside, shut: hidden from any side and from above; open, or the eye inside, or the box out of the room: not', () => {
    close()
    for (const [x, y, z] of [
      [3, 1.6, -3],
      [-4, 1.6, 2],
      [3, 8, 2],
      [10, 5, 9],
    ]) {
      expect(updateWalls(x, y, z, 0.1, 500)).toBe(1)
      expect(hides(shelf)).toBe(true)
      // reaching out of the room (into the wall, up through the roof): not
      expect(hides([2, 0.4, 3, 2.4, 3.2, 3.4])).toBe(false)
    }
    shut = false
    updateWalls(3, 1.6, -3, 0.1, 500)
    expect(hides(shelf)).toBe(false)
    shut = true
    // the eye in the room, or in the doorway
    updateWalls(3, 1.6, 2, 0.1, 500)
    expect(hides(shelf)).toBe(false)
    updateWalls(3, 1.6, 0.07, 0.1, 500)
    expect(hides(shelf)).toBe(false)
  })

  it('every line from an eye outside to a box it hides crosses the shell or the shut door', () => {
    close()
    const opaque = [...shell, leaf]
    const crosses = (e: number[], p: number[]) =>
      opaque.some((b) => {
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
    let hidden = 0
    // (evenly spread: fast-check's doubles keep to the ends of their range, and a box must land in the room)
    const coord = (lo: number, hi: number) => fc.integer({ min: 0, max: 4096 }).map((k) => lo + ((hi - lo) * k) / 4096)
    fc.assert(
      fc.property(
        fc.tuple(coord(-8, 14), coord(0.2, 9), coord(-8, 12)),
        fc.tuple(coord(-1, 6), coord(0, 3.2), coord(-1, 4), coord(0.05, 1.5), coord(0.05, 1.5), coord(0.05, 1.5)),
        fc.array(fc.tuple(coord(0, 1), coord(0, 1), coord(0, 1)), { minLength: 12, maxLength: 12 }),
        ([ex, ey, ez], [x, y, z, w, h, d], inner) => {
          // the eye outside the building's box
          if (ex > -0.1 && ex < 6.1 && ez > -0.1 && ez < 4.1 && ey < 3.5) return true
          updateWalls(ex, ey, ez, 0.05, 500)
          const box = [x, y, z, x + w, y + h, z + d]
          if (!hides(box)) return true
          hidden++
          const points = [
            ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k & 1 ? box[3] : box[0], k & 2 ? box[4] : box[1], k & 4 ? box[5] : box[2]]),
            ...inner.map(([u, v, t]) => [x + u * w, y + v * h, z + t * d]),
          ]
          for (const p of points) expect(crosses([ex, ey, ez], p), `the eye ${[ex, ey, ez].join(', ')} sees ${p.join(', ')}`).toBe(true)
          return true
        },
      ),
      { numRuns: RUNS * 10 },
    )
    expect(hidden).toBeGreaterThan(RUNS / 10)
  })
})
