import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CanvasTexture, DoubleSide, SRGBColorSpace, type Group, type Mesh, type Sprite } from 'three'
import { loadSolids, solidsReady } from '../lib/sculpt'
import { mouthGlowMaterial, mouthGlowShape, ovenModel, structureParts } from '../models/structures'
import { B } from '../scene/Furnishings'
import { MACHINES, type CakeId, type MachineId } from './data'
import { farm, machineRecipe, machineStage, useFarm } from './state'
import { useMachine } from './useMachine'

// The farm's kitchen in the yard's south-east corner: a mill that presses sugar cane into sugar and grinds wheat
// into flour (its wheel and rollers turn while it works), and a wood-fired clay oven (sculpted with the kit, see
// src/models/structures.ts) that bakes cakes from what the farm makes (its mouth glows and its chimney smokes while
// it bakes; the cake waits on the table beside it). And in the
// north yard, beside the sheep, a loom that weaves the fleeces into cloth (its shuttle flies while it works). What
// each takes, makes and says is in MACHINES (src/farm/data.ts), and useMachine puts it on the action button; here
// are their models and their moving parts.

const WOOD = '#8a6440'
const WOOD_DARK = '#5e4630'
/** What a machine has ready to take out (null while it works or is idle). */
const done = (id: MachineId) => (machineStage(id) === 'done' ? (machineRecipe(id)?.makes ?? null) : null)

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

// the oven's mouth is cut through its dome with the solid engine: it starts loading with the farm
void loadSolids()

/** False until the solid engine has loaded (or failed to: then the oven is built without its cut). */
function useSolids() {
  const [ready, setReady] = useState(solidsReady)
  useEffect(() => {
    if (!ready) void loadSolids().then(() => setReady(true))
  }, [ready])
  return ready
}

function Oven() {
  useFarm((s) => s.rev)
  useMachine('oven')
  const glow = useMemo(() => mouthGlowMaterial(0), [])
  const smoke = useRef<(Sprite | null)[]>([])
  const tex = useMemo(() => smokeTexture(), [])
  const solids = useSolids()
  const model = useMemo(() => (solids ? structureParts(ovenModel(), 'oven') : null), [solids])
  const glowShape = useMemo(() => mouthGlowShape().geometry(), [])
  useEffect(() => () => model?.dispose(), [model])
  useEffect(
    () => () => {
      glowShape.dispose()
      glow.dispose()
    },
    [glowShape, glow],
  )
  const ready = done('oven') as CakeId | null

  useFrame((state) => {
    const s = machineStage('oven')
    const t = state.clock.elapsedTime
    const baking = s === 'working'
    const flicker = 0.75 + Math.sin(t * 13) * 0.12 + Math.sin(t * 29) * 0.08
    glow.emissiveIntensity = baking ? 2.6 * flicker : s === 'done' ? 0.5 : 0
    smoke.current.forEach((sp, k) => {
      if (!sp) return
      sp.visible = baking
      if (!baking) return
      const life = (t * 0.35 + k / smoke.current.length) % 1
      sp.position.set(0.24 + Math.sin(t * 0.7 + k) * 0.08 * life, 1.56 + life * 1.3, Math.cos(t * 0.5 + k) * 0.08 * life)
      const size = 0.18 + life * 0.45
      sp.scale.set(size, size, 1)
      sp.material.opacity = (1 - life) * 0.5
    })
  })

  return (
    <group position={[MACHINES.oven.x, 0, MACHINES.oven.z]}>
      {/* stone plinth, clay dome, the mouth facing the yard, a chimney, firewood behind and the peel */}
      {model && <primitive object={model.group} />}
      {/* the fire, at the back of the mouth */}
      <mesh geometry={glowShape} material={glow} />
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
        {/* the firewood behind it */}
        <CuboidCollider args={[0.24, 0.2, 0.42]} position={[0.915, 0.2, 0]} />
      </RigidBody>
    </group>
  )
}

