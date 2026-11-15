import { MACHINES, type MachineId, type ProduceId } from '../data'
import { QUEUE, machineLevel, queuePrice, type MachineActions, type MachineView, type QueueSlot } from '../machineView'

// SAMPLE DATA for the machine panel's preview (?debug&preview=machine, ./Preview.tsx): a machine of its own, run here
// the way the farm's state will run it (jobs one after another, the first working, done ones keeping their place until
// collected; ingredients taken as a job goes in and given back as it comes out; the level from minutes worked), so the
// panel moves and works under a finger before the game's logic is in. Not the game's: nothing here is saved.

interface Job {
  recipe: string
  done: boolean
  /** seconds worked on it */
  progress: number
}

export interface SampleMachine {
  id: MachineId
  inv: Partial<Record<ProduceId, number>>
  coins: number
  /** seconds of work, all told (the level) */
  worked: number
  capacity: number
  jobs: Job[]
  /** what the barn still has room for (collect takes as many as fit) */
  room: number
}

const recipeOf = (s: SampleMachine, id: string) => MACHINES[s.id].recipes.find((r) => r.id === id)!
/** A job's time at the machine's level (a level may make it quicker). */
const secondsOf = (s: SampleMachine, id: string) => Math.round(recipeOf(s, id).seconds * (1 - machineLevel(s.worked).boost.speed))

export function sampleView(s: SampleMachine): MachineView {
  const def = MACHINES[s.id]
  const working = s.jobs.findIndex((j) => !j.done)
  const slots: QueueSlot[] = s.jobs.map((j, i) => {
    const seconds = secondsOf(s, j.recipe)
    const state = j.done ? 'done' : i === working ? 'working' : 'waiting'
    return { recipe: j.recipe, makes: recipeOf(s, j.recipe).makes, state, seconds, left: state === 'done' ? 0 : state === 'working' ? Math.max(0, seconds - j.progress) : seconds }
  })
  const free = s.jobs.length < s.capacity
  const price = s.capacity < QUEUE.max ? queuePrice(s.capacity + 1) : null
  return {
    id: s.id,
    name: s.id === 'oven' ? 'Oven' : s.id === 'mill' ? 'Mill' : 'Loom',
    level: machineLevel(s.worked),
    capacity: s.capacity,
    slots,
    recipes: def.recipes.map((r) => {
      const have = Object.fromEntries(Object.keys(r.needs).map((k) => [k, s.inv[k as ProduceId] ?? 0])) as Partial<Record<ProduceId, number>>
      const enough = Object.entries(r.needs).every(([k, n]) => (s.inv[k as ProduceId] ?? 0) >= (n ?? 0))
      return { id: r.id, makes: r.makes, needs: r.needs, have, seconds: secondsOf(s, r.id), can: enough && free }
    }),
    upgrade: price === null ? null : { capacity: s.capacity + 1, price },
  }
}

/** The machine runs on `dt` seconds: the first job not done works, and the next starts as it finishes. */
export function sampleTick(s: SampleMachine, dt: number): boolean {
  let changed = false
  let t = dt
  while (t > 0) {
    const j = s.jobs.find((x) => !x.done)
    if (!j) break
    const need = secondsOf(s, j.recipe) - j.progress
    const step = Math.min(t, need)
    j.progress += step
    s.worked += step
    t -= step
    changed = true
    if (j.progress >= secondsOf(s, j.recipe) - 1e-6) j.done = true
  }
  return changed
}

export function sampleActions(s: SampleMachine, changed: () => void): MachineActions {
  const give = (id: string, k: number) => {
    for (const [g, n] of Object.entries(recipeOf(s, id).needs)) s.inv[g as ProduceId] = (s.inv[g as ProduceId] ?? 0) + k * (n ?? 0)
  }
  const firstWaiting = () => {
    const w = s.jobs.findIndex((j) => !j.done)
    return w < 0 ? s.jobs.length : w + 1
  }
  const ok = (v: boolean) => {
    if (v) changed()
    return v
  }
  return {
    add(recipe, at) {
      const r = recipeOf(s, recipe)
      if (s.jobs.length >= s.capacity) return false
      if (Object.entries(r.needs).some(([k, n]) => (s.inv[k as ProduceId] ?? 0) < (n ?? 0))) return false
      give(recipe, -1)
      const job = { recipe, done: false, progress: 0 }
      if (at === undefined || at >= s.jobs.length) s.jobs.push(job)
      else s.jobs.splice(Math.max(firstWaiting(), at), 0, job)
      return ok(true)
    },
    remove(index) {
      const j = s.jobs[index]
      if (!j || j.done || index < firstWaiting()) return false
      s.jobs.splice(index, 1)
      give(j.recipe, 1)
      return ok(true)
    },
    move(from, to) {
      const w = firstWaiting()
      if (from < w || to < w || from >= s.jobs.length || to >= s.jobs.length || from === to) return false
      s.jobs.splice(to, 0, ...s.jobs.splice(from, 1))
      return ok(true)
    },
    collect() {
      let n = 0
      for (let i = 0; i < s.jobs.length && s.room > 0;) {
        if (s.jobs[i].done) {
          const j = s.jobs.splice(i, 1)[0]
          const made = recipeOf(s, j.recipe).makes
          s.inv[made] = (s.inv[made] ?? 0) + 1
          s.room--
          n++
        } else i++
      }
      if (n) changed()
      return n
    },
    buySlot() {
      const p = queuePrice(s.capacity + 1)
      if (p === null || s.coins < p) return false
      s.coins -= p
      s.capacity++
      return ok(true)
    },
  }
}

