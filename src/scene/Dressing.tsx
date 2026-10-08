import { useMemo, type ReactNode } from 'react'
import { CanvasTexture, DoubleSide, LatheGeometry, SRGBColorSpace, Vector2 } from 'three'
import { HOUSE } from '../data/layout'
import { surface } from '../lib/proceduralTextures'
import { B } from './Furnishings'

// Small things that make rooms look lived in. Purely decorative (no colliders) and tiny, so the
// player walks "through" them only where nobody can reach — they all sit on furniture, walls or ceilings.
// Dropping real props into src/assets/models/props/ does not remove these; delete a line here instead.

type V3 = [number, number, number]

function At({ position, rotationY = 0, children }: { position: V3; rotationY?: number; children: ReactNode }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {children}
    </group>
  )
}

function Cyl({ r, h, position, color, rough = 0.6, metal = 0, rotation, top = r, segments = 20, emissive, glow }: {
  r: number
  h: number
  position: V3
  color: string
  rough?: number
  metal?: number
  rotation?: V3
  top?: number
  segments?: number
  emissive?: string
  glow?: number
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry args={[top, r, h, segments]} />
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive} emissiveIntensity={glow} />
    </mesh>
  )
}

function Ball({ r, position, color, rough = 0.5, scale }: { r: number; position: V3; color: string; rough?: number; scale?: V3 }) {
  return (
    <mesh position={position} scale={scale} castShadow>
      <sphereGeometry args={[r, 18, 14]} />
      <meshStandardMaterial color={color} roughness={rough} />
    </mesh>
  )
}

// ───────────────────────────── living room ─────────────────────────────

function Magazines() {
  return (
    <group>
      <B size={[0.3, 0.012, 0.22]} position={[0, 0.006, 0]} rotation={[0, 0.2, 0]} color="#d9d3c4" roughness={0.6} radius={0.002} mat="paint" tile={0.3} />
      <B size={[0.29, 0.01, 0.21]} position={[0.01, 0.017, 0]} rotation={[0, 0.05, 0]} color="#b4543a" roughness={0.5} radius={0.002} mat="paint" tile={0.3} />
      <B size={[0.27, 0.009, 0.2]} position={[-0.005, 0.0265, 0.005]} rotation={[0, -0.12, 0]} color="#3d6a8a" roughness={0.5} radius={0.002} mat="paint" tile={0.3} />
    </group>
  )
}

function Remote() {
  return (
    <group rotation={[0, 0.6, 0]}>
      <B size={[0.045, 0.014, 0.17]} position={[0, 0.007, 0]} color="#1b1c1f" roughness={0.45} radius={0.006} />
      {[-0.05, -0.015, 0.02, 0.055].map((z) => (
        <B key={z} size={[0.026, 0.004, 0.016]} position={[0, 0.0155, z]} color="#5c6068" roughness={0.6} radius={0.002} />
      ))}
    </group>
  )
}

/** A bud vase with a few dried stems. */
function Vase({ stems = true }: { stems?: boolean }) {
  const geometry = useMemo(() => {
    const profile = [
      [0.0, 0.0], [0.05, 0.0], [0.065, 0.03], [0.07, 0.08], [0.055, 0.15], [0.03, 0.2], [0.032, 0.235], [0.04, 0.245],
    ].map(([x, y]) => new Vector2(x, y))
    return new LatheGeometry(profile, 28)
  }, [])
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#e8dfd0" roughness={0.18} metalness={0.05} side={DoubleSide} />
      </mesh>
      {stems &&
        [[-0.03, 0.35, 0.2], [0.02, 0.5, -0.1], [0.05, 0.42, 0.28], [-0.05, 0.4, -0.25]].map(([x, h, tilt], i) => (
          <group key={i} position={[x * 0.5, 0.22, 0]} rotation={[tilt * 0.3, i, -x * 5]}>
            <Cyl r={0.003} h={h} position={[0, h / 2, 0]} color="#8a7a4e" rough={0.9} segments={5} />
            <Ball r={0.02} position={[0, h, 0]} scale={[0.7, 1.6, 0.7]} color={i % 2 ? '#c9ae7a' : '#d8c79a'} rough={0.9} />
          </group>
        ))}
    </group>
  )
}

