import { useMemo } from 'react'
import { BoxGeometry, BufferGeometry, CylinderGeometry, IcosahedronGeometry, Vector3 } from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { HOUSE } from '../data/layout'
import { boxProject } from '../lib/boxProject'
import { surface } from '../lib/proceduralTextures'

function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// The garden: a hedge along the north and west boundary, a slatted timber fence to the south and east (the
// sunny side, so it throws no shade into the rooms), shrubs along the house, and broadleaf trees in front of a
// far ring. All of it is static, so <House /> merges it into a handful of draws.
const GARDEN = { minX: -14, maxX: 14, minZ: -13, maxZ: 13 }

/** Lumpy, leafy mass: a box or sphere whose surface is pushed in and out by a few octaves of smooth noise. */
function foliage(base: BufferGeometry, seed: number, amount: number, tile: number): BufferGeometry {
  const r = mulberry(seed)
  const ph = Array.from({ length: 9 }, () => r() * Math.PI * 2)
  base.deleteAttribute('normal')
  base.deleteAttribute('uv')
  const g = mergeVertices(base, 1e-4)
  g.computeVertexNormals()
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const p = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const n =
      Math.sin(p.x * 2.1 + ph[0]) * Math.sin(p.y * 2.4 + ph[1]) * Math.sin(p.z * 2.2 + ph[2]) * 0.6 +
      Math.sin(p.x * 5.3 + ph[3]) * Math.sin(p.y * 4.7 + ph[4]) * Math.sin(p.z * 5.1 + ph[5]) * 0.3 +
      Math.sin(p.x * 11.0 + ph[6]) * Math.sin(p.y * 12.3 + ph[7]) * Math.sin(p.z * 10.7 + ph[8]) * 0.15
    const d = n * amount
    pos.setXYZ(i, p.x + nor.getX(i) * d, p.y + nor.getY(i) * d, p.z + nor.getZ(i) * d)
  }
  g.computeVertexNormals()
  return boxProject(g, tile, seed * 0.37)
}

function hedgeRun(axis: 'x' | 'z', at: number, from: number, to: number, seed: number): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const r = mulberry(seed)
  // in sections, so the top line wanders a little like a real clipped hedge
  for (let a = from; a < to - 0.01; ) {
    const len = Math.min(to - a, 2.4 + r() * 1.2)
    const h = 1.45 + r() * 0.2
    const depth = 0.95
    const g = new BoxGeometry(axis === 'x' ? len + 0.25 : depth, h, axis === 'x' ? depth : len + 0.25, Math.ceil(len * 5), 8, axis === 'x' ? 5 : Math.ceil(len * 5))
    const f = foliage(g, seed * 31 + Math.round(a * 10), 0.07, 0.9)
    const mid = a + len / 2
    f.translate(axis === 'x' ? mid : at, h / 2, axis === 'x' ? at : mid)
    out.push(f)
    a += len
  }
  return out
}

function shrub(x: number, z: number, size: number, seed: number): BufferGeometry {
  const g = foliage(new IcosahedronGeometry(1, 3), seed, 0.16, 0.7)
  g.scale(size * 1.15, size * 0.8, size)
  g.translate(x, size * 0.55, z)
  return g
}

interface TreeParts {
  wood: BufferGeometry
  crown: BufferGeometry
}

/** A broadleaf tree: tapered, slightly leaning trunk with two limbs and a crown of overlapping leaf masses. */
function tree(x: number, z: number, height: number, seed: number): TreeParts {
  const r = mulberry(seed)
  const lean = (r() - 0.5) * 0.12
  const trunkH = height * 0.42
  const trunk = new CylinderGeometry(0.11 * height * 0.16, 0.2 * height * 0.16, trunkH, 9, 3)
  trunk.translate(0, trunkH / 2, 0)
  trunk.rotateZ(lean)
  const limbs = [0, 1].map((i) => {
    const l = new CylinderGeometry(0.035 * height * 0.16 * 3, 0.07 * height * 0.16 * 2.2, height * 0.3, 7)
    l.translate(0, height * 0.15, 0)
    l.rotateZ((i ? 1 : -1) * (0.45 + r() * 0.25))
    l.rotateY(r() * Math.PI * 2)
    l.translate(0, trunkH * 0.85, 0)
    return l
  })
  const wood = mergeGeometries([trunk, ...limbs].map((g) => g.toNonIndexed()))!
  const blobs: BufferGeometry[] = []
  const cx = Math.sin(lean) * -trunkH
  const crownY = trunkH + height * 0.3
  const masses = 6 + Math.floor(r() * 3)
  for (let i = 0; i < masses; i++) {
    const a = (i / masses) * Math.PI * 2 + r() * 0.6
    const rad = height * (0.16 + r() * 0.08)
    const out = i === 0 ? 0 : height * (0.14 + r() * 0.1)
    const b = foliage(new IcosahedronGeometry(1, 2), seed * 7 + i, 0.2, 0.9)
    b.scale(rad * 1.1, rad * 0.85, rad * 1.1)
    b.translate(cx + Math.cos(a) * out, crownY + (i === 0 ? height * 0.08 : (r() - 0.4) * height * 0.16), Math.sin(a) * out)
    blobs.push(b.index ? b.toNonIndexed() : b)
  }
  const crown = mergeGeometries(blobs)!
  for (const g of [wood, crown]) g.translate(x, 0, z)
  return { wood, crown }
}

