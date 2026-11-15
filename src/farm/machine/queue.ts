import type { QueueSlot, RecipeView } from '../machineView'

// The machine panel's own arithmetic, with nothing drawn: the places of the queue as the panel shows them (with a job
// being dragged over them: where it would go, the others making room), what a drop does, and a stable key for each
// job so a place that moves slides rather than pops (the view gives the jobs in order, without names of their own).

/** Seconds as the game's clock writes them: 0:35, 4:05, 1:02:10. */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Minutes of work as words: 45 min, 6 h, 6 h 40 min. */
export function workTime(minutes: number): string {
  const t = Math.max(0, Math.round(minutes))
  const h = Math.floor(t / 60)
  const m = t % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Seconds until every job in the queue is done (the working one's time left and every waiting one's). */
export const queueLeft = (slots: QueueSlot[]) => slots.reduce((t, s) => t + (s.state === 'working' ? s.left : s.state === 'waiting' ? s.seconds : 0), 0)

/** How many times a recipe can be made from what is in store (0 when something is short). */
export function timesCan(r: RecipeView): number {
  let n = Infinity
  for (const [k, need] of Object.entries(r.needs)) if (need) n = Math.min(n, Math.floor((r.have[k as keyof typeof r.have] ?? 0) / need))
  return Number.isFinite(n) ? n : 0
}

/** What is being dragged: a recipe card (a new job) or a waiting job of the queue (by its place). */
export type Payload = { kind: 'recipe'; recipe: string } | { kind: 'job'; index: number }

/** A place of the queue as drawn: a job in it, an empty place, or the hole where the dragged thing would land. */
export type CellKind = QueueSlot['state'] | 'empty' | 'hole'
export interface Cell {
  key: string
  kind: CellKind
  /** the job in it (a hole: the dragged job, or none for a new one) */
  slot?: QueueSlot
  /** its place in the view's queue (jobs only): what remove and move are told */
  from?: number
}

/** Where a drag would land: a place of the queue (a recipe: the place of the new job; a job: its new place), out of the
 *  queue (a job: taken out), or nowhere (let go, it goes back). */
export type Target = { at: number } | { out: true } | null

/** What lies under the finger: a place (its kind and where it is drawn), the queue round them, or anything else. */
export type Hit = { cell: CellKind; index: number } | { queue: true } | null

const firstWaiting = (slots: QueueSlot[]) => {
  const i = slots.findIndex((s) => s.state === 'waiting')
  return i < 0 ? slots.length : i
}

/** The target as the finger moves: over a waiting place, there; over the hole, where it already was; over a done or
 *  working one, an empty place or the queue's edge, the end of the queue (a job: the front or end of the waiting ones);
 *  a job outside the queue is taken out, a recipe goes back. */
export function nextTarget(prev: Target, hit: Hit, payload: Payload, slots: QueueSlot[]): Target {
  const lastWaiting = slots.length - 1
  if (!hit) return payload.kind === 'job' ? { out: true } : null
  if ('queue' in hit) return payload.kind === 'job' ? { at: lastWaiting } : { at: slots.length }
  if (hit.cell === 'hole') return prev && 'at' in prev ? prev : { at: hit.index }
  if (hit.cell === 'waiting') return { at: payload.kind === 'job' ? Math.min(hit.index, lastWaiting) : hit.index }
  if (hit.cell === 'empty') return payload.kind === 'job' ? { at: lastWaiting } : { at: slots.length }
  // done or working: a job goes to the front of the waiting ones, a new one to the end
  return payload.kind === 'job' ? { at: firstWaiting(slots) } : { at: slots.length }
}

/** The places as drawn: the jobs in order, then the empty places up to the capacity; with something dragged over them,
 *  as they would be after the drop (the dragged thing a hole where it would land, the others moved to make room). */
export function cells(slots: QueueSlot[], keys: string[], capacity: number, drag?: { payload: Payload; target: Target } | null): Cell[] {
  const jobs: Cell[] = slots.map((s, i) => ({ key: keys[i] ?? `job-${i}`, kind: s.state, slot: s, from: i }))
  const empties = (from: number) => Array.from({ length: Math.max(0, capacity - from) }, (_, k) => ({ key: `empty-${from + k}`, kind: 'empty' as const }))
  const t = drag?.target
  if (drag && drag.payload.kind === 'job') {
    const f = drag.payload.index
    if (!jobs[f]) return [...jobs, ...empties(jobs.length)]
    const hole: Cell = { ...jobs[f], kind: 'hole' }
    const rest = jobs.filter((_, i) => i !== f)
    const at = t && 'at' in t ? Math.max(firstWaiting(slots), Math.min(t.at, slots.length - 1)) : f
    rest.splice(at, 0, hole)
    return [...rest, ...empties(jobs.length)]
  }
  if (drag && drag.payload.kind === 'recipe' && t && 'at' in t && jobs.length < capacity) {
    const at = Math.max(firstWaiting(slots), Math.min(t.at, jobs.length))
    const placed = [...jobs]
    placed.splice(at, 0, { key: 'new', kind: 'hole' })
    return [...placed, ...empties(placed.length)]
  }
  return [...jobs, ...empties(jobs.length)]
}

/** What a drop does: a recipe added (at a place among the waiting ones, or at the end), a job moved or taken out. */
export type Drop = { add: string; at?: number } | { move: [number, number] } | { remove: number } | null

export function dropOf(payload: Payload, target: Target, slots: QueueSlot[]): Drop {
  if (!target) return null
  if (payload.kind === 'recipe') {
    if (!('at' in target)) return null
    const at = Math.max(firstWaiting(slots), target.at)
    return at >= slots.length ? { add: payload.recipe } : { add: payload.recipe, at }
  }
  const f = payload.index
  if ('out' in target) return { remove: f }
  const to = Math.max(firstWaiting(slots), Math.min(target.at, slots.length - 1))
  return to === f ? null : { move: [f, to] }
}

/** A change the panel itself asked for, so each job's key follows it exactly. */
export type KeyOp = { add: number } | { move: [number, number] } | { remove: number } | { collect: number }

/**
 * The jobs' keys after the queue changed from `before` to `after` (their recipes, in order): the change the panel
 * asked for when it is what happened, else each job matched to the first one of its recipe at or after the last
 * match (what was collected leaves from the front, what was added comes at the end); a job matched to none is new.
 */
export function nextKeys(keys: string[], before: { recipe: string; state: string }[], after: { recipe: string; state: string }[], op: KeyOp | null, fresh: () => string): string[] {
  if (op) {
    const k = [...keys]
    const b = [...before]
    if ('add' in op) {
      k.splice(op.add, 0, fresh())
      b.splice(op.add, 0, after[op.add])
    } else if ('move' in op) {
      const [f, t] = op.move
      k.splice(t, 0, ...k.splice(f, 1))
      b.splice(t, 0, ...b.splice(f, 1))
    } else if ('remove' in op) {
      k.splice(op.remove, 1)
      b.splice(op.remove, 1)
    } else {
      // the first `collect` done jobs (they are at the front)
      let n = op.collect
      for (let i = 0; i < b.length && n > 0;) {
        if (b[i].state === 'done') {
          k.splice(i, 1)
          b.splice(i, 1)
          n--
        } else i++
      }
    }
    if (b.length === after.length && b.every((s, i) => s?.recipe === after[i].recipe)) return k
  }
  const out: string[] = []
  let j = 0
  for (const s of after) {
    let m = j
    while (m < before.length && before[m].recipe !== s.recipe) m++
    if (m < before.length) {
      out.push(keys[m])
      j = m + 1
    } else out.push(fresh())
  }
  return out
}
