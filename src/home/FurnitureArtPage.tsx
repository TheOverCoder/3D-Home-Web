import { Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Box3, NeutralToneMapping, PMREMGenerator, SRGBColorSpace, Vector3, type Group, type PerspectiveCamera } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { cropArt } from '../models/itemArt'
import { useGLTF } from '@react-three/drei'
import { PieceLook, pieceModelUrl } from '../scene/Furnishings'
import { PIECES, PIECE_TYPES, type PieceType } from './catalogue'

// The furniture's pictures, drawn from the pieces themselves (open the site with ?furniture), in the same still
// studio as the goods' pictures (src/models/itemArt.ts): soft light from above, a warm key from the upper left, a
// cool rim from behind, seen from the front left and a little above (a rug from higher up), each cropped to fill
// its square. `scripts/render-furniture-art.mjs` saves them as WebP files in src/assets/furniture, which
// src/home/pictures.ts serves.

const SIZE = 256
const S = SIZE * 3

/** Where each kind is seen from: degrees round from its front (negative: from the left) and up. */
const VIEW: Partial<Record<PieceType, { az: number; el: number }>> = {
  bed: { az: 150, el: 30 }, // its headboard is at its front
  'rug-living': { az: -20, el: 62 },
  'rug-studio': { az: -20, el: 62 },
  'rug-bedroom': { az: -20, el: 62 },
  counter: { az: -24, el: 22 },
}

/** Lights one piece, frames it, draws it and hands the picture back. */
function Shot({ type, onDone }: { type: PieceType; onDone: (url: string) => void }) {
  const group = useRef<Group>(null)
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    let frames = 0
    let raf = 0
    const take = () => {
      // a few frames for the model's textures, then the picture
      if (++frames < 4 || !group.current) {
        raf = requestAnimationFrame(take)
        return
      }
      const cam = camera as PerspectiveCamera
      group.current.updateMatrixWorld(true)
      const box = new Box3().setFromObject(group.current)
      const centre = box.getCenter(new Vector3())
      const radius = box.getSize(new Vector3()).length() / 2
      const v = VIEW[type] ?? { az: -32, el: 24 }
      const az = (v.az * Math.PI) / 180
      const el = (v.el * Math.PI) / 180
      const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
      const dist = (radius / Math.sin((cam.fov * Math.PI) / 360)) * 1.05
      cam.position.copy(centre).addScaledVector(dir, dist)
      cam.near = dist / 20
      cam.far = dist * 4
      cam.updateProjectionMatrix()
      cam.lookAt(centre)
      gl.render(scene, cam)
      onDone(cropArt(gl.domElement, S, SIZE))
    }
    raf = requestAnimationFrame(take)
    return () => cancelAnimationFrame(raf)
  }, [type, gl, scene, camera, onDone])
  const url = pieceModelUrl({ id: type, type })
  return (
    <group ref={group}>
      {url && <Loaded url={url} />}
      <PieceLook p={{ id: type, type }} />
    </group>
  )
}

/** Waits for a real model to load (the picture is taken once it is there, not of the stand-in). */
function Loaded({ url }: { url: string }) {
  useGLTF(url, false)
  return null
}

function Studio() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const env = new PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.45
    return () => env.dispose()
  }, [gl, scene])
  return (
    <>
      <hemisphereLight args={[0xfff6e6, 0x8a6a4a, 1.0]} />
      <directionalLight position={[-1.2, 2.4, 1.6]} intensity={2.4} color={0xfff1dc} />
      <directionalLight position={[1.5, 1.0, -1.8]} intensity={1.4} color={0xd6e6ff} />
    </>
  )
}

const page: CSSProperties = { position: 'fixed', inset: 0, overflow: 'auto', padding: 16, background: 'var(--paper)', color: 'var(--ink)', font: '500 15px var(--font-text)' }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }
const card: CSSProperties = { margin: 0, padding: 10, display: 'grid', justifyItems: 'center', gap: 6, borderRadius: 'var(--r-card)', background: 'var(--paper-2)' }

export function FurnitureArtPage() {
  const [done, setDone] = useState<[PieceType, string][]>([])
  const type = PIECE_TYPES[done.length]
  useEffect(() => {
    if (!type) (window as unknown as { __furnitureArt: Record<string, string> }).__furnitureArt = Object.fromEntries(done)
  }, [type, done])
  return (
    <main style={page}>
      <h1 style={{ margin: '0 0 12px', font: '600 26px var(--font-display)' }}>Furniture pictures</h1>
      {type && (
        <div style={{ position: 'fixed', left: -4000, top: 0, width: S, height: S }}>
          <Canvas
            gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true, toneMapping: NeutralToneMapping, outputColorSpace: SRGBColorSpace }}
            camera={{ fov: 24 }}
            dpr={1}
            style={{ width: S, height: S }}
            frameloop="always"
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <Studio />
            <Suspense fallback={null}>
              <Shot key={type} type={type} onDone={(url) => setDone((d) => (d.some(([t]) => t === type) ? d : [...d, [type, url]]))} />
            </Suspense>
          </Canvas>
        </div>
      )}
      <div style={grid}>
        {done.map(([t, url]) => (
          <figure key={t} style={card}>
            <img src={url} alt="" width={128} height={128} />
            <figcaption>{PIECES[t].name}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  )
}
