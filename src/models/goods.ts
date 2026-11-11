import type { ProduceId } from '../farm/data'
import { blade, blob, fbm3, lathe, loft, merge, noise3, rgb, smoothstep, squircle, tube, type Shape, type V3 } from '../lib/sculpt'
import { around, leaflet } from './crops'
import { woodpile, type Structure, type StructurePart } from './structures'

// Every good on the farm as a thing you hold — the harvest as it goes in the basket, and what the hens, the cows,
// the sheep, the mill, the oven and the loom give: a head of lettuce, a carrot, a strawberry, a tomato, a cob of
// corn, a pumpkin, a sheaf of wheat, sugar cane, a lemon, eggs, a bottle of milk, a ball of wool, a bowl of
// sugar, a sack of flour, a roll of cloth, three cakes and a pie; and the six building materials the silo and the
// barn are made bigger with: two bricks, two planks, three nails, two iron bars, a bolt with its nut, a stack of
// logs. Each is a small structure (a part per material)
// of about 0.1–0.5 m, posed the way its picture shows it and set down on y = 0, finer than the garden's own parts
// (it is seen big, once). They are drawn into the game's item pictures (src/models/itemArt.ts), and shown in the
// gallery and checked like every other model.

const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

const ORANGE = rgb(0xf27d22)
const ORANGE_DARK = rgb(0xc9561a)
const LEAF = rgb(0x4f8f3a)
const LEAF_LIGHT = rgb(0x8cc85a)
const CALYX = rgb(0x4a8a32)
const STEM_BROWN = rgb(0x6b5a32)
const CREAM = rgb(0xfff4dc)
const ICING = rgb(0xfffaf0)
const CRUST = rgb(0xdca15b)
const BURLAP = rgb(0xdcc08e)
const BURLAP_DARK = rgb(0xb9965f)
const STRING = rgb(0x8a6a44)
const BERRY = rgb(0xe02a3c)
const BERRY_DARK = rgb(0xa8102a)
const SEED = rgb(0xf7dc72)
const TOMATO = rgb(0xe8402c)
const TOMATO_DARK = rgb(0xb8241a)
const KERNEL = rgb(0xf8cc3a)
const KERNEL_DARK = rgb(0xd29a18)
const HUSK = rgb(0x6ea644)
const HUSK_LIGHT = rgb(0xa9d16c)
const LEMON = rgb(0xffd21f)
const LEMON_DARK = rgb(0xe8a90e)
const ENAMEL = rgb(0x5b97d6)

const leafy = { roughness: 0.6, doubleSided: true, leaf: true }

/** Sets a structure down: its lowest point on the ground (y = 0). */
function grounded<K extends string>(s: Structure<K>): Structure<K> {
  const parts = Object.values(s) as StructurePart[]
  let low = Infinity
  for (const p of parts) for (let k = 1; k < p.shape.p.length; k += 3) low = Math.min(low, p.shape.p[k])
  for (const p of parts) p.shape.place([0, -low, 0])
  return s
}

/** Turns every part of a structure together (the pose its picture shows), then sets it down. */
function posed<K extends string>(s: Structure<K>, rot: V3): Structure<K> {
  for (const p of Object.values(s) as StructurePart[]) p.shape.place([0, 0, 0], rot)
  return grounded(s)
}

/** Seeds on a lathed fruit: every fourth vertex round each ring, staggered ring by ring (vertex 0 is the tip). */
const seeds = (seg: number) => {
  let v = -1
  return () => {
    const i = v++
    if (i < 0) return 0
    return (i % seg) % 4 === (Math.floor(i / seg) % 2) * 2 ? 1 : 0
  }
}

/** A carrot pulled from the soil, lying slantwise: a plump root with shallow rings, a fan of feathery leaves. */
function carrot(): Structure<'root' | 'top'> {
  const root = lathe(
    [
      [0, -0.24],
      [0.006, -0.232],
      [0.014, -0.2],
      [0.024, -0.14],
      [0.032, -0.07],
      [0.036, -0.02],
      [0.034, 0.004],
      [0.022, 0.014],
      [0, 0.018],
    ],
    { seg: 20, steps: 3 },
  )
  const ring = (y: number) => Math.max(0, Math.sin(y * 120)) * smoothstep(-0.23, -0.04, y)
  root
    .displace((_x, y) => -0.0016 * ring(y))
    .paint((_x, y) => mix(ORANGE_DARK, ORANGE, smoothstep(-0.22, -0.03, y)), 0)
    .pattern((_x, y) => 0.55 * ring(y), ORANGE_DARK)
  const top: Shape[] = []
  ;[-0.8, -0.45, -0.14, 0.16, 0.47, 0.82].forEach((phi, k) => {
    const len = 0.095 + 0.03 * Math.cos(phi * 2)
    // the stalk, from inside the root's shoulder out to where the leaf begins
    const d: V3 = [-Math.sin(phi), Math.cos(phi), 0]
    const base: V3 = [d[0] * 0.04, 0.006 + d[1] * 0.04, 0.004 * (k % 2)]
    top.push(tube([[0, -0.004, 0], base], [0.0042, 0.003], { seg: 6, steps: 1, caps: [true, false], round: [0, 0.0025] }).fill(LEAF, 0))
    top.push(
      blade({ length: len, width: 0.05, fold: 0.35, bend: 0.45, teeth: 0.45, toothCount: 7, segL: 8, segW: 2 })
        .paint((_x, _y, z) => mix(LEAF, LEAF_LIGHT, Math.min(1, z / len)), 0)
        .place([0, 0, 0], [0, 0, Math.PI])
        .place([0, 0, 0], [-Math.PI / 2 + 0.18 * (k % 2), 0, 0])
        .place(base, [0, 0, phi]),
    )
  })
  return posed({ root: { shape: root, material: { roughness: 0.5 } }, top: { shape: merge(...top), material: leafy } }, [0, 0, -0.85])
}

