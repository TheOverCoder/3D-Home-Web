import fc from 'fast-check'
import { PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { DOOR, DOORWAYS, HOUSE, WINDOWS } from '../../data/layout'
import { BEHIND, OUTSIDE, PORTALS, Portals, RECT, WHOLE, boxRect, cellIndex } from './portals'

// The rooms and portals (portals.ts) against the house itself: a point the eye can see — the line from the eye to it
// passes every wall through an opening, the floor and the ceiling not at all — must be judged seen, wherever the
// eye stands (in a room, in a doorway, against a wall, outdoors), whichever way it looks, the kitchen's door shut or
// open. The rectangles may over-cover (judge seen what a wall hides); they may never under-cover.

const RUNS = Number(process.env.FC_RUNS) || 300
const H = HOUSE.wallHeight
const T = HOUSE.wallThickness

function camera(x: number, y: number, z: number, yaw: number, pitch: number, fov: number, aspect: number, near = 0.05) {
  const c = new PerspectiveCamera(fov, aspect, near, 1500)
  c.position.set(x, y, z)
  c.rotation.order = 'YXZ'
  c.rotation.set(pitch, yaw, 0)
  c.updateMatrixWorld(true)
  c.updateProjectionMatrix()
  return c
}

const update = (p: Portals, c: PerspectiveCamera, doorOpen: boolean) => p.update(c.matrixWorldInverse.elements, c.projectionMatrix.elements, c.near, c.position, doorOpen)

// the house as thin walls in their middle planes, with their openings (no padding: what is really open)
interface Wall {
  axis: 'x' | 'z' // the plane z = at ('x') or x = at ('z')
  at: number
  from: number
  to: number
  openings: { lo: number; hi: number; y0: number; y1: number; door: boolean }[]
}
const opening = (o: { centre: number; width: number }, y0: number, y1: number, door = false) => ({ lo: o.centre - o.width / 2, hi: o.centre + o.width / 2, y0, y1, door })
const WALLS: Wall[] = [
  ...([HOUSE.minZ, HOUSE.maxZ] as number[]).map((at) => ({
    axis: 'x' as const,
    at,
    from: HOUSE.minX,
    to: HOUSE.maxX,
    openings: WINDOWS.filter((w) => w.axis === 'x' && w.at === at).map((w) => opening(w, w.sill, w.top)),
  })),
  ...([HOUSE.minX, HOUSE.maxX] as number[]).map((at) => ({
    axis: 'z' as const,
    at,
    from: HOUSE.minZ,
    to: HOUSE.maxZ,
    openings: WINDOWS.filter((w) => w.axis === 'z' && w.at === at).map((w) => opening(w, w.sill, w.top)),
  })),
  { axis: 'x', at: 0, from: HOUSE.minX, to: HOUSE.maxX, openings: [opening(DOORWAYS.livingOffice, 0, HOUSE.doorHeight), opening(DOORWAYS.kitchenBedroom, 0, HOUSE.doorHeight, true)] },
  { axis: 'z', at: 0, from: HOUSE.minZ, to: HOUSE.maxZ, openings: [opening(DOORWAYS.officeKitchen, 0, HOUSE.doorHeight), opening(DOORWAYS.livingBedroom, 0, HOUSE.doorHeight)] },
]

/**
 * Whether `p` can be seen from the camera: the stretch of the line of sight past the near plane (what the camera
 * draws) crosses each wall's middle plane only in an opening, and neither the ceiling nor the floor of the house. A
 * stretch that starts inside a wall (the near plane cuts into it) sees through that wall, as the renderer does: the
 * wall's faces towards the eye are clipped, the ones beyond face away.
 */
function canSee(c: PerspectiveCamera, p: Vector3, doorOpen: boolean): boolean {
  const view = p.clone().applyMatrix4(c.matrixWorldInverse)
  if (view.z > -c.near) return false
  const ndc = p.clone().project(c)
  if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1 || ndc.z > 1) return false
  // where the line of sight crosses the near plane
  const e = c.position
  const q = e.clone().lerp(p, c.near / -view.z)
  const inHouse = (x: number, z: number) => x >= HOUSE.minX && x <= HOUSE.maxX && z >= HOUSE.minZ && z <= HOUSE.maxZ
  for (const w of WALLS) {
    const qa = w.axis === 'x' ? q.z : q.x
    const pa = w.axis === 'x' ? p.z : p.x
    if ((qa - w.at) * (pa - w.at) > 0 || qa === pa) continue
    const t = (w.at - qa) / (pa - qa)
    const along = w.axis === 'x' ? q.x + (p.x - q.x) * t : q.z + (p.z - q.z) * t
    const y = q.y + (p.y - q.y) * t
    if (along < w.from || along > w.to || y < 0 || y > H) continue
    // starting inside this wall: its faces are cut away or face away
    const qAlong = w.axis === 'x' ? q.x : q.z
    if (Math.abs(qa - w.at) < T / 2 && qAlong >= w.from - T / 2 && qAlong <= w.to + T / 2 && q.y >= 0 && q.y <= H) continue
    if (!w.openings.some((o) => (!o.door || doorOpen) && along >= o.lo && along <= o.hi && y >= o.y0 && y <= o.y1)) return false
  }
  // the ceiling (its slab's underside at H) and the floor (at 0), over the house's footprint
  for (const level of [H, 0]) {
    if ((q.y - level) * (p.y - level) >= 0) continue
    const t = (level - q.y) / (p.y - q.y)
    if (inHouse(q.x + (p.x - q.x) * t, q.z + (p.z - q.z) * t)) return false
  }
  return true
}

