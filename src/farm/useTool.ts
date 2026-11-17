import { useEffect } from 'react'
import { registerInteractable, type ActionIcon, type InteractableDef } from '../lib/interaction'
import type { Point3 } from '../lib/playerState'
import { useHome } from '../store'
import { PRODUCERS, STORES, TOOLS, count, isToolKind, storeOf, type ProducerId, type ToolKind } from './data'
import { usePlacement } from './edit'
import { toWorld } from './layout'
import { clockText, farm, maxOf, roomFor, toolOwned, useFarm } from './state'

// An animal's tool on the action button (plans/animal-tools.md §2): once the coop, the milk bucket or the shears is
// yours, its place by the fence takes the herd's own offers' place (Herd.tsx and the nest box register theirs only
// before it), under the producer's own id (farm-nest, farm-cow, farm-sheep: the compass, the walk-to and the first
// steps need nothing). With something waiting and room for it, E opens the tool's panel (the machine's way: nothing is
// taken on the button itself); with no room, a status that the barn is full; with nothing waiting, a status with the
// time to the next. A gear on it opens the panel whenever you look at it. On the compass once an animal is full.

/** In all, what waits at a tool's places; the soonest next one, in whole seconds (0: one is full). */
const waitingAt = (kind: ToolKind) => farm.producers[kind].stock.reduce((a, b) => a + b, 0)
function soonest(kind: ToolKind) {
  const p = farm.producers[kind]
  const most = maxOf(kind)
  let best = Infinity
  p.stock.forEach((n, i) => {
    if (n < most) best = Math.min(best, PRODUCERS[kind].every - (p.timer[i] ?? 0))
  })
  return Number.isFinite(best) ? Math.max(1, Math.ceil(best)) : 0
}

function toolOffer(kind: ToolKind, at: { stand: Point3; aim: Point3 }): InteractableDef {
  const def = PRODUCERS[kind]
  const t = TOOLS[kind]
  const store = STORES[storeOf(def.good)]
  const fits = () => Math.min(waitingAt(kind), roomFor(def.good))
  const open = () => useHome.getState().openPanel({ kind: 'tool', tool: kind })
  return {
    id: def.action,
    position: at.stand,
    aim: at.aim,
    radius: t.reach,
    // it always says something: what to take, that the barn is full, or when the next comes
    enabled: () => true,
    ready: () => (farm.producers[kind].stock.some((n) => n >= maxOf(kind)) && fits() > 0 ? { item: def.good, count: fits() } : null),
    label: () => {
      const n = waitingAt(kind)
      if (!n) return `${t.name} · next ${def.good} in ${clockText(soonest(kind))}`
      if (!fits()) return `${store.name} full · ${count(def.good, n)} waiting`
      return `${t.word} · ${count(def.good, fits())}`
    },
    icon: (): ActionIcon => {
      const n = waitingAt(kind)
      if (!n) return { verb: 'wait', item: def.good, seconds: soonest(kind) }
      if (!fits()) return { verb: 'wait', item: def.good, count: n, full: store.id }
      return { verb: def.verb, item: def.good, count: fits(), word: t.word }
    },
    run: () => {
      if (fits() > 0) open()
    },
    // its places and upgrades, whenever you look at it
    tag: () => ({ kind: 'gear', label: `${t.name}: its places and upgrades`, at: { ...at.aim, y: at.aim.y + 0.5 }, open }),
  }
}

/** Puts a producer's tool on the action button where its pen stands, once it is yours (nothing for a producer with no
 *  tool, or before it is bought). */
export function useTool(id: ProducerId) {
  const kind = isToolKind(id) ? id : null
  const owned = useFarm(() => kind !== null && toolOwned(kind) !== null)
  const pen = usePlacement(PRODUCERS[id].place!)
  useEffect(() => {
    if (!kind || !owned) return
    const point = ([x, y, z]: readonly [number, number, number]): Point3 => {
      const [wx, wz] = toWorld(pen, x, z)
      return { x: wx, y, z: wz }
    }
    return registerInteractable(toolOffer(kind, { stand: point(TOOLS[kind].stand), aim: point(TOOLS[kind].aim) }))
  }, [kind, owned, pen])
}