/** A strawberry: a heart-shaped berry speckled with seeds, under a ruff of sepals and a short stalk. */
function strawberry(): Structure<'berry' | 'leaves'> {
  const seg = 24
  const berry = lathe(
    [
      [0, 0],
      [0.01, 0.005],
      [0.026, 0.022],
      [0.04, 0.048],
      [0.048, 0.074],
      [0.049, 0.092],
      [0.04, 0.105],
      [0.02, 0.112],
      [0, 0.113],
    ],
    { seg, steps: 3, shape: (a) => 1 + 0.05 * Math.cos(2 * a) },
  )
    .paint((_x, y) => mix(BERRY_DARK, BERRY, smoothstep(0.0, 0.08, y)), 0)
    .pattern(seeds(seg), SEED)
  const leaves: Shape[] = []
  for (let s = 0; s < 7; s++) leaves.push(around(leaflet(0.05, 0.022, 0.004, 5).fill(CALYX, 0), 0.22 + 0.1 * (s % 2), (s / 7) * Math.PI * 2 + 0.2, [0, 0.112, 0]))
  leaves.push(
    tube(
      [
        [0, 0.1, 0],
        [0.004, 0.13, 0.002],
        [0.012, 0.146, 0.006],
      ],
      [0.005, 0.0045, 0.004],
      { seg: 6, steps: 2, caps: [true, false], round: [0, 0.004] },
    ).fill(CALYX, 0),
  )
  return posed({ berry: { shape: berry, material: { roughness: 0.3 } }, leaves: { shape: merge(...leaves), material: { roughness: 0.6 } } }, [0, 0, 0.35])
}

/** A ripe tomato: round, a little flat and ribbed, a green star of a calyx and a stub of stalk. */
function tomato(): Structure<'fruit' | 'calyx'> {
  const fruit = lathe(
    [
      [0, 0],
      [0.032, 0.003],
      [0.056, 0.014],
      [0.07, 0.033],
      [0.074, 0.054],
      [0.068, 0.076],
      [0.05, 0.092],
      [0.024, 0.099],
      [0, 0.095],
    ],
    { seg: 30, steps: 3, shape: (a) => 1 - 0.035 * Math.abs(Math.sin(a * 3)) },
  ).paint((_x, y) => mix(TOMATO_DARK, TOMATO, smoothstep(0.0, 0.07, y)), 0)
  const calyx: Shape[] = []
  for (let s = 0; s < 5; s++) calyx.push(around(leaflet(0.04, 0.015, 0.007, 5).fill(CALYX, 0), 0.08, (s / 5) * Math.PI * 2 + 0.4, [0, 0.0985, 0]))
  calyx.push(
    tube(
      [
        [0, 0.09, 0],
        [0.002, 0.11, 0.001],
        [0.008, 0.12, 0.003],
      ],
      [0.0045, 0.004, 0.0035],
      { seg: 6, steps: 2, caps: [true, false], round: [0, 0.003] },
    ).fill(CALYX, 0),
  )
  return grounded({ fruit: { shape: fruit, material: { roughness: 0.26 } }, calyx: { shape: merge(...calyx), material: { roughness: 0.6 } } })
}

/** A cob of corn, slantwise: plump kernels in rows, the husk's leaves peeled back from it, the stub of its shank. */
function corn(): Structure<'cob' | 'husk'> {
  const seg = 48
  const steps = 12
  const profile: [number, number][] = [
    [0, 0.0],
    [0.026, 0.006],
    [0.035, 0.03],
    [0.037, 0.1],
    [0.033, 0.16],
    [0.022, 0.198],
    [0, 0.21],
  ]
  const rings = (profile.length - 1) * steps + 1
  const ROWS = 12
  // a kernel's bulge at an angle round the cob and a share of the way along it (rows offset by half a kernel)
  const kernel = (a: number, t: number) => {
    const row = Math.floor((a / (Math.PI * 2)) * ROWS)
    return Math.pow(Math.abs(Math.sin((a * ROWS) / 2)), 0.6) * Math.pow(Math.abs(Math.sin(Math.PI * (t * 18 + (row % 2) * 0.5))), 0.6)
  }
  const ends = (t: number) => smoothstep(0, 0.08, t) * smoothstep(1, 0.86, t)
  const cob = lathe(profile, { seg, steps, shape: (a, t) => 1 + 0.1 * kernel(a, t) * ends(t) }).paint((_x, _y, _z, k) => {
    if (k === 0 || k >= 1 + (rings - 2) * seg) return KERNEL_DARK
    const t = (1 + Math.floor((k - 1) / seg)) / (rings - 1)
    const a = (((k - 1) % seg) / seg) * Math.PI * 2
    return mix(KERNEL_DARK, KERNEL, kernel(a, t) * ends(t) + (1 - ends(t)) * 0.5)
  }, 0)
  const husk: Shape[] = []
  for (let h = 0; h < 3; h++) {
    husk.push(
      blade({ length: 0.15 - 0.02 * h, width: 0.075, fold: 0.5, bend: -0.8, segL: 9, segW: 3 })
        .paint((_x, _y, z) => mix(HUSK, HUSK_LIGHT, smoothstep(0.02, 0.14, z)), 0)
        .place([0, 0.012, 0.03], [-Math.PI / 2 + 0.25, 0, 0])
        .place([0, 0, 0], [0, (h / 3) * Math.PI * 2 + 0.5, 0]),
    )
  }
  husk.push(
    tube(
      [
        [0, 0.02, 0],
        [0, -0.012, 0.003],
        [0.002, -0.03, 0.01],
      ],
      [0.015, 0.013, 0.012],
      { seg: 10, steps: 2, caps: [true, true] },
    ).fill(rgb(0x8aa857), 0),
  )
  return posed({ cob: { shape: cob, material: { roughness: 0.42 } }, husk: { shape: merge(...husk), material: leafy } }, [0, 0, -0.95])
}

