import { Shape, fbm3, lathe, loft, merge, rgb, smoothstep, squircle, tube, type SculptSurface, type V3 } from '../lib/sculpt'
import { grain, mix, slab, type Structure } from './structures'

// The silo and the barn, sculpted like the coop and the oven (src/models/structures.ts): built once in their own
// frame (the ground under their middle at the origin, the way in facing +x), a part per material.
//
//   silo     a round silo of corrugated steel on a concrete ring, a cone roof with a vent, a ladder up its side and a
//            timber door at its foot (what grows is kept in it; it is made bigger with iron, bolts and logs)
//   barn     a red barn of upright boards under a gambrel roof of shingles, white trim, a pair of braced doors and a
//            hayloft door in its gable, a cupola on the ridge (it is made bigger with bricks, planks and nails)

const STEEL = rgb(0xb7c0c6)
const STEEL_DARK = rgb(0x7f8a92)
const CONCRETE = rgb(0xb3ada3)
const BARN_RED = rgb(0xb5523a)
const TRIM = rgb(0xece5d6)
const SHINGLE = rgb(0x46494c)
const WOOD_DARK = rgb(0x5e4630)
const BLACK = rgb(0x2a2c2f)

/** A straight piece of wood or steel from a to b: rx across (sideways), ry along `up`, its ends closed flat. */
function beam(a: V3, b: V3, rx: number, ry: number, up: V3 = [0, 1, 0], soft = 8): Shape {
  return loft(
    [
      { c: a, rx, ry },
      { c: b, rx, ry },
    ],
    { seg: 8, steps: 1, up, shape: (t) => squircle(t, soft), caps: [true, true] },
  )
}

/** A box with soft edges round (x, y, z): half-sizes. */
const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, soft = 8, seg = 16) => slab(hx, hz, y - hy, y + hy, soft, seg).place([x, 0, z])

/** A flat polygon (in the plane x = `at`), seen from both sides: a gable's fill. Points as [z, y]. */
function gable(at: number, points: [number, number][], color: V3): Shape {
  const s = new Shape()
  const cz = points.reduce((n, p) => n + p[0], 0) / points.length
  const cy = points.reduce((n, p) => n + p[1], 0) / points.length
  const c = s.vertex(at, cy, cz, color, 0)
  const vs = points.map(([z, y]) => s.vertex(at, y, z, color, 0))
  for (let k = 0; k < vs.length; k++) {
    const a = vs[k]
    const b = vs[(k + 1) % vs.length]
    s.tri(c, a, b)
    s.tri(c, b, a)
  }
  return s
}

/** A roof slope from `low` to `high` (points in the y–z plane at x = 0), `half` long each way along x, `thick` thick,
 *  a little past both ends so slopes overlap where they meet. */
function slope(low: [number, number], high: [number, number], half: number, thick: number): Shape {
  const dz = high[0] - low[0]
  const dy = high[1] - low[1]
  const len = Math.hypot(dz, dy)
  const ez = (dz / len) * 0.03
  const ey = (dy / len) * 0.03
  // the slab's "up" is square to the slope, pointing out of the roof
  const up: V3 = [0, Math.abs(dz) / len, (-Math.sign(dz) * Math.abs(dy)) / len]
  return beam([0, low[1] - ey, low[0] - ez], [0, high[1] + ey, high[0] + ez], half, thick, up, 10)
}

// ───────────────────────────── the silo ─────────────────────────────

export type SiloPart = 'base' | 'shell' | 'roof' | 'steel' | 'door'

