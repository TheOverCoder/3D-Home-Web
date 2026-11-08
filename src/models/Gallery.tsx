import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { AgXToneMapping, MathUtils, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { GALLERY, type GalleryModel } from './gallery'

// The model gallery (?gallery): every model the sculpt kit makes, in the game's light, moving as it does in the
// game. Drag to turn round a model, scroll or pinch to come closer; pick a model from the list to frame it.

const params = new URLSearchParams(location.search)
const frozen = params.has('t') ? Number(params.get('t')) : null
const GAP = 1.2

interface Placed {
  id: string
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
    out.push({ id: e.id, name: e.name, model, x: x + model.width / 2 })
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

/** Points the camera at an entry: from the front-left and a little above, far enough to see all of it. */
function Framing({ target, controls }: { target: Placed | undefined; controls: React.RefObject<OrbitControlsImpl | null> }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (!target) return
    const az = MathUtils.degToRad(Number(params.get('az') ?? 35))
    const el = MathUtils.degToRad(Number(params.get('el') ?? 14))
    const size = Math.max(target.model.width * 0.75, target.model.height * 1.4)
    const dist = Number(params.get('dist') ?? size * 1.5 + 0.6)
    const look = new Vector3(target.x + Number(params.get('x') ?? 0), params.has('y') ? Number(params.get('y')) : target.model.height * 0.5, 0)
    camera.position.set(look.x + Math.sin(az) * Math.cos(el) * dist, look.y + Math.sin(el) * dist, look.z + Math.cos(az) * Math.cos(el) * dist)
    camera.lookAt(look)
    const c = controls.current
    if (c) {
      c.target.copy(look)
      c.update()
    }
  }, [target, camera, controls])
  return null
}

export function Gallery() {
  const placed = useMemo(layout, [])
  const [focus, setFocus] = useState(params.get('focus') ?? placed[0]?.id)
  const controls = useRef<OrbitControlsImpl | null>(null)
  const [, tick] = useState(0)
  // the triangle counts in the list follow the poses
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    ;(window as unknown as Record<string, unknown>).__gallery = {
      ready: true,
      // read live: the counts follow the poses
      get entries() {
        return placed.map((p) => ({ id: p.id, triangles: p.model.triangles() }))
      },
    }
    return () => clearInterval(id)
  }, [placed])
  const target = placed.find((p) => p.id === focus)

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
        <Framing target={target} controls={controls} />
      </Canvas>
      <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', flexDirection: 'column', gap: 6, font: '500 14px Inter, system-ui, sans-serif' }}>
        {placed.map((p) => (
          <button
            key={p.id}
            onClick={() => setFocus(p.id)}
            style={{
              textAlign: 'left',
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: p.id === focus ? '#1d232c' : 'rgba(255,255,255,0.85)',
              color: p.id === focus ? '#fff' : '#1d232c',
            }}
          >
            {p.name} · {Math.round(p.model.triangles()).toLocaleString()} triangles
          </button>
        ))}
      </div>
    </div>
  )
}