function WallClock() {
  const face = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    g.fillStyle = '#f2eee6'
    g.fillRect(0, 0, 256, 256)
    g.strokeStyle = '#2a2a2c'
    g.lineCap = 'round'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.lineWidth = i % 3 === 0 ? 9 : 4
      g.beginPath()
      g.moveTo(128 + Math.sin(a) * (i % 3 === 0 ? 92 : 100), 128 - Math.cos(a) * (i % 3 === 0 ? 92 : 100))
      g.lineTo(128 + Math.sin(a) * 114, 128 - Math.cos(a) * 114)
      g.stroke()
    }
    const hand = (a: number, len: number, w: number, color: string) => {
      g.strokeStyle = color
      g.lineWidth = w
      g.beginPath()
      g.moveTo(128 - Math.sin(a) * 14, 128 + Math.cos(a) * 14)
      g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len)
      g.stroke()
    }
    hand(-0.9, 62, 9, '#2a2a2c')
    hand(1.9, 92, 6, '#2a2a2c')
    hand(3.6, 100, 3, '#b4543a')
    g.fillStyle = '#2a2a2c'
    g.beginPath()
    g.arc(128, 128, 8, 0, Math.PI * 2)
    g.fill()
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.04, 40]} />
        <meshStandardMaterial color="#222224" roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.0215]}>
        <circleGeometry args={[0.178, 40]} />
        <meshStandardMaterial map={face} roughness={0.35} />
      </mesh>
    </group>
  )
}

function LivingRoom() {
  return (
    <>
      {/* coffee table */}
      <At position={[-3.78, 0.425, 3.95]} rotationY={0.15}><Magazines /></At>
      <At position={[-3.18, 0.425, 4.08]}><Remote /></At>
      <At position={[-3.1, 0.425, 3.84]}><Vase /></At>
      {/* a vase on the console, wall clock opposite the sofa */}
      <At position={[-2.85, 0.48, 5.7]}><Vase /></At>
      <At position={[-0.1, 2.05, 1.15]} rotationY={-Math.PI / 2}><WallClock /></At>
    </>
  )
}

// ───────────────────────────── studio ─────────────────────────────

