import { useEffect, useMemo } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { CAR_SPOT } from '../../data/maps'
import { useInteractable } from '../../lib/interaction'
import { CAR_SHAPE, carHalf, carParts, putCar } from '../../models/car'
import { useHome } from '../../store'
import type { Place } from '../state'

// The car on a map, at its spot (src/data/maps.ts, CAR_SPOT): its model (src/models/car.ts: one draw that casts, and
// the soft shadow under it), a collider you bump into, and its talk — one press opens its sheet (./CarPanel.tsx: where
// it drives you, the house once it is yours, and the farm; `travel` in src/scene/travel.ts). Each map mounts its own.

/** How far from the car's side you can be and still open its door (on the ground, from its footprint's edge). */
const CAR_REACH = 1.2

export function Car({ place }: { place: Place }) {
  const spot = CAR_SPOT[place]
  const parts = useMemo(() => {
    const p = carParts(1)
    p.begin()
    putCar(p, spot.x, spot.z, spot.heading)
    p.end()
    return p
  }, [spot])
  useEffect(() => () => parts.dispose(), [parts])
  const half = carHalf(spot.heading)
  const openPanel = useHome((s) => s.openPanel)

  useInteractable({
    id: `car-${place}`,
    position: [spot.x, 0.8, spot.z],
    aim: [spot.x, 0.95, spot.z],
    box: half,
    radius: CAR_REACH,
    label: 'The car',
    icon: { verb: 'drive', art: 'automobile' },
    run: () => openPanel({ kind: 'car' }),
  })

  return (
    <group name={`car-${place}`}>
      <primitive object={parts.group} />
      <RigidBody type="fixed" colliders={false}>
        {/* the body to the beltline, and the cabin over it (a little narrower) */}
        <CuboidCollider args={[half.x, 0.44, half.z]} position={[spot.x, 0.44, spot.z]} />
        <CuboidCollider args={[half.x * 0.8, 0.28, half.z * 0.8]} position={[spot.x, CAR_SHAPE.belt + 0.26, spot.z]} />
      </RigidBody>
    </group>
  )
}
