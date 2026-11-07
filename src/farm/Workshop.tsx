import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, DoubleSide, SRGBColorSpace, type Group, type Mesh, type MeshStandardMaterial, type Sprite } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useInteractable } from '../lib/interaction'
import { B } from '../scene/Furnishings'
import { useHome } from '../store'
import { MILL, OVEN, count, produceById, type CakeId } from './data'
import { farm, millCollect, millSecondsLeft, millStage, ovenSecondsLeft, ovenStage, takeOut, useFarm } from './state'

// The farm's kitchen in the yard's south-east corner: a mill that presses sugar cane into sugar and grinds wheat
// into flour (its wheel and rollers turn while it works), and a brick oven that bakes cakes from what the farm
// makes (its mouth glows and its chimney smokes while it bakes; the cake waits on the table beside it).

const WOOD = '#8a6440'
const WOOD_DARK = '#5e4630'
const mmss = (seconds: number) => {
  const t = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

let smokeTex: CanvasTexture | undefined
function smokeTexture() {
  if (smokeTex) return smokeTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, 'rgba(235,235,235,0.9)')
  grad.addColorStop(0.5, 'rgba(210,210,210,0.45)')
  grad.addColorStop(1, 'rgba(200,200,200,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  smokeTex = new CanvasTexture(c)
  smokeTex.colorSpace = SRGBColorSpace
  return smokeTex
}

function signTexture(text: string, bg = '#2f3a2c', fg = '#f3ead8') {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 160)
  g.strokeStyle = 'rgba(255,255,255,0.25)'
  g.lineWidth = 8
  g.strokeRect(8, 8, 496, 144)
  g.fillStyle = fg
  g.font = '800 72px Inter, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 84)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const CAKE_LOOK: Record<CakeId, { top: string; dots: string; pie?: boolean }> = {
  lemon_cake: { top: '#f6e7a1', dots: '#f2d43a' },
  strawberry_cake: { top: '#f4c6cf', dots: '#d8213a' },
  carrot_cake: { top: '#f3ede0', dots: '#e8792a' },
  pumpkin_pie: { top: '#d9782a', dots: '#f3e6cf', pie: true },
}

