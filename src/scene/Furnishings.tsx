import { Suspense, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Box3, BoxGeometry, DoubleSide, Mesh, PlaneGeometry, Vector3, type BufferGeometry, type Light, type Object3D, type Texture } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { boxProject } from '../lib/boxProject'
import { material, surface, type MaterialKind } from '../lib/proceduralTextures'
import { assets } from '../assets/registry'

type V3 = [number, number, number]

let fabricNormal: Texture | undefined
const weave = () => (fabricNormal ??= surface('fabric', 3, 3).normalMap)

interface BProps {
  fabric?: boolean // soft furnishing: adds a woven normal map
  mat?: MaterialKind // physically-sized surface (grain, weave, brushed streaks…) projected onto the box
  tile?: number // metres covered by one tile of `mat`
  size: V3
  position?: V3
  rotation?: V3
  color: string
  roughness?: number
  metalness?: number
  radius?: number
  emissive?: string
  emissiveIntensity?: number
}

const boxCache = new Map<string, BufferGeometry>()

/** Shared box geometry: plain for small or sharp pieces, softly rounded otherwise (kept light on triangles). */
function boxGeometry(size: V3, radius: number, tile?: number, offset = 0): BufferGeometry {
  const key = `${size.join(',')}|${radius}|${tile ?? ''}|${tile ? offset.toFixed(2) : ''}`
  let g = boxCache.get(key)
  if (!g) {
    const r = Math.min(radius, Math.min(...size) / 2 - 1e-3)
    g = r < 0.008 ? new BoxGeometry(size[0], size[1], size[2]) : new RoundedBoxGeometry(size[0], size[1], size[2], 2, r)
    if (tile) boxProject(g, tile, offset)
    boxCache.set(key, g)
  }
  return g
}

/** A (rounded) box — the building block of every placeholder prop. */
export function B({ size, position, rotation, color, roughness = 0.8, metalness = 0, radius = 0.015, emissive, emissiveIntensity, fabric, mat, tile = 0.6 }: BProps) {
  // textured boxes share their map set and carry projected UVs
  const set = mat ? material(mat) : null
  const geometry = boxGeometry(size, radius, mat ? tile : undefined, (position?.[0] ?? 0) * 3.1 + (position?.[2] ?? 0) * 1.7)
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        map={set?.map ?? null}
        normalMap={set ? set.normalMap : fabric ? weave() : null}
        roughnessMap={set?.roughnessMap ?? null}
        normalScale={set ? [1, 1] : [0.8, 0.8]}
      />
    </mesh>
  )
}

function GlbProp({ url, size }: { url: string; size: V3 }) {
  const { scene } = useGLTF(url, false)
  const object = useMemo(() => {
    const clone = scene.clone(true)
    const dim = new Box3().setFromObject(clone).getSize(new Vector3())
    clone.scale.setScalar(Math.min(size[0] / dim.x, size[1] / dim.y, size[2] / dim.z))
    const fitted = new Box3().setFromObject(clone)
    const centre = fitted.getCenter(new Vector3())
    clone.position.set(-centre.x, -fitted.min.y, -centre.z)
    const lights: Object3D[] = []
    clone.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
      // product shots ship their own studio lights; extra lights would change the shader of the whole scene
      if ((o as Light).isLight) lights.push(o)
    })
    lights.forEach((l) => l.removeFromParent())
    return clone
  }, [scene, size])
  return <primitive object={object} />
}

interface SolidProps {
  id: string // matches src/assets/models/props/<id>.glb
  position: V3
  rotationY?: number
  size: V3 // collider box (also the box a replacement GLB is fitted into)
  children: ReactNode
}

/** Static furniture: a collider plus either the placeholder meshes or a dropped-in GLB. */
function Solid({ id, position, rotationY = 0, size, children }: SolidProps) {
  const url = assets.props[id]
  return (
    <RigidBody type="fixed" colliders={false} position={position} rotation={[0, rotationY, 0]}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={[0, size[1] / 2, 0]} />
      {url ? (
        // a real model replaces the placeholder later: never merge this group into the static batch
        <group userData={{ noBatch: true }}>
          <Suspense fallback={children}>
            <GlbProp url={url} size={size} />
          </Suspense>
        </group>
      ) : (
        children
      )}
    </RigidBody>
  )
}