/** A lemon lying on its side, a nub at each end, a leaf on a twig at one. */
function lemon(): Structure<'fruit' | 'leaf'> {
  const fruit = lathe(
    [
      [0, -0.07],
      [0.008, -0.066],
      [0.014, -0.06],
      [0.032, -0.046],
      [0.044, -0.024],
      [0.047, 0.0],
      [0.044, 0.024],
      [0.032, 0.046],
      [0.014, 0.06],
      [0.008, 0.066],
      [0, 0.07],
    ],
    { seg: 32, steps: 2 },
  ).displace((x, y, z) => 0.0007 * (noise3(x * 260, y * 260, z * 260, 3) - 0.5))
  const twig = tube(
    [
      [0, 0.062, 0],
      [0.002, 0.08, 0],
      [0.008, 0.088, 0],
    ],
    [0.0042, 0.0038, 0.0034],
    { seg: 6, steps: 2, caps: [true, false], round: [0, 0.003] },
  ).fill(STEM_BROWN, 0)
  const leaf = blade({ length: 0.085, width: 0.04, fold: 0.35, bend: 0.4, segL: 8, segW: 2 })
    .paint((x, _y, z) => mix(LEAF, LEAF_LIGHT, 0.45 * smoothstep(0.004, 0, Math.abs(x)) + 0.35 * (z / 0.085)), 0)
    .place([0, 0, 0], [0, Math.PI / 2, 0])
    .place([0, 0, 0], [0, 0, 0.5])
    .place([0.006, 0.086, 0], [0, -0.35, 0])
  const s = posed({ fruit: { shape: fruit, material: { roughness: 0.36 } }, leaf: { shape: merge(twig, leaf), material: leafy } }, [0, 0, Math.PI / 2 - 0.3])
  // the peel: deeper yellow underneath, bright on top (painted once it lies as it is shown)
  s.fruit.shape.paint((_x, y) => mix(LEMON_DARK, LEMON, smoothstep(0.0, 0.08, y)), 0)
  return s
}

/** A head of lettuce: a pale heart in rings of frilly leaves, light and upright inside, wide and darker outside. */
function lettuce(): Structure<'head' | 'leaves'> {
  const head = merge(
    blob(0.045, 3, (x, y, z) => 0.06 * Math.sin(x * 70 + y * 30) * Math.cos(z * 60 - y * 20)).place([0, 0.05, 0], [0, 0, 0], [1, 0.9, 1]),
    // the stump the leaves grow from, under them all
    blob(0.035, 2).place([0, 0.008, 0], [0, 0, 0], [1, 0.35, 1]),
  ).paint((_x, y) => mix(rgb(0xb8dc7a), rgb(0xdff2ac), smoothstep(0.03, 0.09, y)), 0)
  const rings: { n: number; len: number; width: number; lean: number; bend: number; r: number; dark: V3; light: V3; turn: number }[] = [
    { n: 6, len: 0.13, width: 0.14, lean: 1.15, bend: 0.5, r: 0.03, dark: rgb(0x4a9638), light: rgb(0x9fd06a), turn: 0 },
    { n: 5, len: 0.11, width: 0.12, lean: 0.75, bend: 0.9, r: 0.025, dark: rgb(0x6db447), light: rgb(0xb6df7a), turn: 0.3 },
    { n: 4, len: 0.085, width: 0.09, lean: 0.35, bend: 1.2, r: 0.015, dark: rgb(0x9ccf5e), light: rgb(0xd2ec98), turn: 0.8 },
  ]
  const leaves: Shape[] = []
  for (const g of rings)
    for (let k = 0; k < g.n; k++)
      leaves.push(
        blade({ length: g.len, width: g.width, outline: (u) => Math.sin(Math.PI * Math.pow(u, 0.6)) * (1 - 0.1 * u), fold: 0.45, bend: g.bend, frill: 0.18, waves: 8, segL: 10, segW: 4 })
          .paint((x, _y, z) => mix(g.dark, g.light, 0.75 * smoothstep(0.0, g.len, z) + 0.25 * smoothstep(0.03, 0, Math.abs(x))), 0)
          .place([0, 0.006, g.r], [-Math.PI / 2 + g.lean, 0, 0])
          .place([0, 0, 0], [0, (k / g.n) * Math.PI * 2 + g.turn, 0]),
      )
  return grounded({ head: { shape: head, material: { roughness: 0.55 } }, leaves: { shape: merge(...leaves), material: leafy } })
}

/** A pumpkin: deep ribs, flat on top round a short twisted stem, a curl of tendril and a leaf behind. */
function pumpkin(): Structure<'body' | 'stem' | 'leaf'> {
  const R = 0.12
  const profile: [number, number][] = [
    [0, -0.66],
    [0.3, -0.64],
    [0.6, -0.55],
    [0.85, -0.38],
    [1.0, -0.08],
    [0.92, 0.3],
    [0.62, 0.55],
    [0.25, 0.6],
    [0.06, 0.5],
    [0, 0.46],
  ]
  const body = lathe(
    profile.map(([r, y]) => [r * R, y * R]),
    { seg: 60, steps: 2, shape: (a) => 1 - 0.1 * Math.pow(Math.abs(Math.sin(a * 5)), 0.55) },
  ).paint((x, y, z) => {
    const rib = Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 5)), 0.5)
    return mix(rgb(0xc8580f), rgb(0xf58a24), 0.55 + 0.35 * rib - 0.25 * smoothstep(0.03, -0.07, y))
  }, 0)
  const stem = tube(
    [
      [0, 0.04, 0],
      [0.003, 0.07, 0.001],
      [0.012, 0.09, 0.005],
    ],
    [0.012, 0.009, 0.008],
    { seg: 8, steps: 2, caps: [true, true], shape: (a) => 1 - 0.14 * Math.abs(Math.sin(a * 3)) },
  ).paint((_x, y) => mix(rgb(0x6b5a32), rgb(0x8d8a48), smoothstep(0.05, 0.09, y)), 0)
  const curl: V3[] = []
  for (let j = 0; j <= 24; j++) {
    const t = j / 24
    curl.push([0.012 + 0.07 * t + 0.012 * Math.cos(t * Math.PI * 5), 0.062 + 0.012 * Math.sin(t * Math.PI * 5), 0.02 + 0.012 * Math.sin(t * Math.PI * 5)])
  }
  const leaf = merge(
    tube(curl, 0.0022, { seg: 5, steps: 1, caps: [true, false], round: [0, 0.002] }).fill(rgb(0x6f9f45), 0),
    blade({ length: 0.13, width: 0.15, outline: (u) => Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 + 0.12 * Math.sin(u * Math.PI * 5)), fold: 0.3, bend: -0.25, segL: 8, segW: 3 })
      .paint((x, _y, z) => mix(rgb(0x3f7f32), rgb(0x7ab452), 0.6 * smoothstep(0, 0.13, z) + 0.3 * smoothstep(0.02, 0, Math.abs(x))), 0)
      .place([0, 0, 0], [-0.25, 0, 0])
      .place([-0.01, 0.06, -0.012], [0, Math.PI + 0.7, 0]),
  )
  return grounded({ body: { shape: body, material: { roughness: 0.45 } }, stem: { shape: stem, material: { roughness: 0.7 } }, leaf: { shape: leaf, material: leafy } })
}

