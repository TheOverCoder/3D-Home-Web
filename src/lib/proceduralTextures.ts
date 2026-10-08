import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import type { FloorKind } from '../data/layout'

// Stand-in PBR surfaces generated on canvases (colour + normal + roughness). Real PBR sets from
// Poly Haven etc. replace these later; until then rooms still get believable grain, grout and weave.

const SIZE = 512

export interface Surface {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** Tileable value noise with `cx` × `cy` lattice cells. */
function noise2(cx: number, cy: number, seed: number) {
  const r = rng(seed)
  const grid = new Float32Array(cx * cy)
  for (let i = 0; i < grid.length; i++) grid[i] = r()
  const at = (x: number, y: number) => grid[(((y % cy) + cy) % cy) * cx + (((x % cx) + cx) % cx)]
  return (u: number, v: number) => {
    const x = u * cx
    const y = v * cy
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = at(x0, y0)
    const b = at(x0 + 1, y0)
    const c = at(x0, y0 + 1)
    const d = at(x0 + 1, y0 + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

function fbm(cells: number, seed: number, octaves = 4, stretchY = 1) {
  const layers = Array.from({ length: octaves }, (_, i) => noise2(cells * 2 ** i, Math.round(cells * stretchY) * 2 ** i, seed + i * 31))
  return (u: number, v: number) => {
    let sum = 0
    let amp = 0.5
    let norm = 0
    for (const n of layers) {
      sum += n(u, v) * amp
      norm += amp
      amp *= 0.5
    }
    return sum / norm
  }
}

type Painter = (u: number, v: number, i: number) => { r: number; g: number; b: number; h: number; rough: number }

function make(paint: Painter, normalStrength: number, seedless = true): Surface {
  void seedless
  const color = document.createElement('canvas')
  const rough = document.createElement('canvas')
  const normal = document.createElement('canvas')
  for (const c of [color, rough, normal]) c.width = c.height = SIZE
  const cctx = color.getContext('2d')!
  const rctx = rough.getContext('2d')!
  const nctx = normal.getContext('2d')!
  const cimg = cctx.createImageData(SIZE, SIZE)
  const rimg = rctx.createImageData(SIZE, SIZE)
  const heights = new Float32Array(SIZE * SIZE)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x
      const p = paint(x / SIZE, y / SIZE, i)
      heights[i] = p.h
      const o = i * 4
      cimg.data[o] = p.r
      cimg.data[o + 1] = p.g
      cimg.data[o + 2] = p.b
      cimg.data[o + 3] = 255
      const rv = Math.max(0, Math.min(255, p.rough * 255))
      rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = rv
      rimg.data[o + 3] = 255
    }
  }
  cctx.putImageData(cimg, 0, 0)
  rctx.putImageData(rimg, 0, 0)

  // height → tangent-space normal (wraps at the edges so the texture stays tileable)
  const nimg = nctx.createImageData(SIZE, SIZE)
  const hAt = (x: number, y: number) => heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)]
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const nx = -(hAt(x + 1, y) - hAt(x - 1, y)) * normalStrength
      const ny = (hAt(x, y + 1) - hAt(x, y - 1)) * normalStrength
      const len = Math.hypot(nx, ny, 1)
      const o = (y * SIZE + x) * 4
      nimg.data[o] = (nx / len * 0.5 + 0.5) * 255
      nimg.data[o + 1] = (ny / len * 0.5 + 0.5) * 255
      nimg.data[o + 2] = (1 / len * 0.5 + 0.5) * 255
      nimg.data[o + 3] = 255
    }
  }
  nctx.putImageData(nimg, 0, 0)

  const tex = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(canvas)
    t.wrapS = t.wrapT = RepeatWrapping
    t.anisotropy = 8
    if (srgb) t.colorSpace = SRGBColorSpace
    return t
  }
  return { map: tex(color, true), normalMap: tex(normal, false), roughnessMap: tex(rough, false) }
}

// ───────────────────────── surfaces ─────────────────────────

function wood(): Surface {
  const planks = 6
  const grain = fbm(2, 11, 4, 40) // long streaks along u
  const tone = fbm(3, 7, 3)
  const r = rng(5)
  const plankTone = Array.from({ length: planks }, () => 0.8 + r() * 0.35)
  const joint = Array.from({ length: planks }, () => r())
  return make((u, v) => {
    const row = Math.min(planks - 1, Math.floor(v * planks))
    const within = v * planks - row
    const segment = u > joint[row] ? 1 : 0 // one butt joint per plank row
    const groove = within < 0.025 || within > 0.975 ? 1 : 0
    const jointGroove = Math.abs(u - joint[row]) < 0.004 || Math.abs(u - joint[row] - 1) < 0.004 ? 1 : 0
    const g = grain(u, v)
    const t = (plankTone[row] + segment * 0.06) * (0.82 + g * 0.36) + (tone(u, v) - 0.5) * 0.15
    const dark = groove || jointGroove ? 0.45 : 1
    return {
      r: Math.min(255, 205 * t * dark),
      g: Math.min(255, 160 * t * dark),
      b: Math.min(255, 118 * t * dark),
      h: (g - 0.5) * 0.35 - (groove || jointGroove ? 1.2 : 0),
      rough: groove || jointGroove ? 0.9 : 0.42 + (1 - g) * 0.25,
    }
  }, 6)
}