function Laptop() {
  return (
    <group>
      <B size={[0.34, 0.012, 0.23]} position={[0, 0.006, 0]} color="#9ea3a8" metalness={0.9} roughness={0.55} radius={0.006} mat="brushed" tile={0.4} />
      <B size={[0.29, 0.002, 0.1]} position={[0, 0.0135, -0.03]} color="#1c1d20" roughness={0.6} radius={0.001} />
      <B size={[0.1, 0.002, 0.065]} position={[0, 0.0135, 0.07]} color="#7a7f85" metalness={0.5} roughness={0.5} radius={0.001} />
      {/* the lid hinges at the back and leans away from whoever sits at the desk */}
      <group position={[0, 0.012, -0.115]} rotation={[-0.3, 0, 0]}>
        <B size={[0.34, 0.22, 0.008]} position={[0, 0.11, 0]} color="#9ea3a8" metalness={0.9} roughness={0.55} radius={0.004} mat="brushed" tile={0.4} />
        <mesh position={[0, 0.11, 0.0046]}>
          <planeGeometry args={[0.31, 0.19]} />
          <meshStandardMaterial color="#0e1a2a" emissive="#4a79b8" emissiveIntensity={0.7} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}

function PenCup() {
  return (
    <group>
      <Cyl r={0.04} h={0.1} position={[0, 0.05, 0]} color="#2f3338" rough={0.5} metal={0.6} />
      {[[-0.012, 0.01, 0.12, '#b4543a'], [0.012, -0.01, 0.15, '#3d6a8a'], [0.0, 0.016, 0.17, '#d7b25a']].map(([x, z, h, c], i) => (
        <Cyl key={i} r={0.004} h={h as number} position={[x as number, 0.1 + (h as number) / 2 - 0.04, z as number]} rotation={[(z as number) * 4, 0, -(x as number) * 5]} color={c as string} rough={0.4} segments={6} />
      ))}
    </group>
  )
}

function Studio() {
  return (
    <>
      <At position={[-3.4, 0.76, -5.28]}>
        <B size={[0.72, 0.004, 0.36]} position={[0, 0.002, 0.02]} color="#25282d" roughness={0.9} radius={0.002} mat="fabric" tile={0.3} />
        <group position={[0, 0.004, 0]}><Laptop /></group>
        <B size={[0.06, 0.03, 0.1]} position={[0.28, 0.019, 0.04]} color="#1f2124" roughness={0.4} radius={0.02} />
      </At>
      <At position={[-2.68, 0.76, -5.62]}><PenCup /></At>
      <At position={[-4.0, 0.76, -5.68]} rotationY={0.4}><Vase stems /></At>
    </>
  )
}

// ───────────────────────────── kitchen ─────────────────────────────

function Kettle() {
  return (
    <group>
      <Cyl r={0.085} top={0.07} h={0.2} position={[0, 0.1, 0]} color="#c4c8cb" metal={0.9} rough={0.3} />
      <Cyl r={0.07} top={0.03} h={0.04} position={[0, 0.22, 0]} color="#c4c8cb" metal={0.9} rough={0.3} />
      <B size={[0.02, 0.15, 0.05]} position={[0.1, 0.13, 0]} rotation={[0, 0, -0.15]} color="#1d1f21" roughness={0.5} radius={0.008} />
      <B size={[0.07, 0.03, 0.07]} position={[0, 0.015, 0]} color="#1d1f21" roughness={0.5} radius={0.01} />
    </group>
  )
}

function Toaster() {
  return (
    <group>
      <B size={[0.28, 0.17, 0.16]} position={[0, 0.085, 0]} color="#d9d4c8" roughness={0.3} metalness={0.5} radius={0.035} mat="brushed" tile={0.4} />
      {[-0.06, 0.06].map((x) => (
        <B key={x} size={[0.09, 0.004, 0.012]} position={[x, 0.17, 0]} color="#101112" roughness={0.9} radius={0.001} />
      ))}
      <B size={[0.02, 0.045, 0.012]} position={[0.14, 0.12, 0.08]} color="#1f2124" roughness={0.5} radius={0.004} />
    </group>
  )
}

function CuttingBoard() {
  return (
    <group rotation={[0, 0.12, 0]}>
      <B size={[0.42, 0.022, 0.28]} position={[0, 0.011, 0]} color="#c9a070" roughness={0.6} radius={0.008} mat="veneer" tile={0.5} />
      <Ball r={0.035} position={[-0.08, 0.055, 0.02]} scale={[1, 1, 1]} color="#d33d2a" rough={0.35} />
      <Ball r={0.03} position={[0.02, 0.05, -0.03]} color="#e8a42a" rough={0.4} />
    </group>
  )
}

function FruitBowl() {
  return (
    <group>
      <mesh position={[0, 0.07, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.17, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#d9d3c6" roughness={0.25} side={DoubleSide} />
      </mesh>
      <Cyl r={0.06} h={0.01} position={[0, 0.0, 0]} color="#d9d3c6" rough={0.3} />
      {[[-0.05, 0.05, 0, '#d33d2a', 0.045], [0.06, 0.05, 0.02, '#e87a1f', 0.05], [0, 0.065, -0.07, '#9bbf3a', 0.042], [0.0, 0.1, 0.03, '#f0cd3a', 0.04], [-0.09, 0.06, -0.04, '#d33d2a', 0.04]].map(([x, y, z, c, r], i) => (
        <Ball key={i} r={r as number} position={[x as number, (y as number) + 0.03, z as number]} color={c as string} rough={0.35} />
      ))}
    </group>
  )
}

function Faucet() {
  return (
    <group>
      <Cyl r={0.014} h={0.2} position={[0, 0.1, 0]} color="#c4c8cb" metal={1} rough={0.18} segments={14} />
      <Cyl r={0.011} h={0.16} position={[0, 0.2, 0.08]} rotation={[Math.PI / 2, 0, 0]} color="#c4c8cb" metal={1} rough={0.18} segments={14} />
      <B size={[0.012, 0.05, 0.012]} position={[0.03, 0.04, 0]} color="#c4c8cb" metalness={1} roughness={0.2} radius={0.004} />
    </group>
  )
}

function Pendant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl r={0.004} h={HOUSE.wallHeight - 1.9} position={[0, (HOUSE.wallHeight + 1.9) / 2, 0]} color="#1b1c1e" rough={0.8} segments={5} />
      <Cyl r={0.17} top={0.05} h={0.18} position={[0, 1.86, 0]} color="#232528" rough={0.4} metal={0.5} segments={28} />
      <mesh position={[0, 1.78, 0]}>
        <sphereGeometry args={[0.05, 14, 12]} />
        <meshStandardMaterial color="#fff2d0" emissive="#ffd9a0" emissiveIntensity={4} />
      </mesh>
    </group>
  )
}

function TilePanel({ x0, x1, top }: { x0: number; x1: number; top: number }) {
  const w = x1 - x0
  const h = top - 0.91
  const s = useMemo(() => surface('tile', w / 0.6, h / 0.6), [w, h])
  return (
    <mesh position={[(x0 + x1) / 2, 0.91 + h / 2, -5.915]}>
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial map={s.map} normalMap={s.normalMap} roughnessMap={s.roughnessMap} color="#f4f1ea" roughness={1} normalScale={[0.8, 0.8]} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  )
}

/** Wall tiles behind the counter; the kitchen window (x 4.55–5.45, sill 1.2) keeps its view. */
function Backsplash() {
  return (
    <>
      <TilePanel x0={1.0} x1={4.55} top={1.5} />
      <TilePanel x0={4.55} x1={5.45} top={1.2} />
      <TilePanel x0={5.45} x1={5.6} top={1.5} />
    </>
  )
}

function Kitchen() {
  return (
    <>
      <Backsplash />
      <At position={[2.0, 0.91, -5.62]}><Kettle /></At>
      <At position={[5.36, 0.91, -5.6]} rotationY={-0.1}><Toaster /></At>
      <At position={[3.55, 0.91, -5.58]}><CuttingBoard /></At>
      <At position={[2.75, 0.91, -5.78]}><Faucet /></At>
      <At position={[2.75, 0.91, -2.15]}><FruitBowl /></At>
      <Pendant x={2.85} z={-2.4} />
      <Pendant x={3.95} z={-2.4} />
    </>
  )
}

// ───────────────────────────── bedroom ─────────────────────────────

function BedsideClock() {
  const face = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const g = c.getContext('2d')!
    g.fillStyle = '#0a0f0a'
    g.fillRect(0, 0, 128, 64)
    g.fillStyle = '#7dff9a'
    g.font = 'bold 44px monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('07:30', 64, 34)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  return (
    <group rotation={[0, 0.5, 0]}>
      <B size={[0.12, 0.06, 0.07]} position={[0, 0.03, 0]} color="#2a2b2e" roughness={0.5} radius={0.012} />
      <mesh position={[0, 0.032, 0.0355]}>
        <planeGeometry args={[0.095, 0.042]} />
        <meshStandardMaterial map={face} emissiveMap={face} emissive="#ffffff" emissiveIntensity={1.6} roughness={0.3} />
      </mesh>
    </group>
  )
}