/** A sheaf of wheat: stalks bound with twine in the middle, fanning out to their bearded ears. */
function wheat(): Structure<'sheaf'> {
  const parts: Shape[] = []
  const N = 7
  for (let k = 0; k < N; k++) {
    const u = (k / (N - 1)) * 2 - 1
    const back = (k % 2) * 0.012
    const foot: V3 = [u * 0.03, 0, back * 0.6]
    const tie: V3 = [u * 0.008, 0.12, back * 0.3]
    const top: V3 = [u * 0.075, 0.3 - Math.abs(u) * 0.035, back - 0.006]
    parts.push(tube([foot, tie, top], 0.0038, { seg: 6, steps: 3, caps: [true, true] }).fill(rgb(0xd8b45a), 0))
    // the ear, on along the line the stalk ends on: two rows of plump grains, and its beard
    const d = [top[0] - tie[0], top[1] - tie[1], top[2] - tie[2]]
    const l = Math.hypot(d[0], d[1], d[2])
    const at = (s: number): V3 => [top[0] + (d[0] / l) * s, top[1] + (d[1] / l) * s, top[2] + (d[2] / l) * s]
    parts.push(
      tube([at(-0.004), at(0.016), at(0.04), at(0.066), at(0.076)], [0.004, 0.009, 0.0105, 0.007, 0.003], {
        seg: 8,
        steps: 3,
        round: [0.002, 0.004],
        shape: (a, t) => 1 + 0.26 * Math.max(0, Math.sin(t * Math.PI * 7 + (Math.cos(a) > 0 ? 0 : Math.PI))) * Math.abs(Math.cos(a)),
      }).paint((_x, y) => mix(rgb(0xc99a3e), rgb(0xf0c862), smoothstep(top[1], top[1] + 0.06, y)), 0),
    )
    for (let w = 0; w < 3; w++) {
      const side = (w - 1) * 0.012
      const tip = at(0.12)
      parts.push(tube([at(0.06), [tip[0] + side, tip[1] - Math.abs(side), tip[2]]], [0.0013, 0], { seg: 4, steps: 1 }).fill(rgb(0xe9cf86), 0))
    }
  }
  const band: V3[] = []
  for (let j = 0; j <= 24; j++) {
    const t = (j / 24) * Math.PI * 2
    band.push([Math.cos(t) * 0.013, 0.12, 0.004 + Math.sin(t) * 0.01])
  }
  parts.push(tube(band, 0.0042, { seg: 6, steps: 1, caps: [true, true] }).fill(rgb(0xa8753a), 0))
  return { sheaf: { shape: merge(...parts), material: { roughness: 0.65 } } }
}

/** Three cut canes of sugar cane: thick and closely jointed, red-brown at the foot, the tallest still in leaf. */
function sugarcane(): Structure<'cane' | 'leaves'> {
  const r = 0.021
  const node = (t: number, n: number) => {
    const f = (t * n) % 1
    return Math.min(f, 1 - f)
  }
  const canes: Shape[] = []
  const leaves: Shape[] = []
  const stand: [number, number, number, number][] = [
    [-0.036, 0.004, 0.16, 0.38],
    [0, -0.004, 0.0, 0.46],
    [0.036, 0.006, -0.18, 0.34],
  ]
  for (const [x, z, lean, L] of stand) {
    const n = Math.round(L / 0.06)
    const cane = loft(
      [
        { c: [0, 0, 0], rx: r, ry: r },
        { c: [0, L, 0], rx: r, ry: r },
      ],
      { seg: 16, steps: n * 6, up: [0, 0, 1], caps: [true, true], shape: (_a, t) => 1 + 0.1 * Math.exp(-(node(t, n) ** 2) / 0.0015) },
    )
    const cut = cane.ends ?? cane.count
    cane
      .paint((_x, y, _z, k) => (k >= cut ? rgb(0xf3e9b8) : mix(rgb(0x9a5f45), rgb(0xc9c25a), smoothstep(0.02, L * 0.9, y))), 0)
      .pattern((_x, y) => smoothstep(0.04, 0.0, node(y / L, n)), rgb(0x4e3f24))
    canes.push(cane.place([x, 0, z], [0, 0, lean]))
    if (L > 0.45)
      for (let b = 0; b < 3; b++)
        leaves.push(
          blade({ length: 0.2, width: 0.032, fold: 0.4, bend: -0.9, segL: 9, segW: 1 })
            .paint((_x, _y, zz) => mix(rgb(0x5f9a3a), rgb(0x9ccc5a), smoothstep(0, 0.2, zz)), 0)
            .place([0, L - 0.01, 0], [-Math.PI / 2 + 0.5, (b / 3) * Math.PI * 2 + 0.6, 0])
            .place([x, 0, z], [0, 0, lean]),
        )
  }
  return grounded({ cane: { shape: merge(...canes), material: { roughness: 0.45 } }, leaves: { shape: merge(...leaves), material: leafy } })
}

