import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { farmSound, placeSound, type FarmSound } from '../audio/sound'
import { debugSet } from '../lib/debug'
import { registerInteractable } from '../lib/interaction'
import { playerState, type Point3 } from '../lib/playerState'
import type { Parts } from '../lib/sculpt'
import { PRODUCERS, mostAnimals, type ProducerId } from './data'
import { shownPlacement } from './edit'
import { rectToWorld, samePlacement, type Placement } from './layout'
import { farm, useFarm } from './state'
import { producerOffer } from './useProducer'
import { agentAt, carryAlong, follow, penAt, rest, wander, type Agent, type Mode, type Wander } from './wander'

// A herd of animals that each give their own (the cows' milk, the sheep's fleeces): as many as the farm has, each
// wandering the pen (src/farm/wander.ts), drawn with one instanced draw per part for the whole herd, riding a
// kinematic body so you bump into her instead of walking through, and carrying her own offer on the action button,
// which follows her round (milk her, shear her). Now and then one of them calls (a moo, a bleat), if you are near
// enough to hear it. Cows.tsx and Sheep.tsx give what is their own: how they wander, their bodies, their pose.

/** An animal of a herd: where you stand near to use her, and what you look at (her middle). */
export interface HerdAgent extends Agent {
  pos: Point3
  aim: Point3
}

/** A new animal of producer `id`'s herd, standing at (x, z). */
export function herdAgent(id: ProducerId, x: number, z: number, heading: number, mode: Mode, timer: number): HerdAgent {
  const { stand, aim } = PRODUCERS[id]
  return { ...agentAt(x, z, heading, mode, timer), pos: { x, y: stand[1], z }, aim: { x, y: aim[1], z } }
}

export interface HerdKind<A extends HerdAgent> {
  /** the producer they are (their number, their offers) */
  id: ProducerId
  /** the scene group's name, and the debug hook's (window.__home) */
  name: string
  debug: string
  wander: Wander
  /** the instanced parts for a herd of up to `max` */
  parts: (max: number) => Parts
  /** the i-th animal, new, where her pen stands */
  spawn: (i: number, pen: Placement) => A
  /** her body: half its size each way, and how high its middle is */
  body: { half: [number, number, number]; y: number }
  /** how long she stands still after she is milked or shorn */
  pause: number
  /** the odd call from one of them: the first after `first` seconds, then every `every` and up to `more` seconds more,
   *  heard within `range` */
  call: { sound: FarmSound; first: number; every: number; more: number; range: number }
  /** her pose this frame, once she has wandered (and whatever else moves on her: a tail, a fleece) */
  pose: (parts: Parts, a: A, i: number, t: number, dt: number) => void
}

export function Herd<A extends HerdAgent>({ kind, agents }: { kind: HerdKind<A>; agents: A[] }) {
  const place = PRODUCERS[kind.id].place
  const count = useFarm(() => farm.producers[kind.id].animals)
  // every coat or face can be worn by every one of them (a herd is small): one draw per part
  const parts = useMemo(() => kind.parts(mostAnimals(kind.id)), [kind])
  useEffect(() => () => parts.dispose(), [parts])
  const bodies = useRef<(RapierRigidBody | null)[]>([])
  const call = useRef(kind.call.first)
  const frame = useRef<Placement>(shownPlacement(place))
  debugSet(kind.debug, agents)

  // one offer per animal on the action button, standing where she stands
  useEffect(() => {
    while (agents.length < count) agents.push(kind.spawn(agents.length, frame.current))
    agents.length = count
    const offs = agents.map((a, i) => registerInteractable(producerOffer(kind.id, i, { stand: a.pos, aim: a.aim }, () => rest(a, kind.pause))))
    return () => offs.forEach((off) => off())
  }, [count, agents, kind])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = state.clock.elapsedTime
    const at = shownPlacement(place)
    // the pen was moved: the herd comes along, each where she was in it
    if (!samePlacement(at, frame.current)) carryAlong(agents, frame.current, at)
    frame.current = at
    const pen = penAt(kind.wander, at)
    parts.begin()
    agents.forEach((a, i) => {
      wander(a, i, agents, kind.wander, pen, dt)
      a.pos.x = a.aim.x = a.x
      a.pos.z = a.aim.z = a.z
      kind.pose(parts, a, i, t, dt)
      const body = bodies.current[i]
      if (body) follow(body, a, kind.body.y)
    })
    parts.end()

    // the odd call, if you are near enough to hear it
    call.current -= dt
    if (call.current <= 0 && agents.length) {
      call.current = kind.call.every + Math.random() * kind.call.more
      const a = agents[Math.floor(Math.random() * agents.length)]
      const p = playerState.position
      if (Math.hypot(p.x - a.x, p.z - a.z) < kind.call.range) {
        const { pan, near } = placeSound(a.x, a.z)
        farmSound(kind.call.sound, pan, near)
      }
    }
  })

  const start = rectToWorld(frame.current, kind.wander.area)
  return (
    <group name={kind.name}>
      <primitive object={parts.group} />
      {Array.from({ length: count }, (_, i) => (
        <RigidBody
          key={i}
          ref={(b) => {
            bodies.current[i] = b
          }}
          type="kinematicPosition"
          colliders={false}
          position={[agents[i]?.x ?? (start.minX + start.maxX) / 2, kind.body.y, agents[i]?.z ?? (start.minZ + start.maxZ) / 2]}
        >
          <CuboidCollider args={kind.body.half} />
        </RigidBody>
      ))}
    </group>
  )
}
