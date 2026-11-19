import { farmSound, placeSound } from '../../audio/sound'
import { farmFx } from '../../fx/fx'
import { count, MACHINE_IDS, MACHINES, storeOf, STORES, type MachineId, type ProduceId, type Recipe, type StoreId } from '../data'
import { machineLevel, QUEUE, queuePrice, type MachineActions, type MachineView, type QueueSlot } from '../machineView'
import { boostOf, hasPlace, insertJob, isWorking, jobSeconds, moveWaiting, secondsLeft as queueSecondsLeft, recipeOf, runQueue, takeDone, takeWaiting } from '../machines'
import { toWorld } from '../layout'
import { recipeUnlock } from '../unlocks'
import { bump, eventSpeed, farm, isUnlocked, lockField, lockOf, machineLock, putBack, save, toast } from './core'
import { gainXp } from './levels'
import { rewarded } from './rewards'
import { room, store } from './stores'

// The machines (MACHINES: the mill, the loom, the oven) and their queues of jobs.

// Each machine works through a queue of jobs, one good each (src/farm/machines.ts has its rules): a job goes in with
// its ingredients, the first one waiting starts as soon as the machine is free, and a done job keeps its place until
// it is collected. The machine's level (from how long it has worked) makes its jobs quicker, the XP for them more and
// what it makes dearer wherever it is sold (src/farm/prices.ts).

export type MachineStage = 'idle' | 'working' | 'done'

/** Working while a job is under way (whatever is done before it); done while only done jobs wait; idle with an empty
 *  queue. */
export function machineStage(id: MachineId): MachineStage {
  const m = farm.machines[id]
  return isWorking(m) ? 'working' : m.done > 0 ? 'done' : 'idle'
}

/** What a machine is working on, or else the first thing it has done (null with nothing in its queue). */
export function machineRecipe(id: MachineId): Recipe | null {
  const m = farm.machines[id]
  return recipeOf(id, m.jobs[isWorking(m) ? m.done : 0]) ?? null
}

/** Seconds until every job in a machine's queue is done. */
export const machineSecondsLeft = (id: MachineId) => queueSecondsLeft(id, farm.machines[id]) / eventSpeed('machines')

/** How far the job under way is, 0 to 1 (0 with none). */
export function machineProgress(id: MachineId) {
  const m = farm.machines[id]
  const r = isWorking(m) ? recipeOf(id, m.jobs[m.done]) : undefined
  return r ? Math.min(1, m.progress / jobSeconds(r, boostOf(m))) : 0
}

/** A machine's level now, from how long it has worked (src/farm/machineView.ts). */
export const machineLevelOf = (id: MachineId) => machineLevel(farm.machines[id].worked)

/** Jobs of a machine's queue as the goods they make, each with how many, in the order they come. */
function goodsOf(id: MachineId, jobs: readonly string[]) {
  const out: { recipe: Recipe; item: ProduceId; count: number }[] = []
  for (const job of jobs) {
    const r = recipeOf(id, job)
    if (!r) continue
    const same = out.find((g) => g.recipe === r)
    if (same) same.count++
    else out.push({ recipe: r, item: r.makes, count: 1 })
  }
  return out
}
/** The goods a machine has done, waiting to be collected (the first done first). */
export const machineDone = (id: MachineId) => goodsOf(id, farm.machines[id].jobs.slice(0, farm.machines[id].done))
/** The jobs it has still to do (the one under way first), as the goods they make. */
export const machineToDo = (id: MachineId) => goodsOf(id, farm.machines[id].jobs.slice(farm.machines[id].done))

/** A point of a machine's own frame (MACHINES: its stand, aim and sparkle), where it stands now (it is a movable place
 *  of the edit mode: src/farm/layout.ts). */
export function machinePoint(id: MachineId, [x, y, z]: readonly [number, number, number]) {
  const [wx, wz] = toWorld(farm.layout.places[id], x, z)
  return { x: wx, y, z: wz }
}

