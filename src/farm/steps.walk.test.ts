// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FARM_START } from '../data/maps'
import { groundDistance, registerInteractable } from '../lib/interaction'
import { playerState } from '../lib/playerState'
import { WALK, seeded } from '../sim/play'
import { BEDS, CROPS, GATE_SPOT, MACHINES, MACHINE_IDS, OFFICE_STAND, PRODUCERS, cropById, type CropId, type MachineId, type ProducerId } from './data'
import { FIRST_STEPS, lineFor, orderToFollow, type Line } from './firstSteps'
import { isComplete } from './orders'
import {
  addJob,
  bedBox,
  bedSpot,
  bedStage,
  bedsForSeeds,
  bedsNear,
  bedsToHarvest,
  canAddJob,
  collect,
  collectable,
  collectMachine,
  cropOpen,
  farm,
  fillOrder,
  harvestBeds,
  harvestFits,
  machineCollectable,
  machinePoint,
  orderAt,
  plantBeds,
  quietSteps,
  resetFarm,
  sellAll,
  sendOrder,
  setEventClock,
  setRandom,
  stepNow,
  takePassed,
  tick,
  unlockAll,
  waterBeds,
  yieldOf,
} from './state'
import { walkTarget } from './walkTargets'

// A new farm's first steps followed by a player who does only what the farmer says (src/farm/firstSteps.ts, lineFor):
// a tap on the hint walks to its target (src/farm/walkTargets.ts), and there the action button does what it does now
// (plants a bed — the seeds the line pictures, else the first open —, waters, harvests, collects, takes out or queues
// at a machine, sells to the line, fills or sends the order the last step follows); with nothing to press there, the
// player waits. Played on seeds 1–20 with no event and on each day of the week (the event clock set to it: the market,
// the harvest festival, gift day, the machine rush, the lucky draw), it passes all of the steps, within six minutes of
// play by the sim's walk (src/sim/play.ts, WALK), and no frame leaves the hint with nowhere to go. The places stand
// where they do on a new farm, registered as the scene would (as in walkTargets.test.ts).

/** The farm's clock moves on in steps this long, as in the sim. */
const STEP = 0.25
/** The most play the steps may take, by the sim's walk measure. */
const MOST = 6 * 60

const at = (day: number, hour: number) => new Date(2026, 10, day, hour).getTime()
/** No event, then a day of each weekday (16 November 2026 is a Monday): the event clock set to it. */
const DAYS: [string, number | null][] = [
  ['no event', null],
  ['Monday, market day', at(16, 12)],
  ['Tuesday', at(17, 12)],
  ['Wednesday, the harvest festival', at(18, 12)],
  ['Thursday, gift day', at(19, 12)],
  ['Friday evening, the machine rush', at(20, 17)],
  ['Saturday, the lucky draw', at(21, 12)],
  ['Sunday, market day', at(22, 12)],
]
const SEEDS = Array.from({ length: 20 }, (_, k) => k + 1)

/** A place on the map: where the player walks to for an interactable. */
type Spot = { x: number; z: number }
const off: (() => void)[] = []
const spots = new Map<string, Spot>()
/** Puts a thing on the map as the scene would: its id, where it stands, its footprint, and what it has ready. */
function put(id: string, spot: Spot, ready?: () => { item: string; count: number } | null, box?: { x: number; z: number }) {
  spots.set(id, spot)
  off.push(registerInteractable({ id, label: id, position: { x: spot.x, y: 0, z: spot.z }, box, radius: 1, ready, run: () => {} }))
}

/** Every place of a new farm: its beds, the tree, the nest, each animal, the machines, the gate and the office. */
function putFarm() {
  BEDS.forEach((_, i) => put(`farm-bed-${i}`, bedSpot(i), () => (harvestFits(i) ? { item: farm.beds[i].crop!, count: yieldOf(farm.beds[i].crop!) } : null), bedBox(i)))
  for (const id of Object.keys(PRODUCERS) as ProducerId[]) {
    const p = PRODUCERS[id]
    if (!p.place) continue
    const spot = farm.layout.places[p.place]
    const ready = (k: number) => () => (collectable(id, k) > 0 ? { item: p.good, count: collectable(id, k) } : null)
    if (!p.herd || p.herd.shared) put(p.action, spot, ready(0))
    else for (let k = 0; k < farm.producers[id].animals; k++) put(`${p.action}-${k}`, spot, ready(k))
  }
  for (const id of MACHINE_IDS) put(`farm-${id}`, machinePoint(id, MACHINES[id].stand), () => (machineCollectable(id) > 0 ? { item: 'x', count: 1 } : null))
  put('farm-queue', GATE_SPOT)
  put('farm-office', OFFICE_STAND)
}

/** The seeds the player picks at an empty bed: the crop the line pictures, if it can be sown; else the first open that
 *  the coins pay for. */
function seedsFor(line: Line): CropId | null {
  const item = 'item' in line.pic ? line.pic.item : null
  const pictured = CROPS.find((c) => c.id === item)
  const can = (c: CropId) => cropOpen(c) && farm.coins >= cropById(c).seedCost
  if (pictured && can(pictured.id)) return pictured.id
  return CROPS.find((c) => can(c.id))?.id ?? null
}

