import { Environment, OrbitControls, Sky } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AgXToneMapping, DirectionalLight, MathUtils, Object3D, PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import hdri from '../../src/assets/hdri/home.jpg?url'
import { SUN, SUN_SHADOW } from '../../src/data/layout'
import type { V3 } from '../../src/lib/sculpt'
import { Minus, Plus } from '../../src/ui/glyphs'
import './ModelView.css'

// A 3D board's view (the 3D designer's, .claude/agents/3d-designer.md): what a proposal looks like in the game, in the
// game's own light — its sun and shadows, the sky light from its HDRI, the haze, AgX tone mapping and a touch of its
// grade (src/scene/Lighting.tsx, src/scene/Effects.tsx), not the film stage's market (lab/films/stage3d.ts): only its
// way of lighting is taken. Two kinds of view:
//   eye    the player's own eyes in first person (1.62 m up, the game's field of view upright and sideways); a drag
//          looks round, as the game's does
//   orbit  turning round the model under a finger (a pinch, or + and −, to come closer)
// A corner chip gives the triangles it draws against the weight of what it replaces (or what it adds). One canvas,
// drawn only when something changes, unless something moves.

/** The game's light at noon (src/scene/Lighting.tsx, NOON) and its sky light (the HDRI, as strong as on a phone). */
const NOON = { sun: 2.5, sunColor: '#ffd9a0', hemi: 0.24, sky: '#dfe9ff', ground: '#4a3d32', fog: '#aab4c0', background: '#a9c4e0', env: 0.75 } as const
/** The first person's field of view (src/settings.ts and src/scene/Player.tsx: 72°, and 12° more upright). */
const FOV = { wide: 72, tall: 84 }
const EYE_HEIGHT = 1.62

export type View3D =
  /** the player's eye at `at` (its height is the eye's), looking at `look` */
  | { kind: 'eye'; at: V3; look: V3 }
  /** turning round `target`, `distance` metres away, from `azimuth` degrees round (0: from +z) and `elevation` up */
  | { kind: 'orbit'; target: V3; size: [number, number]; azimuth: number; elevation: number }

export interface Built {
  root: Object3D
  /** what moves, posed at t seconds (the view draws every frame only when something does) */
  tick?: (t: number) => void
}

export interface Count {
  /** the triangles the proposal draws */
  triangles: number
  /** the weight of what it replaces (none: it is new, and adds them) */
  weight?: number
}

/** What a model's checks found (src/lib/sculpt/check.ts), by model: shown in the chip and in the console. */
export type Checks = () => string[]

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

/** The sun of the game: its direction, strength and shadow box (as Lighting.tsx sets them), its box round `focus`. */
function Sun({ focus }: { focus: V3 }) {
  const light = useRef<DirectionalLight>(null)
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    const l = light.current
    if (!l) return
    const k = SUN_SHADOW.scale
    l.position.set(focus[0] + SUN[0] * k, focus[1] + SUN[1] * k, focus[2] + SUN[2] * k)
    l.target.position.set(...focus)
    scene.add(l.target)
    return () => void scene.remove(l.target)
  }, [focus, scene])
  return (
    <directionalLight
      ref={light}
      intensity={NOON.sun}
      color={NOON.sunColor}
      castShadow
      shadow-mapSize={[1024, 1024]}
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
  )
}

/** First person: the eye where the view puts it, the game's field of view for the screen's way round, a drag to look. */
function Eye({ at, look }: { at: V3; look: V3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const turn = useRef({ yaw: 0, pitch: 0 })
  useLayoutEffect(() => {
    const d = new Vector3(look[0] - at[0], look[1] - at[1], look[2] - at[2]).normalize()
    // as the game's look: yaw 0 looks along −z
    turn.current = { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(d.y) }
  }, [at, look])
  useLayoutEffect(() => {
    camera.fov = size.height > size.width ? FOV.tall : FOV.wide
    camera.near = 0.1
    camera.far = 1500
    camera.position.set(...at)
    camera.rotation.set(turn.current.pitch, turn.current.yaw, 0, 'YXZ')
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, at, invalidate])
  useEffect(() => {
    const el = gl.domElement
    let last: { x: number; y: number; id: number } | null = null
    const down = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!last || e.pointerId !== last.id) return
      const t = turn.current
      t.yaw -= (e.clientX - last.x) * 0.006
      t.pitch = MathUtils.clamp(t.pitch - (e.clientY - last.y) * 0.006, -1.2, 1.2)
      last = { x: e.clientX, y: e.clientY, id: e.pointerId }
      camera.rotation.set(t.pitch, t.yaw, 0, 'YXZ')
      invalidate()
    }
    const up = () => (last = null)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [gl, camera, invalidate])
  return null
}

/** Turning round the model: placed from the view's angles, then the finger's. */
/** How far away the camera stands to see something `size` (metres across and up) whole on this screen. */
function fitDistance(size: [number, number], fov: number, aspect: number) {
  const tan = Math.tan(MathUtils.degToRad(fov) / 2)
  return Math.max((size[1] * 0.58) / tan, (size[0] * 0.56) / (tan * aspect)) * 1.06
}

