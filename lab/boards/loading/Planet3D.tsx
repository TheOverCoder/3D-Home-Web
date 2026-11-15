import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

// F's little world in 3D (three.js through @react-three/fiber): a tiny round planet with the farm on it — the house on
// top, trees, a windmill turning, striped fields, fence posts — spinning slowly, while the sun comes up round it as the
// game loads: night at the start (the moon up, cool light), dawn in the middle, full day when ready (the sun high, warm
// light; the windmill hurries and the planet hops). About 2,000 triangles, flat colours, no shadow map. Its colours
// are the game's tokens, read from the page.

const token = (name: string, or: string) => {
  const v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return new THREE.Color(v || or)
}

const NIGHT = new THREE.Color('#5b6cc4')
const DAY = new THREE.Color('#fff1cf')

/** Something standing on the planet at a latitude and longitude (radians), its foot on the ground. */
const On = ({ lat, lon, r = 1.6, children }: { lat: number; lon: number; r?: number; children: ReactNode }) => {
  const q = useMemo(() => {
    const up = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon))
    return { pos: up.clone().multiplyScalar(r), rot: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up) }
  }, [lat, lon, r])
  return (
    <group position={q.pos} quaternion={q.rot}>
      {children}
    </group>
  )
}

function World({ p, ready, hop }: { p: number; ready: boolean; hop: number }) {
  const pal = useMemo(() => {
    const leaf = token('--leaf', '#2c8540')
    const sun = token('--sun', '#ffc93c')
    const ink = token('--ink', '#3b2a1e')
    const mat = (c: THREE.Color) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })
    return {
      ground: mat(leaf.clone().lerp(sun, 0.3).lerp(new THREE.Color('#fff'), 0.14)),
      leaf: mat(leaf),
      leaf2: mat(leaf.clone().lerp(sun, 0.25)),
      wood: mat(ink.clone().lerp(token('--sun-lip', '#d39a1c'), 0.5)),
      wall: mat(token('--paper', '#fff7e8')),
      roof: mat(token('--berry', '#d2452f')),
      field: mat(sun.clone().lerp(new THREE.Color('#fff'), 0.1)),
      soil: mat(ink.clone().lerp(new THREE.Color('#8a5a33'), 0.6)),
      blade: mat(token('--paper', '#fff7e8')),
      sun: new THREE.MeshBasicMaterial({ color: sun }),
      moon: new THREE.MeshBasicMaterial({ color: '#fff8e0' }),
    }
  }, [])
  const spin = useRef<THREE.Group>(null)
  const lift = useRef<THREE.Group>(null)
  const blades = useRef<THREE.Group>(null)
  const sky = useRef<THREE.Group>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.HemisphereLight>(null)
  const hopAt = useRef(-9)
  const lastHop = useRef(hop)
  const day = useRef(p)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    day.current = THREE.MathUtils.lerp(day.current, ready ? 1 : p, Math.min(1, dt * 2))
    const d = day.current
    if (spin.current) spin.current.rotation.y += dt * 0.28
    if (blades.current) blades.current.rotation.z -= dt * (ready ? 6 : 2.2)
    // the sun and the moon on one wheel round the planet: night, dawn, noon
    if (sky.current) sky.current.rotation.z = THREE.MathUtils.lerp(-2.6, 0, d)
    if (key.current) {
      key.current.intensity = 0.7 + d * 2.2
      key.current.color.copy(NIGHT).lerp(DAY, d)
      const a = THREE.MathUtils.lerp(-2.6, 0, d) + Math.PI / 2
      key.current.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 4)
    }
    if (fill.current) fill.current.intensity = 1 + d * 0.9
    if (hop !== lastHop.current) {
      lastHop.current = hop
      hopAt.current = t
    }
    if (lift.current) {
      const u = t - hopAt.current
      lift.current.position.y = Math.sin(t * 1.2) * 0.05 + (u >= 0 && u < 0.6 ? Math.sin((u / 0.6) * Math.PI) * 0.4 : 0)
    }
  })
  const tree = (s = 1) => (
    <group scale={s}>
      <mesh material={pal.wood} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.24, 5]} />
      </mesh>
      <mesh material={pal.leaf} position={[0, 0.38, 0]}>
        <icosahedronGeometry args={[0.2, 0]} />
      </mesh>
    </group>
  )
  return (
    <>
      <hemisphereLight ref={fill} args={['#fff3d6', '#8c90b8', 1]} />
      <directionalLight ref={key} position={[0, 6, 4]} intensity={1} />
      <group ref={sky}>
        <mesh material={pal.sun} position={[0, 4.2, -2]}>
          <icosahedronGeometry args={[0.42, 1]} />
        </mesh>
        <mesh material={pal.moon} position={[0, -4.2, -2]}>
          <icosahedronGeometry args={[0.26, 1]} />
        </mesh>
      </group>
      <group ref={lift}>
        <group rotation={[0.42, 0, 0.12]}>
          <group ref={spin}>
            <mesh material={pal.ground}>
              <icosahedronGeometry args={[1.6, 2]} />
            </mesh>
            {/* the house */}
            <On lat={1.25} lon={0}>
              <mesh material={pal.wall} position={[0, 0.2, 0]}>
                <boxGeometry args={[0.46, 0.36, 0.38]} />
              </mesh>
              <mesh material={pal.roof} position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.2, 1, 1]}>
                <coneGeometry args={[0.38, 0.28, 4]} />
              </mesh>
            </On>
            {/* the windmill */}
            <On lat={0.35} lon={1.4}>
              <mesh material={pal.wall} position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.08, 0.14, 0.6, 6]} />
              </mesh>
              <group ref={blades} position={[0, 0.58, 0.1]}>
                {[0, 1, 2, 3].map((i) => (
                  <mesh key={i} material={pal.blade} rotation={[0, 0, (i * Math.PI) / 2]} position={[0, 0, 0]}>
                    <boxGeometry args={[0.05, 0.5, 0.02]} />
                  </mesh>
                ))}
              </group>
            </On>
            {/* fields */}
            {[
              [0.5, -1.0],
              [-0.2, 2.6],
              [0.1, -2.2],
            ].map(([lat, lon], i) => (
              <On key={i} lat={lat} lon={lon}>
                {[-0.12, 0, 0.12].map((x) => (
                  <mesh key={x} material={i % 2 ? pal.soil : pal.field} position={[x, 0.02, 0]}>
                    <boxGeometry args={[0.08, 0.05, 0.42]} />
                  </mesh>
                ))}
              </On>
            ))}
            {/* trees */}
            {[
              [0.9, 0.9, 1],
              [0.7, -0.6, 0.8],
              [-0.3, 0.6, 1.1],
              [-0.6, -1.6, 0.9],
              [0.2, 3.4, 1],
              [-1.0, 2.0, 0.8],
              [1.0, 2.5, 0.9],
            ].map(([lat, lon, s], i) => (
              <On key={i} lat={lat} lon={lon}>
                {tree(s)}
              </On>
            ))}
            {/* fence posts round the house */}
            {Array.from({ length: 8 }, (_, i) => (
              <On key={i} lat={1.02} lon={(i / 8) * Math.PI * 2}>
                <mesh material={pal.wood} position={[0, 0.07, 0]}>
                  <boxGeometry args={[0.035, 0.14, 0.035]} />
                </mesh>
              </On>
            ))}
          </group>
        </group>
      </group>
    </>
  )
}

/** The camera stands back far enough for the planet and the sun's wheel to fit, however narrow the stage is. */
function Fit() {
  const { camera, size } = useThree()
  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height)
    const far = aspect >= 1 ? 9 : 9 + (1 - aspect) * 9
    camera.position.set(0, 0.6, far)
    camera.lookAt(0, 0.3, 0)
  })
  return null
}

export function Planet3D({ p, ready, hop, onTap }: { p: number; ready: boolean; hop: number; onTap: () => void }) {
  return (
    <Canvas
      className="lf-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0.6, 9], fov: 34 }}
      onPointerDown={onTap}
      aria-hidden="true"
    >
      <Fit />
      <World p={p} ready={ready} hop={hop} />
    </Canvas>
  )
}
