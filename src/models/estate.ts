import { Parts, blob, lathe, merge, noise3, rgb, tube, type PartDef, type Shape, type V3 } from '../lib/sculpt'
import {
  AGENT_SEAT,
  BENCH,
  CABINET,
  ESTATE_DESK,
  ESTATE_DISPLAY,
  ESTATE_DOOR,
  ESTATE_HOURS,
  ESTATE_MAP,
  ESTATE_ROOM,
  ESTATE_SIGN,
  ESTATE_WINDOW,
  HOUSE_MODEL,
  HOUSE_TABLE,
  KERB,
  PARKING,
  PARKING_SIGN,
  PLANT,
  SALE_BOARD,
  SEAT_Y,
  BAYS,
} from '../data/estate'
import { HOUSE, ROOMS } from '../data/layout'
import { ROOM_IDS, floorOf, wallSegments, type HomeShell } from '../home/shell'
import { around, box, cuboid, type Paint } from './boxes'
import { grain, mix, structureParts, type Structure } from './structures'

// The estate office's fittings and the parking lot, sculpted from their rows (src/data/estate.ts), in world metres: put
// them at the origin. The office's shell is the walk-in's (./market.ts, shellModel: weatherboards, its row's `look`),
// with the parking sign standing with it (the one part that casts).
//
//   front     the shop front on the north wall, facing the lane: the sign's navy board (the logo and the words are
//             drawn by the scene at ESTATE_SIGN), the opening hours' plaque (ESTATE_HOURS), the window east of the door
//             with the house for sale in it (ESTATE_WINDOW) and the wide one west of it with the farm's map
//             (ESTATE_DISPLAY), a frame round the door and a canopy over it
//   inside    the agent's desk (a laptop, a stack of papers, a pot of pens), his chair, a filing cabinet, a plant, the
//             frame of the board with the house for sale (SALE_BOARD), the frame of the farm's map (ESTATE_MAP), the
//             table the house's model stands on, a bench by the front and a rug
//   house     the house at 1:25 on its base (houseModel: its walls, floors and openings from the save's shell), on the
//             table, made again when the shell changes
//   lot       the parking lot: asphalt, the bays' white lines, and a kerb along the fence and at its west end
//
// None of them casts (the shell shades the inside; the front faces north, away from the sun; the lot lies flat). They
// are boxes with flat faces (./boxes.ts), and a few round things (the plant, its pot, the pens).

const NAVY = rgb(0x22344f)
const NAVY_DARK = rgb(0x182538)
const GOLD = rgb(0xd8b25a)
const TRIM = rgb(0xf4f0e6)
const GLASS = rgb(0x22313f)
const STEEL = rgb(0x9aa3ab)
const STEEL_DARK = rgb(0x6f7880)
const BLACK = rgb(0x2a2c2f)
const PAPER = rgb(0xf3efe4)
const LEAF = rgb(0x4f7d3c)
const POT = rgb(0xc4704a)
const RUG = rgb(0x3c5f73)
const ASPHALT = rgb(0x45484c)
const LINE = rgb(0xeeeeea)
const CONCRETE = rgb(0xb9b6ae)
const SIGN_BLUE = rgb(0x1f5fa8)

/** The wall's outer face on the lane side, and the faces just proud of it. */
const FRONT = ESTATE_DOOR.z0

const wood = (n: V3, m: V3): Paint => ({ color: grain(1, 41)(m[0] + n[0] * 0.3, m[1], m[2] + n[2] * 0.3) })

// ───────────────────────────── the front ─────────────────────────────

