import { BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'

// The sculpt kit's building block: a mesh under construction — positions, colours, a tint mask and triangles —
// that shapes are made into, painted, bent and merged before it becomes one BufferGeometry. Everything a model
// needs is in its vertices (colour per vertex, no textures), so a whole animal or plant is one small geometry that
// can be instanced by the hundred.
//
// The tint mask (0..1 per vertex) says how much of an instance's own colour applies there: a coat or a shirt
// follows the instance colour (tint 1), eyes and hooves do not (tint 0). See material.ts.
//
// Colours come in two layers: every vertex has a base colour and a pattern colour, and a pattern value that says
// which shows (below 0.5 the base, above it the pattern). The edge between them is found per pixel, so patches,
// spots and stripes come out crisp and smooth however few triangles they fall across.
//
//   paint    the colour of both layers (the base of everything)
//   pattern  where the second colour shows, and what it is (a cow's patches)
//   blend    a soft wash of a colour over both layers (a pink muzzle, white socks, a darker face)
//   shade    darker or lighter by position (underneath, in creases)

export type V3 = [number, number, number]

const col = new Color()
/** sRGB hex → the linear RGB the renderer works in. */
export function rgb(hex: number): V3 {
  col.setHex(hex)
  return [col.r, col.g, col.b]
}
export const mixRgb = (a: V3, b: V3, t: number): V3 => {
  const k = Math.max(0, Math.min(1, t))
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
}

export class Shape {
  p: number[] = [] // x, y, z
  c: number[] = [] // base colour: r, g, b (linear)
  c2: number[] = [] // pattern colour
  m: number[] = [] // pattern value: the pattern colour shows above 0.5
  t: number[] = [] // tint mask
  i: number[] = [] // triangles

  get count() {
    return this.p.length / 3
  }

  vertex(x: number, y: number, z: number, color: V3 = [1, 1, 1], tint = 1) {
    this.p.push(x, y, z)
    this.c.push(color[0], color[1], color[2])
    this.c2.push(color[0], color[1], color[2])
    this.m.push(0)
    this.t.push(tint)
    return this.count - 1
  }

  tri(a: number, b: number, c: number) {
    this.i.push(a, b, c)
  }

  /** Appends another shape (its triangles keep pointing at its own vertices). */
  add(...others: Shape[]) {
    for (const o of others) {
      const base = this.count
      for (const v of o.p) this.p.push(v)
      for (const v of o.c) this.c.push(v)
      for (const v of o.c2) this.c2.push(v)
      for (const v of o.m) this.m.push(v)
      for (const v of o.t) this.t.push(v)
      for (const k of o.i) this.i.push(k + base)
    }
    return this
  }

  clone() {
    const s = new Shape()
    s.p = this.p.slice()
    s.c = this.c.slice()
    s.c2 = this.c2.slice()
    s.m = this.m.slice()
    s.t = this.t.slice()
    s.i = this.i.slice()
    return s
  }

  transform(m: Matrix4) {
    const v = new Vector3()
    for (let k = 0; k < this.p.length; k += 3) {
      v.set(this.p[k], this.p[k + 1], this.p[k + 2]).applyMatrix4(m)
      this.p[k] = v.x
      this.p[k + 1] = v.y
      this.p[k + 2] = v.z
    }
    // a mirror (negative determinant) turns triangles inside out: flip their winding back
    if (m.determinant() < 0) for (let k = 0; k < this.i.length; k += 3) [this.i[k + 1], this.i[k + 2]] = [this.i[k + 2], this.i[k + 1]]
    return this
  }

  /** Moves, turns (Euler XYZ, radians) and scales, in that order of application: scale, rotate, then move. */
  place(at: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1) {
    const s = typeof scale === 'number' ? [scale, scale, scale] : scale
    return this.transform(new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(rot[0], rot[1], rot[2], 'XYZ')), new Vector3(s[0], s[1], s[2])))
  }

  /** A mirrored copy across x = 0 (left and right of a symmetric animal). */
  mirrored() {
    return this.clone().transform(new Matrix4().makeScale(-1, 1, 1))
  }

  /** Sets the colour of both layers (and optionally the tint mask) per vertex; return null to leave a vertex as
   *  it is. */
  paint(fn: (x: number, y: number, z: number, k: number) => V3 | null, tint?: number | ((x: number, y: number, z: number) => number)) {
    for (let k = 0; k < this.count; k++) {
      const x = this.p[k * 3]
      const y = this.p[k * 3 + 1]
      const z = this.p[k * 3 + 2]
      const c = fn(x, y, z, k)
      if (c) {
        for (let j = 0; j < 3; j++) this.c[k * 3 + j] = this.c2[k * 3 + j] = c[j]
        if (tint !== undefined) this.t[k] = typeof tint === 'number' ? tint : tint(x, y, z)
      }
    }
    return this
  }

  /** One colour (and tint) for the whole shape, with no pattern. */
  fill(color: V3, tint = 1) {
    for (let k = 0; k < this.count; k++) {
      for (let j = 0; j < 3; j++) this.c[k * 3 + j] = this.c2[k * 3 + j] = color[j]
      this.m[k] = 0
      this.t[k] = tint
    }
    return this
  }

  /** A pattern in a second colour: it shows where `fn` is above 0.5 (give it smooth values — noise, distances —
   *  and the edge is drawn crisp and smooth where they cross 0.5). */
  pattern(fn: (x: number, y: number, z: number) => number, color: V3 | ((x: number, y: number, z: number) => V3)) {
    for (let k = 0; k < this.count; k++) {
      const x = this.p[k * 3]
      const y = this.p[k * 3 + 1]
      const z = this.p[k * 3 + 2]
      this.m[k] = fn(x, y, z)
      const c = typeof color === 'function' ? color(x, y, z) : color
      for (let j = 0; j < 3; j++) this.c2[k * 3 + j] = c[j]
    }
    return this
  }

  /** Washes both layers towards a colour, by an amount (0..1) from position: soft markings over a pattern. */
  blend(color: V3 | ((x: number, y: number, z: number) => V3), amount: (x: number, y: number, z: number) => number) {
    for (let k = 0; k < this.count; k++) {
      const x = this.p[k * 3]
      const y = this.p[k * 3 + 1]
      const z = this.p[k * 3 + 2]
      const a = Math.max(0, Math.min(1, amount(x, y, z)))
      if (a <= 0) continue
      const c = typeof color === 'function' ? color(x, y, z) : color
      for (let j = 0; j < 3; j++) {
        this.c[k * 3 + j] += (c[j] - this.c[k * 3 + j]) * a
        this.c2[k * 3 + j] += (c[j] - this.c2[k * 3 + j]) * a
      }
    }
    return this
  }

  /** Multiplies the colours by a factor from position (shading: darker underneath, in creases…). */
  shade(fn: (x: number, y: number, z: number) => number) {
    for (let k = 0; k < this.count; k++) {
      const f = fn(this.p[k * 3], this.p[k * 3 + 1], this.p[k * 3 + 2])
      for (let j = 0; j < 3; j++) {
        this.c[k * 3 + j] *= f
        this.c2[k * 3 + j] *= f
      }
    }
    return this
  }

  /** Smooth vertex normals from the triangles. */
  normals(): Float32Array {
    const n = new Float32Array(this.p.length)
    const p = this.p
    for (let k = 0; k < this.i.length; k += 3) {
      const a = this.i[k] * 3
      const b = this.i[k + 1] * 3
      const c = this.i[k + 2] * 3
      const ux = p[b] - p[a]
      const uy = p[b + 1] - p[a + 1]
      const uz = p[b + 2] - p[a + 2]
      const vx = p[c] - p[a]
      const vy = p[c + 1] - p[a + 1]
      const vz = p[c + 2] - p[a + 2]
      const nx = uy * vz - uz * vy
      const ny = uz * vx - ux * vz
      const nz = ux * vy - uy * vx
      for (const q of [a, b, c]) {
        n[q] += nx
        n[q + 1] += ny
        n[q + 2] += nz
      }
    }
    for (let k = 0; k < n.length; k += 3) {
      const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1
      n[k] /= l
      n[k + 1] /= l
      n[k + 2] /= l
    }
    return n
  }

  /** Pushes every vertex along its normal by `fn` (bumps, wool, wrinkles). */
  displace(fn: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => number) {
    const n = this.normals()
    for (let k = 0; k < this.p.length; k += 3) {
      const d = fn(this.p[k], this.p[k + 1], this.p[k + 2], n[k], n[k + 1], n[k + 2])
      this.p[k] += n[k] * d
      this.p[k + 1] += n[k + 1] * d
      this.p[k + 2] += n[k + 2] * d
    }
    return this
  }

  /** Moves vertices by a function of position (bends, sags, twists). */
  warp(fn: (x: number, y: number, z: number) => V3) {
    for (let k = 0; k < this.p.length; k += 3) {
      const [x, y, z] = fn(this.p[k], this.p[k + 1], this.p[k + 2])
      this.p[k] = x
      this.p[k + 1] = y
      this.p[k + 2] = z
    }
    return this
  }

  /** Keeps only the triangles whose three corners pass `fn` (a hair-line, a cut-away, an open shell). */
  keep(fn: (x: number, y: number, z: number) => boolean) {
    const ok = (k: number) => fn(this.p[k * 3], this.p[k * 3 + 1], this.p[k * 3 + 2])
    const out: number[] = []
    for (let k = 0; k < this.i.length; k += 3) if (ok(this.i[k]) && ok(this.i[k + 1]) && ok(this.i[k + 2])) out.push(this.i[k], this.i[k + 1], this.i[k + 2])
    this.i = out
    return this
  }

  triangles() {
    return this.i.length / 3
  }

  /** The finished geometry: position, normal, both colour layers, the pattern and the tint mask. */
  geometry(): BufferGeometry {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.p), 3))
    g.setAttribute('normal', new BufferAttribute(this.normals(), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.c), 3))
    g.setAttribute('color2', new BufferAttribute(new Float32Array(this.c2), 3))
    g.setAttribute('pattern', new BufferAttribute(new Float32Array(this.m), 1))
    g.setAttribute('tint', new BufferAttribute(new Float32Array(this.t), 1))
    g.setIndex(this.count > 65535 ? new BufferAttribute(new Uint32Array(this.i), 1) : new BufferAttribute(new Uint16Array(this.i), 1))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

