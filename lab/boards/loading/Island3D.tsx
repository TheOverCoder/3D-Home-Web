import { Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

// A's stage in 3D (three.js through @react-three/fiber): a little low-poly island floating and turning slowly, and the
// house building itself on it as the game loads — the floor, the walls, the roof, the door and windows, the chimney and
// its smoke, then the trees, the beds and the fence — each piece dropping in from above, squashing as it lands and
// settling. Clouds drift round it and specks of light float up. Ready, the lamps come on in the windows and the island
// hops. Light for a phone: about 1,500 triangles, flat colours, no shadow map (a soft disc under it instead), at most
// 1.5 pixels to a point. Its colours are the game's tokens, read from the page.

const token = (name: string, or: string) => {
  const v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return new THREE.Color(v || or)
}

function usePalette() {
  return useMemo(() => {
    const leaf = token('--leaf', '#2c8540')
    const sun = token('--sun', '#ffc93c')
    const ink = token('--ink', '#3b2a1e')
    const paper = token('--paper', '#fff7e8')
    const mat = (c: THREE.Color, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, flatShading: true, ...o })
    return {
      grass: mat(leaf.clone().lerp(sun, 0.24).lerp(new THREE.Color('#ffffff'), 0.08)),
      grass2: mat(leaf.clone().lerp(ink, 0.12)),
      earth: mat(ink.clone().lerp(token('--sun-lip', '#d39a1c'), 0.55), { emissive: ink.clone(), emissiveIntensity: 0.25 }),
      stone: mat(token('--paper-3', '#efdcbb').lerp(ink, 0.2)),
      wall: mat(paper),
      wood: mat(ink.clone().lerp(token('--sun-lip', '#d39a1c'), 0.5)),
      roof: mat(token('--berry', '#d2452f')),
      glass: mat(new THREE.Color('#9fd3ff'), { emissive: sun.clone(), emissiveIntensity: 0 }),
      leaf: mat(leaf),
      leaf2: mat(leaf.clone().lerp(sun, 0.2)),
      soil: mat(ink.clone().lerp(new THREE.Color('#8a5a33'), 0.6)),
      crop: mat(leaf.clone().lerp(sun, 0.55)),
      cloud: mat(new THREE.Color('#ffffff'), { roughness: 1 }),
      smoke: new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, roughness: 1 }),
    }
  }, [])
}

/** A piece that drops in once `on`: it falls from above, squashes as it lands, springs back and settles. */
function Drop({ on, children, from = 2.6, position = [0, 0, 0] as [number, number, number] }: { on: boolean; children: ReactNode; from?: number; position?: [number, number, number] }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(-1)
  const still = useMemo(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useFrame((_, dt) => {
    const o = g.current
    if (!o) return
    if (!on) {
      o.visible = false
      t.current = -1
      return
    }
    o.visible = true
    if (t.current < 0) t.current = 0
    t.current += Math.min(dt, 0.05)
    const s = still ? 9 : t.current
    const fall = 0.32
    if (s < fall) {
      // falling, a little stretched
      const k = s / fall
      o.position.y = position[1] + from * (1 - k * k)
      o.scale.set(0.94, 1.1, 0.94)
    } else {
      // landed: a squash that springs back and settles
      const u = s - fall
      const wob = Math.exp(-7 * u) * Math.sin(17 * u)
      o.position.y = position[1]
      o.scale.set(1 + 0.16 * wob, 1 - 0.22 * wob, 1 + 0.16 * wob)
    }
  })
  return (
    <group ref={g} position={position} visible={false}>
      {children}
    </group>
  )
}

/** A tree: a trunk and two cones of leaves. */
const Tree = ({ p, s = 1 }: { p: ReturnType<typeof usePalette>; s?: number }) => (
  <group scale={s}>
    <mesh material={p.wood} position={[0, 0.22, 0]}>
      <cylinderGeometry args={[0.07, 0.09, 0.44, 6]} />
    </mesh>
    <mesh material={p.leaf} position={[0, 0.62, 0]}>
      <coneGeometry args={[0.36, 0.6, 7]} />
    </mesh>
    <mesh material={p.leaf2} position={[0, 0.92, 0]}>
      <coneGeometry args={[0.26, 0.48, 7]} />
    </mesh>
  </group>
)

/** Smoke from the chimney: three puffs rising, growing and fading, over and over. */
function Smoke({ m }: { m: THREE.Material }) {
  const puffs = useRef<(THREE.Mesh | null)[]>([])
  useFrame(({ clock }) => {
    puffs.current.forEach((o, i) => {
      if (!o) return
      const k = (clock.elapsedTime * 0.45 + i / 3) % 1
      o.position.set(0.04 * Math.sin(k * 6 + i), k * 0.9, 0)
      o.scale.setScalar(0.06 + k * 0.14)
      ;(o.material as THREE.MeshStandardMaterial).opacity = 0.85 * (1 - k)
    })
  })
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(o) => void (puffs.current[i] = o)} material={(m as THREE.MeshStandardMaterial).clone()}>
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </group>
  )
}

