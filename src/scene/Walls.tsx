import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Box3, MathUtils, Ray, Vector3, type MeshStandardMaterial } from 'three'
import { DOORWAYS, HOUSE, ROOMS, type Vec3 } from '../data/layout'
import { playerState } from '../lib/playerState'

interface Seg {
  key: string
  center: Vec3
  size: Vec3
  color: string
  solid: boolean // false = decorative lintel above a doorway (no collider)
}

const INTERIOR = '#d4d0c8'
const { wallHeight: H, wallThickness: T, doorHeight: DH } = HOUSE

function run(
  axis: 'x' | 'z',
  at: number,
  from: number,
  to: number,
  gaps: { centre: number; width: number }[],
  color: string,
  tag: string,
): Seg[] {
  const out: Seg[] = []
  const add = (a: number, b: number, y0: number, y1: number, solid: boolean, suffix: string) => {
    const len = b - a
    if (len < 1e-3) return
    const mid = (a + b) / 2
    const cy = (y0 + y1) / 2
    const hh = y1 - y0
    out.push({
      key: `${tag}-${suffix}`,
      center: axis === 'x' ? [mid, cy, at] : [at, cy, mid],
      size: axis === 'x' ? [len, hh, T] : [T, hh, len],
      color,
      solid,
    })
  }
  let cursor = from
  gaps
    .filter((g) => g.centre - g.width / 2 >= from - 1e-6 && g.centre + g.width / 2 <= to + 1e-6)
    .sort((a, b) => a.centre - b.centre)
    .forEach((g, i) => {
      const a = g.centre - g.width / 2
      const b = g.centre + g.width / 2
      add(cursor, a, 0, H, true, `wall${i}`)
      add(a, b, DH, H, false, `lintel${i}`)
      cursor = b
    })
  add(cursor, to, 0, H, true, 'end')
  return out
}

function buildSegments(): Seg[] {
  const { minX, maxX, minZ, maxZ } = HOUSE
  const e = T / 2
  const r = ROOMS
  const zGaps = [DOORWAYS.livingOffice, DOORWAYS.kitchenBedroom]
  const xGaps = [DOORWAYS.officeKitchen, DOORWAYS.livingBedroom]
  return [
    // exterior, coloured per room so the inside reads correctly
    ...run('x', minZ, minX - e, 0, [], r.office.wall, 'n-office'),
    ...run('x', minZ, 0, maxX + e, [], r.kitchen.wall, 'n-kitchen'),
    ...run('x', maxZ, minX - e, 0, [], r.living.wall, 's-living'),
    ...run('x', maxZ, 0, maxX + e, [], r.bedroom.wall, 's-bedroom'),
    ...run('z', minX, minZ - e, 0, [], r.office.wall, 'w-office'),
    ...run('z', minX, 0, maxZ + e, [], r.living.wall, 'w-living'),
    ...run('z', maxX, minZ - e, 0, [], r.kitchen.wall, 'e-kitchen'),
    ...run('z', maxX, 0, maxZ + e, [], r.bedroom.wall, 'e-bedroom'),
    // interior cross walls with doorways
    ...run('x', 0, minX, maxX, zGaps, INTERIOR, 'mid-z'),
    ...run('z', 0, minZ, maxZ, xGaps, INTERIOR, 'mid-x'),
  ]
}

const ray = new Ray()
const tmp = new Vector3()
const point = new Vector3()
// feet, hips, head — a wall that hides any of them fades
const SAMPLE_HEIGHTS = [-0.7, 0, 0.7]

/** Box walls with colliders. Walls that sit between the camera and the player fade out. */
export function Walls() {
  const segs = useMemo(buildSegments, [])
  const mats = useRef<(MeshStandardMaterial | null)[]>([])
  const boxes = useMemo(
    () =>
      segs.map((s) => {
        const b = new Box3().setFromCenterAndSize(new Vector3(...s.center), new Vector3(...s.size))
        return b.expandByScalar(0.02)
      }),
    [segs],
  )
  const fade = useRef<number[]>(segs.map(() => 1))
  const camera = useThree((s) => s.camera)

  useFrame((_, dt) => {
    ray.origin.copy(camera.position)
    for (let i = 0; i < segs.length; i++) {
      let blocked = false
      for (const dy of SAMPLE_HEIGHTS) {
        point.set(playerState.position.x, playerState.position.y + dy, playerState.position.z)
        const length = camera.position.distanceTo(point)
        ray.direction.copy(point).sub(camera.position).normalize()
        const hit = ray.intersectBox(boxes[i], tmp)
        if (hit !== null && tmp.distanceTo(camera.position) < length - 0.05) {
          blocked = true
          break
        }
      }
      fade.current[i] = MathUtils.damp(fade.current[i], blocked ? 0.08 : 1, 10, dt)
      const mat = mats.current[i]
      if (!mat) continue
      const o = fade.current[i]
      mat.opacity = o
      const transparent = o < 0.995
      if (mat.transparent !== transparent) {
        mat.transparent = transparent
        mat.depthWrite = !transparent
        mat.needsUpdate = true
      }
    }
  })

  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={s.key} position={s.center} castShadow receiveShadow>
          <boxGeometry args={s.size} />
          <meshStandardMaterial
            ref={(m) => {
              mats.current[i] = m
            }}
            color={s.color}
            roughness={0.92}
          />
        </mesh>
      ))}
      <RigidBody type="fixed" colliders={false}>
        {segs
          .filter((s) => s.solid)
          .map((s) => (
            <CuboidCollider key={s.key} args={[s.size[0] / 2, s.size[1] / 2, s.size[2] / 2]} position={s.center} />
          ))}
      </RigidBody>
    </group>
  )
}
