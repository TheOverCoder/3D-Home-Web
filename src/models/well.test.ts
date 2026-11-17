import { describe, expect, it } from 'vitest'
import { lathe, spin, type Shape } from '../lib/sculpt'
import { WELL_BUCKET, WELL_WALL, decorModel } from './decor'

// The well's wall and bucket (src/models/decor.ts): each a profile that turns back on itself (up the outside, over the
// rim, down the inside), turned with `spin`, every ring in one frame. `lathe` turns each ring with its spine, so where a
// profile turns down its rings flip and the band between them twists; it is left as it is, as every other model built
// with it is drawn today (the berries' and fruits' dimples, a hat's brim, a forearm's cuff turn back too), and a profile
// that turns back is turned with `spin`. A band turned that way leaves the inside of the wall inside out: these hold every
// face of the well's turned parts upright on its profile and facing out of the solid.

/** Each triangle's unit normal and middle. */
function faces(s: Shape) {
  const out: { n: [number, number, number]; c: [number, number, number] }[] = []
  for (let t = 0; t < s.i.length; t += 3) {
    const [a, b, c] = [s.i[t], s.i[t + 1], s.i[t + 2]].map((k) => [s.p[k * 3], s.p[k * 3 + 1], s.p[k * 3 + 2]])
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n: [number, number, number] = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n)
    if (len < 1e-12) continue
    out.push({ n: [n[0] / len, n[1] / len, n[2] / len], c: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] })
  }
  return out
}

/** How far the faces turn round the axis: the largest share of a normal along the way round (0 on a surface turned
 *  true; a polygon's face off its middle leans by at most sin(π / seg)). */
function twist(s: Shape) {
  let most = 0
  for (const { n, c } of faces(s)) {
    const r = Math.hypot(c[0], c[2])
    if (r < 1e-6) continue
    most = Math.max(most, Math.abs((-c[2] / r) * n[0] + (c[0] / r) * n[2]))
  }
  return most
}

/** The volume a closed shape holds, signed: positive when its faces face out. */
function volume(s: Shape) {
  let v = 0
  for (let t = 0; t < s.i.length; t += 3) {
    const [a, b, c] = [s.i[t], s.i[t + 1], s.i[t + 2]].map((k) => [s.p[k * 3], s.p[k * 3 + 1], s.p[k * 3 + 2]])
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
  }
  return v
}

/** What a profile turned as a polygon of `seg` sides holds: a frustum of the polygon between each two rings, taken away
 *  where the profile goes down (the inside of a wall). */
function expected(profile: [number, number][], seg: number) {
  const k = (seg / 2) * Math.sin((2 * Math.PI) / seg)
  let v = 0
  for (let i = 0; i < profile.length - 1; i++) {
    const [a, y0] = profile[i]
    const [b, y1] = profile[i + 1]
    v += (k * (y1 - y0) * (a * a + a * b + b * b)) / 3
  }
  return v
}

describe('the well: its turned wall and bucket', () => {
  it.each([
    ['wall', WELL_WALL, 20],
    ['bucket', WELL_BUCKET, 12],
  ] as const)('the %s faces out everywhere, untwisted, and holds what its profile does', (_, profile, seg) => {
    const s = spin(profile as [number, number][], seg)
    expect(twist(s)).toBeLessThan(Math.sin(Math.PI / seg) + 1e-6)
    const want = expected(profile as [number, number][], seg)
    expect(want).toBeGreaterThan(0)
    expect(volume(s)).toBeCloseTo(want, 8)
  })

  it('the well is built with them: its wall is the wall turned true', () => {
    const wall = decorModel('well').stone.shape
    expect(twist(wall)).toBeLessThan(Math.sin(Math.PI / 20) + 1e-6)
    expect(volume(wall)).toBeCloseTo(expected(WELL_WALL, 20), 8)
  })

  it('(why not `lathe`: the same profiles come out with the inside of the wall inside out, holding twice and more)', () => {
    for (const [profile, seg] of [
      [WELL_WALL, 20],
      [WELL_BUCKET, 12],
    ] as const) {
      const want = expected(profile as [number, number][], seg)
      expect(volume(lathe(profile as [number, number][], { seg, steps: 1 }))).toBeGreaterThan(1.5 * want)
    }
  })
})
