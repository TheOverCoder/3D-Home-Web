import { describe, expect, it } from 'vitest'
import type { Box, Rect } from './buildings'
import {
  AGENT_SEAT,
  AGENT_STAND,
  BENCH,
  CABINET,
  ESTATE_DESK,
  ESTATE_DISPLAY,
  ESTATE_DOOR,
  ESTATE_HOURS,
  ESTATE_MAP,
  ESTATE_PATH,
  ESTATE_ROOM,
  ESTATE_SIGN,
  ESTATE_WALKIN,
  ESTATE_WINDOW,
  HOUSE_MODEL,
  HOUSE_TABLE,
  MAP_AREA,
  PLANT,
  SALE_BOARD,
  onMap,
} from './estate'
import { HOUSE } from './layout'
import { HOME_LAND, PARCELS, PARCEL_IDS } from '../farm/layout'
import { agentComes, agentLeaves, type Step } from '../farm/script'
import { LANE_ENDS, WALK_Z } from '../farm/data'

// The estate office's room (./estate.ts): what stands in it stands in it, clear of the rest and of the way the agent
// walks; the house's model fits its table; the farm's map shows all the land there is, north up, each meadow where its
// price tag can be told from the next; the front's pictures side by side on its wall.

const EPS = 1e-9
const R = ESTATE_ROOM
const within = (b: Rect, r: Rect, m = 0) => b.x0 >= r.x0 + m - EPS && b.x1 <= r.x1 - m + EPS && b.z0 >= r.z0 + m - EPS && b.z1 <= r.z1 - m + EPS
const overlaps = (a: Rect, b: Rect, grow = 0) => a.x0 < b.x1 + grow - EPS && a.x1 > b.x0 - grow + EPS && a.z0 < b.z1 + grow - EPS && a.z1 > b.z0 - grow + EPS
const around = (x: number, z: number, r: number): Rect => ({ x0: x - r, x1: x + r, z0: z - r, z1: z + r })
/** How far a point is from a footprint, on the ground. */
const gap = (b: Rect, x: number, z: number) => Math.hypot(Math.max(0, b.x0 - x, x - b.x1), Math.max(0, b.z0 - z, z - b.z1))
/** A body's half width: a person keeps this clear of everything. */
const BODY = 0.2

/** What stands on the floor: its footprint. */
const STANDING: Record<string, Rect> = {
  desk: ESTATE_DESK,
  chair: around(AGENT_SEAT.x, AGENT_SEAT.z, 0.24),
  cabinet: CABINET,
  plant: around(PLANT.x, PLANT.z, 0.2),
  bench: BENCH,
  table: HOUSE_TABLE,
}

/** Every point a script's walker passes, 5 cm apart. */
function trail(x: number, z: number, steps: Step[]) {
  const out: { x: number; z: number }[] = []
  let at = { x, z }
  for (const s of steps) {
    if (!('to' in s)) continue
    const n = Math.max(1, Math.ceil(Math.hypot(s.to.x - at.x, s.to.z - at.z) / 0.05))
    for (let k = 0; k <= n; k++) out.push({ x: at.x + ((s.to.x - at.x) * k) / n, z: at.z + ((s.to.z - at.z) * k) / n })
    at = s.to
  }
  return out
}

