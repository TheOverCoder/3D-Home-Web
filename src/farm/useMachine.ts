import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { registerInteractable, type ActionIcon, type InteractableDef } from '../lib/interaction'
import type { Point3 } from '../lib/playerState'
import { useHome } from '../store'
import { MACHINES, STORES, count, inputOf, storeOf, type MachineId, type ProduceId, type Recipe } from './data'
import { usePlacement } from './edit'
import { canAddJob, clockText, collectMachine, farm, machineCollectable, machineDone, machinePoint, machineSecondsLeft, machineStage, machineToDo } from './state'

// A machine on the action button (MACHINES in src/farm/data.ts): the mill, the loom and the oven, each working through
// a queue of jobs. The button takes out what is done; otherwise, while something can go into the queue, it opens the
// machine's panel (its queue, what it makes, its level): nothing goes in on the button itself. With nothing to add, a
// status says how long the queue still works, that the barn is full, or what the machine wants. A gear on it opens the
// panel whenever you look at it. It dings as each job is done and makes its working sound now and then; the work
// level it gives back (0 … 1, eased) drives its moving parts.

/** Whole seconds to go, rounded as the clock in the labels is. */
const whole = (seconds: number) => Math.max(0, Math.ceil(seconds))
/** A point round where a machine stands (in its own frame: it turns with its place, src/farm/layout.ts), in the world. */
const around = (id: MachineId, at: [number, number, number]): Point3 => machinePoint(id, at)
/** Where a machine's sounds come from: its middle, where it stands now. */
const middle = (id: MachineId) => machinePoint(id, [0, 0, 0])

/** What a recipe still lacks, and how many of each (shown as pictures on the status line). */
const lacking = (needs: Partial<Record<ProduceId, number>>) =>
  Object.entries(needs).flatMap(([item, n]) => {
    const more = (n ?? 0) - farm.inv[item as ProduceId]
    return more > 0 ? [{ item, count: more }] : []
  })

/** The recipe you are closest to having everything for (fewest things still to get). */
function nearest(id: MachineId) {
  const short = (r: Recipe) => Object.entries(r.needs).reduce((t, [k, n]) => t + Math.max(0, (n ?? 0) - farm.inv[k as ProduceId]), 0)
  return MACHINES[id].recipes.reduce((best, r) => (short(r) < short(best) ? r : best))
}

/** The first recipe that can go into the queue now (null: none). */
const addable = (id: MachineId) => MACHINES[id].recipes.find((r) => canAddJob(id, r)) ?? null

/** Goods with how many, in words: "3 lemon cakes, 1 carrot cake". */
const listed = (goods: { item: ProduceId; count: number }[]) => goods.map((g) => count(g.item, g.count)).join(', ')

/** What collecting takes now: the first good done (the picture), how many in all that fit, and the others. */
function collectIcon(id: MachineId): ActionIcon {
  const [first, ...rest] = machineDone(id)
  const n = machineCollectable(id)
  return { verb: 'pick', item: first.item, count: rest.length ? first.count : n, also: rest.length ? rest.map((g) => ({ item: g.item, count: g.count })) : undefined }
}

function main(id: MachineId): InteractableDef {
  const def = MACHINES[id]
  const action = `farm-${id}`
  const open = () => useHome.getState().openPanel({ kind: 'machine', id })
  return {
    id: action,
    position: around(id, def.stand),
    aim: around(id, def.aim),
    radius: def.reach,
    label: () => {
      const done = machineDone(id)
      if (machineCollectable(id)) return done.length === 1 ? def.words.done(done[0].recipe, machineCollectable(id)) : `Collect ${listed(done)}`
      if (addable(id)) return `${def.words.word} · add to the queue`
      const todo = machineToDo(id)
      const left = clockText(machineSecondsLeft(id))
      if (todo.length === 1) return def.words.working(todo[0].recipe, todo[0].count, left)
      if (todo.length) return `${def.name} · ${listed(todo)} · ${left}`
      if (done.length) return `${STORES[storeOf(done[0].item)].name} full · ${listed(done)} waiting`
      return def.words.idle(nearest(id))
    },
    needs: () => (machineStage(id) === 'idle' && !addable(id) && !def.picture ? lacking(nearest(id).needs) : null),
    icon: (): ActionIcon => {
      if (machineCollectable(id)) return collectIcon(id)
      const r = addable(id)
      // what one of its jobs makes: the press opens the queue, nothing goes in yet
      if (r) return { verb: 'make', item: r.makes, word: def.words.word }
      const todo = machineToDo(id)
      if (todo.length) return { verb: 'wait', item: todo[0].item, count: todo.reduce((n, g) => n + g.count, 0), seconds: whole(machineSecondsLeft(id)) }
      const done = machineDone(id)
      if (done.length) return { verb: 'wait', item: done[0].item, count: done.reduce((n, g) => n + g.count, 0), full: storeOf(done[0].item) }
      // nothing to work on: a status that says what is missing (or what it makes from what), never a button
      if (def.picture) return { verb: 'wait', item: def.picture, makes: def.recipes.map((x) => ({ from: inputOf(x), to: x.makes })) }
      return { verb: 'wait', item: nearest(id).makes }
    },
    // on the compass once the whole queue is done (and what is done fits)
    ready: () => {
      if (machineStage(id) !== 'done') return null
      const n = machineCollectable(id)
      return n ? { item: machineDone(id)[0].item, count: n } : null
    },
    run: () => {
      if (machineCollectable(id)) {
        if (collectMachine(id)) playGesture('interact')
      } else if (addable(id)) open()
    },
    // its queue and its level, whenever you look at it
    tag: () => ({ kind: 'gear', label: `${def.name}: its queue and level`, at: { ...around(id, def.aim), y: def.aim[1] + 0.5 }, open }),
  }
}

/** Puts a machine on the action button, with its sounds: what the scene's model needs back is how hard it works, 0 … 1,
 *  eased at rate `ease` (its moving parts get going and wind down). */
export function useMachine(id: MachineId, ease = 0) {
  const working = useRef(machineStage(id) === 'working')
  const done = useRef(farm.machines[id].done)
  const noise = useRef(0)
  const work = useRef(0)

  // on the button where it stands (again when the edit mode moves it)
  const placed = usePlacement(id)
  useEffect(() => registerInteractable(main(id)), [id, placed])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const def = MACHINES[id]
    const m = farm.machines[id]
    // a ding for each job done (as many done as before, or fewer: some were collected)
    if (m.done > done.current) {
      const { pan, near } = placeSound(middle(id).x, middle(id).z)
      farmSound('ding', pan, Math.max(0.6, near))
    }
    done.current = m.done
    const was = working.current
    const now = machineStage(id) === 'working'
    working.current = now
    work.current = MathUtils.damp(work.current, now ? 1 : 0, ease, dt)
    // its working sound now and then, if you are near enough to hear it; the first one a while after it starts, as it
    // has just made its sound as the job went in (not twice at once)
    const sound = def.sounds.work
    if (!was && now && sound) noise.current = sound.every + Math.random() * sound.spread
    if (now && sound) {
      noise.current -= dt
      if (noise.current <= 0) {
        noise.current = sound.every + Math.random() * sound.spread
        const { pan, near } = placeSound(middle(id).x, middle(id).z)
        if (near > 0.15) farmSound(sound.sound, pan, near)
      }
    }
  })
  return work
}
