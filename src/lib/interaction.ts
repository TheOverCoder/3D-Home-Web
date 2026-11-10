import { useEffect, useRef } from 'react'
import { insideHouse, roomAt } from '../data/layout'
import { useSettings } from '../settings'
import { busy, useHome, type Nearby } from '../store'
import type { ArtId } from '../ui/art'
import { canVibrate, coarsePointer } from './device'
import { look, turnTowards } from './look'
import { playerState, type Point3 } from './playerState'

/** What an action does — drawn as a glyph on the action button. */
export type Verb = 'pick' | 'water' | 'plant' | 'shear' | 'sell' | 'build' | 'make' | 'shop' | 'switch' | 'door' | 'watch' | 'wait' | 'drop'

/** The action button's picture: a verb glyph, and (optionally) a small picture of the thing itself, by farm icon id.
 *  Its numbers are what the prompt shows instead of a sentence (src/ui/Hud.tsx): the good and how many (the bottle
 *  of milk ×3), a coin chip where coins change hands, and for a status how long. */
export interface ActionIcon {
  verb: Verb
  item?: string
  /** the one word under the button, when the label's first word is not it ("Other seeds" → Seeds) */
  word?: string
  /** how many of `item` one press takes, makes or sells (all that is ripe in reach together); to water or plant, how
   *  many beds; for a status, how many are on their way */
  count?: number
  /** what else the same press takes, when it is more than one good (ripe beds of different crops) */
  also?: { item: string; count: number }[]
  /** the coins that change hands with one press: what it costs (seeds, a bed, a field) or what the buyer offers */
  coins?: number
  /** an action about no good: its picture from the interface's art (the hammer, to build) */
  art?: ArtId
  /** a status: whole seconds until it is ready (so it changes once a second, as the label does) */
  seconds?: number
  /** a status at a machine with nothing to work on: what it makes from what (the mill: flour from wheat, sugar from
   *  sugar cane) */
  makes?: { from: string; to: string }[]
}

export interface InteractableDef {
  id: string
  label: string | (() => string)
  /** 'wait' marks something that only tells you how long: never an action (it is shown as a status instead);
   *  'build' spends coins: offered after anything else in reach, and its run only asks (a confirmation panel) */
  icon?: ActionIcon | (() => ActionIcon)
  /** a keyboard shortcut that goes with it, shown beside the label on a computer ("1–9 other seeds") */
  hint?: () => string | undefined
  position: Point3 // where you must stand near
  aim?: Point3 // what you look at in first person (defaults to `position`)
  radius: number
  enabled?: () => boolean
  /** what is ready to take here, for the compass at the top of the screen (a ripe bed, a nest with no room for
   *  another egg, a cow full of milk, a batch out of the oven): null while there is nothing, or less than the most
   *  it holds — a nest with room for more eggs is not worth the walk yet */
  ready?: () => { item: string; count: number } | null
  /** for a status: what is still missing, shown as pictures with how many (the oven's ingredients for a cake) */
  needs?: () => { item: string; count: number }[] | null
  /** what can be set about it (a bed: what it always grows): looked at, a gear on it opens them (src/ui/Gear.tsx),
   *  `at` being where the gear sits; null when there is nothing to set right now */
  settings?: () => Settings | null
  run: () => void
}

/** What can be set about a thing: the gear's words (for screen readers and the key hint), where it sits, what it opens. */
export interface Settings {
  label: string
  at: Point3
  open: () => void
}

const registry = new Map<string, InteractableDef>()

export function registerInteractable(def: InteractableDef) {
  registry.set(def.id, def)
  return () => {
    if (registry.get(def.id) === def) registry.delete(def.id)
  }
}

const labelOf = (def: InteractableDef) => (typeof def.label === 'function' ? def.label() : def.label)

/** What can be set about a thing (its gear), or null. */
export const settingsOf = (id: string): Settings | null => registry.get(id)?.settings?.() ?? null
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

/** Only tells you how long: shown, never pressed. */
const isInfo = (c: Candidate) => c.icon?.verb === 'wait'
/** Spends coins: never ahead of something you can do here. */
const isSpend = (c: Candidate) => c.icon?.verb === 'build'

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
  const hint = c.def.hint?.()
  if (hint) out.hint = hint
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
 *
 * Never on offer: what only tells you how long (a growing bed, a working mill — see findStatus). Never first
 * while there is anything else to do here: spending coins (a bed to build, a field to buy), so the button you
 * press to water is never the one that buys.
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
    if (isInfo(c)) continue
    if (inCone && score < aimedScore) {
      aimed = c
      aimedScore = score
    }
    if (sameSpace(def.position, here)) near.push(c)
  }
  const rank = (c: Candidate) => RANK[c.icon?.verb ?? 'pick'] * 10 + c.d
  near.sort((a, b) => rank(a) - rank(b))
  // a thing to buy in view gives way to something to do within reach
  if (aimed && isSpend(aimed) && reach && near.some((c) => !isSpend(c))) aimed = null
  const out: Nearby[] = []
  // one press can do several things at once (every ripe bed within reach): they all offer the same, once is enough
  const seen = new Set<string>()
  const key = (n: Nearby) => `${n.label}|${n.icon?.verb}|${n.icon?.item}`
  if (aimed) {
    const first = describe(aimed, false, view)
    out.push(first)
    seen.add(key(first))
  }
  if (!reach) return out
  for (const c of near) {
    if (out.length >= max) break
    if (c.def === aimed?.def) continue
    const n = describe(c, !!view, view)
    if (seen.has(key(n))) continue
    seen.add(key(n))
    out.push(n)
  }
  return out
}

