import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, DoubleSide, MathUtils, SRGBColorSpace, type Group, type Sprite } from 'three'
import { useInteractable } from '../lib/interaction'
import { useHome } from '../store'
import { GATE_SPOT, count } from './data'
import { drawProduce } from './icons'
import { farm, useFarm, type Visitor } from './state'

// People from the lane who stop at the garden gate to buy something. Built like the player's own body, in their
// own clothes, they walk, wave when they arrive, hop when you say yes and shake their head when you say no.
// A speech bubble over their head shows what they want and what they offer.

function bubbleTexture(v: Visitor): CanvasTexture {
  const W = 320
  const H = 136
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  const r = 34
  c.fillStyle = 'rgba(255,255,255,0.96)'
  c.beginPath()
  c.moveTo(r, 4)
  c.arcTo(W - 4, 4, W - 4, H - 24, r)
  c.arcTo(W - 4, H - 24, 4, H - 24, r)
  c.lineTo(W / 2 + 14, H - 24)
  c.lineTo(W / 2, H - 4)
  c.lineTo(W / 2 - 14, H - 24)
  c.arcTo(4, H - 24, 4, 4, r)
  c.arcTo(4, 4, W - 4, 4, r)
  c.closePath()
  c.fill()
  drawProduce(c, v.want, 58, 56, 72)
  c.fillStyle = '#1d232c'
  c.font = '700 44px Inter, system-ui, sans-serif'
  c.textBaseline = 'middle'
  c.fillText(`×${v.qty}`, 100, 58)
  drawProduce(c, 'coin', 214, 56, 50)
  c.fillText(String(v.offer), 244, 58)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  return t
}