/** Clouds drifting round the island. */
function Clouds({ m }: { m: THREE.Material }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y -= dt * 0.07
  })
  const cloud = (x: number, y: number, z: number, s: number) => (
    <group position={[x, y, z]} scale={s}>
      <mesh material={m}>
        <icosahedronGeometry args={[0.42, 1]} />
      </mesh>
      <mesh material={m} position={[0.42, -0.08, 0]}>
        <icosahedronGeometry args={[0.3, 1]} />
      </mesh>
      <mesh material={m} position={[-0.4, -0.1, 0.05]}>
        <icosahedronGeometry args={[0.28, 1]} />
      </mesh>
    </group>
  )
  return (
    <group ref={g}>
      {cloud(3.3, 1.9, -1.2, 0.9)}
      {cloud(-3.1, 2.4, -0.4, 0.7)}
      {cloud(0.6, 2.7, -3.2, 0.8)}
    </group>
  )
}

/** The island: grass on a cone of earth, the house building itself on it, its garden after. */
function Island({ p: share, ready, hop }: { p: number; ready: boolean; hop: number }) {
  const pal = usePalette()
  const turn = useRef<THREE.Group>(null)
  const lift = useRef<THREE.Group>(null)
  const hopAt = useRef(-9)
  const lastHop = useRef(hop)
  useFrame(({ clock }, dt) => {
    if (turn.current) turn.current.rotation.y += dt * 0.22
    if (hop !== lastHop.current) {
      lastHop.current = hop
      hopAt.current = clock.elapsedTime
    }
    if (lift.current) {
      const u = clock.elapsedTime - hopAt.current
      const jump = u >= 0 && u < 0.6 ? Math.sin((u / 0.6) * Math.PI) * 0.45 : 0
      lift.current.position.y = Math.sin(clock.elapsedTime * 1.3) * 0.06 + jump
    }
    pal.glass.emissiveIntensity = THREE.MathUtils.lerp(pal.glass.emissiveIntensity, ready ? 1.4 : 0.15, Math.min(1, dt * 3))
  })
  const at = (x: number) => share >= x
  return (
    <group ref={lift}>
      <group ref={turn} rotation={[0, -0.5, 0]}>
        {/* the ground */}
        <mesh material={pal.grass} position={[0, 0, 0]}>
          <cylinderGeometry args={[2.3, 2.15, 0.36, 9]} />
        </mesh>
        <mesh material={pal.earth} position={[0, -1.06, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[2.15, 1.76, 9]} />
        </mesh>
        {[
          [1.15, -0.45, 1.1],
          [-1.3, -0.55, 0.55],
          [0.2, -0.75, -1.3],
        ].map((r, i) => (
          <mesh key={i} material={pal.stone} position={r as [number, number, number]}>
            <dodecahedronGeometry args={[0.22 + i * 0.05, 0]} />
          </mesh>
        ))}
        <mesh material={pal.stone} position={[0, 0.19, 1.25]}>
          <boxGeometry args={[0.42, 0.03, 1.4]} />
        </mesh>
        {/* the house, piece by piece */}
        <Drop on={at(0.02)} position={[0, 0.24, 0]}>
          <mesh material={pal.stone}>
            <boxGeometry args={[1.56, 0.12, 1.24]} />
          </mesh>
        </Drop>
        <Drop on={at(0.14)} position={[0, 0.72, 0]}>
          <mesh material={pal.wall}>
            <boxGeometry args={[1.34, 0.86, 1.04]} />
          </mesh>
        </Drop>
        <Drop on={at(0.3)} position={[0, 1.5, 0]} from={3}>
          <mesh material={pal.roof} rotation={[0, Math.PI / 4, 0]} scale={[1.28, 1, 1.06]}>
            <coneGeometry args={[1.08, 0.72, 4]} />
          </mesh>
        </Drop>
        <Drop on={at(0.44)} position={[0.1, 0.52, 0.53]}>
          <mesh material={pal.wood}>
            <boxGeometry args={[0.3, 0.46, 0.05]} />
          </mesh>
        </Drop>
        <Drop on={at(0.5)} position={[-0.38, 0.78, 0.53]}>
          <mesh material={pal.glass}>
            <boxGeometry args={[0.26, 0.26, 0.05]} />
          </mesh>
          <mesh material={pal.glass} position={[0.86, 0, 0]}>
            <boxGeometry args={[0.2, 0.26, 0.05]} />
          </mesh>
        </Drop>
        <Drop on={at(0.58)} position={[0.42, 1.7, -0.18]}>
          <mesh material={pal.stone}>
            <boxGeometry args={[0.18, 0.44, 0.18]} />
          </mesh>
          <group position={[0, 0.26, 0]}>
            <Smoke m={pal.smoke} />
          </group>
        </Drop>
        {/* the garden */}
        <Drop on={at(0.66)} position={[-1.45, 0.18, -0.55]}>
          <Tree p={pal} />
        </Drop>
        <Drop on={at(0.72)} position={[1.5, 0.18, -0.45]}>
          <Tree p={pal} s={0.8} />
        </Drop>
        <Drop on={at(0.78)} position={[-1.15, 0.18, 1.05]}>
          <Tree p={pal} s={0.65} />
        </Drop>
        <Drop on={at(0.84)} position={[1.15, 0.22, 0.95]}>
          <mesh material={pal.soil}>
            <boxGeometry args={[0.7, 0.1, 0.5]} />
          </mesh>
          {[-0.2, 0, 0.2].map((x) =>
            [-0.12, 0.12].map((z) => (
              <mesh key={`${x}${z}`} material={pal.crop} position={[x, 0.1, z]}>
                <icosahedronGeometry args={[0.07, 0]} />
              </mesh>
            )),
          )}
        </Drop>
        <Drop on={at(0.9)} position={[0, 0.18, 0]} from={1.6}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * 0.2 + (i / 8) * Math.PI * 0.6
            return (
              <mesh key={i} material={pal.wood} position={[Math.cos(a) * 1.95, 0.16, Math.sin(a) * 1.95]}>
                <boxGeometry args={[0.07, 0.32, 0.07]} />
              </mesh>
            )
          })}
        </Drop>
      </group>
      <Clouds m={pal.cloud} />
    </group>
  )
}