function fenceRun(axis: 'x' | 'z', at: number, from: number, to: number): BufferGeometry[] {
  const out: BufferGeometry[] = []
  const len = to - from
  const posts = Math.round(len / 1.8)
  const put = (g: BufferGeometry, along: number, y: number) => {
    g.translate(axis === 'x' ? along : at, y, axis === 'x' ? at : along)
    out.push(g)
  }
  for (let i = 0; i <= posts; i++) put(new BoxGeometry(0.09, 1.15, 0.09), from + (i / posts) * len, 0.575)
  for (let s = 0; s < 6; s++) {
    const y = 0.16 + s * 0.16
    put(boxProject(new BoxGeometry(axis === 'x' ? len : 0.025, 0.12, axis === 'x' ? 0.025 : len), 1.4, s * 1.7), from + len / 2, y)
  }
  return out
}

/** Lawn, a paved apron around the house, and a garden with depth so every window looks onto something. */
export function Exterior() {
  const grass = useMemo(() => surface('grass', 260, 260), [])
  const leaves = useMemo(() => surface('grass', 1, 1), [])
  const bark = useMemo(() => surface('veneer', 1, 1), [])
  const garden = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = GARDEN
    const hedge = mergeGeometries(
      [...hedgeRun('x', minZ, minX, maxX, 3), ...hedgeRun('z', minX, minZ + 0.5, maxZ - 2, 5)].map((g) => g.toNonIndexed()),
    )!
    const fence = mergeGeometries([...fenceRun('x', maxZ, minX + 0.5, maxX), ...fenceRun('z', maxX, minZ + 0.5, maxZ)].map((g) => (g.index ? g.toNonIndexed() : g)))!
    // shrubs: a border along the walls, never right in front of a window sill, and a row in front of the fence
    const r = mulberry(9)
    const bushes: BufferGeometry[] = []
    const spots: [number, number][] = [
      [-8.4, -3.2], [-8.5, 4.4], [8.6, 1.6], [8.5, 3.4], [-3.5, -7.6], [1.5, -7.6], [-5.2, 7.6], [4.6, 7.7],
      [12.6, -9], [12.8, -4], [12.5, 2.5], [12.7, 8.5], [9, 11.7], [3, 11.8], [-4, 11.6], [-10, 11.7],
    ]
    spots.forEach(([x, z], i) => bushes.push(shrub(x, z, 0.55 + r() * 0.35, 100 + i)))
    const shrubs = mergeGeometries(bushes.map((g) => (g.index ? g.toNonIndexed() : g)))!
    // trees: a few in the garden corners, the rest in a looser ring beyond the boundary
    const trees: TreeParts[] = [tree(-11.2, -10.2, 7.5, 21), tree(10.8, -10.6, 6.8, 22), tree(-11.6, 9.6, 6.4, 23)]
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.35
      const radius = 19 + r() * 9
      trees.push(tree(Math.cos(angle) * radius, Math.sin(angle) * radius, 6 + r() * 4, 40 + i))
    }
    const wood = mergeGeometries(trees.map((t) => t.wood))!
    const crowns = [0, 1, 2].map((k) => mergeGeometries(trees.filter((_, i) => i % 3 === k).map((t) => t.crown))!)
    return { hedge, fence, shrubs, wood, crowns }
  }, [])
  const w = HOUSE.maxX - HOUSE.minX + 3.2
  const d = HOUSE.maxZ - HOUSE.minZ + 3.2
  const leafProps = { map: leaves.map, normalMap: leaves.normalMap, roughnessMap: leaves.roughnessMap, roughness: 1, normalScale: [1.4, 1.4] as [number, number] }
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial map={grass.map} normalMap={grass.normalMap} roughnessMap={grass.roughnessMap} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.015, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#9a9c98" roughness={0.95} />
      </mesh>
      <mesh geometry={garden.hedge} castShadow receiveShadow>
        <meshStandardMaterial color="#5f7a4a" {...leafProps} />
      </mesh>
      <mesh geometry={garden.shrubs} castShadow receiveShadow>
        <meshStandardMaterial color="#6e8a52" {...leafProps} />
      </mesh>
      <mesh geometry={garden.fence} castShadow receiveShadow>
        <meshStandardMaterial color="#7a6048" map={bark.map} normalMap={bark.normalMap} roughness={0.85} />
      </mesh>
      {/* trees throw no shadow: the sun is low in the south-east and must keep reaching the windows */}
      <mesh geometry={garden.wood}>
        <meshStandardMaterial color="#6a5a4c" map={bark.map} normalMap={bark.normalMap} roughness={0.95} />
      </mesh>
      {garden.crowns.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={['#5d7d43', '#6f8a46', '#4f6e3f'][i]} {...leafProps} />
        </mesh>
      ))}
    </group>
  )
}
