import { Color, Vector3 } from 'three'
import type { Parts } from '../lib/sculpt'
import type { CropId } from '../farm/data'
import { STALK_END, type CropPart } from './crops'

// How each crop looks as it grows: a grower puts one plant's parts (see crops.ts) at a spot on the soil, for a
// growth from 0 (just sown) to 1 (ripe), and a seed (0..1) that keeps each plant its own shape from frame to
// frame. Used by the garden (src/farm/Plants.tsx) and the model gallery.

export type Grower = (p: Parts<CropPart>, x: number, y: number, z: number, g: number, seed: number) => void

const color = new Color()
const size = new Vector3()

const mixHex = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k)
}
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
/** Deterministic 0..1 per plant and part, so plants keep their shape from one frame to the next. */
export const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Where to put a fruit so the end of its own stalk (`end`, in its units) is at `at` on the plant, the fruit
 *  turned by rx and then ry (as Parts.put turns it) and scaled by `size`. */
function hang(at: [number, number, number], end: readonly number[], rx: number, ry: number, size: number): [number, number, number] {
  const vx = end[0] * size
  const vy = end[1] * size
  const vz = end[2] * size
  const uy = vy * Math.cos(rx) - vz * Math.sin(rx)
  const uz = vy * Math.sin(rx) + vz * Math.cos(rx)
  const wx = vx * Math.cos(ry) + uz * Math.sin(ry)
  const wz = -vx * Math.sin(ry) + uz * Math.cos(ry)
  return [at[0] - wx, at[1] - uy, at[2] - wz]
}

const LEAF = 0x5f9a45
const LEAF_DARK = 0x4a7d36
const c = (hex: number) => color.setHex(hex)

