import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import {
  Color,
  type DirectionalLight,
  type FogExp2,
  type HemisphereLight,
  type InstancedMesh,
  type Mesh,
  type Object3D,
  type ShaderMaterial,
  type SkinnedMesh,
  type Vector3,
  type WebGLRenderer,
} from 'three'
import { assets } from '../assets/registry'
import { useSettings } from '../settings'
import { SUN, SUN_SHADOW } from '../data/layout'
import { ErrorBoundary } from '../lib/ErrorBoundary'
import { profile } from '../lib/profile'
import { setShadowCheck, sunLeftOut, view } from '../lib/visibility/pass'
import { useHome } from '../store'
import { moodAt, phaseDef } from '../farm/day'
import { DAY } from '../farm/data'
import { dayIsFrozen, farm } from '../farm/state'

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

/** How much the environment lights the scene at noon: the real HDRI's, or the generated probe's. */
const envIntensity = () => (assets.hdri && profile.hdri ? 0.75 : 0.4)

/** Image-based lighting: the real HDRI if one was dropped in, otherwise a generated daylight probe. */
function Ibl() {
  // own boundary: while an HDRI decodes, only this subtree is hidden — never the physics world
  return (
    <Suspense fallback={null}>
      {assets.hdri && profile.hdri ? (
        <Environment files={assets.hdri} background={false} environmentIntensity={envIntensity()} />
      ) : (
        <Environment frames={1} resolution={128} far={900} background={false} environmentIntensity={envIntensity()}>
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
function instancesMoved(m: InstancedMesh, keeping: boolean): number {
  const attr = m.instanceMatrix
  const src = attr.array as Float32Array
  const copy = instanceCopies.get(m)
  if (copy && copy.version === attr.version && copy.count === m.count) return 0
  if (!copy || copy.data.length !== src.length) {
    instanceCopies.set(m, { version: attr.version, count: m.count, data: Float32Array.from(src) })
    return Infinity
  }
  // how far the farthest instance went since the map was last drawn (any change of count is a move)
  let most = copy.count !== m.count ? Infinity : 0
  for (let i = 0; most <= EPS && i < m.count * 16; i++) most = Math.max(most, Math.abs(src[i] - copy.data[i]))
  copy.version = attr.version
  copy.count = m.count
  // the copy is where they were drawn: kept up to date only as the map is (a drift under a millimetre is drawn again
  // only while the map is kept)
  if (most > (keeping ? DRIFT : EPS)) copy.data.set(src)
  return most
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
      // moved: more than EPS since the map was drawn; a caster in the map more than DRIFT from where it was drawn has the
      // map drawn again (a body easing to a stop after a turn, a door settling: under a millimetre, but the map is to be
      // exactly a full redraw's); one out of the map, before and now, leaves it as it is
      let moved = false
      let dirty = false
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
        if ((o as InstancedMesh).isInstancedMesh) {
          const most = instancesMoved(o as InstancedMesh, keeping)
          if (most > EPS) far = true
          if (most > DRIFT) differs = true
        }
        if (!differs) continue
        if (keeping && ((shown === 0 && s[base] === 0) || sunLeftOut(own[i], culling))) {
          // not in the map, before or now: where it is changes nothing in it
          if (far) moved = true
          s[base] = shown
          for (let k = 0; k < MATRIX.length; k++) s[base + 1 + k] = e[MATRIX[k]]
        } else if (far) dirty = moved = true
        else if (keeping) dirty = true
      }
      if (dirty) {
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

  // every frame, before the map may be kept: is the list of casters still the scene's? A mesh that mounts or is made
  // again (a pickup dropped is a new mesh) must be in the map at once: kept without it, its shadow would lag (walked
  // against the list in place, so a frame where nothing changed allocates nothing)
  const walk = useMemo(() => {
    let n = 0
    let same = true
    let tracked = new Set<Object3D>()
    const visit = (o: Object3D) => {
      if (!same || !(o as Mesh).isMesh || !(o.castShadow || tracked.has(o))) return
      if (state.casters[n++] !== o) same = false
      const skeleton = (o as SkinnedMesh).isSkinnedMesh ? (o as SkinnedMesh).skeleton : null
      if (skeleton) for (const bone of skeleton.bones) if (same && state.casters[n++] !== bone) same = false
    }
    return {
      unchanged: () => {
        n = 0
        same = true
        scene.traverse(visit)
        return same && n === state.casters.length
      },
      track: () => {
        tracked = new Set(state.casters)
      },
    }
  }, [scene, state])

  useFrame(() => {
    state.frame++
    if (!walk.unchanged()) {
      // what casts now: meshes mount, pickups are made again when dropped, a slab stops casting (one that stopped stays
      // on the list, so the map knows it is gone)
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
      state.casters = list
      state.owners = own
      state.snap = new Float64Array(list.length * SNAP)
      walk.track()
      gl.shadowMap.needsUpdate = true
      view.stats.mapDrawn++
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

// ───────────────────────────── the day's light ─────────────────────────────

/** The light at noon, as it always was: the sun's, the sky's and the ground's colours, the haze and the background. */
const NOON = { sun: 2.5, sunColor: '#ffd9a0', hemi: 0.24, sky: '#dfe9ff', ground: '#4a3d32', fog: '#aab4c0', background: '#a9c4e0' } as const
/** What each colour turns towards as the day goes, and how far: orange at sunrise and sunset (by `k[0]` of the mood's
 *  `warm`, above 0), moonlit blue at night (by `k[1]` of it, below 0) — the sun most, the haze least. */
interface Tint {
  warm: Color
  cool: Color
  k: readonly [number, number]
}
const TINT: Record<'sun' | 'sky' | 'haze', Tint> = {
  sun: { warm: new Color('#ff8a3c'), cool: new Color('#8fa8ff'), k: [0.55, 1] },
  sky: { warm: new Color('#ffc58f'), cool: new Color('#6f86d0'), k: [0.5, 0.9] },
  haze: { warm: new Color('#e8a774'), cool: new Color('#4f5d84'), k: [0.45, 0.7] },
}
/** The sun's height in the sky you see (degrees), at noon (SUN's own) and at its lowest (night: just under the
 *  horizon, so the sky is a deep blue with the last of the light low down). Only the sky's picture: the sun's light and
 *  its shadows never move. */
const SUN_UP = (Math.atan2(SUN[1], Math.hypot(SUN[0], SUN[2])) * 180) / Math.PI
const SUN_LOW = -1.2
const DAY_MIN = DAY.minLight

const base = {
  sun: new Color(NOON.sunColor),
  sky: new Color(NOON.sky),
  ground: new Color(NOON.ground),
  fog: new Color(NOON.fog),
  background: new Color(NOON.background),
}
/** A colour turned by the day's warmth. */
function tint(out: Color, from: Color, warm: number, to: Tint) {
  out.copy(from)
  if (warm > 0) out.lerp(to.warm, warm * to.k[0])
  else if (warm < 0) out.lerp(to.cool, -warm * to.k[1])
  return out
}

/**
 * The time of day (src/farm/day.ts, moodAt): the sun's and the sky light's colour and strength, how much the
 * environment lights, the haze and the background, and the sun's height in the sky you see — never a light added or
 * taken away, never the sun moved, never its shadow camera, so nothing drawn changes, only how bright and what colour.
 * With the day stopped (the tests: freezeDay) it is noon, as the light always was.
 */
function DayLight({ sun, hemi, sky }: { sun: { current: DirectionalLight | null }; hemi: { current: HemisphereLight | null }; sky: { current: { material: unknown } | null } }) {
  const scene = useThree((s) => s.scene)
  const noon = phaseDef('noon').mood
  useFrame(() => {
    const m = dayIsFrozen() ? noon : moodAt(farm.day.t)
    const s = sun.current
    if (s) {
      s.intensity = NOON.sun * m.sun
      tint(s.color, base.sun, m.warm, TINT.sun)
    }
    const h = hemi.current
    if (h) {
      h.intensity = NOON.hemi * m.sky
      tint(h.color, base.sky, m.warm, TINT.sky)
      h.groundColor.copy(base.ground)
    }
    // set every frame: the environment's own component sets it again whenever it renders
    scene.environmentIntensity = envIntensity() * m.sky
    const fog = scene.fog as FogExp2 | null
    if (fog) tint(fog.color, base.fog, m.warm, TINT.haze).multiplyScalar(m.sky)
    const bg = scene.background as Color | null
    if (bg?.isColor) tint(bg, base.background, m.warm, TINT.haze).multiplyScalar(m.sky)
    // the sky's own sun (a copy of SUN, lowered towards the horizon as the light goes: a sunset sky, a night sky)
    const uniform = (sky.current?.material as ShaderMaterial | undefined)?.uniforms?.sunPosition
    if (uniform) {
      const k = Math.max(0, Math.min(1, (m.sun - DAY_MIN) / (1 - DAY_MIN)))
      const up = SUN_LOW + (SUN_UP - SUN_LOW) * k * k * k
      const flat = Math.hypot(SUN[0], SUN[2])
      ;(uniform.value as Vector3).set(SUN[0], k >= 1 ? SUN[1] : flat * Math.tan((up * Math.PI) / 180), SUN[2])
    }
  })
  return null
}

// shadow map resolution per tier comes from the device profile (low: half, and the cheaper filter comes from
// fewer texels to fetch; phones: 1k below the top tier)

export function Lighting() {
  const markReady = useHome((s) => s.markReady)
  const haze = useSettings((s) => s.haze)
  const quality = useHome((s) => s.quality)
  const gl = useThree((s) => s.gl)
  const sun = useRef<DirectionalLight>(null)
  const hemi = useRef<HemisphereLight>(null)
  const sky = useRef<ComponentRef<typeof Sky>>(null)
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
      <color attach="background" args={[NOON.background]} />
      {/* haze: distant things sink into a pale grey-blue, which is what makes the rooms and the garden feel deep */}
      <fogExp2 attach="fog" args={[NOON.fog, haze ? 0.04 : 0.0006]} />
      {/* the sky you see through windows and over the roof (the outside, for the drawing pass: src/lib/visibility) */}
      <group userData={{ cell: 'outside' }}>
        <Sky ref={sky} distance={900} sunPosition={SUN_DIR} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
      </group>
      <ErrorBoundary fallback={null} onError={() => markReady('env')}>
        <Ibl />
      </ErrorBoundary>
      <hemisphereLight ref={hemi} args={[NOON.sky, NOON.ground, NOON.hemi]} />
      <DayLight sun={sun} hemi={hemi} sky={sky} />
      <ShadowDirector />
      <directionalLight
        ref={sun}
        position={[SUN[0] * SUN_SHADOW.scale, SUN[1] * SUN_SHADOW.scale, SUN[2] * SUN_SHADOW.scale]}
        intensity={NOON.sun}
        color={NOON.sunColor}
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-left={-SUN_SHADOW.half}
        shadow-camera-right={SUN_SHADOW.half}
        shadow-camera-top={SUN_SHADOW.half}
        shadow-camera-bottom={-SUN_SHADOW.half}
        shadow-camera-near={SUN_SHADOW.near}
        shadow-camera-far={SUN_SHADOW.far}
        shadow-radius={3}
        shadow-bias={-0.0003}
        shadow-normalBias={0.025}
      />
    </>
  )
}