/**
 * When there is nothing to do here, what is on its way: the thing you look at that only tells you how long (a
 * growing bed, the oven baking), or else the nearest such thing within reach — shown as a status, not a button.
 */
export function findStatus(from: Point3, view?: ViewRay): Nearby | null {
  const here = insideHouse(from.x, from.z) ? (roomAt(from.x, from.z) ?? 'house') : 'out'
  let best: { def: InteractableDef; score: number } | null = null
  for (const def of registry.values()) {
    if (def.enabled && !def.enabled()) continue
    const d = Math.hypot(def.position.x - from.x, def.position.y - from.y, def.position.z - from.z)
    if (d > def.radius || !sameSpace(def.position, here) || iconOf(def)?.verb !== 'wait') continue
    let score = d
    if (view) {
      const a = def.aim ?? def.position
      const vx = a.x - view.origin.x
      const vy = a.y - view.origin.y
      const vz = a.z - view.origin.z
      const cos = (vx * view.dir.x + vy * view.dir.y + vz * view.dir.z) / (Math.hypot(vx, vy, vz) || 1e-6)
      if (cos >= AIM_COS) score -= 100 // looked at: that one
    }
    if (!best || score < best.score) best = { def, score }
  }
  if (!best) return null
  const out: Nearby = { id: best.def.id, label: labelOf(best.def), icon: iconOf(best.def) }
  const needs = best.def.needs?.()
  if (needs?.length) out.needs = needs
  return out
}

/** A job for the compass: something ready to take somewhere you cannot reach from here. Several of a kind (three
 *  ripe lettuce beds, two cows full of milk) are one mark, counted together, pointing at the nearest. */
export interface FarMark {
  /** the nearest one's interactable (where the mark points, and what it marks when tapped) */
  id: string
  item: string
  count: number
  d: number
}

/**
 * What is ready to take on the farm and out of reach, nearest first. What is within reach is the action button's
 * (it is left off the compass until you walk away from it again, still not taken).
 */
export function findFar(from: Point3): FarMark[] {
  const here = insideHouse(from.x, from.z) ? (roomAt(from.x, from.z) ?? 'house') : 'out'
  const byItem = new Map<string, FarMark>()
  for (const def of registry.values()) {
    if (!def.ready || (def.enabled && !def.enabled())) continue
    const r = def.ready()
    if (!r || r.count <= 0) continue
    const d = Math.hypot(def.position.x - from.x, def.position.y - from.y, def.position.z - from.z)
    if (d <= def.radius && sameSpace(def.position, here)) continue
    const m = byItem.get(r.item)
    if (!m) byItem.set(r.item, { id: def.id, item: r.item, count: r.count, d })
    else {
      m.count += r.count
      if (d < m.d) Object.assign(m, { id: def.id, d })
    }
  }
  return [...byItem.values()].sort((a, b) => a.d - b.d)
}

/** Does it give the phone's short buzz: something taken, watered, shorn, sold or planted. */
const isJob = (icon: ActionIcon | undefined) => !!icon && (icon.verb === 'pick' || icon.verb === 'shear' || icon.verb === 'water' || icon.verb === 'sell' || icon.verb === 'plant')

/** A short buzz as something is done, where the phone can and the player has not turned it off. */
function buzz() {
  if (coarsePointer && canVibrate && useSettings.getState().vibration) navigator.vibrate(12)
}

/** A mark tapped on the compass: turns you to face it and marks it in the world until you get there. */
export function guideTo(id: string) {
  const target = registry.get(id)
  if (!target) return
  turnTowards({ x: playerState.position.x, y: playerState.eye.y, z: playerState.position.z }, target.aim ?? target.position)
  useHome.getState().setGuide(target.id)
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
 * what you carry. While a confirm card is open, any press only closes it.
 */
export function triggerInteraction(id?: string) {
  const state = useHome.getState()
  const { nearby, actions, carrying, drop } = state
  if (busy(state)) return
  // the offer is refreshed a few times a second: it can still name something that just went away
  // (the item you picked up) or was switched off — then E falls through to dropping what you carry
  // a confirm card is open (a machine about to take its ingredients): the button again only closes it, so a
  // second tap by mistake never uses them up
  if (state.confirm) {
    state.setConfirm(null)
    return
  }
  const offer = id === undefined ? nearby : actions.find((a) => a.id === id)
  const def = offer ? registry.get(offer.id) : undefined
  if (offer && def && (!def.enabled || def.enabled())) {
    // turn from where the body stands (the same place the offer was worked out from), at eye height
    if (offer.reach && state.view === 'first') turnTowards({ x: playerState.position.x, y: playerState.eye.y, z: playerState.position.z }, def.aim ?? def.position)
    const job = isJob(iconOf(def)) // (asked before it runs: after watering, the bed only says how long)
    def.run()
    if (job) buzz()
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
  const hasReady = def.ready !== undefined
  const hasSettings = def.settings !== undefined
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
      hint: () => latest.current.hint?.(),
      ready: hasReady ? () => latest.current.ready?.() ?? null : undefined,
      needs: () => latest.current.needs?.() ?? null,
      settings: hasSettings ? () => latest.current.settings?.() ?? null : undefined,
      run: () => latest.current.run(),
    }
    return registerInteractable(entry)
  }, [def.id, def.radius, x, y, z, ax, ay, az, hasIcon, hasReady, hasSettings])
}