const point = fc.record({ x: fc.double({ min: -16, max: 16, noNaN: true }), y: fc.double({ min: 0.02, max: H - 0.02, noNaN: true }), z: fc.double({ min: -15, max: 15, noNaN: true }) })
const eyeInside = fc.record({
  x: fc.double({ min: HOUSE.minX + 0.12, max: HOUSE.maxX - 0.12, noNaN: true }),
  y: fc.double({ min: 0.4, max: 2.98, noNaN: true }),
  z: fc.double({ min: HOUSE.minZ + 0.12, max: HOUSE.maxZ - 0.12, noNaN: true }),
})
const eyeOutside = fc
  .record({ x: fc.double({ min: -15, max: 15, noNaN: true }), y: fc.double({ min: 0.4, max: 2.9, noNaN: true }), z: fc.double({ min: -14, max: 14, noNaN: true }) })
  .filter((e) => !(e.x > HOUSE.minX - 0.12 && e.x < HOUSE.maxX + 0.12 && e.z > HOUSE.minZ - 0.12 && e.z < HOUSE.maxZ + 0.12))
// an eye right at a doorway or a window, or against a wall: the near plane cuts into it
const eyeAtOpening = fc
  .record({
    k: fc.integer({ min: 0, max: PORTALS.length - 1 }),
    along: fc.double({ min: -0.3, max: 1.3, noNaN: true }),
    off: fc.double({ min: -0.4, max: 0.4, noNaN: true }),
    y: fc.double({ min: 0.5, max: 2.9, noNaN: true }),
  })
  .map(({ k, along, off, y }) => {
    const p = PORTALS[k]
    const a = p.lo + (p.hi - p.lo) * along
    return p.axis === 'x' ? { x: a, y, z: p.at + off } : { x: p.at + off, y, z: a }
  })
const view = fc.record({
  yaw: fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
  pitch: fc.double({ min: -1.45, max: 1.45, noNaN: true }),
  fov: fc.constantFrom(72, 84, 50, 100),
  aspect: fc.constantFrom(640 / 360, 390 / 844, 1),
  near: fc.constantFrom(0.05, 0.1),
  doorOpen: fc.boolean(),
})