function frontShape(): Shape {
  const sg = ESTATE_SIGN
  const hr = ESTATE_HOURS
  const wn = ESTATE_WINDOW
  const d = ESTATE_DOOR
  // the sign's board: navy, a gold line round its face; the plaque: a brass edge round a white face
  const sign = [
    cuboid(box(sg.x - sg.half[0] - 0.05, sg.x + sg.half[0] + 0.05, sg.y - sg.half[1] - 0.05, sg.y + sg.half[1] + 0.05, FRONT - 0.035, FRONT), { color: NAVY_DARK }),
    cuboid(box(sg.x - sg.half[0] - 0.015, sg.x + sg.half[0] + 0.015, sg.y - sg.half[1] - 0.015, sg.y + sg.half[1] + 0.015, FRONT - 0.045, FRONT - 0.035), { color: GOLD }),
  ]
  const plaque = cuboid(box(hr.x - hr.half[0] - 0.025, hr.x + hr.half[0] + 0.025, hr.y - hr.half[1] - 0.025, hr.y + hr.half[1] + 0.025, FRONT - 0.02, FRONT), { color: GOLD })
  // the window: a white frame round dark glass, a sill under it (the glass and what is in the window: the scene's)
  const f = 0.05
  const frame = [
    cuboid(box(wn.x - wn.half[0] - f, wn.x + wn.half[0] + f, wn.y - wn.half[1] - f - 0.03, wn.y - wn.half[1], FRONT - 0.06, FRONT), { color: TRIM }),
    cuboid(box(wn.x - wn.half[0] - f, wn.x + wn.half[0] + f, wn.y + wn.half[1], wn.y + wn.half[1] + f, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(wn.x - wn.half[0] - f, wn.x - wn.half[0], wn.y - wn.half[1], wn.y + wn.half[1], FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(wn.x + wn.half[0], wn.x + wn.half[0] + f, wn.y - wn.half[1], wn.y + wn.half[1], FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(wn.x - wn.half[0], wn.x + wn.half[0], wn.y - wn.half[1], wn.y + wn.half[1], FRONT - 0.008, FRONT), { color: GLASS }),
  ]
  // the wide window west of the door: the same frame and sill round it (its glass and the map in it: the scene's)
  const dp = ESTATE_DISPLAY
  const display = [
    cuboid(box(dp.x - dp.half[0] - f, dp.x + dp.half[0] + f, dp.y - dp.half[1] - f - 0.03, dp.y - dp.half[1], FRONT - 0.06, FRONT), { color: TRIM }),
    cuboid(box(dp.x - dp.half[0] - f, dp.x + dp.half[0] + f, dp.y + dp.half[1], dp.y + dp.half[1] + f, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(dp.x - dp.half[0] - f, dp.x - dp.half[0], dp.y - dp.half[1], dp.y + dp.half[1], FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(dp.x + dp.half[0], dp.x + dp.half[0] + f, dp.y - dp.half[1], dp.y + dp.half[1], FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(dp.x - dp.half[0], dp.x + dp.half[0], dp.y - dp.half[1], dp.y + dp.half[1], FRONT - 0.008, FRONT), { color: GLASS }),
  ]
  // the door's frame on the wall's face (the leaves slide behind it into the wall) and a canopy over the door
  const jamb = 0.06
  const doorFrame = [
    cuboid(box(d.x0 - jamb, d.x0, 0, 2.1 + jamb, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(d.x1, d.x1 + jamb, 0, 2.1 + jamb, FRONT - 0.03, FRONT), { color: TRIM }),
    cuboid(box(d.x0, d.x1, 2.1, 2.1 + jamb, FRONT - 0.03, FRONT), { color: TRIM }),
  ]
  const canopy = cuboid(box(d.x0 - 0.16, d.x1 + 0.16, 2.17, 2.21, FRONT - 0.3, FRONT), (n) => ({ color: n[1] > 0 ? STEEL_DARK : NAVY }))
  return merge(...sign, plaque, ...frame, ...display, ...doorFrame, canopy)
}

// ───────────────────────────── inside ─────────────────────────────

function insideShape(): Shape {
  const dk = ESTATE_DESK
  const top = dk.y1
  // the desk: its top, a pedestal of drawers on the west, a leg panel on the east, a panel down its front (you stand at)
  const desk = [
    cuboid(box(dk.x0, dk.x1, top - 0.035, top, dk.z0, dk.z1), wood),
    cuboid(box(dk.x0 + 0.03, dk.x0 + 0.42, 0, top - 0.035, dk.z0 + 0.04, dk.z1 - 0.03), wood),
    cuboid(box(dk.x1 - 0.06, dk.x1 - 0.03, 0, top - 0.035, dk.z0 + 0.04, dk.z1 - 0.03), wood),
    cuboid(box(dk.x0 + 0.03, dk.x1 - 0.03, 0.16, top - 0.035, dk.z0 + 0.02, dk.z0 + 0.045), (n, m) => ({ color: n[2] < 0 ? NAVY : grain(1, 41)(m[0], m[1], m[2]) })),
    // the drawers' fronts, facing the agent
    ...[0.16, 0.38, 0.58].map((y) => cuboid(around(dk.x0 + 0.225, y, dk.z1 - 0.025, 0.17, 0.085, 0.006), { color: mix(grain(1, 41)(0, y, 0), [0, 0, 0], 0.15) })),
  ]
  // on it: a laptop open towards the agent (low: it hides nothing of him from you), a stack of papers, a pot of pens,
  // a name plate facing you
  const mx = (dk.x0 + dk.x1) / 2 + 0.28
  const mz = dk.z0 + 0.26
  const lid = 0.2
  const things = [
    cuboid(box(mx - 0.17, mx + 0.17, top, top + 0.018, mz - 0.02, mz + 0.22), (n) => ({ color: n[1] > 0 ? STEEL_DARK : STEEL })),
    // its lid, leaning back from its hinge (the screen's side facing him)
    cuboid(box(-0.17, 0.17, 0, lid, -0.008, 0.004), (n) => ({ color: n[2] > 0 ? rgb(0x1a2733) : STEEL })).place([mx, top + 0.012, mz - 0.01], [-0.28, 0, 0]),
    cuboid(box(dk.x0 + 0.12, dk.x0 + 0.42, top, top + 0.03, dk.z0 + 0.12, dk.z0 + 0.34), { color: PAPER }),
    cuboid(box(dk.x0 + 0.16, dk.x0 + 0.44, top + 0.03, top + 0.04, dk.z0 + 0.14, dk.z0 + 0.36), { color: rgb(0xe6e0d0) }),
    cuboid(box((dk.x0 + dk.x1) / 2 - 0.16, (dk.x0 + dk.x1) / 2 + 0.16, top, top + 0.07, dk.z0 + 0.03, dk.z0 + 0.06), (n) => ({ color: n[2] < 0 ? GOLD : NAVY })),
  ]
  const pens = lathe(
    [
      [0, top],
      [0.035, top],
      [0.035, top + 0.1],
      [0.03, top + 0.1],
      [0.0, top + 0.02],
    ],
    { seg: 10, steps: 1 },
  )
    .place([dk.x1 - 0.12, 0, dk.z0 + 0.12])
    .fill(NAVY, 0)
  const penSticks = [-0.012, 0.012].map((dx, k) =>
    tube(
      [
        [dk.x1 - 0.12 + dx, top + 0.03, dk.z0 + 0.12],
        [dk.x1 - 0.12 + dx * 2.5, top + 0.15, dk.z0 + 0.12 + (k ? 0.01 : -0.01)],
      ] as V3[],
      0.005,
      { seg: 5, steps: 1, caps: [true, true] },
    ).fill(k ? GOLD : BLACK, 0),
  )
  // his chair behind the desk: a seat, a back, four legs
  const cx = AGENT_SEAT.x
  const cz = AGENT_SEAT.z
  const chair = [
    cuboid(around(cx, SEAT_Y - 0.025, cz, 0.22, 0.025, 0.21), { color: NAVY }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cuboid(around(cx + sx * 0.18, (SEAT_Y - 0.05) / 2, cz + sz * 0.17, 0.018, (SEAT_Y - 0.05) / 2, 0.018), { color: STEEL_DARK }))),
    ...[-1, 1].map((sx) => cuboid(box(cx + sx * 0.18 - 0.018, cx + sx * 0.18 + 0.018, SEAT_Y, SEAT_Y + 0.5, cz + 0.17, cz + 0.205), { color: STEEL_DARK })),
    cuboid(box(cx - 0.21, cx + 0.21, SEAT_Y + 0.22, SEAT_Y + 0.52, cz + 0.19, cz + 0.23), { color: NAVY }),
  ]
  // the filing cabinet: three drawers with handles
  const c = CABINET
  const cabinet = [
    cuboid(box(c.x0, c.x1, 0, c.y1, c.z0, c.z1), { color: STEEL }),
    ...[0.2, 0.5, 0.8].flatMap((y) => [
      cuboid(box(c.x1, c.x1 + 0.004, y - 0.13, y + 0.13, c.z0 + 0.03, c.z1 - 0.03), { color: rgb(0xb1b9c0) }),
      cuboid(around(c.x1 + 0.012, y + 0.06, (c.z0 + c.z1) / 2, 0.01, 0.012, 0.07), { color: STEEL_DARK }),
    ]),
  ]
  // the plant in its pot by the door
  const pot = lathe(
    [
      [0, 0],
      [0.13, 0],
      [0.16, 0.34],
      [0.14, 0.34],
      [0.0, 0.3],
    ],
    { seg: 14, steps: 1 },
  )
    .place([PLANT.x, 0, PLANT.z])
    .fill(POT, 0)
  const lumpy = (seed: number) => (x: number, y: number, z: number) => 0.06 * noise3(x * 9, y * 9, z * 9, seed)
  const leaves = merge(blob(0.24, 2, lumpy(21)).place([PLANT.x, 0.55, PLANT.z], [0, 0, 0], [1, 1.15, 1]), blob(0.16, 2, lumpy(22)).place([PLANT.x - 0.05, 0.84, PLANT.z + 0.04])).paint(
    (x, y, z) => mix(LEAF, rgb(0x6f9a4a), Math.max(0, Math.min(1, (y - 0.4) / 0.6)) * 0.6 + 0.2 * Math.sin(x * 40 + z * 30)),
    0,
  )
  const stem = tube(
    [
      [PLANT.x, 0.28, PLANT.z],
      [PLANT.x, 0.5, PLANT.z],
    ],
    0.02,
    { seg: 6, steps: 1, caps: [true, true] },
  ).fill(rgb(0x5a4430), 0)
  // the frame of the board with the house for sale (the picture is the scene's), on the east wall, facing west
  const b = SALE_BOARD
  const w = 0.035
  const ex = ESTATE_ROOM.x1
  const boardFrame = [
    cuboid(box(ex - 0.035, ex, b.y - b.half[1] - w, b.y - b.half[1], b.z - b.half[0] - w, b.z + b.half[0] + w), { color: NAVY }),
    cuboid(box(ex - 0.035, ex, b.y + b.half[1], b.y + b.half[1] + w, b.z - b.half[0] - w, b.z + b.half[0] + w), { color: NAVY }),
    cuboid(box(ex - 0.035, ex, b.y - b.half[1], b.y + b.half[1], b.z - b.half[0] - w, b.z - b.half[0]), { color: NAVY }),
    cuboid(box(ex - 0.035, ex, b.y - b.half[1], b.y + b.half[1], b.z + b.half[0], b.z + b.half[0] + w), { color: NAVY }),
    cuboid(box(ex - 0.015, ex, b.y - b.half[1], b.y + b.half[1], b.z - b.half[0], b.z + b.half[0]), { color: PAPER }),
  ]
  // the frame of the farm's map on the west wall (the map is the scene's), oak round a cream backing
  const mp = ESTATE_MAP
  const wx = ESTATE_ROOM.x0
  const mf = 0.045
  const oak = (n: V3, m: V3): Paint => ({ color: grain(1, 23)(m[0], m[1] + n[1] * 0.2, m[2]) })
  const mapFrame = [
    cuboid(box(wx, wx + 0.04, mp.y - mp.half[1] - mf, mp.y - mp.half[1], mp.z - mp.half[0] - mf, mp.z + mp.half[0] + mf), oak),
    cuboid(box(wx, wx + 0.04, mp.y + mp.half[1], mp.y + mp.half[1] + mf, mp.z - mp.half[0] - mf, mp.z + mp.half[0] + mf), oak),
    cuboid(box(wx, wx + 0.04, mp.y - mp.half[1], mp.y + mp.half[1], mp.z - mp.half[0] - mf, mp.z - mp.half[0]), oak),
    cuboid(box(wx, wx + 0.04, mp.y - mp.half[1], mp.y + mp.half[1], mp.z + mp.half[0], mp.z + mp.half[0] + mf), oak),
    cuboid(box(wx, wx + 0.015, mp.y - mp.half[1], mp.y + mp.half[1], mp.z - mp.half[0], mp.z + mp.half[0]), { color: PAPER }),
  ]
  // the house's table: a top, an apron under it and four legs
  const t = HOUSE_TABLE
  const legs = 0.05
  const table = [
    cuboid(box(t.x0, t.x1, t.y1 - 0.035, t.y1, t.z0, t.z1), oak),
    cuboid(box(t.x0 + 0.06, t.x1 - 0.06, t.y1 - 0.12, t.y1 - 0.035, t.z0 + 0.06, t.z1 - 0.06), oak),
    ...[t.x0 + 0.04, t.x1 - 0.04 - legs].flatMap((x) => [t.z0 + 0.04, t.z1 - 0.04 - legs].map((z) => cuboid(box(x, x + legs, 0, t.y1 - 0.035, z, z + legs), oak))),
  ]
  // the bench by the front: a slatted seat, a back against the wall, a frame of steel at either end
  const bn = BENCH
  const bench = [
    cuboid(box(bn.x0, bn.x1, bn.y1 - 0.04, bn.y1, bn.z0 + 0.06, bn.z1), oak),
    cuboid(box(bn.x0, bn.x1, bn.y1 + 0.08, bn.y1 + 0.42, bn.z0 + 0.01, bn.z0 + 0.05), oak),
    ...[bn.x0 + 0.05, bn.x1 - 0.09].flatMap((x) => [
      cuboid(box(x, x + 0.04, 0, bn.y1 - 0.04, bn.z0 + 0.08, bn.z1 - 0.04), { color: STEEL_DARK }),
      cuboid(box(x, x + 0.04, 0, bn.y1 + 0.42, bn.z0, bn.z0 + 0.01), { color: STEEL_DARK }),
      cuboid(box(x, x + 0.04, bn.y1 - 0.08, bn.y1 + 0.42, bn.z0 + 0.01, bn.z0 + 0.06), { color: STEEL_DARK }),
    ]),
  ]
  // a rug from the door to the desk, where you stand
  const rug = cuboid(box(dk.x0 - 0.05, dk.x1 + 0.05, 0.0, 0.008, ESTATE_ROOM.z0 + 0.25, dk.z0 - 0.05), { color: RUG })
  return merge(...desk, ...things, pens, ...penSticks, ...chair, ...cabinet, pot, leaves, stem, ...boardFrame, ...mapFrame, ...table, ...bench, rug)
}

// ───────────────────────────── the house's model ─────────────────────────────

/** The model's base: a board of lawn under the house, a little round it (in the model's metres). */
const MODEL_BASE = 0.02
const LAWN = rgb(0x7fa65a)
const LAWN_EDGE = rgb(0x5d7d44)
/** A wall's top, cut: the model's plaster. */
const CUT = rgb(0xefe9df)

const hexColor = (hex: string) => rgb(parseInt(hex.replace('#', ''), 16))

/**
 * The house at 1:25 as the save's shell has it (src/home/shell.ts): every piece of its walls (cut by its openings where
 * they are now — windows and doorways open, a closed one walled up), each face in its room's paint or as built, each
 * room's floor in its own colour, on a board of lawn. No roof: it is a model to look into. In its own frame: the house's
 * middle at the origin, the base on the ground (y 0), its north to −z as the house's (the scene turns it).
 */
export function houseModelShape(shell: HomeShell): Shape {
  const k = HOUSE_MODEL.scale
  const y0 = MODEL_BASE
  const half = HOUSE.wallThickness / 2
  const bx = (HOUSE.maxX + half) * k + 0.035
  const bz = (HOUSE.maxZ + half) * k + 0.035
  const base = cuboid(box(-bx, bx, 0, y0, -bz, bz), (n) => ({ color: n[1] > 0 ? LAWN : LAWN_EDGE }))
  const floors = ROOM_IDS.map((room) => {
    const r = ROOMS[room].bounds
    return cuboid(box(r.minX * k, r.maxX * k, y0, y0 + 0.003, r.minZ * k, r.maxZ * k), { color: hexColor(floorOf(shell, room).tint) })
  })
  // each piece of wall a box: its long faces in their rooms' colours (or the outside's), its top and its ends cut plaster
  const walls = wallSegments(shell)
    .filter((sg) => sg.kind === 'wall')
    .map((sg) => {
      const [cx, cy, cz] = sg.center
      const [sx, sy, sz] = sg.size
      const faces = sg.faces ?? [sg.color, sg.color]
      const lower = hexColor(faces[0])
      const higher = hexColor(faces[1])
      const across = sg.axis === 'x' ? 2 : 0
      return cuboid(box((cx - sx / 2) * k, (cx + sx / 2) * k, y0 + (cy - sy / 2) * k, y0 + (cy + sy / 2) * k, (cz - sz / 2) * k, (cz + sz / 2) * k), (n) => ({
        color: n[across] < 0 ? lower : n[across] > 0 ? higher : CUT,
      }))
    })
  return merge(base, ...floors, ...walls)
}

/** The house's model as a structure: one part, casting nothing (it stands indoors, under the office's roof). */
export function houseModel(shell: HomeShell): Structure<'house'> {
  return { house: { shape: houseModelShape(shell), material: { roughness: 0.75 }, castShadow: false } }
}

/** The house's model drawn, on its table in the office: one draw. */
export function houseModelParts(shell: HomeShell): Parts<'house'> {
  const parts = structureParts(houseModel(shell), 'estate-house')
  putHouseModel(parts)
  return parts
}

/** Puts the model on its table, its garden side to the door. */
export function putHouseModel(parts: Parts<'house'>) {
  parts.begin()
  parts.at(HOUSE_MODEL.x, HOUSE_MODEL.y, HOUSE_MODEL.z, HOUSE_MODEL.heading)
  parts.put('house', 0, 0, 0)
  parts.end()
}

// ───────────────────────────── the parking lot ─────────────────────────────

/** The lot: asphalt (1.5 cm proud of the lane), each bay's white lines, the kerb along the fence and at the west end. */
function lotShape(): Shape {
  const p = PARKING
  const asphalt = cuboid(box(p.x0, p.x1, 0, 0.015, p.z0, p.z1), { color: ASPHALT })
  const lw = 0.1
  const ly0 = 0.01
  const ly1 = 0.019
  const lines: Shape[] = []
  // the line along the lot's lane side, and a line across at each end of each bay
  lines.push(cuboid(box(BAYS[0].x0, BAYS[BAYS.length - 1].x1 - 0.02, ly0, ly1, BAYS[0].z1 - lw, BAYS[0].z1), { color: LINE }))
  for (const x of new Set(BAYS.flatMap((b) => [b.x0, b.x1]))) {
    const x0 = Math.max(p.x0 + KERB.w, Math.min(x - lw / 2, p.x1 - 0.02 - lw))
    lines.push(cuboid(box(x0, x0 + lw, ly0, ly1, BAYS[0].z0 + 0.05, BAYS[0].z1 - lw), { color: LINE }))
  }
  const kerb = [
    cuboid(box(p.x0, p.x1, 0, KERB.h, p.z0, p.z0 + KERB.w), (n) => ({ color: n[1] > 0 ? CONCRETE : mix(CONCRETE, [0, 0, 0], 0.12) })),
    cuboid(box(p.x0, p.x0 + KERB.w, 0, KERB.h, p.z0 + KERB.w, p.z1), (n) => ({ color: n[1] > 0 ? CONCRETE : mix(CONCRETE, [0, 0, 0], 0.12) })),
  ]
  return merge(asphalt, ...lines, ...kerb)
}

/** The parking sign at the lot's west end: a post, and a plate on it facing east (its face is the scene's: a white P on
 *  blue). Stands with the office's shell, so it casts with it. */
export function parkingSignShape(): Shape {
  const s = PARKING_SIGN
  const post = tube(
    [
      [s.x, 0, s.z],
      [s.x, s.y + s.half[1] + 0.06, s.z],
    ] as V3[],
    0.03,
    { seg: 8, steps: 1, caps: [true, true] },
  ).fill(STEEL, 0)
  const plate = cuboid(box(s.x + 0.025, s.x + 0.05, s.y - s.half[1] - 0.02, s.y + s.half[1] + 0.02, s.z - s.half[0] - 0.02, s.z + s.half[0] + 0.02), (n) => ({ color: n[0] > 0 ? SIGN_BLUE : STEEL }))
  return merge(post, plate)
}

// ───────────────────────────── drawn ─────────────────────────────

export type EstatePart = 'front' | 'inside'

let made: Record<EstatePart | 'lot', Shape> | null = null

/** Every shape (built once). */
export function estateShapes(): Record<EstatePart | 'lot', Shape> {
  made ??= { front: frontShape(), inside: insideShape(), lot: lotShape() }
  return made
}

/** The office's fittings: the front and the inside, each its own model (from the lane with the door shut the inside is
 *  left out; from inside, the front behind the wall), one draw each, none casting. */
export function estateFittingsParts(): Parts<EstatePart> {
  const shapes = estateShapes()
  const defs = {} as Record<EstatePart, PartDef>
  for (const k of ['front', 'inside'] as const) defs[k] = { geometry: shapes[k].geometry(), max: 1, material: { roughness: 0.7 }, castShadow: false, receiveShadow: true }
  const parts = new Parts<EstatePart>(defs, 'estate-fittings')
  putEstateFittings(parts)
  return parts
}

/** Puts the fittings, each its own model (they are in world metres). */
export function putEstateFittings(parts: Parts<EstatePart>) {
  parts.begin()
  for (const k of ['front', 'inside'] as const) {
    parts.at(0, 0, 0)
    parts.put(k, 0, 0, 0)
  }
  parts.end()
}

/** The parking lot as a structure: one draw, receiving the car's and the office's shadows, casting none. A fine grain
 *  over the asphalt. */
export function parkingLotModel(): Structure<'lot'> {
  return { lot: { shape: estateShapes().lot, material: { roughness: 0.95, detail: { scale: 60, bump: 0.0012, shade: 0.06 } }, castShadow: false } }
}

export const parkingLotParts = () => structureParts(parkingLotModel(), 'parking-lot')

/** Where the office is, for framing it (the gallery). */
export const ESTATE_MIDDLE = { x: (ESTATE_ROOM.x0 + ESTATE_ROOM.x1) / 2, z: (ESTATE_ROOM.z0 + ESTATE_ROOM.z1) / 2 }

/** The sitting agent's place, for the gallery and the checks. */
export const AGENT_AT = { x: AGENT_SEAT.x, z: AGENT_SEAT.z, heading: AGENT_SEAT.heading }
