import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox, Text } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, Color, MathUtils, SRGBColorSpace, Vector3, type Group, type Mesh } from 'three'
import interBold from '@pmndrs/assets/fonts/inter_bold.woff'
import { SCREENS, type ScreenDef } from '../data/screens'
import { useInteractable } from '../lib/interaction'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'

const W = 1024
const H = 576

function drawScreen(ctx: CanvasRenderingContext2D, def: ScreenDef, t: number, active: boolean) {
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#080c14')
  bg.addColorStop(1, '#131b2c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // soft accent glow
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.2, 10, W * 0.82, H * 0.2, 420)
  glow.addColorStop(0, def.accent + '55')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = def.accent
  ctx.fillRect(56, 60, 64, 6)

  ctx.fillStyle = '#9aa7bd'
  ctx.font = '600 28px Inter, system-ui, sans-serif'
  ctx.fillText(def.subtitle.toUpperCase(), 56, 112)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 96px Inter, system-ui, sans-serif'
  ctx.fillText(def.title, 52, 214)

  // animated mini bars
  const baseY = H - 120
  const bw = 62
  def.bars.forEach((b, i) => {
    const wobble = active ? 0.06 * Math.sin(t * 2 + i * 1.3) : 0
    const bh = Math.max(8, (b.value + wobble) * 190)
    const x = 56 + i * (bw + 22)
    ctx.fillStyle = def.accent
    ctx.globalAlpha = 0.9
    ctx.fillRect(x, baseY - bh, bw, bh)
    ctx.globalAlpha = 1
    ctx.fillStyle = '#8b97ab'
    ctx.font = '500 22px Inter, system-ui, sans-serif'
    ctx.fillText(b.label, x, baseY + 32)
  })

  ctx.fillStyle = active ? '#ffffff' : '#5d6a80'
  ctx.font = '600 26px Inter, system-ui, sans-serif'
  const hint = active ? 'Stand close and press E to open' : def.tabs.map((x) => x.label).join('  ·  ')
  ctx.fillText(hint, W - 56 - ctx.measureText(hint).width, H - 44)
}

function ScreenPanel({ def, active }: { def: ScreenDef; active: boolean }) {
  const [w, h] = def.size
  const { texture, ctx } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return { texture, ctx: canvas.getContext('2d')! }
  }, [])
  const clock = useRef(0)
  const lastActive = useRef<boolean | null>(null)

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, dt) => {
    clock.current += dt
    // idle screens are drawn once; the active one animates at ~12 fps
    if (!active && lastActive.current === false) return
    if (active && (clock.current % 0.08) > dt) return
    drawScreen(ctx, def, clock.current, active)
    texture.needsUpdate = true
    lastActive.current = active
  })

  return (
    <group>
      <RoundedBox args={[w + 0.08, h + 0.08, 0.05]} radius={0.012} smoothness={3} castShadow>
        <meshStandardMaterial color="#0a0b0d" roughness={0.35} metalness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={new Color('#ffffff')}
          emissiveIntensity={active ? 1.5 : 0.8}
          roughness={0.65}
        />
      </mesh>
    </group>
  )
}

const worldPos = new Vector3()

function HoloChart({ def }: { def: ScreenDef }) {
  const camera = useThree((s) => s.camera)
  const bars = useRef<(Mesh | null)[]>([])
  const heights = useRef(def.bars.map(() => 0.01))
  const group = useRef<Group>(null)
  const spacing = 0.2
  const x0 = (-(def.bars.length - 1) * spacing) / 2

  useFrame((state, dt) => {
    def.bars.forEach((b, i) => {
      heights.current[i] = MathUtils.damp(heights.current[i], b.value * 0.62, 3.2, dt)
      const mesh = bars.current[i]
      if (!mesh) return
      mesh.scale.y = Math.max(heights.current[i], 0.001)
      mesh.position.y = heights.current[i] / 2
    })
    const g = group.current
    if (g) {
      // yaw towards the camera so labels never read mirrored (pedestal is rotated by rotationY)
      g.getWorldPosition(worldPos)
      const want = Math.atan2(camera.position.x - worldPos.x, camera.position.z - worldPos.z) - def.rotationY
      const diff = Math.atan2(Math.sin(want - g.rotation.y), Math.cos(want - g.rotation.y))
      g.rotation.y += diff * (1 - Math.exp(-6 * dt))
      g.position.y = 0.9 + Math.sin(state.clock.elapsedTime * 1.4) * 0.015
    }
  })

  return (
    <group ref={group} position={[0, 0.9, 0]}>
      <mesh position={[0, -0.01, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.012, 48]} />
        <meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={0.9} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {def.bars.map((b, i) => (
        <group key={b.label} position={[x0 + i * spacing, 0, 0]}>
          <mesh
            ref={(m) => {
              bars.current[i] = m
            }}
          >
            <boxGeometry args={[0.1, 1, 0.1]} />
            <meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={1.0} roughness={0.25} transparent opacity={0.92} />
          </mesh>
          <Text font={interBold} fontSize={0.055} color="#ffffff" position={[0, 0.03, 0.09]} anchorX="center" anchorY="bottom">
            {b.label}
          </Text>
        </group>
      ))}
      <Text font={interBold} fontSize={0.11} color={def.accent} position={[0, 0.82, 0]} anchorX="center" anchorY="bottom">
        {def.title}
      </Text>
    </group>
  )
}

function Pedestal({ def, active }: { def: ScreenDef; active: boolean }) {
  return (
    <group position={def.holo} rotation-y={def.rotationY}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.3, 0.45, 0.3]} position={[0, 0.45, 0]} />
      </RigidBody>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.84, 36]} />
        <meshStandardMaterial color="#14171c" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.845, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.012, 36]} />
        <meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={active ? 2.2 : 0.4} />
      </mesh>
      {active && (
        <Suspense fallback={null}>
          <HoloChart def={def} />
        </Suspense>
      )}
    </group>
  )
}

function Screen({ def }: { def: ScreenDef }) {
  const active = useHome((s) => s.room === def.room)
  const openScreen = useHome((s) => s.openScreen)
  const nx = Math.sin(def.rotationY)
  const nz = Math.cos(def.rotationY)

  useInteractable({
    id: def.id,
    label: `Open “${def.title}”`,
    position: [def.position[0] + nx * 1.1, 1.0, def.position[2] + nz * 1.1],
    radius: 1.5,
    run: () => {
      playGesture('interact')
      openScreen(def.id)
    },
  })

  return (
    <>
      <group position={def.position} rotation-y={def.rotationY}>
        <ScreenPanel def={def} active={active} />
      </group>
      <Pedestal def={def} active={active} />
      {/* constant light count; only the active room's screen glows */}
      <pointLight
        position={[def.position[0] + nx * 0.7, def.position[1], def.position[2] + nz * 0.7]}
        color={def.accent}
        intensity={active ? 1.3 : 0}
        distance={3.2}
        decay={2}
      />
    </>
  )
}

export function Screens() {
  return (
    <>
      {SCREENS.map((def) => (
        <Screen key={def.id} def={def} />
      ))}
    </>
  )
}