/** What the action button at an interactable does now, as the scene's would (a panel it opens: the press the line asks
 *  for there). Whether it did anything. */
function press(id: string, line: Line): boolean {
  const { x, z } = playerState.position
  const bed = /^farm-bed-(\d+)$/.exec(id)
  if (bed) {
    const i = Number(bed[1])
    const stage = bedStage(i)
    if (stage === 'empty') {
      const crop = seedsFor(line)
      return !!crop && plantBeds(bedsForSeeds(i, crop, x, z), crop) > 0
    }
    if (stage === 'thirsty') return waterBeds(bedsNear(i, 'thirsty', x, z)) > 0
    if (stage === 'ripe') return harvestBeds(bedsToHarvest(i, x, z)) > 0
    return false
  }
  for (const pid of Object.keys(PRODUCERS) as ProducerId[]) {
    const p = PRODUCERS[pid]
    if (id === p.action) return collect(pid) > 0
    if (id.startsWith(`${p.action}-`)) return collect(pid, Number(id.slice(p.action.length + 1))) > 0
  }
  const machine = MACHINE_IDS.find((m) => id === `farm-${m}`) as MachineId | undefined
  if (machine) {
    if (machineCollectable(machine) > 0) return collectMachine(machine) > 0
    // its panel: the job the line is about (its picture), else the first one it can take
    const recipes = MACHINES[machine].recipes
    const item = 'item' in line.pic ? line.pic.item : null
    const r = recipes.find((r) => r.makes === item && canAddJob(machine, r)) ?? recipes.find((r) => canAddJob(machine, r))
    return !!r && addJob(machine, r.id)
  }
  if (id === 'farm-queue') return sellAll() > 0
  if (id === 'farm-office') {
    const k = orderToFollow(farm)
    const o = orderAt(k)
    if (!o) return false
    return isComplete(o) ? sendOrder(k) : fillOrder(k) > 0
  }
  return false
}

interface Run {
  seconds: number
  over: boolean
  nowhere: string[]
}

/** A new farm, its steps followed from the first frame on: the seconds of play they took, and every frame whose line
 *  had nowhere to walk to. */
function follow(seed: number, clock: number | null): Run {
  setRandom(seeded(seed))
  Math.random = seeded(seed * 7919 + 13)
  setEventClock(clock)
  resetFarm()
  takePassed()
  putFarm()
  const nowhere: string[] = []
  let t = 0
  const check = () => {
    const step = stepNow()
    if (!step) return
    const line = lineFor(step, farm)
    if (!walkTarget(line.target) && nowhere.length < 5) nowhere.push(`${Math.round(t)} s, ${step.id}: "${line.say}"`)
  }
  const advance = (seconds: number) => {
    for (let left = seconds; left > 1e-9 && t < MOST + 60; left -= STEP) {
      tick(Math.min(STEP, left))
      t += Math.min(STEP, left)
      check()
    }
  }
  playerState.position.x = FARM_START.x
  playerState.position.z = FARM_START.z
  check()
  while (!farm.firstSteps.over && t < MOST + 60) {
    const step = stepNow()!
    const line = lineFor(step, farm)
    const id = walkTarget(line.target)
    if (!id) {
      advance(1)
      continue
    }
    const to = spots.get(id)!
    const { x, z } = playerState.position
    // the walk there (to within reach), as the sim measures it
    const way = Math.max(0, groundDistance(x, z, to, id.startsWith('farm-bed-') ? bedBox(Number(id.slice(9))) : undefined) - 1)
    playerState.position.x = to.x
    playerState.position.z = to.z
    advance((way * WALK.detour) / WALK.speed)
    advance(press(id, line) ? WALK.press : 1)
  }
  return { seconds: t, over: farm.firstSteps.over && farm.firstSteps.step >= FIRST_STEPS.length, nowhere }
}

const random = Math.random
beforeEach(() => {
  localStorage.clear()
  quietSteps(false)
  unlockAll(false)
})
afterEach(() => {
  off.splice(0).forEach((f) => f())
  spots.clear()
  Math.random = random
  setRandom(null)
  setEventClock(null)
  quietSteps(true)
  unlockAll(true)
})

describe('the first steps, followed by a player who does only what the farmer says', () => {
  for (const [day, clock] of DAYS)
    it(`pass all ${FIRST_STEPS.length} within six minutes of play, never with nowhere to go: ${day}`, () => {
      const slow: string[] = []
      for (const seed of SEEDS) {
        const run = follow(seed, clock)
        expect(run.nowhere, `seed ${seed}: the hint with nowhere to go`).toEqual([])
        expect(run.over, `seed ${seed}: on step ${farm.firstSteps.step} (${FIRST_STEPS[farm.firstSteps.step]?.id}) after ${Math.round(run.seconds)} s`).toBe(true)
        if (run.seconds > MOST) slow.push(`seed ${seed}: ${Math.round(run.seconds)} s`)
        off.splice(0).forEach((f) => f())
      }
      expect(slow, 'runs over six minutes of play').toEqual([])
    })
})
