import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Box3, Color, Frustum, Group, Matrix4, Vector3 } from 'three'
import { debugSet } from '../lib/debug'
import { Parts, type PartDef } from '../lib/sculpt'
import { carHalf, carParts, paintTint, putCar } from '../models/car'
import { PARK_LAMPS, PARK_PLANTERS, parkModel, piecesAt } from '../models/park'
import { partGeometry, structureParts, type Structure } from '../models/structures'
import { decorModel } from './decorModels'
import { BY_CAR, MOST_CARS, PARK_BAYS, byCar, carColour, parkCars, parkStage, visitorBays } from './park'
import { shoppersAtOnce } from './market'
import { farm, shoppersNow, useFarm } from './state'
import { parkFull } from './parkFill'

// The car park beyond the lane (update-v1/missions/11-buildings.md c7, c8; its rules src/farm/park.ts, its model
// src/models/park.ts): built in stages as the farm's traffic grows — asphalt, bays and the P sign, then a second row
// and two lamps, then planters, a trolley shelter and a crossing to the market's door — and the cars of the people
// about who came by car, one crowd painted by instance colour, casting nothing (the car park lies outside the sun's
// box: each keeps its soft shadow), each with a collider. A car comes and goes only while its bay is out of the
// camera's view (a person whose car could not come walks from the lane's end, as everyone did before). Nothing here is
// saved: the stage is worked out from the farm, the cars from who is about.

/** A crowd of `n` of a decoration's model (the lamps', the planters'), put at `at` (in world metres). */
function decorCrowd(kind: 'lamp' | 'planter', at: readonly { x: number; z: number }[]): Parts<string> {
  const model: Structure<string> = decorModel(kind)
  const defs: Record<string, PartDef> = {}
  for (const k of Object.keys(model)) defs[k] = { geometry: partGeometry(model[k]), max: at.length, material: model[k].material, castShadow: false, receiveShadow: true }
  const parts = new Parts(defs, `park-${kind}`)
  parts.begin()
  for (const p of at) {
    parts.at(p.x, 0, p.z)
    for (const k of Object.keys(model)) parts.put(k, 0, 0, 0)
  }
  parts.end()
  return parts
}

/** Where a bay's car stands: its middle, its bonnet towards the far end of its row (the first row's north, the
 *  second's south: each driven in from the aisle between them). */
function carAt(bay: number) {
  const b = PARK_BAYS[bay]
  const mid = { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }
  const yaw = mid.z < 23 ? 0 : Math.PI
  return { ...mid, yaw }
}

/** The people about who came by car, in the order they came: the buyers in the line, and the shoppers (one car a
 *  visit for about half the visits: each shopper's share, the group's size shared out). */
function wantedNow(): number[] {
  const buyers = farm.visitors.filter((v) => byCar(v.id, BY_CAR.buyer)).map((v) => v.id)
  const share = BY_CAR.visit / shoppersAtOnce(farm.ladders.group)
  const shoppers = shoppersNow()
    .filter((s) => byCar(-s.id, share))
    .map((s) => s.id)
  return [...buyers, ...shoppers]
}

const FRUSTUM = new Frustum()
const VIEW = new Matrix4()
const BOX = new Box3()

export function Park() {
  const stage = useFarm(() => parkStage(farm))
  const root = useMemo(() => new Group(), [])
  const camera = useThree((s) => s.camera)
  // the car park as built at its stage
  useEffect(() => {
    const model = parkModel(stage)
    const has = piecesAt(stage)
    const made: Parts<string>[] = []
    if (Object.keys(model).length) made.push(structureParts(model, 'park'))
    if (has.has('lamps')) made.push(decorCrowd('lamp', PARK_LAMPS))
    if (has.has('planters')) made.push(decorCrowd('planter', PARK_PLANTERS))
    for (const p of made) root.add(p.group)
    return () => {
      for (const p of made) {
        root.remove(p.group)
        p.dispose()
      }
    }
  }, [stage, root])

  // the cars: who stands in which bay (a person's id → a bay), as it was last frame
  const cars = useMemo(() => carParts(MOST_CARS, false), [])
  useEffect(() => {
    root.add(cars.group)
    return () => {
      root.remove(cars.group)
      cars.dispose()
    }
  }, [cars, root])
  const held = useRef(new Map<number, number>())
  const [shown, setShown] = useState<readonly [number, number][]>([])
  const since = useRef(0)
  useEffect(() => {
    debugSet('park', { stage: () => parkStage(farm), cars: () => [...held.current.entries()] })
  }, [])
  useFrame((_, dt) => {
    since.current += dt
    if (since.current < 0.25) return
    since.current = 0
    const free = visitorBays(stage)
    let next: Map<number, number>
    if (parkFull()) {
      // filled for measuring (marketFill with shoppers): every bay the car park has, up to the most there ever are
      next = new Map(free.slice(0, MOST_CARS).map((bay, k) => [-1000 - k, bay]))
    } else {
      VIEW.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      FRUSTUM.setFromProjectionMatrix(VIEW)
      const inView = (bay: number) => {
        const b = PARK_BAYS[bay]
        return FRUSTUM.intersectsBox(BOX.set(new Vector3(b.x0, 0, b.z0), new Vector3(b.x1, 1.6, b.z1)))
      }
      next = parkCars(held.current, wantedNow(), free, inView)
    }
    const same = next.size === held.current.size && [...next].every(([id, bay]) => held.current.get(id) === bay)
    if (same) return
    held.current = next
    cars.begin()
    for (const [id, bay] of next) {
      const c = carAt(bay)
      putCar(cars, c.x, c.z, c.yaw, new Color(...paintTint(carColour(id))))
    }
    cars.end()
    setShown([...next])
  })

  return (
    <group name="car-park">
      <primitive object={root} />
      {shown.length > 0 && (
        <RigidBody type="fixed" colliders={false}>
          {shown.map(([id, bay]) => {
            const c = carAt(bay)
            const half = carHalf(c.yaw)
            return <CuboidCollider key={id} args={[half.x, 0.7, half.z]} position={[c.x, 0.7, c.z]} />
          })}
        </RigidBody>
      )}
    </group>
  )
}
