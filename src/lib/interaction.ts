import { useEffect, useRef } from 'react'
import { insideHouse, roomAt } from '../data/layout'
import { isWalkInSpace, spaceAt } from '../data/buildings'
import { useSettings } from '../settings'
import { busy, useHome, type Nearby } from '../store'
import type { ArtId } from '../ui/art'
import { canVibrate, coarsePointer } from './device'
import { look, turnTowards } from './look'
import { playerState, type Point3 } from './playerState'
import { stopWalk } from './route/walking'
import { useStick } from './stick'

/** What an action does — drawn as a glyph on the action button. (Nothing that spends coins is one: building and buying
 *  are a price tag on the thing itself, see `Tag`.) */
export type Verb = 'pick' | 'water' | 'plant' | 'shear' | 'sell' | 'make' | 'shop' | 'switch' | 'door' | 'watch' | 'wait' | 'drop'

/** The action button's picture: a verb glyph, and (optionally) a small picture of the thing itself, by farm icon id.
 *  Its numbers are what the prompt shows instead of a sentence (src/ui/Hud.tsx): the good and how many (the bottle
 *  of milk ×3), a coin chip where coins change hands, and for a status how long. */
export interface ActionIcon {
  verb: Verb
  item?: string
  /** the one word under the button, when the label's first word is not it ("Other seeds" → Seeds) */
  word?: string
  /** how many of `item` one press takes, makes or sells (all that is ripe in reach together); to water or plant, how
   *  many beds; for a status, how many are on their way; at the gate, how many in the line you can serve */
  count?: number
  /** out of how many, shown after `count` (the gate: 4 of the 7 waiting can be served — 4/7) */
  of?: number
  /** what else the same press takes, when it is more than one good (ripe beds of different crops) */
  also?: { item: string; count: number }[]
  /** the coins that change hands with one press: what it costs (a bed's seeds) or what the buyer offers */
  coins?: number
  /** an action about no good: its picture from the interface's art (the line at the gate) */
  art?: ArtId
  /** a status: whole seconds until it is ready (so it changes once a second, as the label does) */
  seconds?: number
  /** a status at a machine with nothing to work on: what it makes from what (the mill: flour from wheat, sugar from
   *  sugar cane) */
  makes?: { from: string; to: string }[]
  /** a status: what is ready here cannot be taken, its building is full (the silo or the barn: its picture, how full) */
  full?: 'silo' | 'barn'
}

export interface InteractableDef {
  id: string
  label: string | (() => string)
  /** 'wait' marks something that only tells you how long: never an action (it is shown as a status instead) */
  icon?: ActionIcon | (() => ActionIcon)
  /** a keyboard shortcut that goes with it, shown beside the label on a computer ("1–9 other seeds") */
  hint?: () => string | undefined
  position: Point3 // where you must stand near (for a thing with a `box`, its middle)
  aim?: Point3 // what you look at in first person (defaults to `position`)
  /** its footprint on the ground, half its size each way round `position` (a bed's frame): reach is measured from
   *  its edge, so a long thing is as near from its end as from its side */
  box?: { x: number; z: number }
  /** how far you can be from it and still use it, on the ground: from the edge of its `box`, or from `position` */
  radius: number
  /** whether it offers anything now (an action, or a status); its tag is shown whatever this says (a plot to build
   *  offers nothing, only its price tag) */
  enabled?: () => boolean
  /** what is ready to take here, for the compass at the top of the screen (a ripe bed, a nest with no room for
   *  another egg, a cow full of milk, a batch out of the oven): null while there is nothing, or less than the most
   *  it holds — a nest with room for more eggs is not worth the walk yet. `alert`: not something to take but a
   *  building that needs you (the barn full while goods wait for room) */
  ready?: () => { item: string; count: number; alert?: boolean } | null
  /** for a status: what is still missing, shown as pictures with how many (the oven's ingredients for a cake, what
   *  the line at the gate wants) */
  needs?: () => { item: string; count: number }[] | null
  /** what it carries on it, apart from the action button, while you look at it (src/ui/ThingTag.tsx): a gear for what
   *  can be set about it, a price tag for what it costs to build or buy; null when there is none right now */
  tag?: () => Tag | null
  /** what one press does, as a key shared by every thing whose press does the same (two ripe beds in reach harvest
   *  both, whichever is pressed): only one of them is offered */
  same?: () => string | undefined
  run: () => void
}