/** Where a machine's crystals fly up from: where its sparkles pop. */
const machineAt = (id: MachineId) => machinePoint(id, MACHINES[id].sparkle)
/** A machine's sound, from where it stands. */
function machineSound(id: MachineId, sound: Parameters<typeof farmSound>[0]) {
  const at = machinePoint(id, [0, 0, 0])
  const { pan, near } = placeSound(at.x, at.z)
  farmSound(sound, pan, near)
}

/** A recipe's ingredients are all in store. */
const hasNeeds = (r: Recipe) => Object.entries(r.needs).every(([k, per]) => farm.inv[k as ProduceId] >= (per ?? 0))

/** A recipe is open at the farm's level (src/farm/unlocks.ts). */
const recipeOpen = (id: MachineId, recipe: string) => isUnlocked(recipeUnlock(id, recipe))

/** A job of a recipe could go into a machine's queue now: it is open, a place is free and its ingredients are in store. */
export const canAddJob = (id: MachineId, r: Recipe) => recipeOpen(id, r.id) && hasPlace(farm.machines[id]) && hasNeeds(r)

/** A job into a machine's queue, at the end or at a waiting place: its ingredients are taken now, and it starts as
 *  soon as the machine is free. No XP for it (it can be taken out again, its ingredients back): its job's comes as it
 *  is collected. */
export function addJob(id: MachineId, recipe: string, at?: number): boolean {
  const r = recipeOf(id, recipe)
  if (!r || !recipeOpen(id, r.id) || !hasNeeds(r) || !insertJob(farm.machines[id], r.id, at)) return false
  for (const [k, per] of Object.entries(r.needs)) farm.inv[k as ProduceId] -= per ?? 0
  machineSound(id, MACHINES[id].sounds.load)
  bump()
  save()
  return true
}

/** A waiting job taken out of a machine's queue: its ingredients go back into store (even past full: they were the
 *  farm's). The job under way and the done ones cannot be. */
export function removeJob(id: MachineId, index: number): boolean {
  const r = recipeOf(id, takeWaiting(farm.machines[id], index))
  if (!r) return false
  for (const [k, per] of Object.entries(r.needs)) putBack(k as ProduceId, per ?? 0)
  bump()
  save()
  return true
}

/** A waiting job moved to another waiting place in the queue. */
export function moveJob(id: MachineId, from: number, to: number): boolean {
  if (!moveWaiting(farm.machines[id], from, to)) return false
  bump()
  save()
  return true
}

/** How many of a machine's done jobs would go into store now (the rest would wait in it for room). */
export function machineCollectable(id: MachineId) {
  const m = farm.machines[id]
  const left: Partial<Record<StoreId, number>> = {}
  let n = 0
  for (const job of m.jobs.slice(0, m.done)) {
    const r = recipeOf(id, job)
    if (!r) continue
    const where = storeOf(r.makes)
    const k = left[where] ?? room(where)
    if (k > 0) n++
    left[where] = k - 1
  }
  return n
}

/** Takes every done job out of a machine into store, as many as there is room for (the rest keep their places, done):
 *  how many. Each is worth its XP, more at a higher level of the machine; sparkles, a rustle and a word say what came
 *  out. */
export function collectMachine(id: MachineId) {
  const m = farm.machines[id]
  if (!m.done) return 0
  const first = recipeOf(id, m.jobs[0])
  const taken = takeDone(m, (job) => {
    const r = recipeOf(id, job)
    return !!r && store(r.makes, 1) === 1
  })
  if (!taken.length) {
    const where = first ? storeOf(first.makes) : 'barn'
    toast(`The ${STORES[where].name.toLowerCase()} is full`, where)
    return 0
  }
  const goods = goodsOf(id, taken)
  const counts = MACHINES[id].counts
  if (counts) farm.stats[counts] += taken.length
  for (const g of goods) farm.got[g.item] += g.count
  const at = machineAt(id)
  gainXp('make', taken.length, at, boostOf(m).xp)
  rewarded(
    'made',
    goods.map((g) => ({ item: g.item, n: g.count })),
    at,
  )
  // its own sound as its goods come out (a sack, a bolt of cloth, a tray, a crock, a jar: MACHINES' `sounds.collect`)
  machineSound(id, MACHINES[id].sounds.collect)
  farmFx('harvest', at.x, at.y, at.z, { good: goods[0].item })
  const full = m.done ? recipeOf(id, m.jobs[0]) : undefined
  toast(`+ ${goods.map((g) => count(g.item, g.count)).join(', ')}${full ? ` · the ${STORES[storeOf(full.makes)].name.toLowerCase()} is full` : ''}`, goods[0].item)
  bump()
  save()
  return taken.length
}

