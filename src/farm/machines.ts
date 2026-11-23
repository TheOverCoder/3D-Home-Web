import { MACHINES, type MachineId, type Recipe } from './data'
import { QUEUE, machineLevel, type LevelBoost } from './machineView'

// A machine's queue, as rules (MACHINES in ./data; the farm's side of it — the ingredients, the store, XP, sounds, the
// save — is in ./state): jobs of one good each, in order, as many as it has places. The first job not done works, and
// as it is done the next one starts at once; a done job keeps its place until it is collected. The machine counts
// every second it works: that is its level (machineLevel in ./machineView), which makes its jobs quicker, the XP for
// them more and its goods dearer. Pure: these change only the machine they are given, never the farm.

/** A machine as the save keeps it. */
export interface MachineState {
  /** the queue in order, each job a recipe of the machine: the first `done` are done (waiting to be collected), the
   *  next one works (`progress` seconds into it), the rest wait */
  jobs: string[]
  done: number
  progress: number
  /** places in the queue, QUEUE.start to QUEUE.max (a save from before the queue may hold more jobs than that: none is
   *  lost, and no new one goes in until there is a place) */
  capacity: number
  /** every second it has worked: its level */
  worked: number
  /** the farm's: bought in the edit mode's shop (MACHINES' `price` in ./data; the loom is every farm's). Until then it
   *  is not on the farm (src/farm/state/core.ts, machineOwned) */
  owned: boolean
}

/** A machine with nothing in its queue and nothing worked: the farm's (`owned`), or one still to be bought. */
export const freshMachine = (owned = true): MachineState => ({ jobs: [], done: 0, progress: 0, capacity: QUEUE.start, worked: 0, owned })

/** A recipe of the machine by its key (anything else, a name every object has included: none). */
export const recipeOf = (id: MachineId, recipe: unknown): Recipe | undefined => MACHINES[id].recipes.find((r) => r.id === recipe)

/** What the machine's level gives now. */
export const boostOf = (m: MachineState): LevelBoost => machineLevel(m.worked).boost

/** How long a job takes at a level's boost. */
export const jobSeconds = (r: Recipe, boost: LevelBoost) => r.seconds * (1 - boost.speed)

/** A job is under way (the first one not done). */
export const isWorking = (m: MachineState) => m.done < m.jobs.length

/** The first place a new or moved job may take: after the one under way (or the done ones, when none is). */
export const firstWaiting = (m: MachineState) => (isWorking(m) ? m.done + 1 : m.jobs.length)

/** A place is free for another job. */
export const hasPlace = (m: MachineState) => m.jobs.length < m.capacity

/** Seconds until every job in the queue is done, at the machine's level now. */
export function secondsLeft(id: MachineId, m: MachineState): number {
  const boost = boostOf(m)
  let t = 0
  for (let i = m.done; i < m.jobs.length; i++) {
    const r = recipeOf(id, m.jobs[i])
    if (r) t += jobSeconds(r, boost)
  }
  return Math.max(0, t - (isWorking(m) ? m.progress : 0))
}

/**
 * The machine works on for `dt` seconds: the job under way goes on, and once it is done the next one starts, as many as
 * the time takes. Every second of it is counted as worked (and a level reached on the way makes the rest quicker).
 * How many jobs were finished.
 */
export function runQueue(id: MachineId, m: MachineState, dt: number): number {
  let left = dt > 0 ? dt : 0
  let finished = 0
  while (isWorking(m)) {
    const r = recipeOf(id, m.jobs[m.done])
    if (!r) {
      // a job the machine does not know (never in a save made safe): it goes
      m.jobs.splice(m.done, 1)
      m.progress = 0
      continue
    }
    // asked again after the time is in: a level reached on the way may have finished it
    const need = Math.max(0, jobSeconds(r, boostOf(m)) - m.progress)
    if (need <= left) {
      left -= need
      m.worked += need
      m.progress = 0
      m.done++
      finished++
      continue
    }
    if (left <= 0) break
    m.progress += left
    m.worked += left
    left = 0
  }
  return finished
}

/** A job into the queue: at the end, or at `at` among the waiting ones (the job under way and the done ones stay where
 *  they are). False with no place free, or a place that is not a waiting one. */
export function insertJob(m: MachineState, recipe: string, at?: number): boolean {
  if (!hasPlace(m)) return false
  const k = at === undefined ? m.jobs.length : at
  if (!Number.isInteger(k) || k < firstWaiting(m) || k > m.jobs.length) return false
  // the first job of an idle queue starts from the beginning
  if (!isWorking(m)) m.progress = 0
  m.jobs.splice(k, 0, recipe)
  return true
}

/** A waiting job taken out of the queue (the one under way and the done ones cannot be): its recipe, or null. */
export function takeWaiting(m: MachineState, index: number): string | null {
  if (!Number.isInteger(index) || index < firstWaiting(m) || index >= m.jobs.length) return null
  return m.jobs.splice(index, 1)[0]
}

/** A waiting job moved to another waiting place: false when either is not one. */
export function moveWaiting(m: MachineState, from: number, to: number): boolean {
  const first = firstWaiting(m)
  const waiting = (k: number) => Number.isInteger(k) && k >= first && k < m.jobs.length
  if (!waiting(from) || !waiting(to)) return false
  if (from === to) return true
  const [job] = m.jobs.splice(from, 1)
  m.jobs.splice(to, 0, job)
  return true
}

/** The done jobs taken out of the queue, those `fits` says yes to, in order (the others keep their places at its
 *  front): the recipes taken. */
export function takeDone(m: MachineState, fits: (recipe: string) => boolean): string[] {
  const taken: string[] = []
  const kept: string[] = []
  for (const job of m.jobs.slice(0, m.done)) (fits(job) ? taken : kept).push(job)
  if (!taken.length) return taken
  m.jobs = [...kept, ...m.jobs.slice(m.done)]
  m.done = kept.length
  return taken
}
