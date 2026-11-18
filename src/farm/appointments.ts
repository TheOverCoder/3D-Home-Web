import { readyAt } from '../lib/time'
import { BEDS, MACHINE_IDS, PRODUCERS, PRODUCER_IDS, cropById, type MachineId } from './data'
import { returnWorth } from './economy'
import type { Pic } from './firstSteps'
import { boostOf, isWorking, jobSeconds, recipeOf } from './machines'
import type { FarmData } from './state/core'
import { mostAt, ownsEach } from './tools'
import { machineOpensAt } from './unlocks'
import { levelOf } from './xp'

// What the farm has on its way, and when (update-v1/missions/01-loop-economy.md, Foundation 3; CONTRACTS §1.17): each
// bed growing, each animal and plant filling up, each job in a machine's queue, each new order coming to the board —
// the soonest first. And whether the farm is busy: every built bed sown and every open machine at work, so a player
// leaving now leaves nothing idle (the busy card says "Busy till 07:40", never "All set": that is the first steps'
// end). Pure: it reads a farm and the speeds the week's events give, and changes nothing.

/** Something on its way: its picture, the seconds until it is ready, how many goods it brings and what they are worth
 *  (net, as a time away counts them: src/farm/economy.ts, returnWorth). */
export interface Appointment {
  what: Pic
  ready: number
  count: number
  worth: number
  from: 'bed' | 'producer' | 'machine' | 'order'
}

/** How much faster the week's events make the crops grow and the machines work (1: no event). */
export interface Speeds {
  crops: number
  machines: number
}
const STILL: Speeds = { crops: 1, machines: 1 }

/** Whether a bed is the farm's to sow: built, on land that is bought. */
const bedOwned = (f: FarmData, i: number) => f.beds[i]?.built && (!BEDS[i].expansion || f.expansions[BEDS[i].expansion!])

/** A machine is open at the farm's level (its first recipe's). */
const openByLevel = (f: FarmData) => (id: MachineId) => levelOf(f.xp.points) >= machineOpensAt(id)

/** Everything on its way, soonest first. A bed that will run dry before it ripens (no sprinklers, too little water) is
 *  not: it will not be ready by itself. Nor is anything ready already. */
export function appointments(f: FarmData, speed: Speeds = STILL): Appointment[] {
  const out: Appointment[] = []
  f.beds.forEach((b, i) => {
    if (!b.crop || !bedOwned(f, i)) return
    const left = cropById(b.crop).growSeconds - b.growth
    if (left <= 0 || (!f.sprinkler && b.water < left)) return
    const count = Math.round(cropById(b.crop).yield * (f.compost ? 1.5 : 1))
    out.push({ what: { item: b.crop }, ready: left / speed.crops, count, worth: returnWorth([{ item: b.crop, count }]), from: 'bed' })
  })
  for (const id of PRODUCER_IDS) {
    const def = PRODUCERS[id]
    const p = f.producers[id]
    const max = mostAt(id, f.ladders)
    const rate = def.herd?.shared && !ownsEach(id, f.ladders) ? p.animals : 1
    if (!(rate > 0)) continue
    p.stock.forEach((has, k) => {
      const need = max - has
      if (need <= 0) return
      const ready = (need * def.every - (p.timer[k] ?? 0)) / rate
      out.push({ what: { item: def.good }, ready: Math.max(0, ready), count: need, worth: returnWorth([{ item: def.good, count: need }]), from: 'producer' })
    })
  }
  for (const id of MACHINE_IDS) {
    const m = f.machines[id]
    const boost = boostOf(m)
    let t = isWorking(m) ? -m.progress : 0
    for (let k = m.done; k < m.jobs.length; k++) {
      const r = recipeOf(id, m.jobs[k])
      if (!r) continue
      t += jobSeconds(r, boost)
      out.push({ what: { item: r.makes }, ready: Math.max(0, t) / speed.machines, count: 1, worth: returnWorth([{ item: r.makes, count: 1 }]), from: 'machine' })
    }
  }
  for (const slot of f.orders) if ('wait' in slot && slot.wait > 0) out.push({ what: { art: 'clipboard' }, ready: slot.wait, count: 0, worth: 0, from: 'order' })
  return out.filter((a) => a.ready > 0).sort((a, b) => a.ready - b.ready)
}

/** What will be ready within `seconds`, in coins (net): a producer filling counts what it gives by then. */
export function worthWithin(f: FarmData, seconds: number, speed: Speeds = STILL): number {
  let sum = 0
  for (const a of appointments(f, speed)) {
    if (a.ready <= seconds) sum += a.worth
    else if (a.from === 'producer') sum += (a.worth * Math.floor((a.count * seconds) / a.ready)) / a.count
  }
  return sum
}

/** The farm is busy: every bed it owns is sown, and every machine open at its level has a job under way. `open`: a
 *  machine is open (the farm's own answer; by the level unless given). */
export function farmBusy(f: FarmData, open: (id: MachineId) => boolean = openByLevel(f)): boolean {
  if (f.beds.some((b, i) => bedOwned(f, i) && !b.crop)) return false
  return MACHINE_IDS.every((id) => !open(id) || isWorking(f.machines[id]))
}

/** How readyAt (src/lib/time.ts) begins a time of tomorrow. */
const TOMORROW = 'tomorrow '

/** What the busy card says: "Busy till 21:40" (the longest thing on its way, on the device's clock: `title`), with the
 *  soonest and the longest ready (a good's picture each). `until` is the time alone and `night` whether it is
 *  tomorrow's (a phone's top has no room for the word: the card shows the moon). Null with nothing on its way. */
export function busyWords(f: FarmData, now: number = Date.now(), speed: Speeds = STILL, locale?: string) {
  const all = appointments(f, speed).filter((a) => a.from !== 'order')
  if (!all.length) return null
  const soonest = all[0]
  const longest = all[all.length - 1]
  const at = readyAt(longest.ready, now, locale)
  const night = at.startsWith(TOMORROW)
  return { title: `Busy till ${at}`, soonest, longest, until: night ? at.slice(TOMORROW.length) : at, night }
}
