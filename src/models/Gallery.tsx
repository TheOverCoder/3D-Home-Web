import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { AgXToneMapping, MathUtils, PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { describeIssue, type Issue } from '../lib/sculpt'
import { MODEL_CHECKS, checkerSelfTest } from './checks'
import { GALLERY, type GalleryModel } from './gallery'

// The model gallery (?gallery): every model the sculpt kit makes, in the game's light, moving as it does in the
// game, and the kit's checks for each (every piece holds on to the rest, the model stands on its ground). Drag to
// turn round a model, scroll or pinch to come closer; pick a model at the top to frame it.

const params = new URLSearchParams(location.search)
const frozen = params.has('t') ? Number(params.get('t')) : null
const GAP = 1.2

interface Placed {
  id: string
  label: string
  name: string
  model: GalleryModel
  x: number
}

function layout(): Placed[] {
  const only = params.get('focus')
  let x = 0
  const out: Placed[] = []
  for (const e of GALLERY) {
    if (only && only !== e.id) continue
    const model = e.make()
    out.push({ id: e.id, label: e.label, name: e.name, model, x: x + model.width / 2 })
    x += model.width + GAP
  }
  // centre the row on the origin
  const mid = x > 0 ? (x - GAP) / 2 : 0
  for (const p of out) {
    p.x -= mid
    p.model.object.position.x = p.x
  }
  return out
}

function Models({ placed }: { placed: Placed[] }) {
  useFrame((state) => {
    const t = frozen ?? state.clock.elapsedTime
    for (const p of placed) p.model.update(t)
  })
  return (
    <>
      {placed.map((p) => (
        <primitive key={p.id} object={p.model.object} />
      ))}
    </>
  )
}

/** Points the camera at an entry: from the front-left and a little above, far enough to see all of it on this
 *  screen (a phone held upright sees much less across than a computer does). */
function Framing({ target, controls, again }: { target: Placed | undefined; controls: React.RefObject<OrbitControlsImpl | null>; again: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    if (!target) return
    const az = MathUtils.degToRad(Number(params.get('az') ?? 35))
    const el = MathUtils.degToRad(Number(params.get('el') ?? 14))
    const tan = Math.tan(MathUtils.degToRad(camera.fov) / 2)
    const aspect = size.width / Math.max(1, size.height)
    const fit = Math.max((target.model.height * 0.62 + 0.15) / tan, (target.model.width * 0.56 + 0.15) / (tan * aspect))
    const dist = Number(params.get('dist') ?? fit * 1.08)
    const look = new Vector3(target.x + Number(params.get('x') ?? 0), params.has('y') ? Number(params.get('y')) : target.model.height * 0.5, 0)
    camera.position.set(look.x + Math.sin(az) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(look)
    const c = controls.current
    if (c) {
      c.target.copy(look)
      c.update()
    }
  }, [target, camera, controls, size.width, size.height, again])
  return null
}

type Results = Record<string, { issues: Issue[]; poses: number } | undefined>

/** Runs every model's checks, one model at a time so the page stays responsive. */
function useChecks(): Results {
  const [results, setResults] = useState<Results>({})
  useEffect(() => {
    let alive = true
    const queue = [...MODEL_CHECKS]
    const next = () => {
      const c = queue.shift()
      if (!c || !alive) return
      const issues = c.run()
      for (const i of issues) console.warn(`[model check] ${describeIssue(i)}`)
      setResults((r) => ({ ...r, [c.id]: { issues, poses: 0 } }))
      setTimeout(next, 30)
    }
    const id = setTimeout(next, 400)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [])
  return results
}

const chip = (active: boolean): React.CSSProperties => ({
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 10px',
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  font: '600 13px Inter, system-ui, sans-serif',
  background: active ? '#1d232c' : 'rgba(255,255,255,0.9)',
  color: active ? '#fff' : '#1d232c',
  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
})

export function Gallery() {
  const placed = useMemo(layout, [])
  const [focus, setFocus] = useState(params.get('focus') ?? placed[0]?.id)
  const [again, setAgain] = useState(0)
  const [open, setOpen] = useState(false)
  const controls = useRef<OrbitControlsImpl | null>(null)
  const results = useChecks()
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__gallery = {
      ready: true,
      // read live: the counts follow the poses
      get entries() {
        return placed.map((p) => ({ id: p.id, triangles: p.model.triangles() }))
      },
      // the checks catch a broken sample (they are not just saying yes)
      selfTest: checkerSelfTest,
      // the kit's checks: done once every model has been checked; what each found
      get checks() {
        const done = MODEL_CHECKS.every((c) => results[c.id])
        return { done, issues: MODEL_CHECKS.flatMap((c) => (results[c.id]?.issues ?? []).map(describeIssue)) }
      },
    }
  }, [placed, results])
  const target = placed.find((p) => p.id === focus)
  const status = (id: string) => {
    const r = results[id]
    if (!MODEL_CHECKS.some((c) => c.id === id)) return null
    if (!r) return { text: '…', color: '#8a94a3' }
    return r.issues.length ? { text: `⚠ ${r.issues.length}`, color: '#d97a1e' } : { text: '✓', color: '#3f9a5a' }
  }
  const mine = target ? results[target.id] : undefined

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#a9c4e0' }}>
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        camera={{ fov: 40, near: 0.05, far: 200, position: [0, 2, 6] }}
        onCreated={({ gl }) => {
          gl.toneMapping = AgXToneMapping
        }}
      >
        <color attach="background" args={['#a9c4e0']} />
        <hemisphereLight args={['#dfe9ff', '#5a4a38', 1.1]} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={2.6}
          color="#ffe2b5"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
          shadow-bias={-0.0003}
          shadow-normalBias={0.02}
        />
        <directionalLight position={[-5, 3, -4]} intensity={0.35} color="#b9cfff" />
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[40, 48]} />
          <meshStandardMaterial color="#6f8f4e" roughness={1} />
        </mesh>
        <Models placed={placed} />
        <OrbitControls ref={controls} makeDefault enableDamping={frozen === null} />
        <Framing target={target} controls={controls} again={again} />
      </Canvas>
      {/* the models: a strip of chips across the top (it scrolls sideways on a narrow screen) */}
      <div style={{ position: 'absolute', top: 'max(10px, env(safe-area-inset-top))', left: 10, right: 10, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {placed.map((p) => {
          const s = status(p.id)
          return (
            <button
              key={p.id}
              onClick={() => {
                setFocus(p.id)
                setAgain((n) => n + 1)
              }}
              style={chip(p.id === focus)}
            >
              {p.label}
              {s && <span style={{ color: p.id === focus ? '#fff' : s.color, fontWeight: 700 }}>{s.text}</span>}
            </button>
          )
        })}
      </div>
      {/* what is shown, and what the checks found */}
      {target && (
        <div
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            bottom: 'max(10px, env(safe-area-inset-bottom))',
            maxWidth: 560,
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.92)',
            color: '#1d232c',
            font: '500 13px/1.4 Inter, system-ui, sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <div>
            {target.name} · {Math.round(target.model.triangles()).toLocaleString()} triangles
          </div>
          {mine ? (
            mine.issues.length ? (
              <>
                <button
                  onClick={() => setOpen((o) => !o)}
                  style={{ marginTop: 4, padding: 0, border: 'none', background: 'none', color: '#b85f10', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}
                >
                  ⚠ {mine.issues.length} problem{mine.issues.length === 1 ? '' : 's'}: pieces apart from the model or off the ground {open ? '▴' : '▾'}
                </button>
                {open && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, maxHeight: '30vh', overflowY: 'auto' }}>
                    {mine.issues.map((i, k) => (
                      <li key={k}>{describeIssue(i)}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div style={{ marginTop: 2, color: '#2f7a46', fontWeight: 600 }}>✓ Every piece is connected, and it stands on its ground, in every pose checked</div>
            )
          ) : MODEL_CHECKS.some((c) => c.id === target.id) ? (
            <div style={{ marginTop: 2, color: '#6b7380' }}>Checking…</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