/** Joins shapes into one. */
export const merge = (...shapes: Shape[]) => new Shape().add(...shapes)

// ───────────────────────────── noise ─────────────────────────────

/** Deterministic 0..1 for integer lattice points. */
function hash3(x: number, y: number, z: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 974634879) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

/** Smooth value noise in 3D, 0..1. */
export function noise3(x: number, y: number, z: number, seed = 1) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const fx = x - xi
  const fy = y - yi
  const fz = z - zi
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const sz = fz * fz * (3 - 2 * fz)
  const at = (a: number, b: number, c: number) => hash3(xi + a, yi + b, zi + c, seed)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return lerp(
    lerp(lerp(at(0, 0, 0), at(1, 0, 0), sx), lerp(at(0, 1, 0), at(1, 1, 0), sx), sy),
    lerp(lerp(at(0, 0, 1), at(1, 0, 1), sx), lerp(at(0, 1, 1), at(1, 1, 1), sx), sy),
    sz,
  )
}

/** Layered noise (octaves halve in size and weight), 0..1. */
export function fbm3(x: number, y: number, z: number, seed = 1, octaves = 3) {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += noise3(x * f, y * f, z * f, seed + o * 17) * amp
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

/** A seeded 0..1 random sequence (plants, flocks: the same every time for the same seed). */
export function random(seed: number) {
  let s = seed >>> 0 || 1
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
