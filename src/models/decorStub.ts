import type { DecorKind, FruitId, FruitKind } from '../farm/decor'
import { blob, ellipsoid, fbm3, lathe, loft, merge, rgb, smoothstep, squircle, tube, type Shape, type V3 } from '../lib/sculpt'
import { mix, slab, type Structure } from './structures'

// Stand-ins for the farm's decoration, its fruit trees and bushes and their fruit as goods, made from the kit's simplest
// shapes until the 3D designer's models (src/models/decor.ts, src/models/fruit.ts, the fruit in src/models/goods.ts)
// take their place: the game takes them from one module (src/farm/decorModels.ts), so they are swapped there. Each in
// its own frame, the ground under its middle at the origin, x across and z along (a fence's or a hedge's 2 m along x,
// its ends at x = ±1). A part named `glow` lights up from the evening (the lamps' and the lanterns' glass).

const IRON = rgb(0x2f3236)
const GLASS = rgb(0xffe7a8)
const WHITE_WOOD = rgb(0xeee6d6)
const WOOD = rgb(0x8a6440)
const WOOD_DARK = rgb(0x5e4630)
const STONE = rgb(0xa49d92)
const STONE_DARK = rgb(0x837c72)
const LEAF = rgb(0x4f7a37)
const LEAF_LIGHT = rgb(0x6f9a46)
const PINE = rgb(0x2f5a3a)
const BARK = rgb(0x5a4434)
const SOIL = rgb(0x4a3526)
const WATER = rgb(0x6f9fb8)

/** A box with soft edges, of one colour. */
const box = (hx: number, hz: number, y0: number, y1: number, color: V3, seg = 12) => slab(hx, hz, y0, y1, 6, seg).fill(color, 0)

/** A leafy lump: a blob with soft bumps, lighter on top. */
function leafy(r: number, at: V3, seed: number, scale: V3 = [1, 1, 1], light = LEAF_LIGHT, dark = LEAF, detail = 2) {
  return blob(r, detail, (x, y, z) => 0.12 * (fbm3(x * 3 + seed, y * 3, z * 3, seed) - 0.5))
    .place(at, [0, seed, 0], scale)
    .paint((x, y, z) => mix(dark, light, smoothstep(0.3, 0.75, fbm3(x * 2.5, y * 2.5, z * 2.5, seed))), 0)
}

/** A round thing turned on a lathe, closed at both ends, of one colour. */
const turned = (profile: [number, number][], color: V3, seg = 12) => lathe(profile, { seg, steps: 1, caps: [true, true] }).fill(color, 0)

/** A trunk from the ground up to `top`, tapering. */
const trunk = (r: number, top: number) =>
  tube(
    [
      [0, -0.02, 0],
      [0.02, top * 0.5, 0.01],
      [0.03, top, 0.02],
    ],
    [r, r * 0.8, r * 0.6],
    { seg: 8, steps: 1, caps: [true, true] },
  ).fill(BARK, 0)

function lamp(): Structure<'iron' | 'glow'> {
  const post = turned(
    [
      [0.13, 0],
      [0.13, 0.1],
      [0.05, 0.18],
      [0.045, 1.98],
      [0.08, 2.0],
    ],
    IRON,
  )
  const roof = turned(
    [
      [0.17, 2.27],
      [0.03, 2.42],
    ],
    IRON,
  )
  const glass = turned(
    [
      [0.1, 2.0],
      [0.13, 2.12],
      [0.12, 2.27],
    ],
    GLASS,
    10,
  )
  return { iron: { shape: merge(post, roof), material: { roughness: 0.45, metalness: 0.5 } }, glow: { shape: glass, material: { roughness: 0.2 } } }
}

function lantern(): Structure<'iron' | 'glow'> {
  const post = turned(
    [
      [0.07, 0],
      [0.035, 0.05],
      [0.03, 0.42],
      [0.06, 0.44],
    ],
    IRON,
    8,
  )
  const cap = turned(
    [
      [0.1, 0.6],
      [0.02, 0.7],
    ],
    IRON,
    8,
  )
  const glass = turned(
    [
      [0.06, 0.44],
      [0.08, 0.52],
      [0.07, 0.6],
    ],
    GLASS,
    8,
  )
  return { iron: { shape: merge(post, cap), material: { roughness: 0.45, metalness: 0.5 } }, glow: { shape: glass, material: { roughness: 0.2 } } }
}