/** Two eggs lying side by side: a white one and a speckled brown one. */
function eggs(): Structure<'eggs'> {
  const profile: [number, number][] = [
    [0, -0.5],
    [0.3, -0.44],
    [0.48, -0.22],
    [0.5, 0.02],
    [0.42, 0.3],
    [0.24, 0.5],
    [0, 0.56],
  ]
  const egg = (at: V3, yaw: number, paint: (x: number, y: number, z: number) => V3) =>
    lathe(
      profile.map(([rr, y]) => [rr * 0.06, y * 0.06]),
      { seg: 32, steps: 3 },
    )
      .place([0, 0, 0], [Math.PI / 2, 0, 0])
      .place(at, [0, yaw, 0])
      .paint(paint, 0)
  const white = egg([-0.03, 0.03, 0], -0.3, (_x, y) => mix(rgb(0xe9dfcc), rgb(0xfbf7ef), smoothstep(0.0, 0.05, y)))
  const brown = egg([0.0285, 0.03, 0.01], 0.4, (x, y, z) =>
    mix(mix(rgb(0xb07a48), rgb(0xd8a571), smoothstep(0.0, 0.05, y)), rgb(0x8a5a32), smoothstep(0.72, 0.82, noise3(x * 500, y * 500, z * 500, 4))),
  )
  return { eggs: { shape: merge(white, brown), material: { roughness: 0.45 } } }
}

/** A glass bottle of milk with a blue cap. */
function milk(): Structure<'bottle' | 'cap'> {
  const bottle = lathe(
    [
      [0, 0],
      [0.07, 0.002],
      [0.078, 0.02],
      [0.08, 0.17],
      [0.07, 0.22],
      [0.042, 0.27],
      [0.036, 0.3],
      [0.0, 0.302],
    ],
    { seg: 24, steps: 3 },
  ).paint((_x, y) => (y > 0.22 ? mix(CREAM, rgb(0xe9f3fb), 0.6) : y > 0.07 && y < 0.15 ? rgb(0x4d8ed1) : CREAM), 0)
  const cap = lathe(
    [
      [0, 0.288],
      [0.042, 0.29],
      [0.045, 0.31],
      [0.04, 0.322],
      [0.0, 0.325],
    ],
    { seg: 20, steps: 1 },
  ).fill(rgb(0x2f6fb8), 0)
  return { bottle: { shape: bottle, material: { roughness: 0.18, metalness: 0.05 } }, cap: { shape: cap, material: { roughness: 0.4 } } }
}

/** A ball of wool: soft, wound round with strands every which way, an end trailing. */
function wool(): Structure<'ball'> {
  const R = 0.11
  const ball = blob(R, 3, (x, y, z) => 0.04 * (fbm3(x * 6, y * 6, z * 6, 3) - 0.5))
    .place([0, R, 0])
    .paint((x, y, z) => mix(rgb(0xf8f2e6), rgb(0xe2d5bf), smoothstep(0.35, 0.75, fbm3(x * 9, y * 9, z * 9, 7))), 0)
  const loop: V3[] = []
  for (let j = 0; j <= 24; j++) {
    const t = (j / 24) * Math.PI * 2
    loop.push([Math.cos(t) * R * 1.01, Math.sin(t) * R * 1.01, 0])
  }
  const turns: V3[] = [
    [0, 0, 0],
    [0, 1.05, 0],
    [0, 2.1, 0],
    [0.9, 0.4, 0],
    [-0.7, 1.4, 0],
    [1.3, 2.6, 0],
  ]
  const strands = turns.map((r) =>
    tube(loop, 0.0065, { seg: 6, steps: 1, caps: [true, true] })
      .place([0, 0, 0], r)
      .place([0, R, 0])
      .paint((_x, y) => mix(rgb(0xd9c8aa), rgb(0xeee3cf), smoothstep(0.02, 0.2, y)), 0),
  )
  const end = tube(
    [
      [0.1, 0.06, 0.04],
      [0.16, 0.012, 0.08],
      [0.22, 0.008, 0.06],
    ],
    0.0065,
    { seg: 6, steps: 3, round: [0.004, 0.004] },
  ).fill(rgb(0xe6d9c2), 0)
  return { ball: { shape: merge(ball, ...strands, end), material: { roughness: 0.95, detail: { scale: 140, bump: 0.004, shade: 0.18 } } } }
}

/** A blue bowl heaped with sugar, three big cubes on top. */
function sugar(): Structure<'bowl' | 'sugar'> {
  const bowl = lathe(
    [
      [0, 0],
      [0.06, 0.002],
      [0.075, 0.015],
      [0.12, 0.07],
      [0.13, 0.1],
      [0.122, 0.102],
      [0.11, 0.075],
      [0.0, 0.03],
    ],
    { seg: 32, steps: 2 },
  ).paint((_x, y) => (y > 0.09 ? rgb(0xf6f1e6) : ENAMEL), 0)
  const heap = lathe(
    [
      [0.0, 0.06],
      [0.118, 0.08],
      [0.09, 0.12],
      [0.04, 0.145],
      [0.0, 0.15],
    ],
    { seg: 28, steps: 2 },
  )
    .displace((x, y, z) => 0.004 * (noise3(x * 60, y * 60, z * 60, 5) - 0.5))
    .fill(rgb(0xfdfcf7), 0)
  const h = 0.024
  const cube = (at: V3, r: V3) =>
    loft(
      [
        { c: [0, -h, 0], rx: h, ry: h },
        { c: [0, h, 0], rx: h, ry: h },
      ],
      { seg: 16, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, 8), caps: [true, true] },
    )
      .fill(rgb(0xffffff), 0)
      .place([0, 0, 0], r)
      .place(at)
  const cubes = merge(cube([0.03, 0.158, 0.005], [0.2, 0.4, 0.1]), cube([-0.035, 0.15, 0.03], [-0.1, 1.1, 0.25]), cube([-0.005, 0.15, -0.05], [0.3, 0.2, -0.2]))
  return { bowl: { shape: bowl, material: { roughness: 0.3 } }, sugar: { shape: merge(heap, cubes), material: { roughness: 0.8, detail: { scale: 260, bump: 0.002, shade: 0.12 } } } }
}