/** What the next place in a machine's queue costs (null: it has all twelve). */
export const slotPrice = (id: MachineId) => queuePrice(farm.machines[id].capacity + 1)

/** One more place in a machine's queue, for its price (its card asked first): true when it was bought. */
export function buySlot(id: MachineId): boolean {
  const m = farm.machines[id]
  const price = slotPrice(id)
  if (price === null || m.capacity >= QUEUE.max || machineLock(id) !== null || farm.coins < price) return false
  farm.coins -= price
  m.capacity++
  gainXp('build', 1, machineAt(id))
  toast(`${MACHINES[id].name}: ${m.capacity} places in its queue`)
  bump()
  save()
  return true
}

const percent = (share: number) => `${Math.round(share * 100)}%`

/** What a level reached gives, in a few words: "Oven: level 2 · +20% XP, +20% coins". */
function levelWords(id: MachineId, level: ReturnType<typeof machineLevel>) {
  const b = level.boost
  return `${MACHINES[id].name}: level ${level.n} · +${percent(b.xp)} XP, +${percent(b.coins)} coins${b.speed > 0 ? `, ${percent(b.speed)} quicker` : ''}`
}

/** Works on through the queue, job after job; a level reached is told (once: a level is never lost). */
export function growMachine(id: MachineId, dt: number) {
  const m = farm.machines[id]
  if (!isWorking(m)) return
  const before = machineLevel(m.worked).n
  runQueue(id, m, dt)
  const level = machineLevel(m.worked)
  if (level.n > before) toast(levelWords(id, level), MACHINES[id].picture ?? MACHINES[id].recipes[0].makes)
}

/** What a machine's panel shows (src/farm/machineView.ts): its level, its queue as places, what it can make and whether
 *  each can go in now (one not open yet: the level it opens at), and the next place's price. */
export function machineView(id: MachineId): MachineView {
  const def = MACHINES[id]
  const m = farm.machines[id]
  const level = machineLevel(m.worked)
  // (real seconds: a machine rush halves them)
  const fast = eventSpeed('machines')
  const slots = m.jobs.map((job, i): QueueSlot => {
    const r = recipeOf(id, job) ?? def.recipes[0]
    const seconds = jobSeconds(r, level.boost) / fast
    const state = i < m.done ? 'done' : i === m.done ? 'working' : 'waiting'
    return { recipe: r.id, makes: r.makes, state, seconds, left: state === 'done' ? 0 : state === 'working' ? Math.max(0, seconds - m.progress / fast) : seconds }
  })
  const recipes = def.recipes.map((r) => ({
    id: r.id,
    makes: r.makes,
    needs: { ...r.needs },
    have: Object.fromEntries(Object.keys(r.needs).map((k) => [k, farm.inv[k as ProduceId]])),
    seconds: jobSeconds(r, level.boost) / fast,
    can: canAddJob(id, r),
    ...lockField(lockOf(recipeUnlock(id, r.id))),
  }))
  // (a machine not open yet sells no place: its places open with it)
  const price = machineLock(id) === null ? slotPrice(id) : null
  return { id, name: def.name, level, capacity: m.capacity, slots, recipes, upgrade: price === null ? null : { capacity: m.capacity + 1, price } }
}

/** What a machine's panel can do, the same functions every time for each machine. */
const ACTIONS = Object.fromEntries(
  MACHINE_IDS.map((id): [MachineId, MachineActions] => [
    id,
    {
      add: (recipe, at) => addJob(id, recipe, at),
      remove: (index) => removeJob(id, index),
      move: (from, to) => moveJob(id, from, to),
      collect: () => collectMachine(id),
      buySlot: () => buySlot(id),
    },
  ]),
) as Record<MachineId, MachineActions>
export const machineActions = (id: MachineId): MachineActions => ACTIONS[id]