function fence(): Structure<'wood'> {
  const parts: Shape[] = []
  // a post at each end (where it meets the next section), two rails, and pickets between
  for (const x of [-0.97, 0.97]) parts.push(box(0.045, 0.045, 0, 0.95, WHITE_WOOD, 8).place([x, 0, 0]))
  for (const y of [0.25, 0.65]) parts.push(box(0.95, 0.014, y, y + 0.07, WHITE_WOOD, 8).place([0, 0, -0.03]))
  for (let k = 0; k < 9; k++) parts.push(box(0.035, 0.012, 0, 0.82, WHITE_WOOD, 8).place([-0.8 + k * 0.2, 0, 0.0]))
  return { wood: { shape: merge(...parts), material: { roughness: 0.75 } } }
}

function hedge(): Structure<'leaves'> {
  const shape = loft(
    [
      { c: [0, 0, 0], rx: 0.98, ry: 0.28 },
      { c: [0, 0.5, 0], rx: 1.0, ry: 0.3 },
      { c: [0, 0.92, 0], rx: 0.98, ry: 0.28 },
    ],
    { seg: 24, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 5), caps: [true, false], round: [0, 0.1] },
  )
    .displace((x, y, z) => (y > 0.02 ? 0.035 * (fbm3(x * 6, y * 6, z * 6, 9) - 0.5) : 0))
    .paint((x, y, z) => mix(LEAF, LEAF_LIGHT, smoothstep(0.35, 0.7, fbm3(x * 4, y * 4, z * 4, 5)) * (0.5 + 0.5 * smoothstep(0.2, 1, y))), 0)
  return { leaves: { shape, material: { roughness: 0.9, detail: { scale: 14, bump: 0.35, shade: 0.12 } } } }
}

function path(): Structure<'stone'> {
  return { stone: { shape: box(0.49, 0.49, -0.01, 0.03, STONE, 12), material: { roughness: 0.9, surface: { kind: 'stone', size: 0.5, tone: 0.35 } } } }
}

function stones(): Structure<'stone'> {
  const one = (x: number, z: number, r: number, k: number) =>
    turned(
      [
        [r, -0.01],
        [r, 0.02],
        [r * 0.85, 0.035],
      ],
      mix(STONE, STONE_DARK, (k % 3) / 3),
      9,
    ).place([x, 0, z], [0, k, 0], [1, 1, 0.8])
  return { stone: { shape: merge(one(-0.22, -0.2, 0.2, 0), one(0.2, 0.05, 0.22, 1), one(-0.12, 0.28, 0.17, 2)), material: { roughness: 0.92 } } }
}

function bench(): Structure<'wood' | 'iron'> {
  const seat = merge(...[-0.12, 0.0, 0.12].map((z) => box(0.75, 0.05, 0.42, 0.46, WOOD, 8).place([0, 0, z])))
  const back = merge(...[0.62, 0.76].map((y) => box(0.75, 0.018, y, y + 0.09, WOOD, 8).place([0, 0, 0.2])))
  const legs = merge(...[-0.62, 0.62].map((x) => merge(box(0.03, 0.2, 0, 0.42, IRON, 8).place([x, 0, 0]), box(0.025, 0.025, 0.42, 0.86, IRON, 8).place([x, 0, 0.21]))))
  return { wood: { shape: merge(seat, back), material: { roughness: 0.8, surface: { kind: 'boards', size: 0.6 } } }, iron: { shape: legs, material: { roughness: 0.5, metalness: 0.4 } } }
}

function shadeTree(): Structure<'wood' | 'crown'> {
  const crown = merge(leafy(1.0, [0, 2.6, 0], 1, [1.1, 0.85, 1.1], LEAF_LIGHT, LEAF, 3), leafy(0.7, [0.6, 2.2, 0.3], 2), leafy(0.65, [-0.55, 2.3, -0.3], 3))
  return {
    wood: { shape: trunk(0.14, 2.2), material: { roughness: 0.95, surface: { kind: 'bark', size: 0.45 } } },
    crown: { shape: crown, material: { roughness: 0.88, detail: { scale: 9, bump: 0.3, shade: 0.1 } } },
  }
}

function pine(): Structure<'wood' | 'crown'> {
  const tiers = [0, 1, 2].map((k) =>
    lathe(
      [
        [0.75 - k * 0.2, 0.8 + k * 0.75],
        [0.02, 2.0 + k * 0.75],
      ],
      { seg: 10, steps: 1, caps: [true, true] },
    ).paint((_x, y) => mix(PINE, rgb(0x46774a), smoothstep(0.8, 3.6, y)), 0),
  )
  return {
    wood: { shape: trunk(0.1, 1.2), material: { roughness: 0.95, surface: { kind: 'bark', size: 0.4 } } },
    crown: { shape: merge(...tiers), material: { roughness: 0.9, detail: { scale: 12, bump: 0.3, shade: 0.12 } } },
  }
}