/** A sack of flour: burlap, slumped and wide, gathered and tied at the neck, open on the flour at the top. */
function flour(): Structure<'sack' | 'flour' | 'string'> {
  const sack = lathe(
    [
      [0, 0],
      [0.11, 0.004],
      [0.15, 0.03],
      [0.158, 0.07],
      [0.15, 0.13],
      [0.124, 0.19],
      [0.082, 0.232],
      [0.058, 0.252],
      [0.07, 0.268],
      [0.094, 0.284],
      [0.104, 0.294],
      [0.096, 0.3],
      [0.0, 0.28],
    ],
    {
      seg: 40,
      steps: 2,
      // wider than deep, soft creases down the sides, the cloth gathered into folds at the neck and its open
      // top falling in floppy flaps
      shape: (a, t) =>
        (1 + 0.12 * Math.cos(2 * a)) *
        (1 + 0.025 * Math.sin(a * 3 + t * 6)) *
        (1 + 0.07 * Math.sin(a * 9) * smoothstep(0.5, 0.62, t) * smoothstep(0.98, 0.85, t)) *
        (1 + 0.16 * Math.sin(a * 5 + 1) * smoothstep(0.72, 0.9, t)),
    },
  )
    .warp((x, y, z) => (y > 0.262 ? [x, y + 0.012 * Math.sin(Math.atan2(z, x) * 3 + 0.5) * smoothstep(0.262, 0.29, y), z] : [x, y, z]))
    .displace((x, y, z) => 0.003 * (fbm3(x * 30, y * 30, z * 30, 2) - 0.5))
    .paint((x, y, z) => mix(BURLAP, BURLAP_DARK, 0.55 * smoothstep(0.3, 0.7, fbm3(x * 12, y * 12, z * 12, 4)) + 0.25 * smoothstep(0.06, 0.0, y)), 0)
    // a pale band printed round it
    .pattern((_x, y) => 0.5 + (0.024 - Math.abs(y - 0.12)) * 40, rgb(0xf6eed8))
  const top = blob(0.07, 2, (x, y, z) => 0.08 * (noise3(x * 5, y * 5, z * 5, 9) - 0.5))
    .place([0, 0.284, 0], [0, 0, 0], [1.25, 0.4, 1.1])
    .fill(rgb(0xfbf8f0), 0)
  const ring: V3[] = []
  for (let j = 0; j <= 24; j++) {
    const t = (j / 24) * Math.PI * 2
    ring.push([Math.cos(t) * 0.066, 0.255, Math.sin(t) * 0.06])
  }
  const tie = merge(
    tube(ring, 0.008, { seg: 6, steps: 1, caps: [true, true] }),
    tube(
      [
        [0.066, 0.255, 0],
        [0.1, 0.22, 0.03],
        [0.11, 0.17, 0.05],
      ],
      0.006,
      { seg: 5, steps: 2, round: [0.004, 0.004] },
    ),
  ).fill(STRING, 0)
  return {
    sack: { shape: sack, material: { roughness: 0.95, detail: { scale: 220, bump: 0.003, shade: 0.16 } } },
    flour: { shape: top, material: { roughness: 0.9 } },
    string: { shape: tie, material: { roughness: 0.85 } },
  }
}

/** A roll of checked cloth lying on its side, its end unrolled a little. */
function cloth(): Structure<'roll'> {
  const r = 0.07
  const roll = loft(
    [
      { c: [-0.14, r, 0], rx: r, ry: r },
      { c: [0.14, r, 0], rx: r, ry: r },
    ],
    { seg: 24, steps: 1, up: [0, 1, 0], caps: [true, true] },
  )
  const sheet = loft(
    [
      { c: [0, 0.003, 0.0], rx: 0.14, ry: 0.003 },
      { c: [0, 0.003, 0.12], rx: 0.14, ry: 0.003 },
    ],
    { seg: 12, steps: 1, up: [0, 1, 0], shape: (a) => squircle(a, 8), caps: [true, true] },
  )
  const check = (x: number, along: number) => (Math.sin(x * 70) > 0.4 || Math.sin(along * 70) > 0.4 ? 1 : 0)
  const all = merge(roll, sheet)
    .fill(rgb(0x3f6fb8), 0)
    .pattern((x, y, z) => check(x, z + Math.atan2(y - r, z) * r), rgb(0xeef3fb))
  return { roll: { shape: all, material: { roughness: 0.9, detail: { scale: 320, bump: 0.002, shade: 0.1 } } } }
}

/** A round layer cake: two sponges, cream between, icing over the top running down the sides, and what is on top. */
function cake(sponge: V3, icing: V3, top: Shape): Structure<'cake' | 'top'> {
  const R = 0.12
  const body = lathe(
    [
      [0, 0],
      [R, 0.002],
      [R, 0.05],
      [R - 0.004, 0.056],
      [R, 0.062],
      [R, 0.11],
      [0.0, 0.112],
    ],
    { seg: 40, steps: 1 },
  ).paint((_x, y) => (y > 0.05 && y < 0.064 ? CREAM : mix(sponge, mix(sponge, rgb(0x5a3a1a), 0.25), smoothstep(0.03, 0.0, y))), 0)
  const drip = (a: number) => 0.024 + 0.02 * Math.max(0, Math.sin(a * 7)) + 0.012 * Math.max(0, Math.sin(a * 13 + 1))
  // the icing: a closed coat over the top, its edge running down the sides in drips, sunk into the sponge below
  const ice = lathe(
    [
      [0.0, 0.122],
      [R + 0.004, 0.12],
      [R + 0.006, 0.108],
      [R + 0.006, 0.09],
      [R - 0.004, 0.09],
      [0.0, 0.104],
    ],
    { seg: 56, steps: 1 },
  )
    .warp((x, y, z) => {
      if (y > 0.1) return [x, y, z]
      const a = Math.atan2(z, x)
      return [x, 0.11 - drip(a), z]
    })
    .fill(icing, 0)
  return { cake: { shape: merge(body, ice), material: { roughness: 0.5 } }, top: { shape: top, material: { roughness: 0.35 } } }
}

