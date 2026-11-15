import { describe, expect, it } from 'vitest'
import { Matrix4, Vector3 } from 'three'
import { CAR_SPOT } from '../data/maps'
import { CAR_CABIN, CAR_SHAPE, putRollingCar, rollingCarParts } from '../models/car'
import { along, arriving, camAt, carAt, carPoint, cuts, driveFilm, EYE, fovFor, momentAt, pathOf, shotAt, travelled, type DriveFilm, type Trip } from './drive'

// The drive's film as data (src/film/drive.ts): its ways and speeds, its shots (each way a beginning and an end, a few
// seconds long, FILM.md's numbers), the car where the game parks it at either end, the camera looking at it, the
// driver's seat inside the cabin looking down the road, and the still for less motion. Pure.

const TRIPS: Trip[] = [
  { from: 'farm', to: 'home' },
  { from: 'home', to: 'farm' },
]
const ASPECTS = [844 / 390, 390 / 844, 640 / 360]

/** Every few hundredths of a second through a film. */
const times = (film: DriveFilm, step = 0.05) => Array.from({ length: Math.floor(film.length / step) + 1 }, (_, i) => Math.min(film.length, i * step))

describe('the ways', () => {
  it('a smooth way goes through its points, measured along its length; past its ends it goes on', () => {
    const way = pathOf([
      [0, 0],
      [10, 0],
      [10, 10],
    ])
    expect(along(way, 0)).toMatchObject({ x: 0, z: 0 })
    const end = along(way, way.length)
    expect(end.x).toBeCloseTo(10, 6)
    expect(end.z).toBeCloseTo(10, 6)
    // round the corner, about as long as its two legs
    expect(way.length).toBeGreaterThan(17)
    expect(way.length).toBeLessThan(21)
    // heading east (+x) is the player's yaw −π/2; south (+z) is π; west π/2
    expect(along(way, 0.5).yaw).toBeCloseTo(-Math.PI / 2, 0)
    expect(Math.abs(along(way, way.length).yaw)).toBeGreaterThan(2.8)
    const west = pathOf([
      [5, 3],
      [-5, 3],
    ])
    expect(along(west, 4).yaw).toBeCloseTo(Math.PI / 2, 9)
    expect(along(west, 4).x).toBeCloseTo(1, 9)
    const past = along(way, way.length + 5)
    expect(past.z).toBeGreaterThan(14.9)
  })

  it('the speeds: straight between moments, held after the last; arriving stops at the end of its way when it says', () => {
    expect(travelled([[0, 10]], 2)).toMatchObject({ s: 20, v: 10, a: 0 })
    const up = travelled(
      [
        [0, 0],
        [2, 8],
      ],
      1,
    )
    expect(up).toMatchObject({ s: 2, v: 4, a: 4 })
    const stop = arriving(20, 2, 1)
    expect(travelled(stop, 2).s).toBeCloseTo(20, 6)
    expect(travelled(stop, 2).v).toBeCloseTo(0, 6)
    expect(travelled(stop, 3).s).toBeCloseTo(20, 6)
  })
})

describe('the film each way', () => {
  for (const trip of TRIPS) {
    const film = driveFilm(trip)
    it(`${trip.from} → ${trip.to}: four shots, leaving then the road then the driver's seat then arriving, 6–10 s, each shot 1.5–3 s`, () => {
      expect(film.shots.map((s) => s.set)).toEqual([trip.from === 'farm' ? 'lot' : 'home', 'road', 'road', trip.to === 'farm' ? 'lot' : 'home'])
      expect(film.shots.map((s) => s.cam.kind)).toEqual(['post', 'track', 'cabin', 'post'])
      expect(film.length).toBeGreaterThanOrEqual(6)
      expect(film.length).toBeLessThanOrEqual(10)
      for (const s of film.shots) {
        expect(s.len).toBeGreaterThanOrEqual(1.5)
        expect(s.len).toBeLessThanOrEqual(3)
      }
      expect(film.length).toBeCloseTo(
        film.shots.reduce((n, s) => n + s.len, 0),
        9,
      )
      expect(cuts(film)[2]).toBeCloseTo(film.shots[0].len + film.shots[1].len, 9)
    })

    it(`${trip.from} → ${trip.to}: it leaves from where the game parks the car, and stops where the game parks it there, then toots`, () => {
      const first = carAt(film.shots[0], 0)
      const spot = CAR_SPOT[trip.from]
      expect(Math.hypot(first.x - spot.x, first.z - spot.z)).toBeLessThan(0.6)
      const last = film.shots[3]
      const parked = carAt(last, last.len)
      const there = CAR_SPOT[trip.to]
      expect(Math.hypot(parked.x - there.x, parked.z - there.z)).toBeLessThan(0.05)
      expect(parked.v).toBeCloseTo(0, 6)
      expect(parked.braking).toBe(true)
      // the horn after it has stopped, and before the picture fades (0.4 s at the end)
      expect(last.horn).toBeGreaterThan(1.5)
      expect(carAt(last, last.horn!).v).toBeCloseTo(0, 6)
      expect(last.horn!).toBeLessThan(last.len - 0.4)
      // it was going when the shot began, and never goes backwards
      expect(carAt(last, 0).v).toBeGreaterThan(4)
      let s = -Infinity
      for (let u = 0; u <= last.len; u += 0.02) {
        const r = carAt(last, u).roll
        expect(r).toBeGreaterThanOrEqual(s - 1e-9)
        s = r
      }
    })

    it(`${trip.from} → ${trip.to}: the camera never under the ground; the car in the picture (but as it goes past leaving, and comes in from behind arriving)`, () => {
      for (const aspect of ASPECTS)
        for (const t of times(film)) {
          const m = momentAt(film, t, aspect)
          expect(m.cam.pos.y).toBeGreaterThan(0.3)
          expect(Number.isFinite(m.cam.fov) && m.cam.fov > 15 && m.cam.fov < 90).toBe(true)
          const shot = film.shots[m.shot]
          if (shot.cam.kind === 'cabin' || (m.shot === 0 && m.u > shot.len * 0.6) || (m.shot === 3 && m.u < 0.9)) continue
          // the car's middle, as the camera sees it: within the picture's edges
          const pos = new Vector3(m.cam.pos.x, m.cam.pos.y, m.cam.pos.z)
          const fwd = new Vector3(m.cam.look.x, m.cam.look.y, m.cam.look.z).sub(pos).normalize()
          const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize()
          const up = new Vector3().crossVectors(right, fwd)
          const to = new Vector3(m.car.x, 0.75, m.car.z).sub(pos)
          const depth = to.dot(fwd)
          const tanV = Math.tan((m.cam.fov * Math.PI) / 360)
          const where = `${shot.name} at ${t.toFixed(2)} s, aspect ${aspect.toFixed(2)}`
          expect(depth, where).toBeGreaterThan(0)
          expect(Math.abs(to.dot(right) / depth), where).toBeLessThan(tanV * aspect)
          expect(Math.abs(to.dot(up) / depth), where).toBeLessThan(tanV)
        }
    })
  }

  it('the signpost stands ahead of the driver in the shot from the seat, and is passed before it ends', () => {
    const film = driveFilm(TRIPS[0])
    const cabin = film.shots[2]
    expect(carAt(cabin, 0).x + CAR_SHAPE.length / 2).toBeLessThan(film.sign - 15)
    expect(carAt(cabin, cabin.len).x).toBeGreaterThan(film.sign)
  })

  it('a shot at a time: the last one past the end; each moment the same however it is reached', () => {
    const film = driveFilm(TRIPS[1])
    expect(shotAt(film, 0)).toEqual({ index: 0, u: 0 })
    expect(shotAt(film, film.length + 3).index).toBe(3)
    expect(momentAt(film, 3.21, 2)).toEqual(momentAt(film, 3.21, 2))
  })
})