/** The silo: 2.4 m across, 5.5 m to the top of its vent. */
export function siloModel(): Structure<SiloPart> {
  const R = 1.05
  const top = 4.55
  // the concrete ring it stands on
  const base = lathe(
    [
      [0, 0],
      [1.2, 0],
      [1.2, 0.2],
      [1.13, 0.26],
      [0, 0.26],
    ],
    { seg: 40, steps: 1 },
  ).paint((x, y, z) => mix(CONCRETE, rgb(0x8f897f), 0.5 * smoothstep(0.4, 0.8, fbm3(x * 4, y * 4, z * 4, 3))), 0)
  // the shell: sheets of corrugated steel (the material's boards, lying: a rib every 10 cm), weathered lower down
  const shell = lathe(
    [
      [0, 0.2],
      [R, 0.2],
      [R, top + 0.04],
      [0, top + 0.04],
    ],
    { seg: 40, steps: 1 },
  ).paint((x, y, z) => mix(STEEL, rgb(0x9a8f80), 0.35 * smoothstep(1.2, 0.2, y) * fbm3(x * 3, y * 3, z * 3, 7)), 0)
  // the cone roof, ribbed from the eaves to the vent, and the vent's cap
  const roof = merge(
    lathe(
      [
        [0, top - 0.02],
        [R + 0.12, top - 0.02],
        [R + 0.12, top + 0.04],
        [0.22, top + 0.74],
        [0.0, top + 0.76],
      ],
      { seg: 48, steps: 1 },
    ).pattern((x, _y, z) => 0.5 + 0.55 * Math.sin(Math.atan2(z, x) * 24), rgb(0x9ea7ad)),
    lathe(
      [
        [0.0, top + 0.7],
        [0.12, top + 0.7],
        [0.12, top + 0.86],
        [0.24, top + 0.88],
        [0.14, top + 0.98],
        [0.0, top + 1.0],
      ],
      { seg: 16, steps: 1 },
    ),
  ).paint((_x, y) => mix(STEEL, rgb(0xd6dde1), smoothstep(top, top + 0.8, y) * 0.4), 0)
  // steel hoops round the shell, a ladder up its south side (two rails, a rung every 30 cm), a frame round the door
  const hoop = (y: number) =>
    lathe(
      [
        [R - 0.02, y - 0.03],
        [R + 0.025, y - 0.03],
        [R + 0.025, y + 0.03],
        [R - 0.02, y + 0.03],
      ],
      { seg: 40, steps: 1, caps: [true, true] },
    )
  const ladder: Shape[] = []
  const lz = R + 0.16
  for (const x of [-0.19, 0.19]) ladder.push(beam([x, 0.24, lz], [x, top + 0.18, lz], 0.022, 0.022, [0, 0, 1]))
  for (let y = 0.5; y < top; y += 0.3) ladder.push(beam([-0.2, y, lz], [0.2, y, lz], 0.014, 0.014, [0, 1, 0], 2))
  // brackets from the rails back into the shell
  for (const y of [1.2, 2.6, 4.0]) for (const x of [-0.19, 0.19]) ladder.push(beam([x, y, R - 0.06], [x, y, lz], 0.016, 0.016, [0, 1, 0]))
  const steel = merge(...[0.9, 2.0, 3.1, 4.2].map(hoop), ...ladder, box(R + 0.01, 0.95, 0, 0.05, 0.78, 0.47, 10))
    .paint(() => STEEL_DARK, 0)
    .surface(0)
  // the door: upright boards of timber, two strap hinges
  const door = merge(
    box(R + 0.03, 0.95, 0, 0.05, 0.68, 0.38, 10).paint(grain(1, 41), 0),
    ...[0.55, 1.35].map((y) =>
      box(R + 0.075, y, -0.1, 0.012, 0.03, 0.26, 8)
        .paint(() => BLACK, 0)
        .surface(0),
    ),
  )
  const corrugated: SculptSurface = { kind: 'boards', size: 0.4, tone: 0.25, bump: 0.8 }
  return {
    base: { shape: base, material: { roughness: 0.95 } },
    shell: { shape: shell, material: { roughness: 0.45, metalness: 0.35, surface: corrugated } },
    roof: { shape: roof, material: { roughness: 0.4, metalness: 0.4 } },
    steel: { shape: steel, material: { roughness: 0.5, metalness: 0.45 } },
    door: { shape: door, material: { roughness: 0.85, surface: { kind: 'boards', size: 0.5, turn: true, tone: 0.4 } } },
  }
}

// ───────────────────────────── the barn ─────────────────────────────

export type BarnPart = 'base' | 'walls' | 'roof' | 'trim' | 'doors'