function bush(flowers?: V3): Structure<'leaves'> {
  const leaves = merge(leafy(0.42, [0, 0.36, 0], 4, [1, 0.85, 1]), leafy(0.3, [0.22, 0.28, 0.1], 5))
  if (flowers) leaves.pattern((x, y, z) => (fbm3(x * 14, y * 14, z * 14, 7) > 0.62 && y > 0.25 ? 1 : 0), flowers)
  return { leaves: { shape: leaves, material: { roughness: 0.85, detail: { scale: 12, bump: 0.3, shade: 0.12 } } } }
}

function flowers(): Structure<'leaves' | 'blooms'> {
  const leaves = merge(...[-0.25, 0.05, 0.28].map((x, k) => leafy(0.17, [x, 0.08, (k - 1) * 0.2], 10 + k, [1.3, 0.6, 1.3])))
  const colours = [0xe6533c, 0xf2c94c, 0xffffff, 0xc86fd0, 0xf28fb0, 0xe6533c, 0xf2c94c]
  const blooms = merge(
    ...colours.map((c, k) => {
      const a = k * 2.4
      const r = 0.12 + (k % 3) * 0.12
      return ellipsoid(0.055, 0.03, 0.055, 7, 4)
        .place([Math.cos(a) * r, 0.24 + (k % 2) * 0.05, Math.sin(a) * r])
        .fill(rgb(c), 0)
    }),
  )
  return { leaves: { shape: leaves, material: { roughness: 0.85 } }, blooms: { shape: blooms, material: { roughness: 0.6 } } }
}

function planter(): Structure<'wood' | 'plants'> {
  const crate = merge(box(0.48, 0.23, 0, 0.36, WOOD, 8), box(0.44, 0.19, 0.3, 0.33, SOIL, 8))
  const plants = merge(leafy(0.18, [-0.25, 0.42, 0], 20), leafy(0.2, [0.05, 0.44, 0], 21), leafy(0.17, [0.3, 0.42, 0], 22)).pattern(
    (x, y, z) => (fbm3(x * 16, y * 16, z * 16, 3) > 0.64 ? 1 : 0),
    rgb(0xe8794a),
  )
  return { wood: { shape: crate, material: { roughness: 0.8, surface: { kind: 'boards', size: 0.4, turn: true } } }, plants: { shape: plants, material: { roughness: 0.85 } } }
}

function birdbath(): Structure<'stone' | 'water'> {
  const stone = turned(
    [
      [0.18, 0],
      [0.18, 0.06],
      [0.07, 0.12],
      [0.06, 0.62],
      [0.26, 0.72],
      [0.28, 0.8],
    ],
    STONE,
  )
  const water = turned(
    [
      [0.24, 0.74],
      [0.25, 0.775],
    ],
    WATER,
  )
  return { stone: { shape: stone, material: { roughness: 0.9 } }, water: { shape: water, material: { roughness: 0.1, metalness: 0.1 } } }
}

function well(): Structure<'stone' | 'wood' | 'roof'> {
  const ring = lathe(
    [
      [0.62, 0],
      [0.62, 0.72],
      [0.48, 0.72],
      [0.48, 0.2],
    ],
    { seg: 16, steps: 1, caps: [false, true] },
  ).fill(STONE, 0)
  const posts = merge(
    ...[-0.55, 0.55].map((x) => box(0.05, 0.05, 0.5, 1.75, WOOD_DARK, 8).place([x, 0, 0])),
    tube(
      [
        [-0.55, 1.45, 0],
        [0.55, 1.45, 0],
      ],
      0.04,
      { seg: 8, steps: 1, caps: [true, true] },
    ).fill(WOOD, 0),
  )
  const roof = merge(box(0.8, 0.35, 0, 0.04, rgb(0x6b4a34), 8).place([0, 1.75, -0.22], [0.55, 0, 0]), box(0.8, 0.35, 0, 0.04, rgb(0x6b4a34), 8).place([0, 1.75, 0.22], [-0.55, 0, 0]))
  return {
    stone: { shape: ring, material: { roughness: 0.92, surface: { kind: 'stone', size: 0.42 } } },
    wood: { shape: posts, material: { roughness: 0.85 } },
    roof: { shape: roof, material: { roughness: 0.8, surface: { kind: 'shingle', size: 0.5 } } },
  }
}