/** Decorative only (no collider). */
function Decor({ position, rotationY = 0, children }: { position: V3; rotationY?: number; children: ReactNode }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {children}
    </group>
  )
}

// ───────────────────────────── pieces ─────────────────────────────

function Sofa() {
  const fabric = '#4a5b6c'
  const cushion = '#586b7e'
  return (
    <group>
      <B size={[2.2, 0.36, 0.95]} position={[0, 0.26, 0]} color={fabric} roughness={1} radius={0.05} mat="fabric" tile={0.32} />
      {[-0.72, 0, 0.72].map((x) => (
        <B key={x} size={[0.7, 0.14, 0.78]} position={[x, 0.5, 0.06]} color={cushion} roughness={1} radius={0.05} mat="fabric" tile={0.32} />
      ))}
      <B size={[2.2, 0.55, 0.22]} position={[0, 0.7, -0.37]} color={fabric} roughness={1} radius={0.06} mat="fabric" tile={0.32} />
      {[-0.72, 0, 0.72].map((x) => (
        <B key={x} size={[0.68, 0.4, 0.16]} position={[x, 0.74, -0.2]} rotation={[-0.14, 0, 0]} color={cushion} roughness={1} radius={0.06} mat="fabric" tile={0.32} />
      ))}
      {[-1.03, 1.03].map((x) => (
        <B key={x} size={[0.18, 0.56, 0.95]} position={[x, 0.37, 0]} color={fabric} roughness={1} radius={0.05} mat="fabric" tile={0.32} />
      ))}
      {[-0.95, 0.95].flatMap((x) => [-0.38, 0.38].map((z) => (
        <B key={`${x}${z}`} size={[0.06, 0.1, 0.06]} position={[x, 0.05, z]} color="#2a1d14" radius={0.01} />
      )))}
    </group>
  )
}

function CoffeeTable() {
  return (
    <group>
      <B size={[1.1, 0.05, 0.6]} position={[0, 0.4, 0]} color="#a07448" roughness={0.55} radius={0.02} mat="veneer" tile={0.9} />
      <B size={[1.0, 0.04, 0.5]} position={[0, 0.16, 0]} color="#8a6340" roughness={0.6} radius={0.015} mat="veneer" tile={0.9} />
      {[-0.5, 0.5].flatMap((x) => [-0.25, 0.25].map((z) => (
        <B key={`${x}${z}`} size={[0.05, 0.38, 0.05]} position={[x, 0.19, z]} color="#3d2a1b" radius={0.01} />
      )))}
    </group>
  )
}

function TvConsole() {
  return (
    <group>
      <B size={[1.8, 0.46, 0.45]} position={[0, 0.25, 0]} color="#6b5646" roughness={0.6} radius={0.02} mat="veneer" tile={1} />
      {[-0.45, 0.45].map((x) => (
        <B key={x} size={[0.8, 0.34, 0.02]} position={[x, 0.26, 0.23]} color="#7a634f" roughness={0.55} radius={0.01} mat="veneer" tile={1} />
      ))}
    </group>
  )
}

let leafGeo: PlaneGeometry | undefined
/** A lens-shaped leaf card, folded along its midrib and drooping at the tip. */
function leafGeometry() {
  if (leafGeo) return leafGeo
  const g = new PlaneGeometry(1, 1, 4, 8)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) // -0.5 … 0.5
    const t = pos.getY(i) + 0.5 // 0 at the stem … 1 at the tip
    const width = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)), 0.75)
    const w = x * width * 0.62
    pos.setXYZ(i, w, t, Math.abs(w) * 0.55 - 0.32 * t * t)
  }
  g.computeVertexNormals()
  leafGeo = g
  return g
}