function Orbit({ view, controls }: { view: Extract<View3D, { kind: 'orbit' }>; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const tall = size.height > size.width
  const fov = tall ? 50 : 40
  const distance = fitDistance(view.size, fov, size.width / Math.max(1, size.height))
  // placed from the view's angles whenever the view or the screen's way round changes: a drag turns it from there
  useLayoutEffect(() => {
    const az = MathUtils.degToRad(view.azimuth)
    const el = MathUtils.degToRad(view.elevation)
    const [x, y, z] = view.target
    camera.fov = fov
    camera.near = 0.05
    camera.far = 600
    camera.position.set(x + Math.sin(az) * Math.cos(el) * distance, y + Math.sin(el) * distance, z + Math.cos(az) * Math.cos(el) * distance)
    camera.lookAt(x, y, z)
    camera.updateProjectionMatrix()
    controls.current?.target.set(x, y, z)
    controls.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, camera, controls, tall])
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={false} minDistance={distance * 0.3} maxDistance={distance * 2} maxPolarAngle={1.5} />
}

/** The scene once built; what moves, posed each frame (or once, for someone who prefers less motion). */
function Content({ build, still, onReady }: { build: () => Promise<Built> | Built; still: boolean; onReady: (b: Built) => void }) {
  const [built, setBuilt] = useState<Built | null>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    let alive = true
    void Promise.resolve(build()).then((b) => {
      if (!alive) return
      b.tick?.(0)
      setBuilt(b)
      onReady(b)
      invalidate()
    })
    return () => {
      alive = false
    }
    // built once per view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useFrame((s) => {
    if (built?.tick && !still) built.tick(s.clock.elapsedTime)
  })
  return built ? <primitive object={built.root} /> : null
}

type Hooks = { __modelView?: { ready: boolean; triangles: number; issues: string[] } }

export function ModelView({ build, view, count, checks, haze = true, focus }: { build: () => Promise<Built> | Built; view: View3D; count: Count; checks?: Checks; haze?: boolean; focus?: V3 }) {
  const reduced = !!useReducedMotion()
  const controls = useRef<OrbitControlsImpl | null>(null)
  const [moving, setMoving] = useState(false)
  const [issues, setIssues] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const hooks = window as unknown as Hooks
  // the kit's checks, after the first picture: what they find is an error on the page (the lab's audit counts it)
  useEffect(() => {
    hooks.__modelView = { ready: false, triangles: count.triangles, issues: [] }
    const id = setTimeout(() => {
      const found = checks?.() ?? []
      for (const f of found) console.error(`[model check] ${f}`)
      setIssues(found)
      if (hooks.__modelView) hooks.__modelView.issues = found
    }, 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const at: V3 = view.kind === 'eye' ? [view.at[0], EYE_HEIGHT, view.at[2]] : view.target
  const zoom = (k: number) => {
    const c = controls.current
    if (!c) return
    const cam = c.object as PerspectiveCamera
    const off = cam.position.clone().sub(c.target)
    off.setLength(MathUtils.clamp(off.length() * k, c.minDistance, c.maxDistance))
    cam.position.copy(c.target).add(off)
    c.update()
  }
  const label = count.weight === undefined ? `${fmt(count.triangles)} משולשים נוספים` : `${fmt(count.triangles)} משולשים, במקום ${fmt(count.weight)}`
  return (
    <div className="model-view" onPointerDown={() => setTouched(true)}>
      <Canvas
        className="model-view-canvas"
        shadows="percentage"
        dpr={[1, 2]}
        frameloop={moving && !reduced ? 'always' : 'demand'}
        camera={{ fov: FOV.tall, near: 0.1, far: 1500, position: at }}
        onCreated={({ gl }) => {
          gl.toneMapping = AgXToneMapping
        }}
      >
        <color attach="background" args={[NOON.background]} />
        <fogExp2 attach="fog" args={[NOON.fog, haze ? 0.04 : 0.0006]} />
        <Sky distance={900} sunPosition={SUN} turbidity={3} rayleigh={1.3} mieCoefficient={0.004} mieDirectionalG={0.85} />
        <hemisphereLight args={[NOON.sky, NOON.ground, NOON.hemi]} />
        <Sun focus={focus ?? (view.kind === 'eye' ? view.look : view.target)} />
        {/* the scene comes in with its sky light, never lit without it */}
        <Suspense fallback={null}>
          <Environment files={hdri} background={false} environmentIntensity={NOON.env} />
          <Content
            build={build}
            still={reduced}
            onReady={(b) => {
              setMoving(!!b.tick)
              // ready once the first frames with it are drawn
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  if (hooks.__modelView) hooks.__modelView.ready = true
                }),
              )
            }}
          />
        </Suspense>
        {view.kind === 'eye' ? <Eye at={at} look={view.look} /> : <Orbit view={view} controls={controls} />}
      </Canvas>
      <div className="model-view-chip" dir="rtl" aria-label={label}>
        <span className="model-view-tri" aria-hidden="true" />
        <span dir="ltr">{count.weight === undefined ? `+${fmt(count.triangles)}` : `${fmt(count.triangles)} / ${fmt(count.weight)}`}</span>
        <span>משולשים</span>
        {issues.length > 0 && <span className="model-view-issues">⚠ {issues.length}</span>}
      </div>
      <p className={`model-view-hint${touched ? ' gone' : ''}`} dir="rtl">
        {view.kind === 'eye' ? 'גררו כדי להסתכל מסביב' : 'גררו כדי לסובב'}
      </p>
      {view.kind === 'orbit' && (
        <div className="model-view-zoom">
          <button className="btn soft round" aria-label="קרוב יותר" onClick={() => zoom(0.8)}>
            <Plus weight="bold" />
          </button>
          <button className="btn soft round" aria-label="רחוק יותר" onClick={() => zoom(1.25)}>
            <Minus weight="bold" />
          </button>
        </div>
      )}
    </div>
  )
}
