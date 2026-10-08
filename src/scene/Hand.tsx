import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Group } from 'three'
import { surface } from '../lib/proceduralTextures'

/** How closed the hand is. 0 = open and relaxed, 1 = fist. `point` straightens the index finger. */
export interface HandPose {
  curl: number
  point: number
}

// proximal / middle / distal lengths and radius of each finger, index → little
const FINGERS = [
  { z: 0.031, len: [0.04, 0.025, 0.021], r: 0.0088, spread: 0.06, bias: 0.85 },
  { z: 0.0105, len: [0.044, 0.028, 0.022], r: 0.0092, spread: 0.0, bias: 0.95 },
  { z: -0.0105, len: [0.04, 0.026, 0.02], r: 0.0088, spread: -0.04, bias: 1.05 },
  { z: -0.03, len: [0.032, 0.02, 0.018], r: 0.0078, spread: -0.1, bias: 1.15 },
]

const PALM = { w: 0.085, l: 0.092, t: 0.03 }

function Finger({ f, side, setJoints }: { f: (typeof FINGERS)[number]; side: 1 | -1; setJoints: (g: Group | null) => void }) {
  const [l1, l2, l3] = f.len
  const cap = (len: number, r: number) => [r, Math.max(0.001, len - r * 2), 4, 10] as const
  return (
    <group ref={setJoints} position={[0, -PALM.l, f.z]} rotation={[0, 0, 0]}>
      {/* proximal */}
      <mesh position={[0, -l1 / 2, 0]} castShadow>
        <capsuleGeometry args={cap(l1, f.r)} />
        <SkinMaterial />
      </mesh>
      <group name="j2" position={[0, -l1, 0]}>
        <mesh position={[0, -l2 / 2, 0]} castShadow>
          <capsuleGeometry args={cap(l2, f.r * 0.94)} />
          <SkinMaterial />
        </mesh>
        <group name="j3" position={[0, -l2, 0]}>
          <mesh position={[0, -l3 / 2, 0]} castShadow>
            <capsuleGeometry args={cap(l3, f.r * 0.88)} />
            <SkinMaterial />
          </mesh>
          {/* nail, on the back of the finger */}
          <mesh position={[side * f.r * 0.78, -l3 * 0.62, 0]} scale={[0.35, 1, 0.9]}>
            <capsuleGeometry args={[f.r * 0.6, l3 * 0.4, 3, 8]} />
            <meshStandardMaterial color="#efc9bd" roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

let skinTex: ReturnType<typeof surface> | undefined
export function SkinMaterial({ tint = '#d7a688' }: { tint?: string }) {
  skinTex ??= surface('skin', 2, 2)
  return (
    <meshPhysicalMaterial
      color={tint}
      map={skinTex.map}
      normalMap={skinTex.normalMap}
      normalScale={[0.5, 0.5]}
      roughness={0.52}
      roughnessMap={skinTex.roughnessMap}
      sheen={0.5}
      sheenColor="#ffb7a0"
      sheenRoughness={0.6}
      emissive="#3b130a"
      emissiveIntensity={0.18}
    />
  )
}

/**
 * A modelled hand: palm, four fingers with three phalanges and nails, a two-part thumb. The local frame is
 * the arm's: fingers point down (−y), the palm faces the body, the thumb is on the front (+z) side.
 * Pose it through the shared `pose` ref; joints ease towards it each frame.
 */
export function Hand({ side, pose, hold, children }: { side: 1 | -1; pose: RefObject<HandPose>; hold?: boolean; children?: React.ReactNode }) {
  const fingerGroups = useRef<(Group | null)[]>([])
  const thumb = useRef<Group>(null)
  const current = useRef({ curl: 0.3, point: 0 })

  const setFinger = useMemo(() => FINGERS.map((_, i) => (g: Group | null) => (fingerGroups.current[i] = g)), [])

  useFrame((_, dt) => {
    const target = pose.current ?? { curl: 0.3, point: 0 }
    current.current.curl = MathUtils.damp(current.current.curl, target.curl, 14, dt)
    current.current.point = MathUtils.damp(current.current.point, target.point, 14, dt)
    const { curl, point } = current.current
    FINGERS.forEach((f, i) => {
      const g = fingerGroups.current[i]
      if (!g) return
      const c = i === 0 ? curl * (1 - point) : curl
      // every joint bends towards the palm; the natural cascade makes the little finger curl more
      const base = (0.18 + c * 1.15) * f.bias
      g.rotation.z = -side * base
      g.rotation.x = f.spread * (1 - c)
      const j2 = g.getObjectByName('j2')
      const j3 = g.getObjectByName('j3')
      if (j2) j2.rotation.z = -side * (0.12 + c * 1.35) * f.bias
      if (j3) j3.rotation.z = -side * (0.08 + c * 0.95) * f.bias
    })
    if (thumb.current) {
      thumb.current.rotation.z = -side * (0.25 + curl * 0.55)
      thumb.current.rotation.x = 0.25 + curl * 0.2
    }
  })

  return (
    <group>
      {/* palm */}
      <mesh position={[0, -PALM.l / 2 + 0.004, 0]} castShadow>
        <boxGeometry args={[PALM.t, PALM.l, PALM.w]} />
        <SkinMaterial />
      </mesh>
      <mesh position={[0, -PALM.l * 0.82, 0]} scale={[0.9, 1, 1]} castShadow>
        <capsuleGeometry args={[PALM.t / 2, PALM.w - PALM.t, 4, 10]} />
        <SkinMaterial />
      </mesh>
      {/* heel of the hand */}
      <mesh position={[0, -0.01, 0.006]} scale={[0.95, 0.8, 1]} castShadow>
        <sphereGeometry args={[0.032, 12, 10]} />
        <SkinMaterial />
      </mesh>
      {FINGERS.map((f, i) => (
        <Finger key={i} f={f} side={side} setJoints={setFinger[i]} />
      ))}
      {/* thumb */}
      <group ref={thumb} position={[-side * 0.004, -0.02, PALM.w / 2 - 0.004]} rotation={[0.25, 0, 0]}>
        <mesh position={[0, -0.02, 0.006]} rotation={[-0.3, 0, 0]} castShadow>
          <capsuleGeometry args={[0.0105, 0.03, 4, 10]} />
          <SkinMaterial />
        </mesh>
        <group position={[0, -0.046, 0.016]} rotation={[-0.3, 0, 0]}>
          <mesh position={[0, -0.014, 0]} castShadow>
            <capsuleGeometry args={[0.0092, 0.022, 4, 10]} />
            <SkinMaterial />
          </mesh>
        </group>
      </group>
      {hold && null}
      {children}
    </group>
  )
}