function Plant({ tall = 1 }: { tall?: number }) {
  const leaves = useMemo(() => {
    let seed = Math.round(tall * 97)
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 16 }, (_, i) => {
      const a = i * 2.4 + rnd() * 0.4 // golden-angle spiral
      const lift = 0.32 + (i / 16) * 0.5 * tall
      const len = (0.38 + rnd() * 0.18) * (0.8 + tall * 0.25) * (1 - (i / 16) * 0.2)
      return { key: i, a, y: lift, len, tilt: 0.55 + rnd() * 0.45 - (i / 16) * 0.25 }
    })
  }, [tall])
  const set = material('leaf')
  return (
    <group>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.15, 0.34, 24]} />
        <meshStandardMaterial color="#b0704c" roughness={0.85} normalMap={surface('plaster', 4, 2).normalMap} normalScale={[0.8, 0.8]} />
      </mesh>
      <mesh position={[0, 0.355, 0]}>
        <cylinderGeometry args={[0.185, 0.185, 0.02, 24]} />
        <meshStandardMaterial color="#2a1f17" roughness={1} />
      </mesh>
      <mesh position={[0, 0.34 + 0.2 * tall, 0]}>
        <cylinderGeometry args={[0.012, 0.016, 0.4 * tall, 8]} />
        <meshStandardMaterial color="#4f6b3a" roughness={0.8} />
      </mesh>
      {leaves.map((l) => (
        <group key={l.key} position={[0, l.y, 0]} rotation={[0, l.a, 0]}>
          <mesh geometry={leafGeometry()} rotation={[l.tilt, 0, 0]} scale={[l.len, l.len, l.len]} castShadow>
            <meshStandardMaterial
              color={l.key % 2 ? '#d6ffd0' : '#f0fff0'}
              map={set.map}
              normalMap={set.normalMap}
              roughnessMap={set.roughnessMap}
              roughness={1}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Desk() {
  return (
    <group>
      <B size={[1.8, 0.05, 0.8]} position={[0, 0.735, 0]} color="#c0905f" roughness={0.55} radius={0.015} mat="veneer" tile={1} />
      {[-0.84, 0.84].map((x) => (
        <B key={x} size={[0.05, 0.71, 0.7]} position={[x, 0.355, 0]} color="#35363a" roughness={0.8} metalness={0.7} radius={0.01} mat="brushed" tile={0.5} />
      ))}
      <B size={[1.62, 0.3, 0.02]} position={[0, 0.5, -0.33]} color="#2c2c2e" roughness={0.5} radius={0.01} />
    </group>
  )
}

function Chair() {
  return (
    <group>
      <B size={[0.5, 0.07, 0.5]} position={[0, 0.5, 0]} color="#3a4047" roughness={1} radius={0.03} mat="fabric" tile={0.25} />
      <B size={[0.48, 0.55, 0.06]} position={[0, 0.82, -0.23]} rotation={[-0.08, 0, 0]} color="#3a4047" roughness={1} radius={0.03} mat="fabric" tile={0.25} />
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
        <meshStandardMaterial color="#9ca3a8" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 5]} />
        <meshStandardMaterial color="#202326" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

function Armchair() {
  const cloth = '#8a6f5a'
  return (
    <group>
      <B size={[0.82, 0.3, 0.8]} position={[0, 0.25, 0]} color={cloth} roughness={1} radius={0.06} mat="fabric" tile={0.32} />
      <B size={[0.66, 0.12, 0.62]} position={[0, 0.46, 0.05]} color="#9b8068" roughness={1} radius={0.05} mat="fabric" tile={0.32} />
      <B size={[0.82, 0.55, 0.16]} position={[0, 0.62, -0.32]} rotation={[-0.12, 0, 0]} color={cloth} roughness={1} radius={0.06} mat="fabric" tile={0.32} />
      {[-0.37, 0.37].map((x) => (
        <B key={x} size={[0.14, 0.26, 0.74]} position={[x, 0.5, 0.02]} color={cloth} roughness={1} radius={0.05} mat="fabric" tile={0.32} />
      ))}
    </group>
  )
}

function Bookshelf() {
  const books = useMemo(() => {
    const palette = ['#b4543a', '#3d6a8a', '#d7b25a', '#4d7a58', '#7a4d7a', '#c9c2b3', '#355c63']
    let seed = 7
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const out: { key: string; x: number; y: number; w: number; h: number; c: string }[] = []
    for (const y of [0.34, 0.74, 1.14, 1.54]) {
      let x = -0.58
      while (x < 0.55) {
        const w = 0.04 + rnd() * 0.04
        const h = 0.22 + rnd() * 0.12
        out.push({ key: `${y}-${x.toFixed(2)}`, x: x + w / 2, y: y + h / 2 + 0.025, w, h, c: palette[Math.floor(rnd() * palette.length)] })
        x += w + 0.004
        if (rnd() < 0.12) x += 0.18
      }
    }
    return out
  }, [])
  return (
    <group>
      {[-0.7, 0.7].map((x) => (
        <B key={x} size={[0.04, 2.0, 0.38]} position={[x, 1.0, 0]} color="#8a6542" roughness={0.65} radius={0.008} mat="veneer" tile={0.9} />
      ))}
      <B size={[1.4, 2.0, 0.02]} position={[0, 1.0, -0.18]} color="#6e5034" roughness={0.75} radius={0} mat="veneer" tile={0.9} />
      {[0.03, 0.4, 0.8, 1.2, 1.6, 1.99].map((y) => (
        <B key={y} size={[1.4, 0.04, 0.38]} position={[0, y, 0]} color="#8a6542" roughness={0.65} radius={0.008} mat="veneer" tile={0.9} />
      ))}
      {books.map((b) => (
        <B key={b.key} size={[b.w, b.h, 0.24]} position={[b.x, b.y, 0.0]} color={b.c} roughness={0.9} radius={0.004} mat="fabric" tile={0.12} />
      ))}
    </group>
  )
}

function Counter() {
  return (
    <group>
      <B size={[4.6, 0.86, 0.62]} position={[0, 0.43, 0]} color="#4e5d66" roughness={0.75} radius={0.01} mat="paint" tile={0.6} />
      <B size={[4.66, 0.05, 0.68]} position={[0, 0.885, 0.0]} color="#eceae4" roughness={0.38} radius={0.01} mat="stone" tile={1.4} />
      {[-1.6, -0.55, 0.5, 1.55].map((x) => (
        <B key={x} size={[0.94, 0.7, 0.02]} position={[x, 0.42, 0.315]} color="#5a6a74" roughness={0.7} radius={0.005} mat="paint" tile={0.6} />
      ))}
      {/* sink + hob */}
      <B size={[0.7, 0.02, 0.4]} position={[-0.55, 0.915, 0]} color="#b5bcc0" metalness={0.9} roughness={0.5} radius={0.005} mat="brushed" tile={0.5} />
      <B size={[0.6, 0.012, 0.5]} position={[1.55, 0.915, 0]} color="#17191b" roughness={0.2} radius={0.005} />
    </group>
  )
}

function Fridge() {
  return (
    <group>
      <B size={[0.8, 1.9, 0.75]} position={[0, 0.95, 0]} color="#cfd3d6" metalness={0.8} roughness={0.5} radius={0.02} mat="brushed" tile={1.2} />
      <B size={[0.78, 0.015, 0.02]} position={[0, 1.2, 0.38]} color="#6f777c" metalness={0.6} roughness={0.4} radius={0.004} />
      <B size={[0.03, 0.5, 0.04]} position={[0.3, 1.5, 0.4]} color="#3b4146" metalness={0.8} roughness={0.3} radius={0.01} />
      <B size={[0.03, 0.4, 0.04]} position={[0.3, 0.75, 0.4]} color="#3b4146" metalness={0.8} roughness={0.3} radius={0.01} />
    </group>
  )
}

function Island() {
  return (
    <group>
      <B size={[2.0, 0.86, 0.9]} position={[0, 0.43, 0]} color="#5d7064" roughness={0.75} radius={0.015} mat="paint" tile={0.6} />
      <B size={[2.1, 0.05, 1.0]} position={[0, 0.885, 0]} color="#f0ede6" roughness={0.38} radius={0.012} mat="stone" tile={1.4} />
    </group>
  )
}

function Stool() {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 20]} />
        <meshStandardMaterial color="#8d6a48" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 0.6, 12]} />
        <meshStandardMaterial color="#202326" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.03, 20]} />
        <meshStandardMaterial color="#202326" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  )
}

