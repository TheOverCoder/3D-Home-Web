import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, ConeGeometry, CylinderGeometry, Euler, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { BED, BEDS, LEMON_TREE, NEST, type CropId } from './data'
import { bedProgress, farm } from './state'

// Every plant in every bed, the lemons on the tree and the eggs in the nest are drawn by five instanced meshes
// (leaves, stems, round fruit, cones, pumpkins): a whole garden of growing things for five draw calls. They are
// rebuilt a few times a second as things grow; nothing here casts a shadow, so the sun's shadow map never has
// to be redrawn because a lettuce got bigger.

const MAX = { leaf: 640, stem: 96, ball: 300, cone: 180, pumpkin: 8 } as const
type Kind = keyof typeof MAX

export const SOIL_Y = BED.h - 0.045 // the soil surface in a bed

function pumpkinGeometry(): BufferGeometry {
  const g = mergeVertices(new SphereGeometry(1, 24, 12).deleteAttribute('uv').deleteAttribute('normal'))
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const ribs = 1 - 0.09 * Math.pow(Math.abs(Math.sin(Math.atan2(z, x) * 5)), 0.6)
    p.setXYZ(i, x * ribs, y * 0.78 - (Math.abs(y) > 0.92 ? Math.sign(y) * 0.08 : 0), z * ribs)
  }
  g.computeVertexNormals()
  return g
}

const dummyM = new Matrix4()
const pos = new Vector3()
const quat = new Quaternion()
const scl = new Vector3()
const euler = new Euler(0, 0, 0, 'YXZ')
const col = new Color()

class Writer {
  counts: Record<Kind, number> = { leaf: 0, stem: 0, ball: 0, cone: 0, pumpkin: 0 }
  constructor(readonly meshes: Record<Kind, InstancedMesh | null>) {}
  put(kind: Kind, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, color: number) {
    const mesh = this.meshes[kind]
    const i = this.counts[kind]
    if (!mesh || i >= MAX[kind]) return
    this.counts[kind] = i + 1
    pos.set(x, y, z)
    quat.setFromEuler(euler.set(rx, ry, rz, 'YXZ'))
    scl.set(sx, sy, sz)
    dummyM.compose(pos, quat, scl)
    mesh.setMatrixAt(i, dummyM)
    mesh.setColorAt(i, col.setHex(color))
  }
  finish() {
    for (const k of Object.keys(this.meshes) as Kind[]) {
      const mesh = this.meshes[k]
      if (!mesh) continue
      mesh.count = this.counts[k]
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }
}

const mix = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k)
}
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3)
const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
/** Deterministic 0..1 per plant and part, so plants keep their shape from one rebuild to the next. */
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

type Grower = (w: Writer, x: number, y: number, z: number, g: number, seed: number) => void

const LEAF = 0x5f9a45
const LEAF_DARK = 0x4a7d36