function Mirror() {
  return (
    <group>
      <B size={[0.62, 1.4, 0.035]} color="#2a2522" roughness={0.5} radius={0.01} mat="veneer" tile={0.8} />
      <mesh position={[0, 0, 0.019]}>
        <planeGeometry args={[0.54, 1.32]} />
        <meshStandardMaterial color="#d8e0e6" metalness={1} roughness={0.05} envMapIntensity={1.6} />
      </mesh>
    </group>
  )
}

function Slippers() {
  return (
    <group>
      {[-0.09, 0.09].map((x) => (
        <group key={x} position={[x, 0, 0]} rotation={[0, x * 1.5, 0]}>
          <B size={[0.1, 0.035, 0.27]} position={[0, 0.0175, 0]} color="#bba58a" roughness={1} radius={0.017} mat="fabric" tile={0.15} />
          <B size={[0.1, 0.04, 0.11]} position={[0, 0.045, 0.06]} color="#cdb9a0" roughness={1} radius={0.02} mat="fabric" tile={0.15} />
        </group>
      ))}
    </group>
  )
}

function Bedroom() {
  return (
    <>
      <At position={[3.52, 0.585, 5.45]}><BedsideClock /></At>
      <At position={[0.1, 1.45, 1.3]} rotationY={Math.PI / 2}><Mirror /></At>
      <At position={[3.25, 0.012, 3.55]} rotationY={0.3}><Slippers /></At>
    </>
  )
}

