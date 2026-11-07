import { useEffect, useRef } from 'react'
import { insideHouse, roomAt } from '../data/layout'
import { busy, useHome, type Nearby } from '../store'
import { look, turnTowards } from './look'
import { playerState, type Point3 } from './playerState'

/** What an action does — drawn as a glyph on the action button. */
export type Verb = 'pick' | 'water' | 'plant' | 'shear' | 'sell' | 'build' | 'make' | 'shop' | 'switch' | 'door' | 'watch' | 'wait' | 'drop'

/** The action button's picture: a verb glyph, and (optionally) a small picture of the thing itself, by farm icon id. */
export interface ActionIcon {
  verb: Verb
  item?: string
}

export interface InteractableDef {
  id: string
  label: string | (() => string)
  /** 'wait' marks something that only tells you how long — never offered unless you look right at it */
  icon?: ActionIcon | (() => ActionIcon)
  position: Point3 // where you must stand near
  aim?: Point3 // what you look at in first person (defaults to `position`)
  radius: number
  enabled?: () => boolean
  run: () => void
}

const registry = new Map<string, InteractableDef>()

export function registerInteractable(def: InteractableDef) {
  registry.set(def.id, def)
  return () => {
    if (registry.get(def.id) === def) registry.delete(def.id)
  }
}

const labelOf = (def: InteractableDef) => (typeof def.label === 'function' ? def.label() : def.label)
const iconOf = (def: InteractableDef) => (typeof def.icon === 'function' ? def.icon() : def.icon)

/** Where the viewer's eyes are and which way they point (first person only). */
export interface ViewRay {
  origin: Point3
  dir: Point3
}

/** An interactable must be this close to the centre of the view (cos of the half-angle ≈ 37°). */
const AIM_COS = 0.8

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * Among the things within reach (not looked at), what you most likely came for: something ready to take first,
 * then what needs looking after, then the rest; spending coins (building, buying land) last.
 */
const RANK: Record<Verb, number> = { pick: 0, shear: 0, water: 1, sell: 1, make: 2, plant: 2, watch: 3, switch: 3, door: 3, shop: 3, drop: 3, build: 4, wait: 5 }

/** Indoors only what is in the same room is within reach (not the lamp behind the wall); outdoors only what is outdoors. */
function sameSpace(p: Point3, here: string) {
  const inside = insideHouse(p.x, p.z)
  if (here === 'out') return !inside
  if (!inside) return false
  const room = roomAt(p.x, p.z)
  return room === null || here === 'house' || room === here
}

interface Candidate {
  def: InteractableDef
  d: number
  icon: ActionIcon | undefined
}

function describe(c: Candidate, reach: boolean, view?: ViewRay): Nearby {
  const out: Nearby = { id: c.def.id, label: labelOf(c.def) }
  if (c.icon) out.icon = c.icon
  if (reach) out.reach = true
  if (view) {
    const a = c.def.aim ?? c.def.position
    const rel = wrap(Math.atan2(-(a.x - view.origin.x), -(a.z - view.origin.z)) - look.yaw)
    const r = Math.abs(rel)
    out.side = r < 0.6 ? 'ahead' : r > 2.35 ? 'back' : rel > 0 ? 'left' : 'right'
  }
  return out
}

/**
 * What to offer, best first. In first person the first is what you look at — within its radius and inside a
 * narrow cone around the view, the most centred first — and when you look at nothing, the nearest thing you
 * can do from where you stand (using it turns you towards it). The rest are other things within reach, for the
 * touch screen's smaller action buttons. Third person: the nearest first. `reach: false` (while carrying
 * something) keeps it to what you look at, so E with nothing in view still puts the thing down.
 */
