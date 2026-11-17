import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Camera,
} from 'three'
import type { WorldFx } from './format'

// A film's effects in the world (FILM.md, achievement: layer the feedback): a puff of dust where the crate lands or a
// herd runs, feathers in a scrum, a splash of milk, tufts of wool at a snip, stars round a bonked head, a pop of sparkles
// as a piece clicks into place — each a few flat sprites facing the camera, from one picture of eight, in one crowd (one
// draw), every one placed by its own dice from the moment it began: any frame is the same however it was reached. And
// the air's motes: specks drifting in the light round what a day's shot looks at (one more draw, added on), so a still
// frame still breathes and the light has depth.

const TILES = 4
const ROWS = 2
type Tile = 'puff' | 'feather' | 'drop' | 'star' | 'sparkle' | 'tuft' | 'mote' | 'chip'
const TILE: Record<Tile, number> = { puff: 0, feather: 1, drop: 2, star: 3, sparkle: 4, tuft: 5, mote: 6, chip: 7 }

/** The eight pictures, drawn once. */
function atlas() {
  const S = 64
  const c = document.createElement('canvas')
  c.width = S * TILES
  c.height = S * ROWS
  const g = c.getContext('2d')!
  const at = (k: number) => [(k % TILES) * S, Math.floor(k / TILES) * S] as const
  const soft = (x: number, y: number, r: number, a: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(255,255,255,${a})`)
    grad.addColorStop(0.55, `rgba(255,255,255,${a * 0.55})`)
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#fff'
  // a puff: soft lumps
  {
    const [x, y] = at(TILE.puff)
    soft(x + 32, y + 34, 24, 0.85)
    soft(x + 22, y + 28, 15, 0.7)
    soft(x + 42, y + 26, 14, 0.7)
  }
  // a feather: a vane round a quill
  {
    const [x, y] = at(TILE.feather)
    g.save()
    g.translate(x + 32, y + 32)
    g.rotate(-0.5)
    g.beginPath()
    g.ellipse(0, 0, 9, 26, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = 'rgba(0,0,0,0.25)'
    g.fillRect(-1, -26, 2, 54)
    g.restore()
  }
  // a drop
  {
    const [x, y] = at(TILE.drop)
    g.beginPath()
    g.moveTo(x + 32, y + 10)
    g.quadraticCurveTo(x + 50, y + 40, x + 32, y + 52)
    g.quadraticCurveTo(x + 14, y + 40, x + 32, y + 10)
    g.fill()
  }
  // a star (five points)
  {
    const [x, y] = at(TILE.star)
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 11 : 27
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      g.lineTo(x + 32 + Math.cos(a) * r, y + 33 + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
  }
  // a sparkle (four thin points and a glow)
  {
    const [x, y] = at(TILE.sparkle)
    soft(x + 32, y + 32, 16, 0.7)
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 4 : 29
      const a = (i / 8) * Math.PI * 2
      g.lineTo(x + 32 + Math.cos(a) * r, y + 32 + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
  }
  // a tuft of wool: curls
  {
    const [x, y] = at(TILE.tuft)
    for (const [dx, dy, r] of [
      [0, 0, 14],
      [-12, 6, 11],
      [12, 5, 11],
      [-5, -10, 10],
      [8, -9, 9],
    ])
      soft(x + 32 + dx, y + 32 + dy, r + 3, 1)
  }
  // a mote: a soft speck
  {
    const [x, y] = at(TILE.mote)
    soft(x + 32, y + 32, 14, 1)
  }
  // a chip of wood
  {
    const [x, y] = at(TILE.chip)
    g.fillRect(x + 20, y + 27, 26, 9)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** A plane showing one tile of the picture (the motes': they are all one tile). */
function sprite(tile: number) {
  const g = new PlaneGeometry(1, 1)
  const uv = g.getAttribute('uv')
  const u0 = (tile % TILES) / TILES
  const v0 = 1 - (Math.floor(tile / TILES) + 1) / ROWS
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / TILES, v0 + uv.getY(i) / ROWS)
  return g
}

interface Kind {
  tile: Tile
  n: number
  life: number
  colours: string[]
  /** starting speed up and out (m/s), gravity (m/s², down), drag (1/s), size (m) at the start and at its biggest */
  up: number
  out: number
  fall: number
  drag: number
  size: [number, number]
  spin: number
  /** where it starts above the subject's foot (m; null: its middle) */
  from: number | null
}

const KINDS: Record<WorldFx, Kind> = {
  dust: { tile: 'puff', n: 14, life: 1.0, colours: ['#cdbd9c', '#bfae8a', '#d8cbb0'], up: 0.35, out: 1.6, fall: -0.25, drag: 2.6, size: [0.18, 0.62], spin: 0.6, from: 0.08 },
  feathers: { tile: 'feather', n: 12, life: 1.8, colours: ['#f4efe6', '#a0522d', '#e8d9c0', '#6b4a32'], up: 1.6, out: 0.9, fall: 1.1, drag: 1.8, size: [0.09, 0.11], spin: 4, from: 0.3 },
  splash: { tile: 'drop', n: 16, life: 0.7, colours: ['#fbf8f1', '#efe9dc'], up: 2.3, out: 1.2, fall: 9, drag: 0.6, size: [0.05, 0.07], spin: 0, from: 0.15 },
  tufts: { tile: 'tuft', n: 10, life: 1.5, colours: ['#f6f1e6', '#ebe2d0'], up: 1.1, out: 0.8, fall: 1.0, drag: 1.6, size: [0.1, 0.15], spin: 2, from: null },
  stars: { tile: 'star', n: 5, life: 1.5, colours: ['#ffd84a', '#ffe98a'], up: 0, out: 0, fall: 0, drag: 0, size: [0.07, 0.09], spin: 3, from: null },
  pop: { tile: 'sparkle', n: 10, life: 0.55, colours: ['#fff4c2', '#ffd66b', '#ffffff'], up: 0.5, out: 1.5, fall: 0, drag: 4, size: [0.16, 0.05], spin: 2, from: null },
}

/** A die for sprite i of effect e: the same every time. */
const dice = (e: number, i: number, k: number) => {
  const x = Math.sin(e * 127.1 + i * 311.7 + k * 74.7) * 43758.5453
  return x - Math.floor(x)
}

export interface Burst {
  fx: WorldFx
  /** seconds since it began */
  age: number
  /** the subject: its foot, its middle's height above it, its head's (for stars) */
  at: Vector3
  mid: number
  /** its number in the film (its dice) */
  seed: number
}

const MAX = 160
const MOTES = 48
const m4 = new Matrix4()
const q = new Quaternion()
const spinQ = new Quaternion()
const p = new Vector3()
const s = new Vector3()
const z = new Vector3(0, 0, 1)
const colour = new Color()

export class Sparks {
  readonly crowd: InstancedMesh
  readonly motes: InstancedMesh
  private texture = atlas()
  /** each sprite's tile of the picture (its column and row from the bottom): one plane for all of them */
  private tiles = new Float32Array(MAX * 2)

  constructor() {
    const material = new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, alphaTest: 0.02 })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 tile;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv = (uv + tile) / vec2(${TILES}.0, ${ROWS}.0);\n#endif`)
    }
    const g = new PlaneGeometry(1, 1)
    this.crowd = new InstancedMesh(g, material, MAX)
    this.crowd.instanceMatrix.setUsage(DynamicDrawUsage)
    this.crowd.frustumCulled = false
    this.crowd.count = 0
    this.crowd.renderOrder = 5
    this.crowd.geometry.setAttribute('tile', new InstancedBufferAttribute(this.tiles, 2))
    this.crowd.setColorAt(0, colour.set('#ffffff'))
    const mg = sprite(TILE.mote)
    this.motes = new InstancedMesh(mg, new MeshBasicMaterial({ map: this.texture, transparent: true, depthWrite: false, blending: AdditiveBlending, color: '#fff2cf', opacity: 0.55 }), MOTES)
    this.motes.instanceMatrix.setUsage(DynamicDrawUsage)
    this.motes.frustumCulled = false
    this.motes.count = 0
    this.motes.renderOrder = 6
  }

  /** The bursts going on, and the motes round `focus` (none: `motes` 0), facing `camera`. */
  draw(bursts: Burst[], camera: Camera, focus: Vector3 | null, motes: number, t: number) {
    camera.getWorldQuaternion(q)
    let n = 0
    for (const b of bursts) {
      const k = KINDS[b.fx]
      for (let i = 0; i < k.n && n < MAX; i++) {
        const life = k.life * (0.75 + 0.5 * dice(b.seed, i, 9))
        const a = b.age
        if (a < 0 || a > life) continue
        const u = a / life
        const ang = dice(b.seed, i, 1) * Math.PI * 2
        const out = k.out * (0.4 + 0.6 * dice(b.seed, i, 2))
        const up = k.up * (0.5 + 0.5 * dice(b.seed, i, 3))
        // speed decays with drag: distance = v (1 − e^(−d a)) / d; gravity on top
        const dr = k.drag ? (1 - Math.exp(-k.drag * a)) / k.drag : a
        const y0 = k.from ?? b.mid
        if (b.fx === 'stars') {
          // round the head, a ring that turns
          const r = 0.24
          const w = ang + a * 5.5
          p.set(b.at.x + Math.cos(w) * r, b.at.y + b.mid + 0.08 + Math.sin(a * 7 + i) * 0.03, b.at.z + Math.sin(w) * r)
        } else {
          p.set(b.at.x + Math.cos(ang) * out * dr, b.at.y + y0 + up * dr - 0.5 * k.fall * a * a, b.at.z + Math.sin(ang) * out * dr)
          // a feather sways as it falls
          if (b.fx === 'feathers') p.x += Math.sin(a * 5 + i) * 0.08 * u
          if (p.y < 0.01) p.y = 0.01
        }
        const grow = k.size[0] + (k.size[1] - k.size[0]) * Math.min(1, u * 1.6)
        // gone by shrinking (no fade needed in a crowd)
        const size = grow * (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1) * (0.75 + 0.5 * dice(b.seed, i, 4))
        spinQ.setFromAxisAngle(z, ang + a * k.spin * (dice(b.seed, i, 5) - 0.5) * 2)
        m4.compose(p, q.clone().multiply(spinQ), s.set(size, size, size))
        this.crowd.setMatrixAt(n, m4)
        const tile = TILE[k.tile]
        this.tiles[n * 2] = tile % TILES
        this.tiles[n * 2 + 1] = ROWS - 1 - Math.floor(tile / TILES)
        this.crowd.setColorAt(n, colour.set(k.colours[i % k.colours.length]))
        n++
      }
    }
    this.crowd.count = n
    this.crowd.instanceMatrix.needsUpdate = true
    if (this.crowd.instanceColor) this.crowd.instanceColor.needsUpdate = true
    ;(this.crowd.geometry.getAttribute('tile') as { needsUpdate: boolean }).needsUpdate = true
    // the motes: specks in a box round what the shot looks at, drifting up and sideways, each at its own pace
    let m = 0
    if (focus && motes > 0)
      for (let i = 0; i < MOTES; i++) {
        const drift = t * (0.05 + 0.08 * dice(7, i, 1))
        p.set(focus.x + (dice(7, i, 2) - 0.5) * 5 + Math.sin(t * 0.3 + i) * 0.3, 0.2 + ((dice(7, i, 3) * 2.6 + drift) % 2.6), focus.z + (dice(7, i, 4) - 0.5) * 5 + Math.cos(t * 0.25 + i) * 0.3)
        const size = (0.018 + 0.03 * dice(7, i, 5)) * motes * (0.6 + 0.4 * Math.sin(t * 1.3 + i * 2.1))
        m4.compose(p, q, s.set(size, size, size))
        this.motes.setMatrixAt(m++, m4)
      }
    this.motes.count = m
    this.motes.instanceMatrix.needsUpdate = true
  }

  dispose() {
    this.crowd.geometry.dispose()
    this.motes.geometry.dispose()
    this.texture.dispose()
  }
}
