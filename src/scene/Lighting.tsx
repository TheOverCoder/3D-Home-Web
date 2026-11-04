import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import type { DirectionalLight, InstancedMesh, Mesh, Object3D, SkinnedMesh } from 'three'
import { assets } from '../assets/registry'
import { useSettings } from '../settings'
import { SUN } from '../data/layout'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { useHome } from '../store'

const SUN_DIR = SUN

function EnvReady() {
  const markReady = useHome((s) => s.markReady)
  useEffect(() => markReady('env'), [markReady])
  return null
}

/** Daylight as seen from outside: sky dome over a lawn-coloured disc. Lights the scene when there is no real HDRI. */
function DaylightProbe() {
  return (
    <>
      <Sky distance={400} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -2, 0]}>
        <circleGeometry args={[200, 16]} />
        <meshBasicMaterial color="#7d7566" />
      </mesh>
    </>
  )
}

/** Image-based lighting: the real HDRI if one was dropped in, otherwise a generated daylight probe. */
function Ibl() {
  // own boundary: while an HDRI decodes, only this subtree is hidden — never the physics world
  return (
    <Suspense fallback={null}>
      {assets.hdri ? (
        <Environment files={assets.hdri} background={false} environmentIntensity={0.75} />
      ) : (
        <Environment frames={1} resolution={128} far={900} background={false} environmentIntensity={0.4}>
          <DaylightProbe />
        </Environment>
      )}
      <EnvReady />
    </Suspense>
  )
}

// whether a caster is drawn into the shadow map, plus the rotation/scale (9) and position (3) parts of its
// world matrix
const SNAP = 1 + 12
const MATRIX = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]
const EPS = 1e-3 // 1 mm: a shadow texel here is ~12 mm, so smaller drifts (physics settling) cannot show

// instanced meshes: drei's <Instances> re-uploads its matrices every frame whether or not anything moved, so
// the attribute version says nothing; compare the matrices themselves (only when the version moved)
const instanceCopies = new WeakMap<InstancedMesh, { version: number; count: number; data: Float32Array }>()
function instancesMoved(m: InstancedMesh): boolean {
  const attr = m.instanceMatrix
  const src = attr.array as Float32Array
  const copy = instanceCopies.get(m)
  if (copy && copy.version === attr.version && copy.count === m.count) return false
  if (!copy || copy.data.length !== src.length) {
    instanceCopies.set(m, { version: attr.version, count: m.count, data: Float32Array.from(src) })
    return true
  }
  let moved = copy.count !== m.count
  for (let i = 0; !moved && i < m.count * 16; i++) moved = Math.abs(src[i] - copy.data[i]) > EPS
  copy.version = attr.version
  copy.count = m.count
  if (moved) copy.data.set(src)
  return moved
}

function drawnInShadow(o: Object3D, scene: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false
    if (p === scene) return true
  }
  return false // detached (unmounted): its shadow must go
}

/**
 * The sun's shadow map is the biggest pass in the frame: its camera sees the whole house, so it draws more
 * than the view itself (~240 of ~410 draws). Almost everything in the house is static, so the map is drawn only
 * on frames where a caster moved, appeared, vanished or switched casting — standing still or reading a screen,
 * the sun costs nothing. The check reads last frame's world matrices: at most one frame late, never wrong for long.
 */
function ShadowDirector() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const casters = useRef<Object3D[]>([])
  const owners = useRef<Object3D[]>([]) // the mesh whose visibility decides (a bone follows its skinned mesh)
  const snap = useRef(new Float32Array(0))
  const frame = useRef(0)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])

  useFrame(() => {
    let dirty = false
    if (frame.current++ % 10 === 0) {
      // re-collect now and then: meshes mount, pickups are re-created when dropped, a slab stops casting
      const tracked = new Set(casters.current)
      const list: Object3D[] = []
      const own: Object3D[] = []
      scene.traverse((o) => {
        if (!(o as Mesh).isMesh || !(o.castShadow || tracked.has(o))) return
        list.push(o)
        own.push(o)
        const skeleton = (o as SkinnedMesh).isSkinnedMesh ? (o as SkinnedMesh).skeleton : null
        if (skeleton) for (const bone of skeleton.bones) (list.push(bone), own.push(o))
      })
      if (list.length !== casters.current.length || list.some((o, i) => o !== casters.current[i])) {
        casters.current = list
        owners.current = own
        snap.current = new Float32Array(list.length * SNAP)
        dirty = true
      }
    }
    const list = casters.current
    const own = owners.current
    const s = snap.current
    for (let i = 0; i < list.length; i++) {
      const o = list[i]
      const base = i * SNAP
      const shown = own[i].castShadow && drawnInShadow(own[i], scene) ? 1 : 0
      const e = o.matrixWorld.elements
      let changed = s[base] !== shown
      for (let k = 0; !changed && k < MATRIX.length; k++) changed = Math.abs(s[base + 1 + k] - e[MATRIX[k]]) > EPS
      if ((o as InstancedMesh).isInstancedMesh && instancesMoved(o as InstancedMesh)) changed = true
      if (!changed) continue
      dirty = true
      s[base] = shown
      for (let k = 0; k < MATRIX.length; k++) s[base + 1 + k] = e[MATRIX[k]]
    }
    if (dirty) gl.shadowMap.needsUpdate = true
  })
  return null
}

// shadow map resolution per tier (low: half, and the cheaper filter comes from fewer texels to fetch)
const SHADOW_SIZE = { high: 2048, medium: 2048, low: 1024 } as const

export function Lighting() {
  const markReady = useHome((s) => s.markReady)
  const haze = useSettings((s) => s.haze)
  const quality = useHome((s) => s.quality)
  const gl = useThree((s) => s.gl)
  const sun = useRef<DirectionalLight>(null)
  const size = SHADOW_SIZE[quality]
  const applied = useRef(size)
  useEffect(() => {
    const light = sun.current
    if (!light || applied.current === size) return
    // a new size needs a new render target; three makes one on the next shadow render
    applied.current = size
    light.shadow.mapSize.set(size, size)
    light.shadow.map?.dispose()
    light.shadow.map = null
    gl.shadowMap.needsUpdate = true
  }, [size, gl])
  return (
    <>
      <color attach="background" args={['#a9c4e0']} />
      {/* haze: distant things sink into a pale grey-blue, which is what makes the rooms and the garden feel deep */}
      <fogExp2 attach="fog" args={['#aab4c0', haze ? 0.04 : 0.0006]} />
      {/* the sky you see through windows and over the roof */}
      <Sky distance={900} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      <ErrorBoundary fallback={null} onError={() => markReady('env')}>
        <Ibl />
      </ErrorBoundary>
      <hemisphereLight args={['#dfe9ff', '#4a3d32', 0.24]} />
      <ShadowDirector />
      <directionalLight
        ref={sun}
        position={[SUN[0] * 1.6, SUN[1] * 1.6, SUN[2] * 1.6]}
        intensity={2.5}
        color="#ffd9a0"
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-radius={3}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
    </>
  )
}