function Bed() {
  return (
    <group>
      <B size={[1.7, 0.3, 2.1]} position={[0, 0.2, 0]} color="#6d5441" roughness={0.7} radius={0.02} mat="veneer" tile={1} />
      <B size={[1.6, 0.24, 1.95]} position={[0, 0.47, -0.02]} color="#e6e2da" roughness={1} radius={0.06} mat="fabric" tile={0.32} />
      <B size={[1.64, 0.07, 1.25]} position={[0, 0.62, -0.3]} color="#6f8497" roughness={1} radius={0.03} mat="fabric" tile={0.32} />
      {[-0.4, 0.4].map((x) => (
        <B key={x} size={[0.62, 0.14, 0.36]} position={[x, 0.65, 0.72]} color="#f3f1ec" roughness={1} radius={0.06} mat="fabric" tile={0.32} />
      ))}
      <B size={[1.8, 1.05, 0.1]} position={[0, 0.52, 1.04]} color="#6d5441" roughness={0.7} radius={0.02} mat="leather" tile={0.4} />
    </group>
  )
}

function Nightstand() {
  return (
    <group>
      <B size={[0.5, 0.5, 0.45]} position={[0, 0.3, 0]} color="#a07448" roughness={0.6} radius={0.015} mat="veneer" tile={0.8} />
      <B size={[0.46, 0.14, 0.02]} position={[0, 0.4, 0.23]} color="#8a6340" roughness={0.6} radius={0.005} mat="veneer" tile={0.8} />
      <B size={[0.5, 0.03, 0.45]} position={[0, 0.565, 0]} color="#b58656" roughness={0.5} radius={0.01} mat="veneer" tile={0.8} />
    </group>
  )
}

