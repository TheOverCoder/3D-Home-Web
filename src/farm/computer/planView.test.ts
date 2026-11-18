import { describe, expect, it } from 'vitest'
import { PRODUCE, type ProduceId } from '../data'
import { planView, type PlanRow } from './planView'
import { FRIDAY_EVENING, WEDNESDAY, buyer, farmOf, nowAt, order } from './testFarms'

// What the computer's Planner shows (./planView.ts): what a bed, a job and an animal bring, at today's prices and
// speeds, and what is asked for now. The numbers are today's tables' (src/farm/data.ts): a change there moves them.

const OFF = nowAt(null)
const rounded = (rows: PlanRow[], key: 'perMinute' | 'perPress' | 'seconds') => rows.map((r) => [r.id, Math.round(r[key] * 100) / 100])

describe('a new farm, the events off', () => {
  const v = planView(farmOf(), OFF)

  it('ranks the beds by coins a minute of growing, each a harvest less its seeds', () => {
    expect(rounded(v.beds, 'perMinute')).toEqual([
      ['lettuce', 13.33],
      ['tomato', 9.5],
      ['carrot', 8.57],
      ['strawberry', 8],
      ['corn', 7.6],
      ['pumpkin', 7.2],
      ['wheat', 6],
      ['sugarcane', 3.43],
    ])
    expect(rounded(v.beds, 'perPress').map(([, n]) => n)).toEqual([10, 19, 10, 12, 19, 24, 8, 8])
  })

  it("ranks the jobs by what they add to their ingredients a minute of the machine's work", () => {
    expect(rounded(v.jobs, 'perMinute')).toEqual([
      ['loom:wool', 100],
      ['mill:sugarcane', 45],
      ['oven:lemon_cake', 42],
      ['oven:strawberry_cake', 39.43],
      ['oven:carrot_cake', 36],
      ['mill:wheat', 30],
      ['oven:pumpkin_pie', 28.5],
    ])
    expect(rounded(v.jobs, 'perPress').map(([, n]) => n)).toEqual([10, 3, 21, 23, 21, 2, 19])
    expect(v.jobs.every((r) => r.can === 0)).toBe(true)
  })

  it('gives each herd and plant what it brings a minute, all of it (one plant where none stands yet)', () => {
    const at = (id: string) => v.animals.find((r) => r.id === id)!
    expect(v.animals[0].id).toBe('sheep')
    expect([at('sheep').perMinute, at('sheep').count]).toEqual([10, 2])
    expect([at('hens').perMinute, at('cows').perMinute, at('tree').perMinute]).toEqual([6, 4 * (60 / 45), 4])
    expect([at('apple-tree').count, at('apple-tree').perMinute, at('apple-tree').locked]).toEqual([0, 6, 11])
    expect(at('hens').locked).toBeNull()
  })

  it('locks what the level has not opened yet', () => {
    expect(v.beds.find((r) => r.id === 'pumpkin')!.locked).toBe(10)
    expect(['loom:wool', 'mill:wheat', 'oven:pumpkin_pie'].map((id) => v.jobs.find((r) => r.id === id)!.locked)).toEqual([null, 2, 10])
    expect([...planView(farmOf(), { ...OFF, allOpen: true }).beds, ...planView(farmOf(), { ...OFF, allOpen: true }).jobs].every((r) => r.locked === null)).toBe(true)
  })
})

describe('what changes it', () => {
  it('compost: half as much again from every harvest, rounded as a harvest is', () => {
    const v = planView(farmOf({ compost: true }), OFF)
    expect(['lettuce', 'carrot', 'corn', 'pumpkin'].map((id) => v.beds.find((r) => r.id === id)!.perPress)).toEqual([16, 16, 31, 40])
  })

  it("the harvest festival halves a crop's time, and the machine rush a job's", () => {
    const wednesday = planView(farmOf(), nowAt(WEDNESDAY))
    expect([wednesday.beds[0].id, wednesday.beds[0].seconds, Math.round(wednesday.beds[0].perMinute * 100) / 100]).toEqual(['lettuce', 22.5, 26.67])
    expect(wednesday.jobs[0].seconds).toBe(6)
    const friday = planView(farmOf(), nowAt(FRIDAY_EVENING))
    expect([friday.jobs[0].id, friday.jobs[0].seconds, Math.round(friday.jobs[0].perMinute * 100) / 100]).toEqual(['loom:wool', 3, 200])
    expect(friday.beds.find((r) => r.id === 'lettuce')!.seconds).toBe(45)
  })

  it("a machine's level: its goods dearer and its jobs quicker; and how many the store could start now", () => {
    const f = farmOf({ machines: { ...farmOf().machines, oven: { ...farmOf().machines.oven, worked: 1080 * 60 } } })
    f.inv = { ...f.inv, flour: 2, sugar: 1, egg: 4, milk: 3, lemon: 10 }
    const cake = planView(f, OFF).jobs.find((r) => r.id === 'oven:lemon_cake')!
    // 42 × 1.4 for the cake, its ingredients as they were (21); 30 s less 5 %
    expect(cake.perPress).toBeCloseTo(42 * 1.4 - 21)
    expect(cake.seconds).toBeCloseTo(28.5)
    expect(cake.can).toBe(1)
    expect(planView(f, OFF).jobs.find((r) => r.id === 'oven:strawberry_cake')!.can).toBe(0)
  })
})

describe('what is asked for', () => {
  it('adds the line (but whoever is going home) to what the open orders still want, the largest shortage first', () => {
    const f = farmOf({
      visitors: [buyer('tomato', 3, 12), buyer('egg', 2, 3, 'arriving'), buyer('milk', 1, 4, 'leaving')],
      orders: [order(30, ['tomato', 4, 1], ['egg', 2, 0], ['cloth', 1, 1]), { wait: 60 }],
    })
    f.inv = { ...(Object.fromEntries(PRODUCE.map((p) => [p.id, 0])) as Record<ProduceId, number>), tomato: 2, egg: 5 }
    expect(planView(f, OFF).asked).toEqual([
      { good: 'tomato', want: 6, have: 2, short: 4 },
      { good: 'egg', want: 4, have: 5, short: 0 },
    ])
  })
})