/** Each kind of decoration's stand-in. */
export function decorModel(kind: DecorKind): Structure<string> {
  switch (kind) {
    case 'lamp':
      return lamp()
    case 'lantern':
      return lantern()
    case 'fence':
      return fence()
    case 'hedge':
      return hedge()
    case 'path':
      return path()
    case 'stones':
      return stones()
    case 'bench':
      return bench()
    case 'tree':
      return shadeTree()
    case 'pine':
      return pine()
    case 'bush':
      return bush()
    case 'roses':
      return bush(rgb(0xc8243a))
    case 'flowers':
      return flowers()
    case 'planter':
      return planter()
    case 'birdbath':
      return birdbath()
    case 'well':
      return well()
  }
}

// ───────────────────────────── fruit trees and bushes ─────────────────────────────

const isTree = (kind: FruitKind) => kind.endsWith('-tree')
const CROWN_SEED: Record<FruitKind, number> = { 'apple-tree': 31, 'orange-tree': 32, 'cherry-tree': 33, 'blueberry-bush': 34, 'raspberry-bush': 35 }

/** The leafy part of a fruit plant: what the fruit hangs under (fruitSpots looks up into it). */
function fruitCrown(kind: FruitKind): Shape {
  const s = CROWN_SEED[kind]
  if (isTree(kind)) {
    const dark = kind === 'orange-tree' ? rgb(0x3d6b35) : LEAF
    return merge(leafy(0.85, [0, 2.15, 0], s, [1.1, 0.8, 1.1], LEAF_LIGHT, dark, 3), leafy(0.55, [0.5, 1.9, 0.25], s + 1), leafy(0.5, [-0.45, 1.95, -0.25], s + 2))
  }
  return merge(leafy(0.42, [0, 0.42, 0], s, [1.05, 0.9, 1.05], LEAF_LIGHT, LEAF, 3), leafy(0.28, [0.25, 0.32, 0.12], s + 1), leafy(0.26, [-0.24, 0.3, -0.12], s + 2))
}

/** A fruit tree's or bush's stand-in: a trunk (a bush: a few stems) and its crown; the fruit hang from it as they ripen
 *  (src/farm/decorScene.tsx, at `fruitSpots`). */
export function fruitPlantModel(kind: FruitKind): Structure<string> {
  const wood = isTree(kind)
    ? trunk(0.11, 1.75)
    : merge(
        ...[0, 2.1, 4.2].map((a) =>
          tube(
            [
              [0, 0, 0],
              [Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12],
            ],
            [0.025, 0.015],
            { seg: 5, steps: 1, caps: [true, true] },
          ).fill(BARK, 0),
        ),
      )
  return {
    wood: { shape: wood, material: { roughness: 0.95, surface: { kind: 'bark', size: 0.4 } } },
    crown: { shape: fruitCrown(kind), material: { roughness: 0.85, detail: { scale: 10, bump: 0.3, shade: 0.1 } } },
  }
}

/** Where a plant's fruit hang (each stalk's end, a little up into the leaves, round the crown's underside), `n` of
 *  them: found by looking straight up from under the crown, so each holds on to it. */
export function fruitSpots(kind: FruitKind, n: number): V3[] {
  const c = fruitCrown(kind)
  const tree = isTree(kind)
  const out: V3[] = []
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.3
    const r = tree ? 0.5 + (k % 3) * 0.12 : 0.18 + (k % 3) * 0.08
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const hit = c.raycast([x, 0.05, z], [0, 1, 0])
    out.push([x, hit ? hit.point[1] + 0.03 : tree ? 1.6 : 0.35, z])
  }
  return out
}

// ───────────────────────────── the fruit as goods ─────────────────────────────

const FRUIT_LOOK: Record<FruitId, { color: number; r: number; n: number }> = {
  apple: { color: 0xc8352b, r: 0.05, n: 3 },
  orange: { color: 0xf08a1c, r: 0.052, n: 3 },
  cherry: { color: 0x8e1424, r: 0.022, n: 6 },
  blueberry: { color: 0x37457e, r: 0.016, n: 9 },
  raspberry: { color: 0xd2335a, r: 0.02, n: 7 },
}

/** A good's stand-in: a few of the fruit in a little heap (on the market's shelves, and their pictures). */
export function fruitGoodModel(id: FruitId): Structure<'fruit'> {
  const { color, r, n } = FRUIT_LOOK[id]
  const pile: Shape[] = []
  for (let k = 0; k < n; k++) {
    const a = k * 2.3
    const ring = k === 0 ? 0 : k < 4 ? r * 1.6 : r * 3
    const y = k === 0 && n > 3 ? r * 1.7 : r * 0.95
    pile.push(ellipsoid(r, r * 0.95, r, 10, 6).place([Math.cos(a) * ring, y, Math.sin(a) * ring], [Math.PI / 2, 0, 0]))
  }
  return { fruit: { shape: merge(...pile).fill(rgb(color), 0), material: { roughness: 0.4 } } }
}
