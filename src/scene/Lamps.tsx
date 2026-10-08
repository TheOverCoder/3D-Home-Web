import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type PointLight } from 'three'
import { LAMPS, type LampDef } from '../data/layout'
import { useInteractable } from '../lib/interaction'
import { levels } from '../lib/lightLevels'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'

const WARM = '#ffcf94'

function Fixture({ def, on }: { def: LampDef; on: boolean }) {
  const [x, y, z] = def.position
  const glow = on ? 2.2 : 0.05
  const shadeMaterial = <meshStandardMaterial color="#f3e7d3" emissive={WARM} emissiveIntensity={glow} roughness={0.9} side={DoubleSide} />
  const metal = <meshStandardMaterial color="#26282b" metalness={0.8} roughness={0.35} />
  switch (def.kind) {
    case 'floor':
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.2, 0.22, 0.04, 24]} />{metal}</mesh>
          <mesh position={[0, 0.7, 0]} castShadow><cylinderGeometry args={[0.012, 0.012, 1.4, 10]} />{metal}</mesh>
          <mesh position={[0, y, 0]}><cylinderGeometry args={[0.2, 0.28, 0.34, 28, 1, true]} />{shadeMaterial}</mesh>
        </group>
      )
    case 'desk':
      return (
        <group position={[x, 0.76, z]}>
          <mesh position={[0, 0.015, 0]} castShadow><cylinderGeometry args={[0.1, 0.11, 0.03, 20]} />{metal}</mesh>
          <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[0.008, 0.008, 0.32, 8]} />{metal}</mesh>
          <mesh position={[0, y - 0.76, 0]}><cylinderGeometry args={[0.07, 0.12, 0.14, 20, 1, true]} />{shadeMaterial}</mesh>
        </group>
      )
    case 'counter':
      return (
        <group position={[x, 0.91, z]}>
          <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.09, 0.1, 0.04, 20]} />{metal}</mesh>
          <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />{metal}</mesh>
          <mesh position={[0, y - 0.91, 0]}><sphereGeometry args={[0.1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />{shadeMaterial}</mesh>
        </group>
      )
    case 'bedside':
      return (
        <group position={[x, 0.585, z]}>
          <mesh position={[0, 0.13, 0]} castShadow><cylinderGeometry args={[0.04, 0.08, 0.26, 16]} /><meshStandardMaterial color="#c9b79c" roughness={0.6} /></mesh>
          <mesh position={[0, y - 0.585, 0]}><cylinderGeometry args={[0.1, 0.16, 0.2, 24, 1, true]} />{shadeMaterial}</mesh>
        </group>
      )
  }
}

function Lamp({ def, fixture }: { def: LampDef; fixture: boolean }) {
  const on = useHome((s) => s.lamps[def.id])
  const toggleLamp = useHome((s) => s.toggleLamp)
  const light = useRef<PointLight>(null)
  const current = useRef(on ? 1 : 0)
  // fades up and down instead of popping, and dims a little when you are elsewhere in the house
  useFrame((_, dt) => {
    current.current += ((useHome.getState().lamps[def.id] ? 1 : 0) - current.current) * (1 - Math.exp(-7 * dt))
    if (light.current) light.current.intensity = 6.5 * current.current * (0.6 + 0.4 * levels[def.room])
  })
  useInteractable({
    id: def.id,
    label: on ? 'Switch the light off' : 'Switch the light on',
    position: [def.position[0], Math.min(def.position[1], 1.1), def.position[2]],
    radius: 1.4,
    run: () => {
      playGesture('interact')
      toggleLamp(def.id)
    },
  })
  return (
    <>
      {fixture && <Fixture def={def} on={on} />}
      {/* constant light count (intensity 0 when off) so toggling never recompiles shaders */}
      <pointLight ref={light} position={def.position} color={WARM} intensity={on ? 6.5 : 0} distance={7} decay={1.7} />
    </>
  )
}

export function Lamps({ fixtures = true }: { fixtures?: boolean }) {
  return (
    <>
      {LAMPS.map((def) => (
        <Lamp key={def.id} def={def} fixture={fixtures} />
      ))}
    </>
  )
}