const plenty: Partial<Record<ProduceId, number>> = { flour: 9, sugar: 7, egg: 14, milk: 6, lemon: 8, strawberry: 12, carrot: 2, pumpkin: 3, wheat: 18, sugarcane: 11, wool: 9 }
const job = (recipe: string, done = false, progress = 0): Job => ({ recipe, done, progress })

/** The preview's starting points: a first visit, a busy oven, one with everything to collect, a full queue of twelve,
 *  one with too little in store, a level about to be reached, the top level, the mill and the loom. */
export const SAMPLES: Record<string, { label: string; make: () => SampleMachine }> = {
  baking: {
    label: 'Oven, baking',
    make: () => ({
      id: 'oven',
      inv: { ...plenty },
      coins: 1240,
      worked: 255 * 60,
      capacity: 5,
      room: 40,
      jobs: [job('lemon_cake', true, 30), job('strawberry_cake', false, 14), job('carrot_cake'), job('lemon_cake')],
    }),
  },
  first: { label: 'Oven, first time', make: () => ({ id: 'oven', inv: { ...plenty }, coins: 380, worked: 0, capacity: 3, room: 40, jobs: [] }) },
  ready: {
    label: 'Oven, all ready',
    make: () => ({
      id: 'oven',
      inv: { ...plenty },
      coins: 900,
      worked: 120 * 60,
      capacity: 4,
      room: 40,
      jobs: [job('lemon_cake', true, 30), job('strawberry_cake', true, 35), job('pumpkin_pie', true, 40), job('carrot_cake', true, 35)],
    }),
  },
  twelve: {
    label: 'Oven, twelve places',
    make: () => ({
      id: 'oven',
      inv: { ...plenty, egg: 30, flour: 20, sugar: 20, milk: 12, lemon: 14, strawberry: 30 },
      coins: 4200,
      worked: 3100 * 60,
      capacity: 12,
      room: 2,
      jobs: [
        job('lemon_cake', true, 30),
        job('strawberry_cake', true, 35),
        job('pumpkin_pie', true, 40),
        job('lemon_cake', false, 9),
        job('strawberry_cake'),
        job('strawberry_cake'),
        job('pumpkin_pie'),
        job('lemon_cake'),
        job('carrot_cake'),
      ],
    }),
  },
  short: {
    label: 'Oven, little in store',
    make: () => ({
      id: 'oven',
      inv: { flour: 1, sugar: 0, egg: 3, milk: 1, lemon: 1, strawberry: 2, carrot: 1, pumpkin: 0 },
      coins: 120,
      worked: 40 * 60,
      capacity: 3,
      room: 40,
      jobs: [job('carrot_cake', false, 20)],
    }),
  },
  levelup: {
    label: 'Oven, a level away',
    make: () => ({ id: 'oven', inv: { ...plenty }, coins: 700, worked: 360 * 60 - 12, capacity: 4, room: 40, jobs: [job('strawberry_cake', false, 20), job('lemon_cake')] }),
  },
  top: {
    label: 'Oven, top level',
    make: () => ({ id: 'oven', inv: { ...plenty }, coins: 9000, worked: 12000 * 60, capacity: 12, room: 40, jobs: [job('pumpkin_pie', false, 10), job('lemon_cake'), job('lemon_cake')] }),
  },
  mill: {
    label: 'Mill',
    make: () => ({ id: 'mill', inv: { ...plenty }, coins: 640, worked: 500 * 60, capacity: 6, room: 40, jobs: [job('wheat', true, 4), job('wheat', false, 1), job('sugarcane'), job('wheat')] }),
  },
  loom: { label: 'Loom', make: () => ({ id: 'loom', inv: { ...plenty }, coins: 300, worked: 30 * 60, capacity: 3, room: 40, jobs: [job('wool', false, 2)] }) },
}