describe("the driver's seat", () => {
  const film = driveFilm(TRIPS[0])
  const cabin = film.shots[2]

  it('is inside the cabin, under its roof, over the dashboard, on the left; it looks down the road and a little down', () => {
    for (const u of [0, 0.7, 1.9]) {
      const car = carAt(cabin, u)
      const cam = camAt(cabin, u, car, 2)
      const inCar = new Vector3(cam.pos.x - car.x, cam.pos.y, cam.pos.z - car.z)
      // the car drives east (+x): its left is −z
      expect(inCar.x).toBeCloseTo(EYE.z, 1)
      expect(inCar.z).toBeCloseTo(-CAR_CABIN.driver, 1)
      expect(cam.pos.y).toBeGreaterThan(CAR_CABIN.screenFoot.y)
      expect(cam.pos.y).toBeLessThan(CAR_CABIN.roof - 0.1)
      const look = new Vector3(cam.look.x - cam.pos.x, cam.look.y - cam.pos.y, cam.look.z - cam.pos.z).normalize()
      expect(look.x).toBeGreaterThan(0.98)
      expect(look.y).toBeLessThan(0)
    }
  })

  it("points of the car's frame go where the rolling car's body is drawn (its springs, its heading)", () => {
    const parts = rollingCarParts()
    parts.record = []
    const car = { ...carAt(film.shots[0], 1.2), pitch: 0.03, lift: 0.01 }
    parts.begin()
    putRollingCar(parts, car.x, car.z, car.yaw, car.roll, { pitch: car.pitch, lift: car.lift })
    parts.end()
    const body = parts.record.find((r) => r.name === 'body')!.matrix as Matrix4
    for (const p of [{ x: 0.5, y: 1.2, z: 1.4 }, { x: -0.7, y: 0.3, z: -1.6 }, EYE]) {
      const drawn = new Vector3(p.x, p.y, p.z).applyMatrix4(body)
      const ours = carPoint(car, p)
      expect(ours.x).toBeCloseTo(drawn.x, 5)
      expect(ours.y).toBeCloseTo(drawn.y, 5)
      expect(ours.z).toBeCloseTo(drawn.z, 5)
    }
    parts.dispose()
  })
})

describe('the lens', () => {
  it('sideways as the shot asks; upright it opens so the picture is still wide enough across', () => {
    expect(fovFor(30, 844 / 390)).toBe(30)
    const up = fovFor(30, 390 / 844)
    expect(up).toBeGreaterThan(60)
    const across = 2 * Math.atan(Math.tan((up * Math.PI) / 360) * (390 / 844)) * (180 / Math.PI)
    expect(across).toBeCloseTo(34, 6)
  })
})

describe('with less motion', () => {
  it("one still from the driver's seat, the car at rest in the picture, a couple of seconds", () => {
    for (const trip of TRIPS) {
      const film = driveFilm(trip, true)
      expect(film.still).toBe(true)
      expect(film.shots).toHaveLength(1)
      expect(film.shots[0].cam.kind).toBe('cabin')
      expect(film.length).toBeGreaterThanOrEqual(2)
      expect(film.length).toBeLessThanOrEqual(3)
      const a = momentAt(film, 0, 0.5)
      const b = momentAt(film, film.length, 0.5)
      expect(b.cam).toEqual(a.cam)
      expect(b.car.roll).toBe(a.car.roll)
    }
  })
})