function Wardrobe() {
  return (
    <group>
      <B size={[1.6, 2.2, 0.6]} position={[0, 1.1, 0]} color="#e3e0d8" roughness={0.75} radius={0.015} mat="paint" tile={0.7} />
      <B size={[0.78, 2.1, 0.02]} position={[-0.4, 1.1, 0.31]} color="#dbd8cf" roughness={0.7} radius={0.005} mat="paint" tile={0.7} />
      <B size={[0.78, 2.1, 0.02]} position={[0.4, 1.1, 0.31]} color="#dbd8cf" roughness={0.7} radius={0.005} mat="paint" tile={0.7} />
      {[-0.06, 0.06].map((x) => (
        <B key={x} size={[0.02, 0.4, 0.03]} position={[x, 1.1, 0.34]} color="#2c2c2e" metalness={0.8} roughness={0.3} radius={0.005} />
      ))}
    </group>
  )
}

function Rug({ size, color }: { size: [number, number]; color: string }) {
  return (
    <mesh position={[0, 0.011, 0]} rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} normalMap={weave()} normalScale={[0.7, 0.7]} />
    </mesh>
  )
}

function Frame({ size, color, accent }: { size: [number, number]; color: string; accent: string }) {
  return (
    <group>
      <B size={[size[0], size[1], 0.04]} color="#1f1f21" roughness={0.5} radius={0.006} />
      <B size={[size[0] - 0.1, size[1] - 0.1, 0.045]} color={color} roughness={0.9} radius={0} />
      <B size={[(size[0] - 0.1) * 0.5, (size[1] - 0.1) * 0.5, 0.05]} position={[0.04, -0.02, 0]} color={accent} roughness={0.9} radius={0} />
    </group>
  )
}