/**
 * Something on the thing you look at that opens a card, never the action button's job: a gear for what can be set
 * about it (a bed: what it always grows), or a price tag — a coin and the price — for what it costs to build or buy
 * (a staked-out bed, a field); the card asks before anything is spent. Tapped, or G on a keyboard.
 */
export interface Tag {
  kind: 'gear' | 'price'
  /** its words, for screen readers and the key hint ("Build a bed · 30 coins") */
  label: string
  /** where it sits */
  at: Point3
  /** a price tag's coins */
  price?: number
  open: () => void
}

const registry = new Map<string, InteractableDef>()

export function registerInteractable(def: InteractableDef) {
  registry.set(def.id, def)
  return () => {
    if (registry.get(def.id) === def) registry.delete(def.id)
  }
}

/** The interactable registered under `id`, if there is one now. */
export const interactable = (id: string): InteractableDef | undefined => registry.get(id)

const labelOf = (def: InteractableDef) => (typeof def.label === 'function' ? def.label() : def.label)

/** What a thing carries on it (its gear or its price tag), or null. */
export const tagOf = (id: string): Tag | null => registry.get(id)?.tag?.() ?? null
const iconOf = (def: InteractableDef) => (typeof def.icon === 'function' ? def.icon() : def.icon)

/**
 * How far (x, z) is from a thing, on the ground: to the nearest point of its footprint (`box`, round `at`), or to `at`
 * itself. Reach is measured this way everywhere — what the button offers, what one press does along with it (the
 * beds round you), what leaves the compass — so "in reach" means one thing.
 */
export function groundDistance(x: number, z: number, at: { x: number; z: number }, box?: { x: number; z: number }) {
  return Math.hypot(Math.max(0, Math.abs(x - at.x) - (box?.x ?? 0)), Math.max(0, Math.abs(z - at.z) - (box?.z ?? 0)))
}
const reachOf = (def: InteractableDef, from: Point3) => groundDistance(from.x, from.z, def.position, def.box)

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
 * then what needs looking after, then the rest.
 */
const RANK: Record<Verb, number> = { pick: 0, shear: 0, water: 1, sell: 1, make: 2, plant: 2, watch: 3, switch: 3, door: 3, shop: 3, drop: 3, wait: 5 }

/** Only tells you how long: shown, never pressed. */
const isInfo = (c: Candidate) => c.icon?.verb === 'wait'

/** How squarely the view looks at a thing's aim point: the cosine of the angle between them (1: dead ahead). */
function aimCos(def: InteractableDef, view: ViewRay) {
  const a = def.aim ?? def.position
  const vx = a.x - view.origin.x
  const vy = a.y - view.origin.y
  const vz = a.z - view.origin.z
  return (vx * view.dir.x + vy * view.dir.y + vz * view.dir.z) / (Math.hypot(vx, vy, vz) || 1e-6)
}

/** Indoors only what is in the same room is within reach (not the lamp behind the wall); outdoors only what is outdoors. */
function sameSpace(p: Point3, here: string) {
  // a walk-in building's room (src/data/buildings.ts) is its own space: nothing in it is in reach from outside, nor
  // anything outside from in it, however near through the wall
  const there = spaceAt(p.x, p.z)
  if (isWalkInSpace(here) || isWalkInSpace(there)) return there === here
  const inside = insideHouse(p.x, p.z)
  if (here === 'out') return !inside
  if (!inside) return false
  const room = roomAt(p.x, p.z)
  return room === null || here === 'house' || room === here
}

