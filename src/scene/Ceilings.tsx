import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial, type PointLight } from 'three'
import { HOUSE, ROOMS, type RoomId } from '../data/layout'
import { levels } from '../lib/lightLevels'
import { useHome } from '../store'

const { wallHeight: H } = HOUSE
const WARM = '#fff0d8'

const PAD = 0.08 // overhang past the outer faces only, so neighbouring slabs never overlap
const THICK = 0.3

/**
 * One ceiling slab with a recessed light. It is shown only while the camera is inside the house under
 * the ceiling (always, in first person) and fades away for the dollhouse view and for any camera outside.
 */
function Ceiling({ id }: { id: RoomId }) {
  const { minX, maxX, minZ, maxZ } = ROOMS[id].bounds
  const x0 = minX === HOUSE.minX ? minX - PAD : minX
  const x1 = maxX === HOUSE.maxX ? maxX + PAD : maxX
  const z0 = minZ === HOUSE.minZ ? minZ - PAD : minZ
  const z1 = maxZ === HOUSE.maxZ ? maxZ + PAD : maxZ
  const cx = (x0 + x1) / 2
  const cz = (z0 + z1) / 2
  const lx = (minX + maxX) / 2
  const lz = (minZ + maxZ) / 2
  const group = useRef<Group>(null)
  const slab = useRef<Mesh>(null)
  const mat = useRef<MeshStandardMaterial>(null)
  const fade = useRef(1)
  const shown = useRef(true)
  const camera = useThree((s) => s.camera)

  useFrame((_, dt) => {
    const state = useHome.getState()
    const c = camera.position
    const inFootprint = c.x > HOUSE.minX && c.x < HOUSE.maxX && c.z > HOUSE.minZ && c.z < HOUSE.maxZ
    if (state.view === 'first' && state.phase === 'playing') {
      shown.current = true
    } else if (shown.current) {
      if (!inFootprint || c.y > H + 0.06) shown.current = false // hysteresis: no flicker around the roof line
    } else if (inFootprint && c.y < H - 0.06) {
      shown.current = true
    }
    fade.current = MathUtils.damp(fade.current, shown.current ? 1 : 0, 12, dt)
    const f = fade.current
    if (group.current) group.current.visible = f > 0.03
    // while it is up, the slab blocks the sun, so light only comes in through the windows
    if (slab.current) slab.current.castShadow = shown.current
    if (mat.current) {
      mat.current.opacity = f
      const transparent = f < 0.995
      if (mat.current.transparent !== transparent) {
        mat.current.transparent = transparent
        mat.current.depthWrite = !transparent
        mat.current.needsUpdate = true
      }
    }
  })

  return (
    <group ref={group} name={`ceiling-group-${id}`}>
      <mesh ref={slab} name={`ceiling-slab-${id}`} position={[cx, H + THICK / 2, cz]} castShadow receiveShadow>
        <boxGeometry args={[x1 - x0, THICK, z1 - z0]} />
        <meshStandardMaterial ref={mat} color="#f3f1ec" roughness={0.95} />
      </mesh>
      {/* recessed downlight */}
      <mesh position={[lx, H - 0.004, lz]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.17, 28]} />
        <meshStandardMaterial color="#fff6e6" emissive={WARM} emissiveIntensity={3.2} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
    </group>
  )
}

/** Room lights live outside the fading group so they keep lighting the room when the roof is hidden. */
function CeilingLight({ id }: { id: RoomId }) {
  const { minX, maxX, minZ, maxZ } = ROOMS[id].bounds
  const { ceiling, color } = ROOMS[id].mood
  const light = useRef<PointLight>(null)
  useFrame(() => {
    if (light.current) light.current.intensity = ceiling * levels[id]
  })
  return <pointLight ref={light} position={[(minX + maxX) / 2, H - 0.7, (minZ + maxZ) / 2]} color={color} intensity={ceiling} distance={10} decay={2} />
}

export function Ceilings() {
  const ids = Object.keys(ROOMS) as RoomId[]
  return (
    <>
      {ids.map((id) => (
        <Ceiling key={id} id={id} />
      ))}
      {ids.map((id) => (
        <CeilingLight key={`l-${id}`} id={id} />
      ))}
    </>
  )
}