export function findActions(from: Point3, view?: ViewRay, opts: { reach?: boolean; max?: number } = {}): Nearby[] {
  const max = opts.max ?? 3
  const reach = opts.reach ?? true
  const here = insideHouse(from.x, from.z) ? (roomAt(from.x, from.z) ?? 'house') : 'out'
  let aimed: Candidate | null = null
  let aimedScore = Infinity
  const near: Candidate[] = []
  for (const def of registry.values()) {
    if (def.enabled && !def.enabled()) continue
    const d = Math.hypot(def.position.x - from.x, def.position.y - from.y, def.position.z - from.z)
    if (d > def.radius) continue
    const icon = iconOf(def)
    let score = d
    let inCone = true
    if (view) {
      const a = def.aim ?? def.position
      const vx = a.x - view.origin.x
      const vy = a.y - view.origin.y
      const vz = a.z - view.origin.z
      const len = Math.hypot(vx, vy, vz) || 1e-6
      const cos = (vx * view.dir.x + vy * view.dir.y + vz * view.dir.z) / len
      inCone = cos >= AIM_COS
      score = (1 - cos) * 10 + d * 0.1
    }
    const c = { def, d, icon }
    if (inCone && score < aimedScore) {
      aimed = c
      aimedScore = score
    }
    if (icon?.verb !== 'wait' && sameSpace(def.position, here)) near.push(c)
  }
  const rank = (c: Candidate) => RANK[c.icon?.verb ?? 'pick'] * 10 + c.d
  near.sort((a, b) => rank(a) - rank(b))
  const out: Nearby[] = []
  if (aimed) out.push(describe(aimed, false, view))
  if (!reach) return out
  for (const c of near) {
    if (out.length >= max) break
    if (c.def === aimed?.def) continue
    out.push(describe(c, !!view, view))
  }
  return out
}

/** The single thing to offer (kept for callers that only need one). */
export function findNearest(from: Point3, view?: ViewRay): Nearby | null {
  return findActions(from, view, { max: 1 })[0] ?? null
}

export function dropPosition(): [number, number, number] {
  const p = playerState.position
  const f = playerState.facing
  return [p.x + f.x * 0.9, p.y + 0.2, p.z + f.z * 0.9]
}

/** Where the eye should rest on an interactable (its aim point), or null if it is not registered. */
export function aimPointOf(id: string): Point3 | null {
  const def = registry.get(id)
  return def ? (def.aim ?? def.position) : null
}

/**
 * Runs an offered action — the first one, or the one with `id` (a touch screen's smaller buttons). Something
 * offered because it is within reach turns the view towards it as it runs. With nothing to run, E puts down
 * what you carry.
 */
export function triggerInteraction(id?: string) {
  const state = useHome.getState()
  const { nearby, actions, carrying, drop } = state
  if (busy(state)) return
  // the offer is refreshed a few times a second: it can still name something that just went away
  // (the item you picked up) or was switched off — then E falls through to dropping what you carry
  const offer = id === undefined ? nearby : actions.find((a) => a.id === id)
  const def = offer ? registry.get(offer.id) : undefined
  if (offer && def && (!def.enabled || def.enabled())) {
    if (offer.reach && state.view === 'first') turnTowards(playerState.eye, def.aim ?? def.position)
    def.run()
    return
  }
  if (id === undefined && carrying) drop(dropPosition())
}

/** Registers an interactable for the lifetime of the component; `run`/`label`/`icon` may close over fresh state. */
export function useInteractable(
  def: Omit<InteractableDef, 'position' | 'aim'> & { position: [number, number, number]; aim?: [number, number, number] },
) {
  const latest = useRef(def)
  latest.current = def
  const [x, y, z] = def.position
  const ax = def.aim?.[0]
  const ay = def.aim?.[1]
  const az = def.aim?.[2]
  const hasIcon = def.icon !== undefined
  useEffect(() => {
    const entry: InteractableDef = {
      id: def.id,
      position: { x, y, z },
      aim: ax === undefined || ay === undefined || az === undefined ? undefined : { x: ax, y: ay, z: az },
      radius: def.radius,
      label: () => {
        const l = latest.current.label
        return typeof l === 'function' ? l() : l
      },
      icon: hasIcon
        ? () => {
            const i = latest.current.icon!
            return typeof i === 'function' ? i() : i
          }
        : undefined,
      enabled: () => latest.current.enabled?.() ?? true,
      run: () => latest.current.run(),
    }
    return registerInteractable(entry)
  }, [def.id, def.radius, x, y, z, ax, ay, az, hasIcon])
}