// ───────────────────────────── whole house ─────────────────────────────

function SwitchPlate({ position, rotationY }: { position: V3; rotationY: number }) {
  return (
    <At position={position} rotationY={rotationY}>
      <B size={[0.08, 0.125, 0.01]} color="#ece9e2" roughness={0.4} radius={0.003} />
      <B size={[0.026, 0.05, 0.008]} position={[0, 0, 0.007]} color="#f6f4ee" roughness={0.35} radius={0.003} />
    </At>
  )
}

function Outlet({ position, rotationY }: { position: V3; rotationY: number }) {
  return (
    <At position={position} rotationY={rotationY}>
      <B size={[0.08, 0.08, 0.01]} color="#ece9e2" roughness={0.4} radius={0.003} />
      {[-0.012, 0.012].map((x) => (
        <B key={x} size={[0.006, 0.016, 0.004]} position={[x, 0.008, 0.006]} color="#2a2a2c" roughness={0.8} radius={0.001} />
      ))}
    </At>
  )
}

function Radiator({ width = 1.0 }: { width?: number }) {
  const n = Math.round(width / 0.07)
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <B key={i} size={[0.05, 0.46, 0.07]} position={[(i - (n - 1) / 2) * 0.07, 0.3, 0]} color="#f1efe9" roughness={0.45} radius={0.018} />
      ))}
      <B size={[width + 0.04, 0.03, 0.08]} position={[0, 0.55, 0]} color="#f1efe9" roughness={0.45} radius={0.008} />
      <B size={[width + 0.04, 0.03, 0.06]} position={[0, 0.05, 0]} color="#f1efe9" roughness={0.45} radius={0.008} />
    </group>
  )
}

function SmokeDetector() {
  return (
    <group>
      <Cyl r={0.06} h={0.032} position={[0, 0, 0]} color="#f2f0ea" rough={0.5} segments={24} />
      <mesh position={[0.03, -0.017, 0]}>
        <sphereGeometry args={[0.004, 8, 6]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={3} />
      </mesh>
    </group>
  )
}

function House() {
  return (
    <>
      {/* switches at the doorways (light side of each wall), a few outlets near the floor */}
      <SwitchPlate position={[-2.35, 1.25, 0.087]} rotationY={0} />
      <SwitchPlate position={[-0.087, 1.25, 4.05]} rotationY={-Math.PI / 2} />
      <SwitchPlate position={[0.087, 1.25, -2.0]} rotationY={Math.PI / 2} />
      <SwitchPlate position={[2.35, 1.25, 0.087]} rotationY={0} />
      <Outlet position={[-5.2, 0.32, 5.915]} rotationY={Math.PI} />
      <Outlet position={[-6.915, 0.32, -1.4]} rotationY={Math.PI / 2} />
      <Outlet position={[6.915, 0.32, 3.0]} rotationY={-Math.PI / 2} />
      <Outlet position={[5.6, 1.0, -5.915]} rotationY={0} />
      {/* radiators under the big south windows */}
      <At position={[-1.2, 0, 5.875]}><Radiator width={1.1} /></At>
      <At position={[1.7, 0, 5.875]}><Radiator width={1.0} /></At>
      {/* smoke detectors */}
      {[[-3.5, -3.0], [3.5, -3.0], [-3.5, 3.0], [3.5, 3.0]].map(([x, z]) => (
        <At key={`${x}${z}`} position={[x + 1.2, HOUSE.wallHeight - 0.02, z + 0.8]}><SmokeDetector /></At>
      ))}
    </>
  )
}

/** Everything small: books on tables, clocks, kitchenware, fixtures. */
export function Dressing() {
  return (
    <group>
      <LivingRoom />
      <Studio />
      <Kitchen />
      <Bedroom />
      <House />
    </group>
  )
}
