import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { Color } from 'three'
import type { Box } from '../data/buildings'
import { DEALER_DESK, DEALER_WALKIN, DISPLAY_BAYS, SELLER_SPOT, SELLER_STAND, TURNTABLE } from '../data/dealer'
import { debugSet } from '../lib/debug'
import { useInteractable } from '../lib/interaction'
import { clock } from '../lib/time'
import { carHalf, carParts, paintTint, putCar } from '../models/car'
import { dealerFittingsParts } from '../models/dealer'
import { WalkIn, walkInDoor } from '../scene/WalkIn'
import { useHome } from '../store'
import { CAR_PAINTS, PAINT_IDS } from './carPaints'
import { clockOf, opensAt } from './day'
import { dealerOpen, dealerOpensIn, farm, sellerNow } from './state'

// The car dealer east of the contractor's cabin (Lane Motors, update-v1/missions/11-buildings.md c9; its row
// src/data/dealer.ts): the walk-in building (src/scene/WalkIn.tsx: its door shut out of its hours), its fittings (the
// seller's desk, the wall of the paints, the turntable: src/models/dealer.ts), the car turning on the turntable in the
// first paint you have not bought yet, two cars for sale on its forecourt (inside the sun's box: they cast, as your own
// car does), and the seller (drawn with the market's people) whose talk opens the paints for your car
// (./car/DealerPanel.tsx).

const middle = (b: Box) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2] as [number, number, number]
const half = (b: Box) => [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2] as [number, number, number]

/** The forecourt's two cars for sale: in their bays facing the lane, in two of the dealer's paints. */
const FOR_SALE = DISPLAY_BAYS.map((b, k) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, yaw: Math.PI / 2, paint: (['sky', 'sunflower'] as const)[k] }))
/** How fast the turntable turns (radians a second). */
const TURN = 0.25

/** The paint the turntable shows: the first you have not bought yet (all bought: the last). */
const showing = () => PAINT_IDS.find((id) => !farm.car.owned.includes(id)) ?? PAINT_IDS[PAINT_IDS.length - 1]

/** Who opens the door besides you: nobody walks in or out (the seller is behind the desk in the hours). */
function* noWalkers() {}
const closedNow = () => !dealerOpen()

export function Dealer() {
  const fittings = useMemo(() => dealerFittingsParts(), [])
  // the forecourt's cars (casting, inside the box) and the turntable's (inside, casting nothing)
  const forecourt = useMemo(() => {
    const p = carParts(FOR_SALE.length)
    p.begin()
    for (const c of FOR_SALE) putCar(p, c.x, c.z, c.yaw, new Color(...paintTint(CAR_PAINTS[c.paint].hex)))
    p.end()
    return p
  }, [])
  const turntable = useMemo(() => carParts(1, false), [])
  useEffect(
    () => () => {
      for (const p of [fittings, forecourt, turntable]) p.dispose()
    },
    [fittings, forecourt, turntable],
  )
  const spin = useRef(0)
  const tint = useMemo(() => new Color(), [])
  useFrame((_, dt) => {
    spin.current = (spin.current + TURN * Math.min(dt, 0.1)) % (Math.PI * 2)
    tint.setRGB(...paintTint(CAR_PAINTS[showing()].hex))
    turntable.begin()
    putCar(turntable, TURNTABLE.x, TURNTABLE.z, spin.current, tint)
    turntable.end()
  })
  useEffect(() => debugSet('dealer', { door: () => walkInDoor(DEALER_WALKIN.id), open: dealerOpen, showing }), [])

  const openPanel = useHome((s) => s.openPanel)
  // the seller behind the desk in the hours: the paints for your car; out of them, when the dealer opens
  useInteractable({
    id: 'farm-dealer-seller',
    position: [SELLER_STAND.x, 1.0, SELLER_STAND.z],
    aim: [SELLER_SPOT.x, 1.3, SELLER_SPOT.z],
    radius: 1.3,
    label: () => (sellerNow() ? 'Talk to the car dealer' : `The car dealer opens at ${clockOf(opensAt('dealer'))} · ${clock(dealerOpensIn())}`),
    icon: () => (sellerNow() ? { verb: 'talk', art: 'automobile' } : { verb: 'wait', art: 'automobile', seconds: Math.ceil(dealerOpensIn()) }),
    run: () => {
      if (sellerNow()) openPanel({ kind: 'dealer' })
    },
  })

  return (
    <group name="farm-dealer">
      <WalkIn def={DEALER_WALKIN} walkers={noWalkers} closed={closedNow} />
      <primitive object={fittings.group} />
      <primitive object={forecourt.group} />
      <primitive object={turntable.group} />
      {/* what you bump into: the desk, the turntable and its car, the forecourt's cars */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={half(DEALER_DESK)} position={middle(DEALER_DESK)} />
        <CylinderCollider args={[0.7, TURNTABLE.r * 0.6]} position={[TURNTABLE.x, 0.7, TURNTABLE.z]} />
        {FOR_SALE.map((c, k) => {
          const h = carHalf(c.yaw)
          return <CuboidCollider key={k} args={[h.x, 0.7, h.z]} position={[c.x, 0.7, c.z]} />
        })}
      </RigidBody>
    </group>
  )
}