/** How many points the eye could see, over a property's runs (a property that saw none would prove nothing). */
let seen = 0

/** Every point of `points` the eye can see is judged seen, as a point and as a small box round it. */
function overCovers(
  e: { x: number; y: number; z: number },
  v: { yaw: number; pitch: number; fov: number; aspect: number; near: number; doorOpen: boolean },
  points: { x: number; y: number; z: number }[],
) {
  const c = camera(e.x, e.y, e.z, v.yaw, v.pitch, v.fov, v.aspect, v.near)
  const p = new Portals()
  update(p, c, v.doorOpen)
  for (const q of points) {
    const at = new Vector3(q.x, q.y, q.z)
    if (!canSee(c, at, v.doorOpen)) continue
    seen++
    expect(p.seesBox(q.x, q.y, q.z, q.x, q.y, q.z, false), `point ${q.x},${q.y},${q.z} from ${e.x},${e.y},${e.z}`).toBe(true)
    expect(p.seesBox(q.x - 0.01, q.y - 0.01, q.z - 0.01, q.x + 0.01, q.y + 0.01, q.z + 0.01, false)).toBe(true)
    // a thing of the outside is judged by the outside's rectangle alone
    const inside = q.x > HOUSE.minX && q.x < HOUSE.maxX && q.z > HOUSE.minZ && q.z < HOUSE.maxZ
    if (!inside) expect(p.seesBox(q.x, q.y, q.z, q.x, q.y, q.z, true)).toBe(true)
  }
}

describe('rooms and portals', () => {
  const points = fc.array(point, { minLength: 40, maxLength: 40 })
  it('every point an eye in the house can see is judged seen', () => {
    seen = 0
    fc.assert(fc.property(eyeInside, view, points, overCovers), { numRuns: RUNS })
    expect(seen).toBeGreaterThan(RUNS / 2)
  })
  it('every point an eye outdoors can see is judged seen', () => {
    seen = 0
    fc.assert(fc.property(eyeOutside, view, points, overCovers), { numRuns: RUNS })
    expect(seen).toBeGreaterThan(RUNS / 2)
  })
  it('every point an eye in a doorway, at a window or against a wall can see is judged seen', () => {
    seen = 0
    fc.assert(fc.property(eyeAtOpening, view, points, overCovers), { numRuns: RUNS })
    expect(seen).toBeGreaterThan(RUNS / 2)
  })

  it('narrows the view through each opening: a room behind a wall is not seen, the one through a doorway is', () => {
    const p = new Portals()
    // the kitchen, looking south at the shut door: only the kitchen
    const kitchen = camera(3.5, 1.62, -3, Math.PI, 0, 72, 640 / 360)
    update(p, kitchen, false)
    expect(p.isStart(cellIndex('kitchen'))).toBe(true)
    expect(p.seen(cellIndex('bedroom'))).toBe(false)
    expect(p.seen(OUTSIDE)).toBe(false)
    // the bedroom's middle, behind the shut door: not drawn; the door open: drawn
    expect(p.seesBox(3, 0.5, 2, 4, 1.5, 3, false)).toBe(false)
    update(p, kitchen, true)
    expect(p.seen(cellIndex('bedroom'))).toBe(true)
    expect(p.seesBox(3, 0.5, 2, 4, 1.5, 3, false)).toBe(true)
    // through the open door the bedroom is seen only through it: its rectangle is the doorway's, not the screen
    const r = p.rects.slice(cellIndex('bedroom') * 4, cellIndex('bedroom') * 4 + 4)
    expect(r[1] - r[0]).toBeLessThan(1.5)
    // the farm behind the kitchen's back wall: not drawn
    expect(p.seesBox(4, 0, -12, 6, 2, -10, true)).toBe(false)
  })

  it('the garden door shows the farm, narrowed to the door', () => {
    const p = new Portals()
    update(p, camera(-1.2, 1.62, 3.6, Math.PI, -0.05, 72, 640 / 360), false)
    expect(p.seen(OUTSIDE)).toBe(true)
    // the lawn straight out of the door
    expect(p.seesBox(-1.5, 0, 9, -1, 0.5, 10, true)).toBe(true)
    // the hen run far to the east, out past the living room's wall: not through the door
    expect(p.seesBox(9, 0, 8, 10, 1, 9, true)).toBe(false)
  })

  it('outdoors, every room is seen only through its windows', () => {
    const p = new Portals()
    // south of the house, looking north at the living room's glass door and the bedroom's window
    update(p, camera(0, 1.62, 12.5, 0, 0.02, 72, 640 / 360), false)
    expect(p.isStart(OUTSIDE)).toBe(true)
    expect(p.seen(cellIndex('living'))).toBe(true)
    expect(p.seen(cellIndex('bedroom'))).toBe(true)
    // the studio, behind the living room, through the doorway between them: seen; the kitchen behind the shut door:
    // only if its own windows are in view, and they face north and east
    expect(p.seen(cellIndex('kitchen'))).toBe(false)
  })

  it('an eye right against a wall sees through it: the cell behind is seen whole', () => {
    const p = new Portals()
    // in the living room, 1 cm from the wall to the studio, looking at it
    const c = camera(-5, 1.6, T / 2 + 0.01, 0, 0, 72, 640 / 360)
    update(p, c, false)
    expect(p.isStart(cellIndex('office'))).toBe(true)
    expect(p.isStart(cellIndex('living'))).toBe(true)
  })
})

