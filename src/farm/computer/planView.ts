import { CROPS, MACHINES, MACHINE_IDS, PRODUCERS, PRODUCER_IDS, type MachineId, type ProduceId } from '../data'
import { speedAt } from '../events'
import { jobSeconds } from '../machines'
import { machineLevel } from '../machineView'
import { levelOf } from '../xp'
import { recipeUnlock, unlockLevel, type UnlockId } from '../unlocks'
import { pricesNow, type MarketFarm, type MarketNow } from './marketView'

// What the computer's Planner shows: what is worth making, at today's prices and speeds — every crop by what a bed
// brings a minute and a harvest, every recipe by what a job adds to its ingredients, every animal and fruit plant by
// what it gives — and what the line at the gate and the open orders ask for now against what the farm has. Worked out
// by the game's own rules (the yield with compost, a job's time at its machine's level, the harvest festival and the
// machine rush); prices are the Market's (./marketView.ts, pricesNow). Pure: the same farm and moment, the same view.

export interface PlanRow {
  kind: 'bed' | 'job' | 'animal'
  /** a crop's id, a recipe as `machine:recipe`, a producer's id */
  id: string
  makes: ProduceId
  machine?: MachineId
  /** coins one press brings: a harvest less its seeds, what a job adds to its ingredients, one good collected */
  perPress: number
  /** coins a minute: of a bed's growing, of the machine's work, of every animal or plant there is (or one, with none) */
  perMinute: number
  /** seconds it takes now: to ripen, a job at the machine's level, one more good from each animal or plant */
  seconds: number
  /** jobs the store could start now (a recipe's); how many animals or plants there are (a producer's) */
  can?: number
  count?: number
  /** not open yet at the farm's level: the level it opens at */
  locked: number | null
}

/** A good the line and the open orders want now: in all, what the farm has, and what it is short of. */
export interface AskedRow {
  good: ProduceId
  want: number
  have: number
  short: number
}

export interface PlanView {
  /** each list the most a minute first */
  beds: PlanRow[]
  jobs: PlanRow[]
  animals: PlanRow[]
  /** what is asked for, the largest shortage first */
  asked: AskedRow[]
}

const byMinute = (a: PlanRow, b: PlanRow) => b.perMinute - a.perMinute
const lockedAt = (id: UnlockId, level: number, now: MarketNow) => (!now.allOpen && unlockLevel(id) > level ? unlockLevel(id) : null)

export function planView(f: MarketFarm, now: MarketNow): PlanView {
  const level = levelOf(f.xp.points)
  const p = pricesNow(f, now)
  const crops = speedAt('crops', now.at)
  const work = speedAt('machines', now.at)

  const beds = CROPS.map((c): PlanRow => {
    // the yield as a harvest gives it (src/farm/state.ts, yieldOf)
    const yields = Math.round(c.yield * (f.compost ? 1.5 : 1))
    const perPress = yields * p[c.id] - c.seedCost
    const seconds = c.growSeconds / crops
    return { kind: 'bed', id: c.id, makes: c.id, perPress, perMinute: perPress / (seconds / 60), seconds, locked: lockedAt(`crop:${c.id}`, level, now) }
  }).sort(byMinute)

  const jobs = MACHINE_IDS.flatMap((m) => {
    const boost = machineLevel(f.machines[m].worked).boost
    return MACHINES[m].recipes.map((r): PlanRow => {
      const needs = Object.entries(r.needs) as [ProduceId, number][]
      const perPress = p[r.makes] - needs.reduce((n, [good, k]) => n + k * p[good], 0)
      const seconds = jobSeconds(r, boost) / work
      const can = Math.min(...needs.map(([good, k]) => Math.floor((f.inv[good] ?? 0) / k)))
      return { kind: 'job', id: `${m}:${r.id}`, makes: r.makes, machine: m, perPress, perMinute: perPress / (seconds / 60), seconds, can, locked: lockedAt(recipeUnlock(m, r.id), level, now) }
    })
  }).sort(byMinute)

  const animals = PRODUCER_IDS.map((id): PlanRow => {
    const def = PRODUCERS[id]
    // the tree is one; a herd its animals (the hens share a nest that fills as many times as fast as there are hens);
    // a fruit kind its plants standing
    const count = def.herd || def.plant ? f.producers[id].animals : 1
    const perPress = p[def.good]
    return {
      kind: 'animal',
      id,
      makes: def.good,
      perPress,
      perMinute: Math.max(1, count) * perPress * (60 / def.every),
      seconds: def.every,
      count,
      locked: def.plant ? lockedAt(`decor:${def.plant}`, level, now) : null,
    }
  }).sort(byMinute)

  // what is asked for: the buyers on their way or in line, and what the open orders still want
  const want = new Map<ProduceId, number>()
  for (const v of f.visitors) if (v.phase !== 'leaving') want.set(v.want, (want.get(v.want) ?? 0) + v.qty)
  for (const slot of f.orders) if ('order' in slot) for (const l of slot.order.lines) if (l.have < l.want) want.set(l.good, (want.get(l.good) ?? 0) + l.want - l.have)
  const asked = [...want.entries()].map(([good, n]) => ({ good, want: n, have: f.inv[good] ?? 0, short: Math.max(0, n - (f.inv[good] ?? 0)) })).sort((a, b) => b.short - a.short || b.want - a.want)

  return { beds, jobs, animals, asked }
}