function tile(): Surface {
  const n = 4
  const speckle = fbm(16, 3, 3)
  const r = rng(9)
  const shade = Array.from({ length: n * n }, () => 0.93 + r() * 0.07)
  return make((u, v) => {
    const fu = (u * n) % 1
    const fv = (v * n) % 1
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv)
    const grout = edge < 0.022
    const bevel = Math.min(1, Math.max(0, (edge - 0.022) / 0.03))
    const s = shade[Math.floor(v * n) * n + Math.floor(u * n)] * (0.97 + speckle(u, v) * 0.06)
    const c = grout ? 150 : 235 * s
    return { r: c, g: c, b: c * 0.99, h: grout ? -1 : bevel * 0.25, rough: grout ? 0.9 : 0.2 }
  }, 5)
}

function carpet(): Surface {
  const fine = fbm(128, 21, 3)
  const mottled = fbm(6, 4, 3)
  return make((u, v) => {
    const f = fine(u, v)
    const m = 0.9 + mottled(u, v) * 0.18
    const c = 205 * m * (0.88 + f * 0.24)
    return { r: c, g: c, b: c, h: f, rough: 1 }
  }, 2.2)
}

function plaster(): Surface {
  const peel = fbm(24, 14, 4)
  const cloud = fbm(3, 2, 3)
  return make((u, v) => {
    const c = 244 * (0.965 + peel(u, v) * 0.035 + (cloud(u, v) - 0.5) * 0.03)
    return { r: c, g: c, b: c, h: peel(u, v), rough: 0.88 + peel(u, v) * 0.1 }
  }, 1.6)
}

function fabric(): Surface {
  const fuzz = fbm(64, 8, 2)
  return make((u, v) => {
    const warp = Math.sin(u * Math.PI * 2 * 96) * 0.5 + 0.5
    const weft = Math.sin(v * Math.PI * 2 * 96) * 0.5 + 0.5
    const weave = (warp * (u * 96 % 2 < 1 ? 1 : 0.4) + weft * (u * 96 % 2 < 1 ? 0.4 : 1)) * 0.5
    const c = 235 * (0.92 + fuzz(u, v) * 0.08)
    return { r: c, g: c, b: c, h: weave + fuzz(u, v) * 0.3, rough: 0.95 }
  }, 1.8)
}

function grass(): Surface {
  const blades = fbm(96, 33, 3)
  const patch = fbm(5, 17, 3)
  return make((u, v) => {
    const b = blades(u, v)
    const p = patch(u, v)
    const k = 0.75 + b * 0.35 + (p - 0.5) * 0.35
    return { r: 92 * k, g: 128 * k, b: 66 * k, h: b, rough: 1 }
  }, 2.5)
}

function skin(): Surface {
  const pores = fbm(180, 41, 2)
  const mottle = fbm(7, 13, 3)
  return make((u, v) => {
    const m = 0.93 + mottle(u, v) * 0.1
    const c = 245 * m
    return { r: c, g: c * 0.97, b: c * 0.95, h: pores(u, v), rough: 0.5 + pores(u, v) * 0.15 }
  }, 1.1)
}


// ─────────────── furniture materials ───────────────
// Neutral, tint-able maps: the prop's `color` multiplies them, `roughness` scales the roughness map.
// They are projected onto boxes in metres (see boxProject) so grain and weave keep a real-world size.

/** Tileable cellular noise: distance to the nearest of a jittered point per cell. */
function worley(cells: number, seed: number) {
  const r = rng(seed)
  const pts = Array.from({ length: cells * cells }, () => [r(), r()] as const)
  return (u: number, v: number) => {
    const x = u * cells
    const y = v * cells
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    let best = 9
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const gx = cx + i
        const gy = cy + j
        const p = pts[((gy % cells) + cells) % cells * cells + (((gx % cells) + cells) % cells)]
        const d = Math.hypot(gx + p[0] - x, gy + p[1] - y)
        if (d < best) best = d
      }
    }
    return Math.min(1, best)
  }
}

/** Veneered wood: fine pores along u with a slow cathedral figure. */
function veneer(): Surface {
  const pores = fbm(3, 61, 4, 90)
  const figure = fbm(2, 63, 3, 6)
  const tone = fbm(4, 65, 3)
  return make((u, v) => {
    const warp = figure(u, v) * 3.2
    const ring = Math.abs(Math.sin((v + warp * 0.18) * Math.PI * 2 * 5))
    const g = pores(u, v)
    const k = 0.84 + ring * 0.12 + g * 0.1 + (tone(u, v) - 0.5) * 0.12
    return { r: 250 * k, g: 244 * k, b: 238 * k, h: g * 0.5 + ring * 0.3, rough: 0.9 + (1 - g) * 0.15 }
  }, 3.2)
}

