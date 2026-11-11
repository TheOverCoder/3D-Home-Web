import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { farmSound, placeSound } from '../audio/sound'
import { farmFx } from '../fx/fx'
import { playGesture } from '../lib/gestures'
import { registerInteractable, type ActionIcon, type InteractableDef } from '../lib/interaction'
import type { Point3 } from '../lib/playerState'
import { useHome } from '../store'
import { MACHINES, count, inputOf, produceById, type MachineId, type ProduceId, type Recipe } from './data'
import { batches, clockText, collectMachine, farm, loadMachine, machineCollectable, machineRecipe, machineSecondsLeft, machineStage } from './state'

// A machine on the action button (MACHINES in src/farm/data.ts): the mill, the loom and the oven. Its main action takes
// out what it made, or says how long it still works; with nothing to work on, a status says what it wants. A recipe it
// can make now is an offer of its own (each cake, wheat or cane; a machine of one recipe offers it on the main action):
// one press asks first — a card over the button with what goes in — and only then loads it. It dings when it is done
// and makes its working sound now and then; the work level it gives back (0 … 1, eased) drives its moving parts.

/** Whole seconds to go, rounded as the clock in the labels is. */
const whole = (seconds: number) => Math.max(0, Math.ceil(seconds))
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** A point round where a machine stands, in the world. */
const around = (id: MachineId, [x, y, z]: [number, number, number]): Point3 => ({ x: MACHINES[id].x + x, y, z: MACHINES[id].z + z })

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

/** The card over the button that asks before anything goes in: what comes out and how many, how long, what it takes. */
function ask(id: MachineId, action: string, r: Recipe) {
  const def = MACHINES[id]
  const n = batches(id, r)
  const made = produceById(r.makes)
  useHome.getState().setConfirm({
    id: action,
    item: r.makes,
    count: n,
    // one at a time (a cake): its name; else what it makes, many of
    title: cap(def.capacity === 1 ? made.name : made.plural),
    seconds: n * r.seconds,
    inputs: Object.entries(r.needs).map(([item, k]) => ({ item, count: (k ?? 0) * n })),
    word: def.words.word,
    go: () => {
      if (!loadMachine(id, r.id)) return
      const { pan, near } = placeSound(def.x, def.z)
      farmSound(def.sounds.load, pan, near)
      playGesture('interact')
    },
  })
}

/** A recipe the machine can make now, from what is in the basket: its own offer (a machine of several recipes). */
function offer(id: MachineId, r: Recipe): InteractableDef {
  const def = MACHINES[id]
  const action = `farm-${id}-${r.id}`
  return {
    id: action,
    position: around(id, def.stand),
    aim: around(id, def.aim),
    radius: def.reach,
    enabled: () => machineStage(id) === 'idle' && batches(id, r) > 0,
    label: () => def.words.load(r, batches(id, r)),
    // what comes out, and how many
    icon: () => ({ verb: 'make', item: r.makes, word: def.words.word, count: batches(id, r) }),
    run: () => ask(id, action, r),
  }
}

