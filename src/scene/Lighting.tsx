import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import type { DirectionalLight, InstancedMesh, Mesh, Object3D, SkinnedMesh, WebGLRenderer } from 'three'
import { assets } from '../assets/registry'
import { useSettings } from '../settings'
import { SUN } from '../data/layout'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { profile } from '../lib/profile'
import { setShadowCheck, sunLeftOut, view } from '../lib/visibility/pass'
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
      {assets.hdri && profile.hdri ? (
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
// 1 µm: a step of the map's 24-bit depth over the sun's 59 m is 3.5 µm, so less cannot change a texel (matrices made
// again each frame differ by ~1e-15)
const DRIFT = 1e-6

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
 * the sun costs nothing. A caster the drawing pass left out of the map, and leaves out now (out of the sun's view, or
 * indoors where no window lets sunlight in: your own body walking and turning in a room), changes nothing in it: the
 * map is kept (src/lib/visibility, `sunLeftOut`). The check runs in the render itself, where every matrix is final,
 * just before the shadow pass (the drawing pass calls it: `setShadowCheck`), so the map is never a frame behind.
 */
function ShadowDirector() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  // the casters, the mesh whose visibility decides for each (a bone follows its skinned mesh), what each was when the
  // map was drawn (whether it was drawn into it, where); whether this frame's check is still to run, and frames since a render last ran it
  const state = useMemo(
    () => ({
      casters: [] as Object3D[],
      owners: [] as Object3D[],
      snap: new Float64Array(0),
      shown: new Uint8Array(0),
      frame: 0,
      due: false,
      unchecked: 0,
      check: null as null | ((r: WebGLRenderer, culling: boolean) => void),
    }),
    [],
  )

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    // once a frame, in its first render by the game's camera (not in one made to measure, or by a test): what changed
    // since the last check. What is not in the map, before or now, leaves it as it is: a caster hidden both times, or
    // one the sun's pass leaves out (`culling`: this render leaves out what no sunlight reaches)
    const check = (renderer: WebGLRenderer, culling: boolean) => {
      if (!state.due) return
      state.due = false
      state.unchecked = 0
      const { casters: list, owners: own, snap: s } = state
      const keeping = view.on && view.keep
      // moved: more than EPS since the map was drawn (it is drawn again, as ever); in the map and not where it was drawn
      // (more than DRIFT off): the map may not be kept for a move of anything else
      let moved = false
      let dirty = false
      let drift = false
      if (state.shown.length < list.length) state.shown = new Uint8Array(list.length)
      for (let i = 0; i < list.length; i++) {
        const o = list[i]
        const base = i * SNAP
        const shown = own[i].castShadow && drawnInShadow(own[i], scene) ? 1 : 0
        state.shown[i] = shown
        const e = o.matrixWorld.elements
        let far = s[base] !== shown
        let differs = far
        for (let k = 0; !far && k < MATRIX.length; k++) {
          const d = Math.abs(s[base + 1 + k] - e[MATRIX[k]])
          if (d > EPS) far = true
          if (d > DRIFT) differs = true
        }
        if ((o as InstancedMesh).isInstancedMesh && instancesMoved(o as InstancedMesh)) far = differs = true
        if (!differs) continue
        if (keeping && ((shown === 0 && s[base] === 0) || sunLeftOut(own[i], culling))) {
          // not in the map, before or now: where it is changes nothing in it
          if (far) moved = true
          s[base] = shown
          for (let k = 0; k < MATRIX.length; k++) s[base + 1 + k] = e[MATRIX[k]]
        } else if (far) dirty = moved = true
        else drift = true
      }
      if (dirty || (moved && drift)) {
        renderer.shadowMap.needsUpdate = true
        view.stats.mapDrawn++
        // the map has everything where it is now
        for (let i = 0; i < list.length; i++) {
          const e = list[i].matrixWorld.elements
          s[i * SNAP] = state.shown[i]
          for (let k = 0; k < MATRIX.length; k++) s[i * SNAP + 1 + k] = e[MATRIX[k]]
        }
      } else if (moved) view.stats.mapKept++
    }
    state.check = check
    const stop = setShadowCheck(check)
    return () => {
      stop()
      state.check = null
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, scene, state])

  useFrame(() => {
    if (state.frame++ % 10 === 0) {
      // re-collect now and then: meshes mount, pickups are re-created when dropped, a slab stops casting
      const tracked = new Set(state.casters)
      const list: Object3D[] = []
      const own: Object3D[] = []
      scene.traverse((o) => {
        if (!(o as Mesh).isMesh || !(o.castShadow || tracked.has(o))) return
        list.push(o)
        own.push(o)
        const skeleton = (o as SkinnedMesh).isSkinnedMesh ? (o as SkinnedMesh).skeleton : null
        if (skeleton)
          for (const bone of skeleton.bones) {
            list.push(bone)
            own.push(o)
          }
      })
      if (list.length !== state.casters.length || list.some((o, i) => o !== state.casters[i])) {
        state.casters = list
        state.owners = own
        state.snap = new Float64Array(list.length * SNAP)
        gl.shadowMap.needsUpdate = true
        view.stats.mapDrawn++
      }
    }
    // this frame's check, in its render; with no render to run it (the drawing pass not installed), here, on last
    // frame's matrices
    state.due = true
    if (++state.unchecked > 2) state.check?.(gl, false)
  })
  return null
}

/** The sun, for the drawing pass (src/lib/visibility): its shadow map leaves out what no sunlight reaches. */
export const sunLight = { current: null as DirectionalLight | null }

// shadow map resolution per tier comes from the device profile (low: half, and the cheaper filter comes from
// fewer texels to fetch; phones: 1k below the top tier)

export function Lighting() {
  const markReady = useHome((s) => s.markReady)
  const haze = useSettings((s) => s.haze)
  const quality = useHome((s) => s.quality)
  const gl = useThree((s) => s.gl)
  const sun = useRef<DirectionalLight>(null)
  const size = profile.shadowMap[quality]
  const applied = useRef(size)
  useEffect(() => {
    sunLight.current = sun.current
    return () => {
      sunLight.current = null
    }
  }, [])
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
      {/* the sky you see through windows and over the roof (the outside, for the drawing pass: src/lib/visibility) */}
      <group userData={{ cell: 'outside' }}>
        <Sky distance={900} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      </group>
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
