import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, Color, SRGBColorSpace } from 'three'
import { SCREENS, type ScreenDef } from '../data/screens'
import { useInteractable } from '../lib/interaction'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { farm, useFarm } from '../farm/state'
import { useDecorate } from '../home/decorate'
import { placedScreen } from '../home/layout'
import { loadScreenFonts } from './screens/fonts'
import { Hologram } from './screens/Holograms'
import { createWallScreen } from './screens/wallScreen'

// bumped once the bundled Inter is ready, so screens painted with the fallback font repaint once
let fontEpoch = 0
void loadScreenFonts().then(() => {
  fontEpoch++
})

const ACTIVE_FPS = 12
const WHITE = new Color('#ffffff')

function ScreenPanel({ def, active }: { def: ScreenDef; active: boolean }) {
  const [w, h] = def.size
  const screen = useMemo(() => createWallScreen(def), [def])
  const texture = useMemo(() => {
    const t = new CanvasTexture(screen.canvas)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [screen])
  const st = useRef({ clock: 0, last: -1, bootAt: -10, wasActive: null as boolean | null, epoch: -1, dirty: true })

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, dt) => {
    const s = st.current
    s.clock += dt
    if (active !== s.wasActive) {
      // entering the room powers the screen on: content fades up, the bars fill
      if (active && s.wasActive !== null) s.bootAt = s.clock
      s.wasActive = active
      s.dirty = true
    }
    if (s.epoch !== fontEpoch) {
      s.epoch = fontEpoch
      screen.invalidate()
      s.dirty = true
    }
    // idle screens repaint only when something changed (entering/leaving the room, fonts); the active one runs at ~12 fps
    if (active ? s.clock - s.last < 1 / ACTIVE_FPS : !s.dirty) return
    s.last = s.clock
    s.dirty = false
    screen.draw(s.clock, active ? s.clock - s.bootAt : 10, active)
    texture.needsUpdate = true
  })

  return (
    <group>
      <RoundedBox args={[w + 0.08, h + 0.08, 0.05]} radius={0.012} smoothness={3} castShadow>
        <meshStandardMaterial color="#0a0b0d" roughness={0.35} metalness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive={WHITE}
          emissiveIntensity={active ? 1.35 : 0.8}
          roughness={0.65}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
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
        <meshStandardMaterial color="#4a5460" metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.845, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.012, 36]} />
        <meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={active ? 2.2 : 0.4} />
      </mesh>
      {active && (
        <Suspense fallback={null}>
          <Hologram def={def} />
        </Suspense>
      )}
    </group>
  )
}

/** A screen where its piece hangs (`at`: src/home/layout.ts, placedScreen; it slides along its room's walls while
 *  decorating, its hologram's stand going along), its content `def`'s. */
function Screen({ def, at }: { def: ScreenDef; at: ScreenDef }) {
  const active = useHome((s) => s.room === def.room)
  // while it is dragged it hides (the decorate mode draws it where the finger is)
  const dragged = useDecorate((s) => s.drag?.id === def.id)
  const openScreen = useHome((s) => s.openScreen)
  const nx = Math.sin(at.rotationY)
  const nz = Math.cos(at.rotationY)

  useInteractable({
    id: def.id,
    label: `Open “${def.title}”`,
    icon: { verb: 'watch' },
    position: [at.position[0] + nx * 1.1, 1.0, at.position[2] + nz * 1.1],
    aim: at.position,
    radius: 1.5,
    run: () => {
      playGesture('interact')
      openScreen(def.id)
    },
  })

  return (
    <group name={`screen-${def.id}`} visible={!dragged}>
      <group position={at.position} rotation-y={at.rotationY}>
        <ScreenPanel def={def} active={active} />
      </group>
      <Pedestal key={at.holo.join(',')} def={at} active={active} />
    </group>
  )
}

/** One light shared by all screens: it sits in front of whichever screen belongs to the current room. */
function ScreenGlow({ placed }: { placed: ScreenDef[] }) {
  const room = useHome((s) => s.room)
  const def = placed.find((s) => s.room === room)
  const nx = def ? Math.sin(def.rotationY) : 0
  const nz = def ? Math.cos(def.rotationY) : 0
  return (
    <pointLight
      position={def ? [def.position[0] + nx * 0.7, def.position[1], def.position[2] + nz * 0.7] : [0, 1.5, 0]}
      color={def?.accent ?? '#ffffff'}
      intensity={def ? 1.3 : 0}
      distance={3.2}
      decay={2}
    />
  )
}

export function Screens() {
  const home = useFarm(() => farm.home)
  const placed = useMemo(() => SCREENS.map((def) => placedScreen(home, def)), [home])
  return (
    <>
      <ScreenGlow placed={placed} />
      {SCREENS.map((def, i) => (
        <Screen key={def.id} def={def} at={placed[i]} />
      ))}
    </>
  )
}