/** The machine's own action: take out what it made, how long it still works, or (a machine of one recipe) load it. */
function main(id: MachineId): InteractableDef {
  const def = MACHINES[id]
  const action = `farm-${id}`
  // a machine of one recipe loads it from here; one of several has an offer for each (above)
  const loadable = () => {
    const r = def.recipes.length === 1 ? def.recipes[0] : null
    return r && machineStage(id) === 'idle' && batches(id, r) > 0 ? r : null
  }
  return {
    id: action,
    position: around(id, def.stand),
    aim: around(id, def.aim),
    radius: def.reach,
    // idle with something to make, each recipe's own offer is on the button instead
    enabled: def.recipes.length === 1 ? undefined : () => machineStage(id) !== 'idle' || !def.recipes.some((r) => batches(id, r) > 0),
    label: () => {
      const s = machineStage(id)
      const m = farm.machines[id]
      if (s === 'done') return machineCollectable(id) ? def.words.done(machineRecipe(id)!, machineCollectable(id)) : `Barn full · ${count(machineRecipe(id)!.makes, m.ready)} waiting`
      if (s === 'working') return def.words.working(machineRecipe(id)!, m.count, clockText(machineSecondsLeft(id)))
      const r = loadable()
      return r ? def.words.load(r, batches(id, r)) : def.words.idle(nearest(id))
    },
    needs: () => (machineStage(id) === 'idle' && !def.picture ? lacking(nearest(id).needs) : null),
    icon: (): ActionIcon => {
      const s = machineStage(id)
      const m = farm.machines[id]
      if (s === 'done')
        return machineCollectable(id) ? { verb: 'pick', item: machineRecipe(id)!.makes, count: machineCollectable(id) } : { verb: 'wait', item: machineRecipe(id)!.makes, count: m.ready, full: 'barn' }
      if (s === 'working') return { verb: 'wait', item: machineRecipe(id)!.makes, count: m.count, seconds: whole(machineSecondsLeft(id)) }
      const r = loadable()
      if (r) return { verb: 'make', item: r.makes, word: def.words.word, count: batches(id, r) }
      // nothing to work on: a status that says what is missing (or what it makes from what), never a button
      if (def.picture) return { verb: 'wait', item: def.picture, makes: def.recipes.map((x) => ({ from: inputOf(x), to: x.makes })) }
      return { verb: 'wait', item: nearest(id).makes }
    },
    ready: () => (machineStage(id) === 'done' && machineCollectable(id) ? { item: machineRecipe(id)!.makes, count: machineCollectable(id) } : null),
    run: () => {
      const s = machineStage(id)
      const { pan, near } = placeSound(def.x, def.z)
      if (s === 'done') {
        const good = machineRecipe(id)?.makes
        if (!collectMachine(id)) return
        playGesture('interact')
        farmSound('harvest', pan, near)
        farmFx('harvest', def.x + def.sparkle[0], def.sparkle[1], def.z + def.sparkle[2], { good })
      } else if (s === 'working') useHome.getState().showToast(def.words.busy(machineRecipe(id)!, clockText(machineSecondsLeft(id))))
      else {
        // what goes in only goes in once asked
        const r = loadable()
        if (r) ask(id, action, r)
      }
    },
  }
}

/** Puts a machine on the action button, with its sounds: what the scene's model needs back is how hard it works, 0 … 1,
 *  eased at rate `ease` (its moving parts get going and wind down). */
export function useMachine(id: MachineId, ease = 0) {
  const stage = useRef(machineStage(id))
  const noise = useRef(0)
  const work = useRef(0)

  useEffect(() => {
    const recipes = MACHINES[id].recipes
    const offs = [main(id), ...(recipes.length > 1 ? recipes.map((r) => offer(id, r)) : [])].map(registerInteractable)
    return () => offs.forEach((off) => off())
  }, [id])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const def = MACHINES[id]
    const s = machineStage(id)
    const was = stage.current
    stage.current = s
    if (was === 'working' && s === 'done') {
      const { pan, near } = placeSound(def.x, def.z)
      farmSound('ding', pan, Math.max(0.6, near))
    }
    const working = s === 'working'
    work.current = MathUtils.damp(work.current, working ? 1 : 0, ease, dt)
    // its working sound now and then, if you are near enough to hear it; the first one a while after it starts, as it
    // has just made its sound on being loaded (not twice at once)
    const sound = def.sounds.work
    if (was === 'idle' && working && sound) noise.current = sound.every + Math.random() * sound.spread
    if (working && sound) {
      noise.current -= dt
      if (noise.current <= 0) {
        noise.current = sound.every + Math.random() * sound.spread
        const { pan, near } = placeSound(def.x, def.z)
        if (near > 0.15) farmSound(sound.sound, pan, near)
      }
    }
  })
  return work
}