describe('the screen rectangle of a box', () => {
  const c = camera(0, 1.6, 0, 0, 0, 72, 16 / 9, 0.05)
  const V = c.matrixWorldInverse.elements
  const P = c.projectionMatrix.elements
  const out = new Float64Array(4)
  it('holds every corner of the box', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5, max: 5, noNaN: true }),
        fc.double({ min: -1, max: 4, noNaN: true }),
        fc.double({ min: -20, max: -1, noNaN: true }),
        fc.double({ min: 0.01, max: 2, noNaN: true }),
        (x, y, z, s) => {
          const r = boxRect(x - s, y - s, z - s, x + s, y + s, z + s, V, P, c.near, out)
          if (r !== RECT) return
          for (let k = 0; k < 8; k++) {
            const q = new Vector3(k & 1 ? x + s : x - s, k & 2 ? y + s : y - s, k & 4 ? z + s : z - s).project(c)
            expect(q.x).toBeGreaterThanOrEqual(out[0] - 1e-9)
            expect(q.x).toBeLessThanOrEqual(out[1] + 1e-9)
            expect(q.y).toBeGreaterThanOrEqual(out[2] - 1e-9)
            expect(q.y).toBeLessThanOrEqual(out[3] + 1e-9)
          }
        },
      ),
      { numRuns: RUNS },
    )
  })
  it('behind the eye is behind; through the near plane is the whole screen; not a number is the whole screen', () => {
    expect(boxRect(-1, 1, 2, 1, 2, 3, V, P, c.near, out)).toBe(BEHIND)
    expect(boxRect(-1, 1, -1, 1, 2, 1, V, P, c.near, out)).toBe(WHOLE)
    expect(boxRect(NaN, 1, -3, 1, 2, -2, V, P, c.near, out)).toBe(WHOLE)
  })
})

describe('the portals', () => {
  it('are the four doorways, the seven windows and the garden door, each a little larger than its opening', () => {
    expect(PORTALS.length).toBe(4 + WINDOWS.length)
    expect(WINDOWS.length).toBe(8)
    const door = PORTALS.find((p) => p.door)!
    expect(door.id).toBe('kitchenBedroom')
    expect(door.lo).toBeLessThan(DOOR.hinge[0])
    expect(door.hi).toBeGreaterThan(DOOR.hinge[0] + DOOR.width)
    for (const p of PORTALS) expect(p.a).not.toBe(p.b)
  })
})