function Person({ v }: { v: Visitor }) {
  const root = useRef<Group>(null)
  const hips = useRef<Group>(null)
  const head = useRef<Group>(null)
  const thighL = useRef<Group>(null)
  const thighR = useRef<Group>(null)
  const kneeL = useRef<Group>(null)
  const kneeR = useRef<Group>(null)
  const armL = useRef<Group>(null)
  const armR = useRef<Group>(null)
  const elbowR = useRef<Group>(null)
  const bubble = useRef<Sprite>(null)
  const phase = useRef(Math.random() * 10)
  const last = useRef({ x: v.x, z: v.z })
  const texture = useMemo(() => bubbleTexture(v), [v])
  useEffect(() => () => texture.dispose(), [texture])
  const { look } = v
  const H = look.height
  const openPanel = useHome((s) => s.openPanel)

  useInteractable({
    id: `farm-visitor-${v.id}`,
    label: () => `${v.name}: ${count(v.want, v.qty)} for ${v.offer} coins`,
    position: [GATE_SPOT.x, 1.0, GATE_SPOT.z],
    aim: [GATE_SPOT.x, 1.45, GATE_SPOT.z],
    radius: 2.9,
    enabled: () => v.phase === 'waiting',
    run: () => openPanel({ kind: 'offer', visitor: v.id }),
  })

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const g = root.current
    if (!g) return
    g.position.set(v.x, 0, v.z)
    g.rotation.y = v.heading
    const moved = Math.hypot(v.x - last.current.x, v.z - last.current.z)
    last.current.x = v.x
    last.current.z = v.z
    phase.current += moved * 5.2
    const walking = v.moving && moved > 1e-4
    const f = phase.current
    const amp = walking ? 0.55 : 0
    const since = farm.clock - v.moodAt
    const t = state.clock.elapsedTime
    const waving = v.phase === 'waiting' && since < 2.4
    const happy = v.mood === 'happy' && since < 1.8
    const sad = v.mood === 'sad' && since < 1.8
    const damp = (o: Group | null, axis: 'x' | 'y' | 'z', to: number, k = 12) => {
      if (o) o.rotation[axis] = MathUtils.damp(o.rotation[axis], to, k, dt)
    }
    damp(thighL.current, 'x', -Math.sin(f) * amp)
    damp(thighR.current, 'x', Math.sin(f) * amp)
    damp(kneeL.current, 'x', Math.max(0, Math.cos(f)) * amp * 1.1 + 0.03)
    damp(kneeR.current, 'x', Math.max(0, -Math.cos(f)) * amp * 1.1 + 0.03)
    damp(armL.current, 'x', happy ? -2.6 : Math.sin(f) * amp * 0.7)
    damp(armL.current, 'z', happy ? 0.25 : 0.06)
    damp(armR.current, 'x', waving || happy ? -2.7 : -Math.sin(f) * amp * 0.7)
    damp(armR.current, 'z', waving ? -0.35 + Math.sin(t * 9) * 0.25 : happy ? -0.25 : -0.06)
    damp(elbowR.current, 'x', waving ? -0.5 : -0.15)
    if (hips.current) {
      const bob = walking ? Math.abs(Math.cos(f)) * 0.025 : 0
      const hop = happy ? Math.abs(Math.sin(t * 10)) * 0.07 : 0
      const breathe = walking ? 0 : Math.sin(t * 1.6) * 0.004
      hips.current.position.y = 0.885 * H + bob + hop + breathe
    }
    damp(head.current, 'y', sad ? Math.sin(t * 13) * 0.4 : 0, 18)
    damp(head.current, 'x', sad ? 0.25 : 0)
    if (bubble.current) {
      bubble.current.visible = v.phase === 'waiting'
      bubble.current.position.y = 2.12 * H + Math.sin(t * 2.2) * 0.02
    }
  })

  const cloth = (color: string) => <meshStandardMaterial color={color} roughness={0.85} />
  const skin = <meshStandardMaterial color={look.skin} roughness={0.6} />
  const hair = <meshStandardMaterial color={look.hair} roughness={0.75} />
  const leg = (side: 1 | -1, thigh: typeof thighL, knee: typeof kneeL) => (
    <group ref={thigh} position={[side * 0.09, 0, 0]}>
      <mesh position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.072, 0.3, 4, 10]} />
        {cloth(look.trousers)}
      </mesh>
      <group ref={knee} position={[0, -0.42, 0]}>
        <mesh position={[0, -0.19, 0]}>
          <capsuleGeometry args={[0.058, 0.3, 4, 10]} />
          {cloth(look.trousers)}
        </mesh>
        <mesh position={[0, -0.43, 0.045]}>
          <boxGeometry args={[0.1, 0.07, 0.25]} />
          <meshStandardMaterial color="#2a2522" roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
  const arm = (side: 1 | -1, ref: typeof armL, elbow?: typeof elbowR) => (
    <group ref={ref} position={[side * 0.215, 0.5, 0]}>
      <mesh position={[0, -0.14, 0]}>
        <capsuleGeometry args={[0.052, 0.2, 4, 10]} />
        {cloth(look.shirt)}
      </mesh>
      <group ref={elbow} position={[0, -0.29, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.042, 0.19, 4, 10]} />
          {skin}
        </mesh>
        <mesh position={[0, -0.27, 0]}>
          <sphereGeometry args={[0.048, 10, 8]} />
          {skin}
        </mesh>
        {side < 0 && (
          // a basket for the shopping
          <group position={[0, -0.36, 0.02]}>
            <mesh position={[0, -0.06, 0]}>
              <cylinderGeometry args={[0.13, 0.1, 0.13, 12, 1, true]} />
              <meshStandardMaterial color="#b88a52" roughness={0.9} side={DoubleSide} />
            </mesh>
            <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.11, 0.008, 6, 16, Math.PI]} />
              <meshStandardMaterial color="#9a7040" roughness={0.9} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  )

  return (
    <group ref={root} name={`visitor-${v.id}`}>
      <group ref={hips} position={[0, 0.885 * H, 0]} scale={H}>
        {leg(1, thighL, kneeL)}
        {leg(-1, thighR, kneeR)}
        <mesh position={[0, 0.26, 0]}>
          <capsuleGeometry args={[0.16, 0.36, 4, 14]} />
          {cloth(look.shirt)}
        </mesh>
        {arm(1, armL)}
        {arm(-1, armR, elbowR)}
        <mesh position={[0, 0.63, 0]}>
          <cylinderGeometry args={[0.05, 0.055, 0.1, 8]} />
          {skin}
        </mesh>
        <group ref={head} position={[0, 0.79, 0]}>
          <mesh>
            <sphereGeometry args={[0.115, 16, 12]} />
            {skin}
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.04, 0.02, 0.105]}>
              <sphereGeometry args={[0.012, 8, 6]} />
              <meshStandardMaterial color="#1b1b1b" roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.035, -0.012]} scale={[1.04, look.hairStyle === 1 ? 0.95 : 0.82, 1.06]}>
            <sphereGeometry args={[0.118, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            {hair}
          </mesh>
          {look.hairStyle === 1 && (
            <mesh position={[0, -0.08, -0.07]} scale={[1, 1, 0.55]}>
              <capsuleGeometry args={[0.1, 0.16, 4, 10]} />
              {hair}
            </mesh>
          )}
          {look.hairStyle === 2 && (
            <mesh position={[0, 0.09, -0.08]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              {hair}
            </mesh>
          )}
          {look.hat && (
            <group position={[0, 0.09, 0]}>
              <mesh>
                <cylinderGeometry args={[0.21, 0.21, 0.012, 20]} />
                <meshStandardMaterial color="#d9c18a" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.05, 0]}>
                <cylinderGeometry args={[0.105, 0.12, 0.1, 16]} />
                <meshStandardMaterial color="#d9c18a" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.122, 0.122, 0.025, 16]} />
                <meshStandardMaterial color="#8a4b3a" roughness={0.8} />
              </mesh>
            </group>
          )}
        </group>
      </group>
      {/* a soft shadow on the ground: people do not draw into the sun's shadow map (it would redraw every frame) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
        <circleGeometry args={[0.32, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <sprite ref={bubble} scale={[0.66, 0.28, 1]} position={[0, 2.12 * H, 0]} visible={false}>
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

/** Everyone currently on the lane or at the gate. */
export function Visitors() {
  useFarm((s) => s.rev)
  return (
    <group name="farm-visitors">
      {farm.visitors.map((v) => (
        <Person key={v.id} v={v} />
      ))}
    </group>
  )
}

