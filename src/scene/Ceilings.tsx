import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { HOUSE, ROOMS, type RoomId } from '../data/layout'
import { useHome } from '../store'

const { wallHeight: H } = HOUSE
const WARM = '#fff0d8'

/** One ceiling slab with a recessed light. It hides itself when the camera is above the roof (dollhouse view). */
function Ceiling({ id }: { id: RoomId }) {
  const { minX, maxX, minZ, maxZ } = ROOMS[id].bounds
  const w = maxX - minX
  const d = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const group = useRef<Group>(null)
  const slab = useRef<Mesh>(null)
  const mat = useRef<MeshStandardMaterial>(null)
  const fade = useRef(1)
  const camera = useThree((s) => s.camera)

  useFrame((_, dt) => {
    const state = useHome.getState()
    const inside = state.view === 'first' && state.phase === 'playing'
    const above = !inside && camera.position.y > H + 0.02
    fade.current = MathUtils.damp(fade.current, above ? 0 : 1, 12, dt)
    const f = fade.current
    if (group.current) group.current.visible = f > 0.03
    if (slab.current) slab.current.castShadow = f > 0.5 // sunlight only comes in through the windows while you are inside
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
      <mesh ref={slab} name={`ceiling-slab-${id}`} position={[cx, H + 0.07, cz]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.16, 0.14, d + 0.16]} />
        <meshStandardMaterial ref={mat} color="#f3f1ec" roughness={0.95} />
      </mesh>
      {/* recessed downlight */}
      <mesh position={[cx, H - 0.004, cz]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.17, 28]} />
        <meshStandardMaterial color="#fff6e6" emissive={WARM} emissiveIntensity={3.2} />
      </mesh>
    </group>
  )
}

/** Room lights live outside the fading group so they keep lighting the room when the roof is hidden. */
function CeilingLight({ id }: { id: RoomId }) {
  const { minX, maxX, minZ, maxZ } = ROOMS[id].bounds
  return <pointLight position={[(minX + maxX) / 2, H - 0.7, (minZ + maxZ) / 2]} color={WARM} intensity={15} distance={10} decay={2} />
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