/** The barn: 3.7 m long (along x, its doors at +x), 3.1 m wide, its ridge at 3.7 m (the cupola to 4.3). */
export function barnModel(): Structure<BarnPart> {
  const L = 1.85
  const W = 1.55
  const eaves = 2.2
  const knee: [number, number] = [1.0, 3.08]
  const ridge = 3.68
  const base = slab(L + 0.05, W + 0.05, 0, 0.3, 6, 24).paint((x, y, z) => mix(CONCRETE, rgb(0x8a8378), 0.45 * smoothstep(0.35, 0.75, fbm3(x * 4, y * 4, z * 4, 5))), 0)
  // the walls: upright red boards (the material's boards, 20 cm wide), and the gables up to the roof
  const outline: [number, number][] = [
    [-W, eaves - 0.02],
    [-knee[0], knee[1]],
    [0, ridge],
    [knee[0], knee[1]],
    [W, eaves - 0.02],
  ]
  const walls = merge(
    slab(L, W, 0.25, eaves, 9, 28).paint(() => BARN_RED, 0),
    gable(L, outline, BARN_RED),
    gable(-L, outline, BARN_RED),
  )
  // the gambrel roof: a steep slope and a shallow one each side, shingled, a cap along the ridge
  const eave: [number, number] = [W + 0.16, eaves - 0.06]
  const roof = merge(
    slope(eave, knee, L + 0.2, 0.035),
    slope(knee, [0, ridge], L + 0.2, 0.035),
    slope([-eave[0], eave[1]], [-knee[0], knee[1]], L + 0.2, 0.035),
    slope([-knee[0], knee[1]], [0, ridge], L + 0.2, 0.035),
    tube(
      [
        [-L - 0.2, ridge + 0.03, 0],
        [L + 0.2, ridge + 0.03, 0],
      ],
      0.05,
      { seg: 8, caps: [true, true] },
    ).surface(0),
    // the cupola's little pyramid roof
    lathe(
      [
        [0, 4.02],
        [0.36, 4.02],
        [0.0, 4.36],
      ],
      { seg: 4, steps: 1 },
    )
      .place([0, 0, 0], [0, Math.PI / 4, 0])
      .surface(0),
  ).paint(() => SHINGLE, 0)
  // white trim: corner boards, the boards along the gables' edges, round the doors, and the cupola
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(sx * (L - 0.02), (eaves + 0.25) / 2, sz * (W - 0.02), 0.05, (eaves - 0.25) / 2 + 0.02, 0.05, 6, 8)))
  const edge = (sx: number, a: [number, number], b: [number, number]) => beam([sx * (L + 0.02), a[1] + 0.02, a[0]], [sx * (L + 0.02), b[1] + 0.02, b[0]], 0.035, 0.05, [1, 0, 0], 8)
  const edges = [-1, 1].flatMap((sx) => [
    edge(sx, [-W, eaves], [-knee[0], knee[1]]),
    edge(sx, [-knee[0], knee[1]], [0, ridge]),
    edge(sx, [0, ridge], [knee[0], knee[1]]),
    edge(sx, [knee[0], knee[1]], [W, eaves]),
  ])
  const doorFrame = [
    box(L + 0.03, 1.15, -0.72, 0.04, 0.88, 0.06, 6, 8),
    box(L + 0.03, 1.15, 0.72, 0.04, 0.88, 0.06, 6, 8),
    box(L + 0.03, 2.06, 0, 0.04, 0.06, 0.78, 6, 8),
    // round the hayloft door
    box(L + 0.025, 2.66, 0, 0.035, 0.36, 0.4, 6, 8),
  ]
  const cupola = box(0, 3.82, 0, 0.26, 0.24, 0.26, 8, 12)
  const trim = merge(...corners, ...edges, ...doorFrame, cupola)
    .paint(() => TRIM, 0)
    .surface(0)
  // the doors: two red leaves, each braced with a white X, and the hayloft door above them
  const leaf = (sz: number) => {
    const z = sz * 0.33
    const a: V3 = [L + 0.062, 0.4, z - 0.28]
    const b: V3 = [L + 0.062, 1.9, z + 0.28]
    return merge(
      box(L + 0.025, 1.15, z, 0.035, 0.84, 0.32, 10).paint(() => BARN_RED, 0),
      beam(a, b, 0.045, 0.014, [1, 0, 0], 6).paint(() => TRIM, 0),
      beam([a[0], a[1], b[2]], [b[0], b[1], a[2]], 0.045, 0.014, [1, 0, 0], 6).paint(() => TRIM, 0),
      box(L + 0.062, 0.42, z, 0.014, 0.04, 0.31, 6, 8).paint(() => TRIM, 0),
      box(L + 0.062, 1.88, z, 0.014, 0.04, 0.31, 6, 8).paint(() => TRIM, 0),
    )
  }
  const hayloft = box(L + 0.05, 2.66, 0, 0.03, 0.3, 0.34, 10).paint(() => mix(BARN_RED, WOOD_DARK, 0.3), 0)
  const doors = merge(leaf(-1), leaf(1), hayloft)
  return {
    base: { shape: base, material: { roughness: 0.95, surface: { kind: 'stone', size: 0.54, joint: rgb(0xd9cbb4), tone: 0.5 } } },
    walls: { shape: walls, material: { roughness: 0.8, surface: { kind: 'boards', size: 0.8, turn: true, tone: 0.4 } } },
    roof: { shape: roof, material: { roughness: 0.7, surface: { kind: 'shingle', size: 0.6, tone: 0.55 } } },
    trim: { shape: trim, material: { roughness: 0.75 } },
    doors: { shape: doors, material: { roughness: 0.8, surface: { kind: 'boards', size: 0.5, turn: true, tone: 0.3 } } },
  }
}
