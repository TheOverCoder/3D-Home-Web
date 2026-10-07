import { useMemo } from 'react'
import { HOUSE } from '../data/layout'
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

function Tree({ x, z, scale, tone }: { x: number; z: number; scale: number; tone: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 2.4, 8]} />
        <meshStandardMaterial color="#5a4632" roughness={1} />
      </mesh>
      {[
        [0, 3.2, 0, 1.7],
        [0.6, 2.7, 0.3, 1.2],
        [-0.5, 2.8, -0.4, 1.3],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={`hsl(${100 + tone * 25}, ${38 + tone * 10}%, ${24 + tone * 8}%)`} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Lawn, a paved apron around the house, and a ring of trees so windows look onto something. */
export function Exterior() {
  const grass = useMemo(() => surface('grass', 260, 260), [])
  const trees = useMemo(() => {
    const r = mulberry(42)
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + (r() - 0.5) * 0.3
      const radius = 17 + r() * 14
      return { key: i, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, scale: 0.9 + r() * 0.8, tone: r() }
    })
  }, [])
  const w = HOUSE.maxX - HOUSE.minX + 3.2
  const d = HOUSE.maxZ - HOUSE.minZ + 3.2
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
      {trees.map((t) => (
        <Tree key={t.key} x={t.x} z={t.z} scale={t.scale} tone={t.tone} />
      ))}
    </group>
  )
}