function Mill() {
  useFarm((s) => s.rev)
  const spin = useMachine('mill', 2)
  const wheel = useRef<Group>(null)
  const rollers = useRef<(Mesh | null)[]>([])
  const sign = useMemo(() => signTexture('MILL'), [])
  const output = done('mill')

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    if (wheel.current) wheel.current.rotation.z -= dt * 1.6 * spin.current
    rollers.current.forEach((r, k) => {
      if (r) r.rotation.y += dt * 3.2 * spin.current * (k ? -1 : 1)
    })
  })

  return (
    <group position={[MACHINES.mill.x, 0, MACHINES.mill.z]}>
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

/** A floor loom: the warp runs from the back beam over the frame to the cloth beam at the front, where the woven
 * cloth rolls up; while it works the shuttle flies across, the beater swings and the heddles rise and fall. */
function Loom() {
  useFarm((s) => s.rev)
  const work = useMachine('loom', 3)
  const shuttle = useRef<Mesh>(null)
  const beater = useRef<Group>(null)
  const heddles = useRef<(Mesh | null)[]>([])
  const roll = useRef<Mesh>(null)
  const t0 = useRef(0)
  const sign = useMemo(() => signTexture('LOOM'), [])
  const warp = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 8
    const g = c.getContext('2d')!
    for (let i = 0; i < 32; i++) {
      g.fillStyle = i % 2 ? '#efe6d2' : '#d9cdb4'
      g.fillRect(i * 4, 0, 2, 8)
    }
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  const ready = farm.machines.loom.ready

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    if (machineStage('loom') === 'working') t0.current += dt
    const k = work.current
    const pick = t0.current * 1.6 // picks (passes of the shuttle) per second
    const across = Math.sin(pick * Math.PI) // −1 … 1
    if (shuttle.current) shuttle.current.position.x = across * 0.5 * k
    if (beater.current) beater.current.rotation.x = -0.22 + Math.max(0, Math.cos(pick * Math.PI * 2)) * 0.22 * k
    heddles.current.forEach((h, i) => {
      if (h) h.position.y = 0.98 + (i ? 1 : -1) * Math.sign(Math.sin(pick * Math.PI)) * 0.03 * k
    })
    // the cloth beam fattens a little as the cloth rolls onto it
    if (roll.current) {
      const m = farm.machines.loom
      const recipe = machineRecipe('loom')
      const r = 1 + (m.count && recipe ? (m.progress / (m.count * recipe.seconds)) * 0.5 : ready ? 0.5 : 0)
      roll.current.scale.set(r, 1, r)
    }
  })

  return (
    <group position={[MACHINES.loom.x, 0, MACHINES.loom.z]}>
      {/* the frame: four posts, side rails, a top bar that carries the heddles */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <B key={`${sx}${sz}`} size={[0.08, sz < 0 ? 1.55 : 0.95, 0.08]} position={[sx * 0.72, sz < 0 ? 0.775 : 0.475, sz * 0.42]} color={WOOD} mat="veneer" tile={0.9} radius={0} />
        )),
      )}
      {[-1, 1].map((sx) => (
        <B key={sx} size={[0.07, 0.07, 0.92]} position={[sx * 0.72, 0.9, 0]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0} />
      ))}
      <B size={[1.52, 0.08, 0.08]} position={[0, 1.52, -0.42]} color={WOOD_DARK} mat="veneer" tile={0.9} radius={0} />
      <B size={[1.52, 0.07, 0.07]} position={[0, 1.25, -0.05]} color={WOOD_DARK} radius={0} />
      <mesh position={[0, 1.66, -0.42]}>
        <planeGeometry args={[0.6, 0.19]} />
        <meshStandardMaterial map={sign} roughness={0.85} />
      </mesh>
      {/* the warp: from the back beam, up over the frame and down to the cloth at the front */}
      <mesh position={[0, 0.95, -0.21]} rotation-x={-Math.PI / 2 + 0.25}>
        <planeGeometry args={[1.3, 0.44]} />
        <meshStandardMaterial map={warp} roughness={0.95} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.93, 0.2]} rotation-x={-Math.PI / 2 - 0.1}>
        <planeGeometry args={[1.3, 0.4]} />
        <meshStandardMaterial map={warp} roughness={0.95} side={DoubleSide} />
      </mesh>
      {/* two heddle frames, rising and falling in turn */}
      {[0, 1].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            heddles.current[i] = m
          }}
          position={[0, 0.98, -0.08 + i * 0.07]}
        >
          <boxGeometry args={[1.36, 0.3, 0.02]} />
          <meshStandardMaterial color="#b3a58a" roughness={0.8} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* the beater swings against the cloth; the shuttle flies across in front of it */}
      <group ref={beater} position={[0, 1.25, 0.12]}>
        <B size={[1.4, 0.06, 0.05]} position={[0, -0.33, 0]} color={WOOD} radius={0} />
        {[-1, 1].map((sx) => (
          <B key={sx} size={[0.04, 0.36, 0.04]} position={[sx * 0.68, -0.15, 0]} color={WOOD} radius={0} />
        ))}
      </group>
      <mesh ref={shuttle} position={[0, 0.93, 0.22]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.025, 0.2, 3, 8]} />
        <meshStandardMaterial color="#6b4a2e" roughness={0.6} />
      </mesh>
      {/* the cloth beam at the front, with the cloth rolled onto it */}
      <mesh ref={roll} position={[0, 0.88, 0.42]} rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.36, 14]} />
        <meshStandardMaterial color="#5b7fb8" roughness={0.9} />
      </mesh>
      {/* the weaver's bench, and the finished cloth on it */}
      <B size={[0.9, 0.06, 0.32]} position={[0, 0.48, 0.92]} color={WOOD} mat="veneer" tile={0.9} radius={0} />
      {[-1, 1].map((sx) => (
        <B key={sx} size={[0.06, 0.45, 0.28]} position={[sx * 0.38, 0.225, 0.92]} color={WOOD_DARK} radius={0} />
      ))}
      {ready > 0 &&
        Array.from({ length: Math.min(3, ready) }, (_, i) => (
          <mesh key={i} position={[-0.22 + i * 0.22, 0.58, 0.92]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.26, 12]} />
            <meshStandardMaterial color={['#5b7fb8', '#c9573f', '#5c8a4a'][i]} roughness={0.9} />
          </mesh>
        ))}
      {/* a basket of fleece waiting to be woven, when there is some */}
      {farm.inv.wool > 0 && (
        <group position={[1.05, 0, 0.35]}>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.22, 0.17, 0.32, 14, 1, true]} />
            <meshStandardMaterial color="#b88a52" roughness={0.9} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.3, 0]} scale={[1, 0.55, 1]}>
            <icosahedronGeometry args={[0.2, 1]} />
            <meshStandardMaterial color="#f1ebdc" roughness={1} />
          </mesh>
        </group>
      )}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.8, 0.78, 0.5]} position={[0, 0.78, 0]} />
        <CuboidCollider args={[0.47, 0.26, 0.18]} position={[0, 0.26, 0.92]} />
      </RigidBody>
    </group>
  )
}

/** The oven, the mill and the loom. */
export function Workshop() {
  return (
    <group name="farm-workshop">
      <Oven />
      <Mill />
      <Loom />
    </group>
  )
}