/** All room furniture. Every piece can be replaced by dropping `props/<id>.glb`. */
export function Furnishings() {
  return (
    <group>
      {/* living room */}
      <Solid id="sofa" position={[-3.5, 0, 2.5]} size={[2.2, 0.95, 0.95]}><Sofa /></Solid>
      <Solid id="coffee-table" position={[-3.5, 0, 3.95]} size={[1.1, 0.42, 0.6]}><CoffeeTable /></Solid>
      <Solid id="tv-console" position={[-3.5, 0, 5.65]} size={[1.8, 0.5, 0.45]}><TvConsole /></Solid>
      <Solid id="plant-living" position={[-6.35, 0, 5.35]} size={[0.7, 1.3, 0.7]}><Plant tall={1.3} /></Solid>
      <Solid id="armchair" position={[-5.85, 0, 3.4]} rotationY={Math.PI / 2} size={[0.85, 0.95, 0.85]}><Armchair /></Solid>
      <Decor position={[-3.5, 0, 3.5]}><Rug size={[3.0, 2.2]} color="#8c6f5a" /></Decor>
      <Decor position={[-6.88, 1.65, 3.4]} rotationY={Math.PI / 2}><Frame size={[1.1, 0.75]} color="#c9b79c" accent="#3d6a8a" /></Decor>
      <Decor position={[-6.88, 1.6, 4.7]} rotationY={Math.PI / 2}><Frame size={[0.6, 0.8]} color="#d9d0c0" accent="#b4543a" /></Decor>

      {/* studio */}
      <Solid id="desk" position={[-3.5, 0, -5.45]} size={[1.8, 0.76, 0.8]}><Desk /></Solid>
      <Solid id="chair" position={[-3.5, 0, -4.45]} rotationY={Math.PI} size={[0.5, 0.95, 0.5]}><Chair /></Solid>
      <Solid id="bookshelf" position={[-6.7, 0, -3]} rotationY={Math.PI / 2} size={[1.4, 2.0, 0.4]}><Bookshelf /></Solid>
      <Solid id="plant-studio" position={[-0.6, 0, -5.4]} size={[0.45, 1.0, 0.45]}><Plant /></Solid>
      <Decor position={[-1.8, 0, -3.2]}><Rug size={[2.4, 1.6]} color="#4f5f6b" /></Decor>

      {/* kitchen */}
      <Solid id="counter" position={[3.3, 0, -5.58]} size={[4.6, 0.9, 0.62]}><Counter /></Solid>
      <Solid id="fridge" position={[6.3, 0, -5.5]} size={[0.8, 1.9, 0.75]}><Fridge /></Solid>
      <Solid id="island" position={[3.4, 0, -2.4]} size={[2.0, 0.92, 0.9]}><Island /></Solid>
      <Solid id="stool-a" position={[2.9, 0, -1.55]} size={[0.38, 0.65, 0.38]}><Stool /></Solid>
      <Solid id="stool-b" position={[3.9, 0, -1.55]} size={[0.38, 0.65, 0.38]}><Stool /></Solid>

      {/* bedroom */}
      <Solid id="bed" position={[4.6, 0, 4.85]} size={[1.7, 0.7, 2.1]}><Bed /></Solid>
      <Solid id="nightstand" position={[3.35, 0, 5.6]} size={[0.5, 0.58, 0.45]}><Nightstand /></Solid>
      <Solid id="wardrobe" position={[5.8, 0, 0.45]} size={[1.6, 2.2, 0.6]}><Wardrobe /></Solid>
      <Decor position={[4.6, 0, 4.4]}><Rug size={[2.8, 3.0]} color="#7d8a96" /></Decor>
      <Decor position={[3.5, 1.7, 5.9]} rotationY={Math.PI}><Frame size={[0.8, 0.6]} color="#cfd6dc" accent="#4d7a58" /></Decor>
    </group>
  )
}