const growers: Record<CropId, Grower> = {
  lettuce(w, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + seed * 6
      const inner = k % 2 === 0
      const len = (inner ? 0.065 : 0.085) * s
      w.put('leaf', x, y + 0.005, z, -(inner ? 0.9 : 0.55), a, 0, 0.05 * s, 0.014 * s, len, inner ? 0x9ccc65 : 0x6ea64a)
    }
    if (g > 0.35) w.put('ball', x, y + 0.045 * s, z, 0, seed, 0, 0.07 * s, 0.055 * s, 0.07 * s, 0x93c45c)
  },
  carrot(w, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + seed * 5
      w.put('leaf', x, y, z, -1.25 + hash(seed, k) * 0.25, a, 0, 0.011 * s, 0.006, 0.075 * s, k % 2 ? 0x5fa040 : 0x4f9a3a)
    }
    const f = smooth(0.4, 1, g)
    if (f > 0) w.put('cone', x, y + 0.012 * f, z, Math.PI, seed, 0, 0.022 * f, 0.09 * f, 0.022 * f, 0xe8792a)
  },
  strawberry(w, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + seed * 4
      w.put('leaf', x, y + 0.01, z, -0.35, a, 0, 0.042 * s, 0.01 * s, 0.05 * s, k % 2 ? LEAF : LEAF_DARK)
    }
    const f = smooth(0.5, 1, g)
    if (f <= 0) return
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + seed * 3 + 0.5
      const r = 0.075 * s
      w.put('cone', x + Math.cos(a) * r, y + 0.035, z + Math.sin(a) * r, Math.PI, a, 0, 0.016 * f, 0.034 * f, 0.016 * f, mix(0xe8f0c8, 0xd8213a, smooth(0.8, 1, g)))
    }
  },
  tomato(w, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    w.put('stem', x + 0.035, y, z, 0, 0, 0, 0.008, 0.95, 0.008, 0x8a6a45) // the cane it is tied to
    w.put('stem', x, y, z, 0, 0, 0, 0.011, 0.8 * s, 0.011, 0x4f7a32)
    for (let k = 0; k < 9; k++) {
      const h = (0.12 + (k / 9) * 0.66) * s
      const a = k * 2.4 + seed * 3
      w.put('leaf', x, y + h, z, -0.25, a, 0, 0.04 * s, 0.01 * s, 0.07 * s, k % 2 ? LEAF : LEAF_DARK)
    }
    const f = smooth(0.5, 1, g)
    if (f <= 0) return
    for (let k = 0; k < 6; k++) {
      const h = (0.28 + hash(seed, k) * 0.36) * s
      const a = k * 2.1 + seed * 2
      const r = 0.06 + hash(k, seed) * 0.03
      const size = 0.03 * f * (0.85 + hash(seed, k + 9) * 0.3)
      w.put('ball', x + Math.cos(a) * r, y + h, z + Math.sin(a) * r, 0, a, 0, size, size * 0.9, size, mix(0x7fae3e, 0xd8342a, smooth(0.82, 1, g) * (0.75 + hash(k, 3) * 0.25)))
    }
  },
  corn(w, x, y, z, g, seed) {
    const s = 0.15 + 0.85 * easeOut(g)
    const h = 1.35 * s
    w.put('stem', x, y, z, 0, 0, 0, 0.022, h, 0.022, 0x6f9a3a)
    // long blades, arching up and out from the stalk, alternating sides
    for (let k = 0; k < 8; k++) {
      const a = (k % 2 ? Math.PI : 0) + seed * 4 + k * 0.35
      w.put('leaf', x, y + (0.1 + k * 0.14) * s, z, -0.75 + k * 0.05, a, 0, 0.034 * s, 0.006, 0.17 * s, k % 2 ? 0x6fa040 : 0x5f9035)
    }
    // the tassel: a little spray of pale spikes at the top
    if (g > 0.7) {
      const t = smooth(0.7, 1, g)
      for (let k = 0; k < 5; k++) w.put('leaf', x, y + h - 0.01, z, -1.15 + (k % 2) * 0.25, k * 1.26 + seed, 0, 0.006, 0.004, 0.06 * t, 0xd8c27a)
    }
    const f = smooth(0.55, 1, g)
    if (f <= 0) return
    for (let k = 0; k < 2; k++) {
      const a = seed * 5 + k * Math.PI
      const ripe = smooth(0.85, 1, g)
      w.put('ball', x + Math.cos(a) * 0.035, y + (0.62 + k * 0.14) * s, z + Math.sin(a) * 0.035, 0.35, a, 0, 0.03 * f, 0.085 * f, 0.03 * f, mix(0x9fbf5a, 0xf0cf4a, ripe))
    }
  },
  pumpkin(w, x, y, z, g, seed) {
    const s = 0.2 + 0.8 * easeOut(g)
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + seed * 3
      const r = (0.12 + hash(seed, k) * 0.1) * s
      w.put('leaf', x + Math.cos(a) * r, y + 0.03, z + Math.sin(a) * r, -0.2, a, 0, 0.09 * s, 0.012, 0.1 * s, k % 2 ? LEAF : LEAF_DARK)
    }
    const f = smooth(0.35, 1, g)
    if (f <= 0) return
    const r = 0.17 * f
    w.put('pumpkin', x, y + r * 0.72, z, 0, seed * 6, 0, r, r, r, mix(0x6f8f3a, 0xe2741e, smooth(0.75, 1, g)))
    w.put('stem', x, y + r * 1.4, z, 0.3, seed, 0, 0.012, 0.05 * f, 0.012, 0x5c6b2a)
  },
}

