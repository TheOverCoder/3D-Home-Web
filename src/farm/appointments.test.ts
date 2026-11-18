// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { appointments, busyWords, farmBusy, worthWithin } from './appointments'
import { BEDS, MACHINE_IDS, MACHINES, cropById, type MachineId } from './data'
import { cropNet, jobAdds } from './economy'
import { addJob, farm, plant, resetFarm, tick } from './state'

// What the farm has on its way, and when (./appointments.ts): beds growing, animals filling, jobs in a queue, orders
// coming; the farm busy once every bed it owns is sown and every open machine is at work.

/** The beds the farm owns now. */
const owned = () => farm.beds.flatMap((b, i) => (b.built && (!BEDS[i].expansion || farm.expansions[BEDS[i].expansion!]) ? [i] : []))

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  farm.coins = 10_000
})

describe('appointments', () => {
  it('lists what is on its way, the soonest first, with what it is worth net', () => {
    farm.sprinkler = true
    const [a, b] = owned()
    plant(a, 'lettuce')
    plant(b, 'carrot')
    const list = appointments(farm)
    const beds = list.filter((x) => x.from === 'bed')
    expect(beds.map((x) => x.what)).toEqual([{ item: 'lettuce' }, { item: 'carrot' }])
    expect(beds[0].ready).toBeCloseTo(cropById('lettuce').growSeconds, 6)
    expect(beds[0].worth).toBeCloseTo(cropNet(cropById('lettuce')), 6)
    for (let k = 1; k < list.length; k++) expect(list[k].ready).toBeGreaterThanOrEqual(list[k - 1].ready)
    tick(10)
    expect(appointments(farm).find((x) => x.from === 'bed')!.ready).toBeCloseTo(cropById('lettuce').growSeconds - 10, 6)
  })

  it('leaves out a bed that will run dry before it ripens, and what is ready already', () => {
    const [a] = owned()
    plant(a, 'pumpkin')
    // seeds go in with water for a share of the growing time: without sprinklers it will need watering
    expect(appointments(farm).some((x) => x.from === 'bed')).toBe(false)
    farm.sprinkler = true
    expect(appointments(farm).some((x) => x.from === 'bed')).toBe(true)
    farm.beds[a].growth = cropById('pumpkin').growSeconds
    expect(appointments(farm).some((x) => x.from === 'bed')).toBe(false)
  })

  it('counts each job of a machine’s queue as it will be done, one after another', () => {
    farm.inv.wool = 3
    expect(addJob('loom', 'wool')).toBe(true)
    expect(addJob('loom', 'wool')).toBe(true)
    const jobs = appointments(farm).filter((x) => x.from === 'machine')
    const r = MACHINES.loom.recipes[0]
    expect(jobs.map((x) => Math.round(x.ready))).toEqual([r.seconds, 2 * r.seconds])
    expect(jobs[0].worth).toBeCloseTo(jobAdds(r), 6)
  })

  it('a producer is on its way until it is full, and what it gives by a moment counts within it', () => {
    const hens = appointments(farm).find((x) => 'item' in x.what && x.what.item === 'egg')
    expect(hens).toBeDefined()
    expect(worthWithin(farm, hens!.ready)).toBeGreaterThanOrEqual(hens!.worth)
    expect(worthWithin(farm, 0)).toBe(0)
  })
})

describe('the farm busy', () => {
  it('once every bed it owns is sown and every open machine is at work', () => {
    const open = (id: MachineId) => id === 'loom'
    expect(farmBusy(farm, open)).toBe(false)
    for (const i of owned()) plant(i, 'lettuce')
    expect(farmBusy(farm, open)).toBe(false)
    farm.inv.wool = 1
    addJob('loom', 'wool')
    expect(farmBusy(farm, open)).toBe(true)
    // a machine not open asks nothing; one open and idle keeps the farm from being busy
    expect(farmBusy(farm, () => false)).toBe(true)
    expect(farmBusy(farm, (id) => MACHINE_IDS.includes(id))).toBe(false)
  })

  it('says how long, on the device’s clock: the soonest and the longest', () => {
    farm.sprinkler = true
    const [a, b] = owned()
    plant(a, 'lettuce')
    plant(b, 'pumpkin')
    const now = new Date(2026, 10, 18, 21, 0).getTime()
    const w = busyWords(farm, now, undefined, 'en-GB')!
    expect(w.soonest.what).toEqual({ item: 'lettuce' })
    expect(w.longest.ready).toBeGreaterThanOrEqual(cropById('pumpkin').growSeconds - 1e-6)
    expect(w.title).toMatch(/^Busy till \d\d:\d\d$/)
    resetFarm()
    for (const p of Object.values(farm.producers)) p.stock = p.stock.map(() => 99)
    expect(busyWords(farm, now)).toBeNull()
  })
})