/** A cake (or pie) on a plate, decorated for its recipe. */
export function Cake({ id }: { id: CakeId }) {
  const look = CAKE_LOOK[id]
  return (
    <group>
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.012, 24]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.3} />
      </mesh>
      {look.pie ? (
        <>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.14, 0.12, 0.04, 24]} />
            <meshStandardMaterial color={look.top} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.135, 0.018, 8, 24]} />
            <meshStandardMaterial color="#d9a35e" roughness={0.8} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.055, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.09, 24]} />
            <meshStandardMaterial color="#d9a35e" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.105, 0]}>
            <cylinderGeometry args={[0.133, 0.133, 0.018, 24]} />
            <meshStandardMaterial color={look.top} roughness={0.5} />
          </mesh>
        </>
      )}
      {Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2
        return (
          <mesh key={k} position={[Math.cos(a) * 0.085, look.pie ? 0.058 : 0.122, Math.sin(a) * 0.085]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <meshStandardMaterial color={look.dots} roughness={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

function Oven() {
  useFarm((s) => s.rev)
  const glow = useRef<MeshStandardMaterial>(null)
  const smoke = useRef<(Sprite | null)[]>([])
  const stage = useRef(ovenStage())
  const openPanel = useHome((s) => s.openPanel)
  const showToast = useHome((s) => s.showToast)
  const tex = useMemo(() => smokeTexture(), [])
  const ready = farm.oven.ready

  useInteractable({
    id: 'farm-oven',
    position: [OVEN.x - 1.15, 1.0, OVEN.z],
    aim: [OVEN.x - 0.5, 0.95, OVEN.z],
    radius: 2.1,
    label: () => {
      const s = ovenStage()
      if (s === 'done') return `Take out the ${produceById(farm.oven.ready!).name}`
      if (s === 'baking') return `Baking a ${produceById(farm.oven.baking!).name} · ready in ${mmss(ovenSecondsLeft())}`
      return 'Oven · bake a cake'
    },
    run: () => {
      const s = ovenStage()
      const { pan, near } = placeSound(OVEN.x, OVEN.z)
      if (s === 'done') {
        takeOut()
        playGesture('interact')
        farmSound('harvest', pan, near)
      } else if (s === 'baking') showToast(`The ${produceById(farm.oven.baking!).name} needs ${mmss(ovenSecondsLeft())} more`)
      else openPanel({ kind: 'oven' })
    },
  })

  useFrame((state) => {
    const s = ovenStage()
    if (stage.current === 'idle' && s === 'baking') {
      const { pan, near } = placeSound(OVEN.x, OVEN.z)
      farmSound('oven', pan, near)
    }
    if (stage.current === 'baking' && s === 'done') {
      const { pan, near } = placeSound(OVEN.x, OVEN.z)
      farmSound('ding', pan, Math.max(0.6, near))
    }
    stage.current = s
    const t = state.clock.elapsedTime
    const baking = s === 'baking'
    if (glow.current) {
      const flicker = 0.75 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08
      glow.current.emissiveIntensity = baking ? 2.6 * flicker : s === 'done' ? 0.5 : 0
    }
    smoke.current.forEach((sp, k) => {
      if (!sp) return
      sp.visible = baking
      if (!baking) return
      const life = (t * 0.35 + k / smoke.current.length) % 1
      sp.position.set(0.25 + Math.sin(t * 0.7 + k) * 0.08 * life, 1.62 + life * 1.3, Math.cos(t * 0.5 + k) * 0.08 * life)
      const size = 0.18 + life * 0.45
      sp.scale.set(size, size, 1)
      sp.material.opacity = (1 - life) * 0.5
    })
  })

  return (
    <group position={[OVEN.x, 0, OVEN.z]}>
      {/* stone base, clay dome, the mouth facing the yard, a chimney */}
      <B size={[1.3, 0.72, 1.2]} position={[0, 0.36, 0]} color="#8f8a82" mat="stone" tile={0.7} radius={0.02} />
      <mesh position={[0, 0.72, 0]} scale={[1, 0.86, 0.95]} castShadow receiveShadow>
        <sphereGeometry args={[0.6, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#b5643e" roughness={0.9} />
      </mesh>
      <mesh position={[-0.47, 0.92, 0]}>
        <boxGeometry args={[0.18, 0.34, 0.42]} />
        <meshStandardMaterial color="#1c1310" roughness={1} />
      </mesh>
      <mesh position={[-0.565, 0.9, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.34, 0.26]} />
        <meshStandardMaterial ref={glow} color="#2a120a" emissive="#ff7a2a" emissiveIntensity={0} roughness={1} />
      </mesh>
      <B size={[0.12, 0.05, 0.56]} position={[-0.58, 1.11, 0]} color="#8f5a3a" radius={0.01} />
      <mesh position={[0.25, 1.38, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.5, 10]} />
        <meshStandardMaterial color="#7a4a34" roughness={0.9} />
      </mesh>
      {Array.from({ length: 6 }, (_, k) => (
        <sprite
          key={k}
          ref={(s) => {
            smoke.current[k] = s
          }}
          visible={false}
        >
          <spriteMaterial map={tex} transparent depthWrite={false} opacity={0.4} />
        </sprite>
      ))}
      {/* the table beside it, where a finished cake waits */}
      <group position={[0, 0, -1.05]}>
        <B size={[0.9, 0.05, 0.55]} position={[0, 0.78, 0]} color={WOOD} mat="veneer" tile={0.8} radius={0.008} />
        {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <B key={`${sx}${sz}`} size={[0.05, 0.78, 0.05]} position={[sx * 0.4, 0.39, sz * 0.22]} color={WOOD_DARK} radius={0.006} />))}
        {ready && (
          <group position={[0, 0.805, 0]}>
            <Cake id={ready} />
          </group>
        )}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.68, 0.75, 0.62]} position={[0, 0.75, 0]} />
        <CuboidCollider args={[0.47, 0.42, 0.3]} position={[0, 0.42, -1.05]} />
      </RigidBody>
    </group>
  )
}

function Mill() {
  useFarm((s) => s.rev)
  const wheel = useRef<Group>(null)
  const rollers = useRef<(Mesh | null)[]>([])
  const stage = useRef(millStage())
  const creak = useRef(0)
  const spin = useRef(0)
  const openPanel = useHome((s) => s.openPanel)
  const showToast = useHome((s) => s.showToast)
  const sign = useMemo(() => signTexture('MILL'), [])
  const output = farm.mill.output

  useInteractable({
    id: 'farm-mill',
    position: [MILL.x - 1.25, 1.0, MILL.z],
    aim: [MILL.x - 0.15, 0.95, MILL.z],
    radius: 2.2,
    label: () => {
      const s = millStage()
      if (s === 'done') return `Collect ${count(farm.mill.output!, farm.mill.ready)}`
      if (s === 'working') return `Milling ${count(farm.mill.input!, farm.mill.count)} · ${mmss(millSecondsLeft())}`
      return 'Mill · sugar from cane, flour from wheat'
    },
    run: () => {
      const s = millStage()
      const { pan, near } = placeSound(MILL.x, MILL.z)
      if (s === 'done') {
        millCollect()
        playGesture('interact')
        farmSound('harvest', pan, near)
      } else if (s === 'working') showToast(`${mmss(millSecondsLeft())} to go`)
      else openPanel({ kind: 'mill' })
    },
  })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const s = millStage()
    if (stage.current === 'working' && s === 'done') {
      const { pan, near } = placeSound(MILL.x, MILL.z)
      farmSound('ding', pan, Math.max(0.6, near))
    }
    stage.current = s
    const working = s === 'working'
    spin.current += ((working ? 1 : 0) - spin.current) * Math.min(1, dt * 2)
    if (wheel.current) wheel.current.rotation.z -= dt * 1.6 * spin.current
    rollers.current.forEach((r, k) => {
      if (r) r.rotation.y += dt * 3.2 * spin.current * (k ? -1 : 1)
    })
    if (working) {
      creak.current -= dt
      if (creak.current <= 0) {
        creak.current = 1.1 + Math.random() * 0.6
        const { pan, near } = placeSound(MILL.x, MILL.z)
        if (near > 0.15) farmSound('creak', pan, near)
      }
    }
  })

  return (
    <group position={[MILL.x, 0, MILL.z]}>
      <B size={[1.6, 0.12, 1.3]} position={[0, 0.06, 0]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0.01} />
      {[-1, 1].map((sz) => (
        <B key={sz} size={[0.13, 1.5, 0.13]} position={[0.1, 0.81, sz * 0.46]} color={WOOD} mat="veneer" tile={0.9} radius={0.01} />
      ))}
      <B size={[0.15, 0.13, 1.12]} position={[0.1, 1.5, 0]} color={WOOD} mat="veneer" tile={0.9} radius={0.01} />
      <mesh position={[0.02, 1.5, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.62, 0.19]} />
        <meshStandardMaterial map={sign} roughness={0.85} />
      </mesh>
      {/* two iron rollers press the cane (or grind the grain) between them */}
      {[-1, 1].map((sz, k) => (
        <mesh
          key={sz}
          ref={(m) => {
            rollers.current[k] = m
          }}
          position={[0.1, 0.62, sz * 0.13]}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.12, 0.8, 14]} />
          <meshStandardMaterial color="#4a4d50" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      {/* the hopper above them */}
      <mesh position={[0.1, 1.18, 0]}>
        <cylinderGeometry args={[0.3, 0.16, 0.26, 14, 1, true]} />
        <meshStandardMaterial color="#9a7040" roughness={0.9} side={DoubleSide} />
      </mesh>
      {/* the big wheel on the side, with a crank */}
      <group ref={wheel} position={[0.1, 0.86, 0.62]}>
        <mesh>
          <torusGeometry args={[0.55, 0.035, 8, 32]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.8} />
        </mesh>
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k} rotation-z={(k / 6) * Math.PI}>
            <boxGeometry args={[1.08, 0.04, 0.03]} />
            <meshStandardMaterial color={WOOD} roughness={0.8} />
          </mesh>
        ))}
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.07, 0.07, 0.1, 12]} />
          <meshStandardMaterial color="#3b3f42" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0.45, 0, 0.08]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
          <meshStandardMaterial color="#3b3f42" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
      {/* what comes out: a sack of sugar or flour, waiting to be collected */}
      {output && (
        <group position={[-0.48, 0.12, 0]}>
          <mesh position={[0, 0.2, 0]} scale={[1, 1.3, 0.85]} castShadow>
            <sphereGeometry args={[0.2, 14, 10]} />
            <meshStandardMaterial color={output === 'sugar' ? '#f2efe6' : '#e2d2b0'} roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.46, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 0.08, 10]} />
            <meshStandardMaterial color="#b89a6a" roughness={0.95} />
          </mesh>
        </group>
      )}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.82, 0.78, 0.72]} position={[0, 0.78, 0.1]} />
      </RigidBody>
    </group>
  )
}

/** The oven and the mill. */
export function Workshop() {
  return (
    <group name="farm-workshop">
      <Oven />
      <Mill />
    </group>
  )
}