export const GROWERS: Record<CropId, Grower> = {
  lettuce(p, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    // a rosette: broad, frilly outer leaves lying open, the inner ones standing up round the heart
    for (let k = 0; k < 9; k++) {
      const inner = k >= 5
      const a = (inner ? (k - 5) / 4 + 0.12 : k / 5) * Math.PI * 2 + seed * 6
      const len = (inner ? 0.085 : 0.12) * s * (0.9 + hash(seed, k) * 0.2)
      p.put('lettuceLeaf', x, y + 0.004, z, inner ? -0.75 : 0.12, a, 0, len, c(inner ? 0x9ccc65 : 0x6ea64a))
    }
    // the heart sits on the soil in the middle of the rosette (its squashed ball is 0.41 of its size high)
    const heart = 0.1 * s * smooth(0.35, 0.8, g)
    if (g > 0.35) p.put('lettuceHeart', x, y + 0.4 * heart, z, 0, seed * 6, 0, heart, c(0x9fcd66))
  },
  carrot(p, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + seed * 5
      p.put('frond', x, y, z, -1.15 + hash(seed, k) * 0.3, a, 0, 0.14 * s, c(k % 2 ? 0x5fa040 : 0x4f9a3a))
    }
    // the orange shoulder of the root shows at the soil as it swells
    const f = smooth(0.4, 1, g)
    if (f > 0) p.put('carrotTop', x, y - 0.004, z, 0, seed * 6, 0, 0.05 * f, c(0xe8792a))
  },
  strawberry(p, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + seed * 4
      p.put('trefoil', x, y - 0.003, z, -0.1 + hash(k, seed) * 0.2, a, 0, 0.13 * s, c(k % 2 ? LEAF : LEAF_DARK))
    }
    const f = smooth(0.5, 1, g)
    if (f <= 0) return
    // berries hang out over the leaves on stalks from the crown: white, then blushing, then red
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + seed * 3 + 0.5
      const d = 0.036 * f
      const [bx, by, bz] = hang([x, y + 0.045, z], STALK_END.strawberry, 0, a, d)
      p.put('strawberry', bx, by, bz, 0, a, 0, d, c(mixHex(0xe8f0c8, 0xd8213a, smooth(0.8, 1, g))))
    }
  },
  tomato(p, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    p.put('stalk', x + 0.035, y, z, 0, 0, 0, size.set(0.008, 0.95, 0.008), c(0x9a7a50)) // the cane it is tied to
    p.put('stem', x, y, z, 0, 0, 0, size.set(0.011, 0.8 * s, 0.011), c(0x4f7a32))
    for (let k = 0; k < 8; k++) {
      const h = (0.1 + (k / 8) * 0.66) * s
      const a = k * 2.4 + seed * 3
      p.put('tomatoLeaf', x, y + h, z, -0.15, a, 0, 0.17 * s, c(k % 2 ? LEAF : LEAF_DARK))
    }
    const f = smooth(0.5, 1, g)
    if (f <= 0) return
    // tomatoes hang in trusses from the stem, each on its own stalk
    for (let k = 0; k < 6; k++) {
      const h = (0.28 + hash(seed, k) * 0.36) * s
      const a = k * 2.1 + seed * 2
      const d = 0.062 * f * (0.85 + hash(seed, k + 9) * 0.3)
      const [tx, ty, tz] = hang([x, y + h, z], STALK_END.tomato, 0, a, d)
      p.put('tomato', tx, ty, tz, 0, a, 0, d, c(mixHex(0x7fae3e, 0xd8342a, smooth(0.82, 1, g) * (0.75 + hash(k, 3) * 0.25))))
    }
  },
  corn(p, x, y, z, g, seed) {
    const s = 0.15 + 0.85 * easeOut(g)
    const h = 1.35 * s
    p.put('stalk', x, y, z, 0, 0, 0, size.set(0.022, h, 0.022), c(0x6f9a3a))
    // long blades, arching up and out from the stalk, alternating sides
    for (let k = 0; k < 8; k++) {
      const a = (k % 2 ? Math.PI : 0) + seed * 4 + k * 0.35
      p.put('grassBlade', x, y + (0.1 + k * 0.14) * s, z, -0.8 + k * 0.06, a, 0, 0.5 * s, c(k % 2 ? 0x6fa040 : 0x5f9035))
    }
    if (g > 0.7) p.put('tassel', x, y + h - 0.02, z, 0, seed * 6, 0, 0.17 * smooth(0.7, 1, g), c(0xd8c27a))
    const f = smooth(0.55, 1, g)
    if (f <= 0) return
    // cobs grow on their shanks from the stalk, leaning out
    for (let k = 0; k < 2; k++) {
      const a = seed * 5 + k * Math.PI
      const size = 0.17 * f
      const [cx, cy, cz] = hang([x, y + (0.55 + k * 0.14) * s, z], STALK_END.cob, 0.4, a, size)
      p.put('cob', cx, cy, cz, 0.4, a, 0, size, c(mixHex(0xb8cf7a, 0xf3cf4a, smooth(0.85, 1, g))))
    }
  },
  sugarcane(p, x, y, z, g, seed) {
    const s = 0.12 + 0.88 * easeOut(g)
    const ripe = smooth(0.8, 1, g)
    // a clump of tall jointed canes with a crown of long blades; they turn from green to gold as they ripen
    for (let k = 0; k < 3; k++) {
      const a = seed * 6 + k * 2.1
      const ox = Math.sin(a) * 0.05
      const oz = Math.cos(a) * 0.05
      const h = (1.75 + hash(seed, k) * 0.35) * s
      const lean = (hash(k, seed) - 0.5) * 0.12
      p.put('stalk', x + ox, y, z + oz, lean, a, 0, size.set(0.02, h, 0.02), c(mixHex(0x7fae3e, 0xc2a04f, ripe * (0.8 + hash(seed, k + 3) * 0.2))))
      const tx = x + ox + Math.sin(a) * Math.sin(lean) * h
      const tz = z + oz + Math.cos(a) * Math.sin(lean) * h
      for (let j = 0; j < 4; j++) p.put('grassBlade', tx, y + h * (0.88 + j * 0.03), tz, -0.55 + j * 0.15, a + j * 1.6, 0, 0.55 * s, c(j % 2 ? 0x6fa040 : 0x5f9035))
    }
  },
  wheat(p, x, y, z, g, seed) {
    const s = 0.15 + 0.85 * easeOut(g)
    const ripe = smooth(0.75, 1, g)
    const stalk = mixHex(0x8fb35a, 0xcfae5c, ripe)
    const ear = mixHex(0x9fbf5a, 0xd9b45a, ripe)
    for (let k = 0; k < 3; k++) {
      const a = seed * 5 + k * 2.1
      const ox = Math.sin(a) * 0.035
      const oz = Math.cos(a) * 0.035
      const h = (0.62 + hash(seed, k) * 0.14) * s
      const lean = (hash(k, seed) - 0.5) * 0.18 + ripe * 0.12 // heavy ears nod a little
      p.put('stem', x + ox, y, z + oz, lean, a, 0, size.set(0.005, h, 0.005), c(stalk))
      if (g > 0.35) p.put('wheatEar', x + ox + Math.sin(a) * Math.sin(lean) * h, y + Math.cos(lean) * h, z + oz + Math.cos(a) * Math.sin(lean) * h, lean + 0.1 * ripe, a, 0, 0.085 * s, c(ear))
    }
    p.put('grassBlade', x, y, z, -1.0, seed * 9, 0, 0.28 * s, c(0x7fa84a))
  },
  pumpkin(p, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + seed * 3
      const r = (0.04 + hash(seed, k) * 0.05) * s
      p.put('pumpkinLeaf', x + Math.sin(a) * r, y, z + Math.cos(a) * r, -0.05, a, 0, 0.32 * s, c(k % 2 ? LEAF : LEAF_DARK))
    }
    const f = smooth(0.35, 1, g)
    if (f <= 0) return
    const r = 0.17 * f
    p.put('pumpkin', x, y + r * 0.64, z, 0, seed * 6, 0, r, c(mixHex(0x6f8f3a, 0xe2741e, smooth(0.75, 1, g))))
  },
}

/** A lemon hanging on the tree from a twig at (x, y, z), up in the leaves (see lemonSpots in structures.ts). */
export function putLemon(p: Parts<CropPart>, x: number, y: number, z: number, k: number) {
  // (x, y, z) is where its stalk holds on: the lemon hangs below, swinging a little off the vertical
  const rx = 0.12 + (k % 3) * 0.07
  const ry = k * 1.7
  const [px, py, pz] = hang([x, y, z], STALK_END.lemon, rx, ry, 0.075)
  p.put('lemon', px, py, pz, rx, ry, 0, 0.075, c(0xf2d43a))
}

/** How high an egg's middle sits above what it lies on (it lies on its side). */
const EGG_REST = 0.5 * 0.058

/** An egg lying on its side on the floor of the nest (`floor`: the height of the straw it rests on). */
export function putEgg(p: Parts<CropPart>, x: number, floor: number, z: number, k: number) {
  p.put('egg', x, floor + EGG_REST, z, Math.PI / 2, k * 1.3, 0, 0.058, c(k % 3 === 1 ? 0xc99a6b : 0xf1e6d0))
}