/** The thing you look at, and a tag, are taken across rooms of the house (a door is in reach from either side), but
 *  never into or out of a walk-in building's room. */
function seenFrom(p: Point3, here: string) {
  const there = spaceAt(p.x, p.z)
  return isWalkInSpace(here) || isWalkInSpace(there) ? there === here : true
}

/** Whether a thing is within reach of `from` as the action button measures it (on the ground, from its footprint's
 *  edge, and in the same room or both outdoors), with `margin` metres to spare. */
export function inReach(def: InteractableDef, from: { x: number; z: number }, margin = 0) {
  if (reachOf(def, { x: from.x, y: 0, z: from.z }) > def.radius - margin) return false
  const here = spaceAt(from.x, from.z)
  return sameSpace(def.position, here)
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
 * Never on offer: what only tells you how long (a growing bed, a working mill — see findStatus), and nothing that
 * spends coins (a bed to build, a field to buy: its price tag, see findTag), so the button you press to water is
 * never the one that buys. Reach is measured on the ground, from the edge of a thing's footprint (groundDistance).
 */
export function findActions(from: Point3, view?: ViewRay, opts: { reach?: boolean; max?: number } = {}): Nearby[] {
  const max = opts.max ?? 3
  const reach = opts.reach ?? true
  const here = spaceAt(from.x, from.z)
  let aimed: Candidate | null = null
  let aimedScore = Infinity
  const near: Candidate[] = []
  for (const def of registry.values()) {
    if (def.enabled && !def.enabled()) continue
    const d = reachOf(def, from)
    if (d > def.radius) continue
    const icon = iconOf(def)
    let score = d
    let inCone = true
    if (view) {
      const cos = aimCos(def, view)
      inCone = cos >= AIM_COS
      score = (1 - cos) * 10 + d * 0.1
    }
    const c = { def, d, icon }
    if (isInfo(c)) continue
    if (inCone && score < aimedScore && seenFrom(def.position, here)) {
      aimed = c
      aimedScore = score
    }
    if (sameSpace(def.position, here)) near.push(c)
  }
  const rank = (c: Candidate) => RANK[c.icon?.verb ?? 'pick'] * 10 + c.d
  near.sort((a, b) => rank(a) - rank(b))
  const out: Nearby[] = []
  // one press can do several things at once (every ripe bed within reach): they all offer the same, once is enough —
  // told by what the press does where the thing says (the beds it takes), else by its words and its picture
  const seen = new Set<string>()
  const key = (c: Candidate, n: Nearby) => c.def.same?.() ?? `${n.label}|${n.icon?.verb}|${n.icon?.item}`
  if (aimed) {
    const first = describe(aimed, false, view)
    out.push(first)
    seen.add(key(aimed, first))
  }
  if (!reach) return out
  for (const c of near) {
    if (out.length >= max) break
    if (c.def === aimed?.def) continue
    const n = describe(c, !!view, view)
    if (seen.has(key(c, n))) continue
    seen.add(key(c, n))
    out.push(n)
  }
  return out
}

/**
 * When there is nothing to do here, what is on its way: the thing you look at that only tells you how long (a
 * growing bed, the oven baking), or else the nearest such thing within reach — shown as a status, not a button.
 */
export function findStatus(from: Point3, view?: ViewRay): Nearby | null {
  const here = spaceAt(from.x, from.z)
  let best: { def: InteractableDef; score: number } | null = null
  for (const def of registry.values()) {
    if (def.enabled && !def.enabled()) continue
    const d = reachOf(def, from)
    if (d > def.radius || !sameSpace(def.position, here) || iconOf(def)?.verb !== 'wait') continue
    let score = d
    if (view && aimCos(def, view) >= AIM_COS) score -= 100 // looked at: that one
    if (!best || score < best.score) best = { def, score }
  }
  if (!best) return null
  const out: Nearby = { id: best.def.id, label: labelOf(best.def), icon: iconOf(best.def) }
  const needs = best.def.needs?.()
  if (needs?.length) out.needs = needs
  return out
}

/**
 * The tag on the thing you look at — its gear, or its price tag — or null when that thing carries none. The thing
 * you look at is found as the action button finds it: within its reach and inside the narrow cone round the view,
 * the most centred (third person: the nearest within reach). Something that offers nothing right now still counts
 * when it carries a tag (a plot to build has no action, only its price tag).
 */
export function findTag(from: Point3, view?: ViewRay): { id: string; tag: Tag } | null {
  let best: InteractableDef | null = null
  let bestScore = Infinity
  const here = spaceAt(from.x, from.z)
  for (const def of registry.values()) {
    if (!def.tag && def.enabled && !def.enabled()) continue
    if (!seenFrom(def.position, here)) continue
    const d = reachOf(def, from)
    if (d > def.radius) continue
    let score = d
    if (view) {
      const cos = aimCos(def, view)
      if (cos < AIM_COS) continue
      score = (1 - cos) * 10 + d * 0.1
    }
    if (score < bestScore) {
      best = def
      bestScore = score
    }
  }
  const tag = best?.tag?.()
  return best && tag ? { id: best.id, tag } : null
}

/** A job for the compass: something ready to take somewhere you cannot reach from here. Several of a kind (three
 *  ripe lettuce beds, two cows full of milk) are one mark, counted together, pointing at the nearest. */
export interface FarMark {
  /** the nearest one's interactable (where the mark points, and what it marks when tapped) */
  id: string
  item: string
  count: number
  d: number
  /** a building that needs you (full, with goods waiting), not something to take */
  alert?: boolean
}

/**
 * What is ready to take on the farm and out of reach, nearest first. What is within reach is the action button's
 * (it is left off the compass until you walk away from it again, still not taken).
 */
export function findFar(from: Point3): FarMark[] {
  const here = spaceAt(from.x, from.z)
  const byItem = new Map<string, FarMark>()
  for (const def of registry.values()) {
    if (!def.ready || (def.enabled && !def.enabled())) continue
    const r = def.ready()
    if (!r || r.count <= 0) continue
    const d = reachOf(def, from)
    if (d <= def.radius && sameSpace(def.position, here)) continue
    const m = byItem.get(r.item)
    if (!m) byItem.set(r.item, { id: def.id, item: r.item, count: r.count, d, ...(r.alert ? { alert: true } : {}) })
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

/** Turns you to face a thing and marks it in the world until you get there: a compass mark tapped when there is no way
 *  to walk to it (src/lib/route/walker.ts), or you are already there. */
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
    // you came for it: walking on by itself stops here, as does walking to a mark
    useStick.getState().setCruise(false)
    stopWalk('used')
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
export function useInteractable(def: Omit<InteractableDef, 'position' | 'aim'> & { position: [number, number, number]; aim?: [number, number, number] }) {
  const latest = useRef(def)
  latest.current = def
  const [x, y, z] = def.position
  const ax = def.aim?.[0]
  const ay = def.aim?.[1]
  const az = def.aim?.[2]
  const bx = def.box?.x
  const bz = def.box?.z
  const hasIcon = def.icon !== undefined
  const hasReady = def.ready !== undefined
  const hasTag = def.tag !== undefined
  useEffect(() => {
    const entry: InteractableDef = {
      id: def.id,
      position: { x, y, z },
      aim: ax === undefined || ay === undefined || az === undefined ? undefined : { x: ax, y: ay, z: az },
      box: bx === undefined || bz === undefined ? undefined : { x: bx, z: bz },
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
      tag: hasTag ? () => latest.current.tag?.() ?? null : undefined,
      same: () => latest.current.same?.(),
      run: () => latest.current.run(),
    }
    return registerInteractable(entry)
  }, [def.id, def.radius, x, y, z, ax, ay, az, bx, bz, hasIcon, hasReady, hasTag])
}