/** Pebbled leather. */
function leather(): Surface {
  const cell = worley(26, 71)
  const mottle = fbm(5, 73, 3)
  return make((u, v) => {
    const d = cell(u, v)
    const crease = d > 0.82 ? 0.78 : 1
    const k = (0.9 + mottle(u, v) * 0.14) * crease
    return { r: 250 * k, g: 248 * k, b: 246 * k, h: Math.sqrt(Math.min(1, d * 1.2)) - (d > 0.82 ? 0.5 : 0), rough: 0.62 + (1 - d) * 0.25 }
  }, 3)
}

/** Brushed metal: streaks along u. */
function brushed(): Surface {
  const streak = fbm(1, 81, 3, 260)
  const fine = fbm(2, 83, 2, 500)
  const wash = fbm(3, 85, 3)
  return make((u, v) => {
    const s = streak(u, v)
    const f = fine(u, v)
    const k = 0.9 + s * 0.06 + f * 0.04 + (wash(u, v) - 0.5) * 0.06
    return { r: 250 * k, g: 250 * k, b: 252 * k, h: (s + f) * 0.4, rough: 0.82 + s * 0.2 }
  }, 0.35)
}

/** Polished stone / quartz with soft veining. */
function stone(): Surface {
  const warp = fbm(3, 91, 4)
  const speck = fbm(90, 93, 2)
  const cloud = fbm(4, 95, 3)
  return make((u, v) => {
    const w = warp(u, v) * 6
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 2 + v * 1 + w) * Math.PI)), 14)
    const k = 0.93 + cloud(u, v) * 0.07 + speck(u, v) * 0.03 - vein * 0.16
    return { r: 250 * k, g: 250 * k, b: 248 * k, h: speck(u, v) * 0.15, rough: 0.7 + speck(u, v) * 0.2 }
  }, 0.9)
}

/** Satin paint / lacquer: a faint orange-peel texture. */
function paint(): Surface {
  const peel = fbm(70, 101, 3)
  const wash = fbm(3, 103, 3)
  return make((u, v) => {
    const k = 0.965 + peel(u, v) * 0.035 + (wash(u, v) - 0.5) * 0.03
    return { r: 252 * k, g: 252 * k, b: 252 * k, h: peel(u, v), rough: 0.85 + peel(u, v) * 0.12 }
  }, 1)
}

/** Houseplant leaf: midrib, side veins and a lighter edge (mapped onto a lens-shaped card). */
function leaf(): Surface {
  const mottle = fbm(8, 111, 3)
  return make((u, v) => {
    const across = Math.abs(u - 0.5) * 2 // 0 at the midrib → 1 at the edge
    const rib = Math.max(0, 1 - across * 14)
    const side = Math.pow(Math.abs(Math.sin((v * 9 - across * 2.4) * Math.PI)), 12) * (1 - across) * 0.55
    const k = 0.78 + mottle(u, v) * 0.3
    const vein = Math.max(rib, side)
    return { r: (60 + vein * 70) * k, g: (118 + vein * 55) * k, b: (62 + vein * 40) * k, h: -vein * 0.6 + mottle(u, v) * 0.1, rough: 0.55 }
  }, 3)
}

const base: Record<string, Surface> = {}
const builders = { wood, tile, carpet, plaster, fabric, grass, skin, veneer, leather, brushed, stone, paint, leaf }

export type MaterialKind = 'veneer' | 'leather' | 'fabric' | 'brushed' | 'stone' | 'paint'
export type SurfaceKind = FloorKind | 'plaster' | 'fabric' | 'grass' | 'skin' | 'leaf' | MaterialKind

/** A surface with its own UV repeat (textures share their canvases, so this is cheap). */
export function surface(kind: SurfaceKind, repeatX: number, repeatY: number): Surface {
  const src = (base[kind] ??= builders[kind]())
  const copy = (t: Texture): Texture => {
    const c = t.clone()
    c.needsUpdate = true
    c.repeat.set(repeatX, repeatY)
    return c
  }
  return { map: copy(src.map), normalMap: copy(src.normalMap), roughnessMap: copy(src.roughnessMap) }
}

export type { Texture }

/** The shared, un-cloned maps of a furniture material (UVs are in "tiles", so no per-use repeat is needed). */
export function material(kind: MaterialKind | 'leaf'): Surface {
  return (base[kind] ??= builders[kind]())
}

/**
 * Swaps individual maps of a surface for real photographic ones (see src/assets/README.md → textures).
 * Must run before the scene is built; anything not supplied keeps its generated map.
 */
export function overrideSurface(kind: SurfaceKind | 'leaf', maps: Partial<Surface>) {
  const current = (base[kind] ??= builders[kind]())
  base[kind] = { map: maps.map ?? current.map, normalMap: maps.normalMap ?? current.normalMap, roughnessMap: maps.roughnessMap ?? current.roughnessMap }
}