const lemonSlice = (at: V3, turn: number) =>
  lathe(
    [
      [0, -0.007],
      [0.036, -0.007],
      [0.038, 0.0],
      [0.036, 0.007],
      [0, 0.007],
    ],
    { seg: 20, steps: 1 },
  )
    .paint((x, _y, z) => (Math.hypot(x, z) > 0.031 ? LEMON : mix(rgb(0xfdeb8a), rgb(0xfbf7e4), Math.abs(Math.sin(Math.atan2(z, x) * 4)) > 0.92 ? 1 : 0)), 0)
    .place([0, 0, 0], [Math.PI / 2 - 0.5, turn, 0])
    .place(at)

const berry = (at: V3, turn: number) =>
  merge(
    lathe(
      [
        [0, -0.034],
        [0.02, -0.022],
        [0.027, 0.0],
        [0.022, 0.014],
        [0, 0.019],
      ],
      { seg: 14, steps: 2 },
    ).fill(BERRY, 0),
    around(leaflet(0.026, 0.014, -0.004, 4).fill(CALYX, 0), -0.3, 0, [0, 0.016, 0]),
    around(leaflet(0.022, 0.012, -0.004, 4).fill(CALYX, 0), -0.3, 2.3, [0, 0.016, 0]),
  )
    .place([0, 0, 0], [Math.PI, turn, 0.2])
    .place(at)

const littleCarrot = (at: V3, turn: number) =>
  merge(
    lathe(
      [
        [0, -0.04],
        [0.011, -0.024],
        [0.015, 0.0],
        [0, 0.005],
      ],
      { seg: 12, steps: 1 },
    ).fill(ORANGE, 0),
    tube(
      [
        [0, 0.002, 0],
        [0, 0.024, 0.005],
      ],
      [0.005, 0],
      { seg: 5, steps: 1, round: [0.004, 0] },
    ).fill(LEAF, 0),
  )
    .place([0, 0, 0], [Math.PI / 2 - 0.2, turn, 0])
    .place(at)

/** A pumpkin pie in a blue enamel dish: a crimped crust round an orange filling, a dollop of cream. */
function pie(): Structure<'dish' | 'pie'> {
  const R = 0.13
  const dish = lathe(
    [
      [0, 0],
      [R - 0.02, 0.002],
      [R + 0.01, 0.045],
      [R + 0.02, 0.05],
      [R - 0.01, 0.042],
      [0, 0.01],
    ],
    { seg: 40, steps: 1 },
  ).fill(ENAMEL, 0)
  const crust = lathe(
    [
      [R - 0.025, 0.035],
      [R - 0.005, 0.045],
      [R + 0.006, 0.058],
      [R - 0.01, 0.066],
      [R - 0.028, 0.058],
    ],
    { seg: 56, steps: 2, caps: [true, true], shape: (a) => 1 + 0.03 * Math.sin(a * 24) },
  ).paint((x, y, z) => mix(CRUST, rgb(0xb8742e), smoothstep(0.4, 0.8, fbm3(x * 30, y * 30, z * 30, 2))), 0)
  const filling = lathe(
    [
      [0, 0.03],
      [R - 0.02, 0.034],
      [R - 0.022, 0.054],
      [0, 0.056],
    ],
    { seg: 40, steps: 1 },
  ).fill(rgb(0xea852a), 0)
  const cream = blob(0.034, 2, (x, y, z) => 0.18 * Math.max(0, Math.sin(Math.atan2(z, x) * 6)) * smoothstep(-0.2, 0.6, y))
    .place([0, 0.072, 0], [0, 0, 0], [1, 0.75, 1])
    .fill(ICING, 0)
  return { dish: { shape: dish, material: { roughness: 0.25 } }, pie: { shape: merge(crust, filling, cream), material: { roughness: 0.6 } } }
}

// ───────────────────────────── the building materials ─────────────────────────────

/** A box with soft edges, its middle at the origin: half-sizes x, y, z (a brick, a board, an iron bar). `top`
 *  narrows the top face (an ingot), as a share of the bottom. */
function block(hx: number, hy: number, hz: number, soft = 8, top = 1): Shape {
  return loft(
    [
      { c: [0, -hy, 0], rx: hx, ry: hz },
      { c: [0, hy, 0], rx: hx * top, ry: hz * top },
    ],
    { seg: 40, steps: 1, up: [0, 0, 1], shape: (a) => squircle(a, soft), caps: [true, true] },
  )
}

const BRICK_RED = rgb(0xb4492f)
const BRICK_DARK = rgb(0x8a3322)
const PINE = rgb(0xe2b97c)
const PINE_DARK = rgb(0xb98a4e)
const STEEL = rgb(0xa9b2bb)
const STEEL_DARK = rgb(0x6f7880)
const IRON = rgb(0x5d6670)
const IRON_LIGHT = rgb(0x8c96a0)

/** Three bricks in running bond, two side by side and one across the joint on top: fired clay, a little speckled. */
function bricks(): Structure<'bricks'> {
  // (a flat face is a cap: its colour is even, so it is painted smoothly, and the fired clay's grain is the
  // material's fine detail)
  const brick = (tone: number) => block(0.1, 0.03, 0.048, 12).paint((_x, y) => mix(mix(BRICK_RED, BRICK_DARK, tone), BRICK_DARK, smoothstep(0.03, -0.03, y) * 0.35), 0)
  const a = brick(0.25).place([0, 0.03, -0.051])
  const b = brick(0.05).place([0, 0.03, 0.051])
  const top = brick(0.15).place([0.004, 0.03 + 0.058, 0], [0, Math.PI / 2 - 0.08, 0])
  return { bricks: { shape: merge(a, b, top), material: { roughness: 0.92, detail: { scale: 260, bump: 0.002, shade: 0.12 } } } }
}

/** Three planks of pine, two side by side and one across them: the grain runs along each (a plank is lofted along
 *  its length, so its long faces carry it), the sawn ends lighter. */
