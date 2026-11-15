import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { B } from './Furnishings'

// What hangs on the walls (src/home/catalogue.ts, the wall layer): each built with its back on the wall's face (z = 0),
// facing +z, its bottom at y = 0, as the house always had them (src/home/layout.ts puts them where the save has them).

function Frame({ size, color, accent }: { size: [number, number]; color: string; accent: string }) {
  return (
    <group position={[0, size[1] / 2, 0.04]}>
      <B size={[size[0], size[1], 0.04]} color="#1f1f21" roughness={0.5} radius={0.006} />
      <B size={[size[0] - 0.1, size[1] - 0.1, 0.045]} color={color} roughness={0.9} radius={0} />
      <B size={[(size[0] - 0.1) * 0.5, (size[1] - 0.1) * 0.5, 0.05]} position={[0.04, -0.02, 0]} color={accent} roughness={0.9} radius={0} />
    </group>
  )
}

export const PictureWide = () => <Frame size={[1.1, 0.75]} color="#c9b79c" accent="#3d6a8a" />
export const PictureTall = () => <Frame size={[0.6, 0.8]} color="#d9d0c0" accent="#b4543a" />
export const PictureSmall = () => <Frame size={[0.8, 0.6]} color="#cfd6dc" accent="#4d7a58" />

export function WallClock() {
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
    <group position={[0, 0.2, 0.02]}>
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

export function Mirror() {
  return (
    <group position={[0, 0.7, 0.02]}>
      <B size={[0.62, 1.4, 0.035]} color="#2a2522" roughness={0.5} radius={0.01} mat="veneer" tile={0.8} />
      <mesh position={[0, 0, 0.019]}>
        <planeGeometry args={[0.54, 1.32]} />
        <meshStandardMaterial color="#d8e0e6" metalness={1} roughness={0.05} envMapIntensity={1.6} />
      </mesh>
    </group>
  )
}

export function SwitchPlate() {
  return (
    <group position={[0, 0.0625, 0.007]}>
      <B size={[0.08, 0.125, 0.01]} color="#ece9e2" roughness={0.4} radius={0.003} />
      <B size={[0.026, 0.05, 0.008]} position={[0, 0, 0.007]} color="#f6f4ee" roughness={0.35} radius={0.003} />
    </group>
  )
}

export function Outlet() {
  return (
    <group position={[0, 0.04, 0.005]}>
      <B size={[0.08, 0.08, 0.01]} color="#ece9e2" roughness={0.4} radius={0.003} />
      {[-0.012, 0.012].map((x) => (
        <B key={x} size={[0.006, 0.016, 0.004]} position={[x, 0.008, 0.006]} color="#2a2a2c" roughness={0.8} radius={0.001} />
      ))}
    </group>
  )
}

export function Radiator({ width = 1.0 }: { width?: number }) {
  const n = Math.round(width / 0.07)
  return (
    <group position={[0, 0, 0.045]}>
      {Array.from({ length: n }, (_, i) => (
        <B key={i} size={[0.05, 0.46, 0.07]} position={[(i - (n - 1) / 2) * 0.07, 0.3, 0]} color="#f1efe9" roughness={0.45} radius={0.018} />
      ))}
      <B size={[width + 0.04, 0.03, 0.08]} position={[0, 0.55, 0]} color="#f1efe9" roughness={0.45} radius={0.008} />
      <B size={[width + 0.04, 0.03, 0.06]} position={[0, 0.05, 0]} color="#f1efe9" roughness={0.45} radius={0.008} />
    </group>
  )
}

/** A screen as it is moved (the screen itself is src/scene/Screens.tsx's): its dark panel. */
export function ScreenShape() {
  return (
    <group position={[0, 0.49, 0.04]}>
      <B size={[1.68, 0.98, 0.05]} color="#0a0b0d" roughness={0.35} metalness={0.6} radius={0.012} />
    </group>
  )
}

/** The standing lamp's base and pole (its shade, which glows, is src/scene/Lamps.tsx's: it goes where this goes). */
export function FloorLampStand({ shade = false }: { shade?: boolean }) {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.04, 24]} />
        <meshStandardMaterial color="#26282b" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.4, 10]} />
        <meshStandardMaterial color="#26282b" metalness={0.8} roughness={0.35} />
      </mesh>
      {shade && (
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.2, 0.28, 0.34, 28, 1, true]} />
          <meshStandardMaterial color="#f3e7d3" emissive="#ffcf94" emissiveIntensity={2.2} roughness={0.9} side={2} />
        </mesh>
      )}
    </group>
  )
}