describe('the estate office’s room', () => {
  it('holds what stands in it, none on another, clear of the way in at its door', () => {
    const names = Object.keys(STANDING)
    for (const n of names) expect(within(STANDING[n], R), `${n} in the room`).toBe(true)
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) if (!(names[i] === 'desk' && names[j] === 'chair')) expect(overlaps(STANDING[names[i]], STANDING[names[j]]), `${names[i]} and ${names[j]}`).toBe(false)
    // a metre inside the door is open floor
    const way: Rect = { x0: ESTATE_DOOR.x0, x1: ESTATE_DOOR.x1, z0: R.z0, z1: R.z0 + 1 }
    for (const n of names) expect(overlaps(STANDING[n], way), `${n} before the door`).toBe(false)
  })

  it('you stand before his desk to talk to him, and the board with the house for sale hangs on a wall near by', () => {
    for (const n of Object.keys(STANDING)) expect(overlaps(STANDING[n], around(AGENT_STAND.x, AGENT_STAND.z, BODY)), n).toBe(false)
    expect(within(around(AGENT_STAND.x, AGENT_STAND.z, BODY), R)).toBe(true)
    expect(AGENT_STAND.z).toBeLessThan(ESTATE_DESK.z0)
    expect(AGENT_SEAT.z).toBeGreaterThan(ESTATE_DESK.z1)
    // the board on the east wall's inside, facing west into the room, within a step and a half of where you talk to him
    expect(SALE_BOARD.x).toBeCloseTo(R.x1 - 0.025, 9)
    expect(SALE_BOARD.heading).toBeCloseTo(-Math.PI / 2, 9)
    expect(Math.hypot(SALE_BOARD.x - 0.3 - AGENT_STAND.x, SALE_BOARD.z - AGENT_STAND.z)).toBeLessThan(1.4)
    expect(SALE_BOARD.z - SALE_BOARD.half[0]).toBeGreaterThan(PLANT.z + 0.2)
  })

  it('the agent walks in from the lane round his desk to his chair, and out again, a body clear of all of it', () => {
    for (const [x, z, steps] of [
      [LANE_ENDS[0], WALK_Z, agentComes()],
      [AGENT_SEAT.x, AGENT_SEAT.z, agentLeaves()],
    ] as const) {
      // (behind his desk he steps along it into his chair, his forearms' reach from its edge, and out of it again)
      const points = trail(x, z, steps).filter((p) => p.z < ESTATE_DESK.z1)
      for (const p of points) for (const [n, b] of Object.entries(STANDING)) if (n !== 'chair') expect(gap(b, p.x, p.z), `${n} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBeGreaterThanOrEqual(BODY)
      // inside, he keeps a body from the walls
      for (const p of points) if (p.z > R.z0 + BODY) expect(within(around(p.x, p.z, BODY), R), `${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBe(true)
    }
    expect(ESTATE_PATH[2].z).toBeGreaterThan(R.z0)
  })

  it("the house's model fits on its table, with room round it", () => {
    const k = HOUSE_MODEL.scale
    // turned half round: its x along the table's x
    const hx = (HOUSE.maxX + HOUSE.wallThickness) * k + 0.035
    const hz = (HOUSE.maxZ + HOUSE.wallThickness) * k + 0.035
    const t: Box = HOUSE_TABLE
    expect(HOUSE_MODEL.y).toBe(t.y1)
    expect(within(around(HOUSE_MODEL.x, HOUSE_MODEL.z, 0), t)).toBe(true)
    expect(HOUSE_MODEL.x - hx).toBeGreaterThan(t.x0 + 0.1)
    expect(HOUSE_MODEL.x + hx).toBeLessThan(t.x1 - 0.1)
    expect(HOUSE_MODEL.z - hz).toBeGreaterThan(t.z0 + 0.1)
    expect(HOUSE_MODEL.z + hz).toBeLessThan(t.z1 - 0.1)
  })
})

describe('the farm’s map on the west wall', () => {
  it('shows all the land there is and the lot, north up and east to the right, on its frame', () => {
    const all = [HOME_LAND, ...PARCEL_IDS.map((id) => PARCELS[id].rect)]
    for (const r of all) {
      expect(r.minX).toBeGreaterThanOrEqual(MAP_AREA.x0)
      expect(r.maxX).toBeLessThanOrEqual(MAP_AREA.x1)
      expect(r.minZ).toBeGreaterThanOrEqual(MAP_AREA.z0)
      expect(r.maxZ).toBeLessThanOrEqual(MAP_AREA.z1)
    }
    expect(MAP_AREA.z1).toBeGreaterThan(R.z1)
    // its corners at the frame's: to someone facing it (west), the farm's north is up and its east to the right (the
    // room's north, −z), so its north-west corner is top left
    const nw = onMap(MAP_AREA.x0, MAP_AREA.z0)
    const se = onMap(MAP_AREA.x1, MAP_AREA.z1)
    expect(nw.y).toBeCloseTo(ESTATE_MAP.y + ESTATE_MAP.half[1], 9)
    expect(se.y).toBeCloseTo(ESTATE_MAP.y - ESTATE_MAP.half[1], 9)
    expect(nw.z).toBeCloseTo(ESTATE_MAP.z + ESTATE_MAP.half[0], 9)
    expect(se.z).toBeCloseTo(ESTATE_MAP.z - ESTATE_MAP.half[0], 9)
    // one scale both ways: the frame is the area's shape
    expect(ESTATE_MAP.half[0] / ESTATE_MAP.half[1]).toBeCloseTo((MAP_AREA.x1 - MAP_AREA.x0) / (MAP_AREA.z1 - MAP_AREA.z0), 9)
    expect(nw.x).toBe(ESTATE_MAP.x)
    expect(ESTATE_MAP.x).toBeCloseTo(R.x0 + 0.025, 9)
  })

  it('each meadow on it far enough from the next to look at its price tag alone, and within reach of open floor', () => {
    const spots = PARCEL_IDS.map((id) => {
      const r = PARCELS[id].rect
      return { id, ...onMap((r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2) }
    })
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i].y - spots[j].y, spots[i].z - spots[j].z), `${spots[i].id} and ${spots[j].id}`).toBeGreaterThan(0.4)
    // where you stand to read one (a metre in front of it) is floor, clear of the table
    for (const s of spots) {
      expect(within(around(s.x + 1, s.z, BODY), R), s.id).toBe(true)
      expect(overlaps(HOUSE_TABLE, around(s.x + 1, s.z, BODY)), s.id).toBe(false)
    }
  })
})

describe('the front', () => {
  it('its pictures side by side on the wall’s face, none on the door, all under the parapet', () => {
    const top = Math.max(...ESTATE_WALKIN.walls.map((b) => b.y1))
    const faces = { sign: ESTATE_SIGN, hours: ESTATE_HOURS, window: ESTATE_WINDOW, display: ESTATE_DISPLAY }
    const rect = (p: { x: number; y: number; half: readonly [number, number] }) => ({ x0: p.x - p.half[0], x1: p.x + p.half[0], z0: p.y - p.half[1], z1: p.y + p.half[1] })
    const names = Object.keys(faces) as (keyof typeof faces)[]
    for (const n of names) {
      const r = rect(faces[n])
      expect(r.x0, n).toBeGreaterThan(R.x0 - 0.15)
      expect(r.x1, n).toBeLessThan(R.x1 + 0.15)
      expect(r.z1, n).toBeLessThan(top - 0.05)
      if (n !== 'sign') expect(r.x1 < ESTATE_DOOR.x0 - 0.06 || r.x0 > ESTATE_DOOR.x1 + 0.06, `${n} clear of the door`).toBe(true)
    }
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) expect(overlaps(rect(faces[names[i]]), rect(faces[names[j]]), 0.05), `${names[i]} and ${names[j]}`).toBe(false)
  })
})