/** The camera stands back far enough for the whole island to fit the stage, however narrow it is. */
function Fit() {
  const { camera, size } = useThree()
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height)
    const far = aspect >= 1 ? 7.4 : 7.4 + (1 - aspect) * 7.5
    camera.position.set(0, far * 0.36, far)
    camera.lookAt(0, 0.1, 0)
  })
  return null
}

export function Island3D({ p, ready, hop, onTap }: { p: number; ready: boolean; hop: number; onTap: () => void }) {
  return (
    <Canvas
      className="la3-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 2.7, 7.6], fov: 33 }}
      onPointerDown={onTap}
      aria-hidden="true"
    >
      <Fit />
      <hemisphereLight args={['#fff3d6', '#8fa860', 1.35]} />
      <directionalLight position={[-3, 5, 4]} intensity={ready ? 2.1 : 1.6} color="#fff1cf" />
      <directionalLight position={[4, 2, -3]} intensity={0.45} color="#ffd59a" />
      <directionalLight position={[0, -4, 5]} intensity={0.5} color="#ffd8a8" />
      <group position={[0, -0.1, 0]}>
        <Island p={p} ready={ready} hop={hop} />
      </group>
      <Sparkles count={36} scale={[6, 3.4, 4]} position={[0, 1.2, 0]} size={3.2} speed={0.35} opacity={0.9} color="#ffe39a" />
    </Canvas>
  )
}