/** Where the plants of a crop stand in a bed (bed-local x along the bed, z across it). */
const LAYOUT: Record<CropId, [number, number][]> = {
  lettuce: grid(4, 2, 0.38, 0.36),
  carrot: grid(6, 2, 0.25, 0.32),
  strawberry: grid(4, 2, 0.38, 0.36),
  tomato: grid(3, 1, 0.5, 0),
  corn: grid(3, 2, 0.5, 0.3),
  pumpkin: grid(2, 1, 0.78, 0),
}

function grid(cols: number, rows: number, dx: number, dz: number): [number, number][] {
  const out: [number, number][] = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([(c - (cols - 1) / 2) * dx, (r - (rows - 1) / 2) * dz])
  return out
}

/** Spots on the lemon tree's crown where fruit hangs, and the egg places in the nest box. */
export const LEMON_SPOTS: [number, number, number][] = Array.from({ length: LEMON_TREE.max }, (_, k) => {
  const a = (k / LEMON_TREE.max) * Math.PI * 2 + 0.4
  const r = 0.78 + (k % 2) * 0.12
  return [LEMON_TREE.x + Math.cos(a) * r, 1.72 + ((k * 7) % 3) * 0.16, LEMON_TREE.z + Math.sin(a) * r]
})
const EGG_SPOTS: [number, number][] = grid(3, 2, 0.085, 0.085)

export function Plants() {
  const geometries = useMemo(() => {
    const leaf = new SphereGeometry(1, 7, 5).translate(0, 0, 1) // base at the origin, reaching out along +z
    const stem = new CylinderGeometry(1, 1, 1, 6, 1).translate(0, 0.5, 0)
    const ball = new SphereGeometry(1, 11, 8)
    const cone = new ConeGeometry(1, 1, 9).translate(0, 0.5, 0)
    return { leaf, stem, ball, cone, pumpkin: pumpkinGeometry() }
  }, [])
  const refs = useRef<Record<Kind, InstancedMesh | null>>({ leaf: null, stem: null, ball: null, cone: null, pumpkin: null })
  const last = useRef(-1)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (Math.abs(t - last.current) < 0.2) return
    last.current = t
    const w = new Writer(refs.current)
    BEDS.forEach((def, i) => {
      const bed = farm.beds[i]
      if (!bed.built || !bed.crop) return
      const g = bedProgress(i)
      LAYOUT[bed.crop].forEach(([lx, lz], k) => {
        const seed = hash(i + 1, k + 1)
        growers[bed.crop!](w, def.x + lx + (hash(k, i) - 0.5) * 0.04, SOIL_Y, def.z + lz + (hash(i, k) - 0.5) * 0.04, g, seed)
      })
    })
    for (let k = 0; k < farm.lemons; k++) {
      const [x, y, z] = LEMON_SPOTS[k]
      w.put('ball', x, y, z, 0, k, 0.3, 0.045, 0.035, 0.035, 0xf2d43a)
    }
    for (let k = 0; k < farm.eggs; k++) {
      const [ex, ez] = EGG_SPOTS[k]
      w.put('ball', NEST.x + ez, 0.66, NEST.z + ex, 0.2, k, 0, 0.026, 0.034, 0.026, k % 3 === 1 ? 0xc99a6b : 0xf1e6d0)
    }
    w.finish()
  })

  const mesh = (kind: Kind, roughness: number) => (
    <instancedMesh
      key={kind}
      ref={(m) => {
        refs.current[kind] = m
        if (m) m.count = 0
      }}
      args={[geometries[kind], undefined, MAX[kind]]}
      frustumCulled={false}
      receiveShadow
    >
      <meshStandardMaterial roughness={roughness} />
    </instancedMesh>
  )

  return (
    <group name="farm-plants">
      {mesh('leaf', 0.6)}
      {mesh('stem', 0.7)}
      {mesh('ball', 0.42)}
      {mesh('cone', 0.55)}
      {mesh('pumpkin', 0.5)}
    </group>
  )
}