function planks(): Structure<'planks'> {
  const plank = (seed: number, tone: number) => {
    const p = loft(
      [
        { c: [-0.17, 0, 0], rx: 0.04, ry: 0.018 },
        { c: [0.17, 0, 0], rx: 0.04, ry: 0.018 },
      ],
      { seg: 44, steps: 1, up: [0, 1, 0], shape: (a) => squircle(a, 12), caps: [true, true] },
    )
    const ends = p.ends ?? p.count
    return p.paint((_x, y, z, k) => {
      if (k >= ends) return mix(PINE, rgb(0xf3dcae), 0.55)
      const g = 0.5 + 0.5 * Math.sin(z * 260 + 3 * noise3(z * 40, y * 40, 0.5, seed))
      return mix(mix(PINE, PINE_DARK, tone), PINE_DARK, 0.45 * smoothstep(0.55, 0.95, g))
    }, 0)
  }
  const a = plank(7, 0.15).place([0, 0.018, -0.043])
  const b = plank(8, 0.3).place([0, 0.018, 0.043])
  const top = plank(9, 0.05)
    .place([0, 0, 0], [0, Math.PI / 2 - 0.35, 0])
    .place([0.01, 0.018 + 0.034, 0])
  return { planks: { shape: merge(a, b, top), material: { roughness: 0.8 } } }
}

/** Three steel nails lying in a fan: a round head, a shank, a sharp point. */
function nails(): Structure<'nails'> {
  const nail = (turn: number, at: V3) => {
    const head = lathe(
      [
        [0, -0.004],
        [0.014, -0.0035],
        [0.015, 0.0],
        [0.012, 0.003],
        [0.0, 0.0035],
      ],
      { seg: 16, steps: 1 },
    )
    const shank = lathe(
      [
        [0.0055, -0.004],
        [0.0055, -0.11],
        [0.0045, -0.125],
        [0.0, -0.138],
      ],
      { seg: 10, steps: 1 },
    )
    // lying down: along the ground, its head's rim on it
    return merge(head, shank)
      .paint((_x, y) => mix(STEEL, STEEL_DARK, smoothstep(-0.02, -0.13, y) * 0.5), 0)
      .place([0, 0, 0], [Math.PI / 2, 0, 0])
      .place([0, 0.015, 0], [0, turn, 0])
      .place(at)
  }
  return grounded({ nails: { shape: merge(nail(-0.35, [-0.03, 0, -0.03]), nail(0.05, [0, 0, 0]), nail(0.45, [0.035, 0, -0.02])), material: { roughness: 0.32, metalness: 0.65 } } })
}

/** Two bars of iron, one across the other: dark, cast, a little lighter on their edges. */
function ironBars(): Structure<'iron'> {
  const bar = (tone: number) => block(0.12, 0.024, 0.045, 14, 0.8).paint((_x, y) => mix(IRON, IRON_LIGHT, tone + 0.3 * smoothstep(-0.024, 0.024, y)), 0)
  const low = bar(0.1).place([0, 0.024, 0])
  const high = bar(0.25).place([0, 0.024 + 0.046, 0], [0, Math.PI / 2 - 0.25, 0])
  return { iron: { shape: merge(low, high), material: { roughness: 0.5, metalness: 0.5 } } }
}

/** A hex bolt standing on its head, threaded, its nut screwed halfway up. */
function bolt(): Structure<'bolt'> {
  const hex = (r: number, y0: number, y1: number) =>
    lathe(
      [
        [0, y0],
        [r * 0.92, y0],
        [r, y0 + 0.004],
        [r, y1 - 0.004],
        [r * 0.92, y1],
        [0, y1],
      ],
      { seg: 6, steps: 1 },
    )
  const head = hex(0.034, 0, 0.026)
  const shank = lathe(
    [
      [0.0135, 0.02],
      [0.0135, 0.168],
      [0.011, 0.176],
      [0.0, 0.177],
    ],
    { seg: 14, steps: 1 },
  ).pattern((_x, y) => (y > 0.07 ? 0.5 + 0.6 * Math.sin(y * 520) : 0), STEEL_DARK)
  const nut = hex(0.03, 0.098, 0.124).place([0, 0, 0], [0, 0.4, 0])
  return { bolt: { shape: merge(head, shank, nut).paint((_x, y) => mix(STEEL, STEEL_DARK, smoothstep(0.03, 0.0, y) * 0.35), 0), material: { roughness: 0.3, metalness: 0.7 } } }
}

/** Three logs stacked, two below and one in the groove between them: bark round them, pale cut ends. */
function logs(): Structure<'logs'> {
  const pile = woodpile(
    [
      { xs: [-0.07, 0.07], r: 0.068 },
      { xs: [0], r: 0.064 },
    ],
    0.3,
    71,
  ).place([0, 0, 0], [0, Math.PI / 2, 0])
  return grounded({ logs: { shape: pile, material: { roughness: 0.9, surface: { kind: 'bark', size: 0.3, turn: true } } } })
}

export type GoodsId = ProduceId

/** Every good's model, by the produce id it stands for. */
export const GOODS: Record<GoodsId, () => Structure> = {
  lettuce,
  carrot,
  strawberry,
  tomato,
  corn,
  pumpkin,
  wheat,
  sugarcane,
  lemon,
  egg: eggs,
  milk,
  wool,
  sugar,
  flour,
  cloth,
  lemon_cake: () => cake(rgb(0xf3c14d), ICING, merge(lemonSlice([0.05, 0.132, 0.0], 0), lemonSlice([-0.03, 0.132, 0.048], 2.1), lemonSlice([-0.028, 0.132, -0.048], 4.2))),
  strawberry_cake: () => cake(rgb(0xf7e3c4), rgb(0xf6a0bd), merge(berry([0.048, 0.132, 0.0], 0), berry([-0.026, 0.132, 0.044], 2), berry([-0.026, 0.132, -0.044], 4), berry([0, 0.14, 0], 1))),
  carrot_cake: () => cake(rgb(0xbf7a3c), ICING, merge(littleCarrot([0.044, 0.13, 0.0], 0), littleCarrot([-0.022, 0.13, 0.038], 2.1), littleCarrot([-0.022, 0.13, -0.038], 4.2))),
  pumpkin_pie: pie,
  brick: bricks,
  plank: planks,
  nail: nails,
  iron: ironBars,
  bolt,
  log: logs,
}
