// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultHome, ROOM_WEIGHT, roomWeight, type HomePiece } from '../home/layout'
import { useHome } from '../store'
import {
  buy,
  collect,
  collectMachine,
  currentSlot,
  exportSlot,
  farm,
  importSlot,
  loadMachine,
  machineSecondsLeft,
  machineStage,
  resetFarm,
  saveFarm,
  slotSummary,
  switchSlot,
  tick,
  waiting,
  woolliness,
} from './state'
import { OLD_SAVE, OLD_SAVE_2, justSaved } from './testSaves'

// the save files a player downloads and loads again (src/ui/SavesPanel.tsx)
describe('farm saves', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
  })

  it('refuses what is not a save, with a reason', () => {
    expect(importSlot(2, 'not json')).toEqual({ ok: false, error: 'That file is not a save (it is not JSON).' })
    expect(importSlot(2, JSON.stringify({ kind: 'something else', save: {} }))).toEqual({ ok: false, error: 'That file is not a 3D Home farm save.' })
    expect(importSlot(2, JSON.stringify({ kind: '3d-home-farm-save', save: {} }))).toEqual({ ok: false, error: 'That save is empty.' })
    expect(slotSummary(2).exists).toBe(false)
  })

  it('a farm exported and imported into another slot keeps its coins and its house', () => {
    farm.coins = 1234
    farm.home = { ...farm.home, pieces: farm.home.pieces.map((p) => (p.id === 'pouf' ? { ...p, x: -1.5, z: 1.5 } : p)) }
    const file = exportSlot(1)
    expect(file.name).toMatch(/^3d-home-farm-1-\d{4}-\d\d-\d\d\.json$/)
    expect(importSlot(3, file.text)).toEqual({ ok: true })
    expect(slotSummary(3).coins).toBe(1234)
    const saved = JSON.parse(localStorage.getItem('3d-home:farm:v1:slot3')!)
    expect(saved.home.pieces.find((p: HomePiece) => p.id === 'pouf')).toMatchObject({ x: -1.5, z: 1.5 })
  })

  it('a save from before the room limit loads with what does not fit in storage', () => {
    expect(currentSlot()).toBe(1)
    const plants: HomePiece[] = [
      [-1.5, 1.5],
      [-1.0, 4.5],
      [-6.3, 1.6],
      [-2.0, 4.75],
    ].map(([x, z], i) => ({ id: `plant-tall-${i + 1}`, type: 'plant-tall', x, z, rot: 0 }))
    const file = JSON.parse(exportSlot(1).text)
    file.save.home = { pieces: [...defaultHome().pieces, ...plants], stored: [], next: 5 }
    expect(roomWeight(file.save.home, 'living')).toBeGreaterThan(ROOM_WEIGHT)
    // into the slot being played: the running farm takes it at once
    expect(importSlot(1, JSON.stringify(file))).toEqual({ ok: true })
    expect(roomWeight(farm.home, 'living')).toBeLessThanOrEqual(ROOM_WEIGHT)
    expect(farm.home.pieces.length + farm.home.stored.length).toBe(defaultHome().pieces.length + plants.length)
    expect(farm.home.stored.length).toBeGreaterThan(0)
  })
})

describe('a save from before the tables', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
    // the clock stands still while a save loads: "saved just now" is no time away, however long the loading takes (the
    // hens' clock runs four times as fast: 13 ms of loading was enough to move it past what the tests allow)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.UTC(2026, 10, 10, 12))
  })
  afterEach(() => {
    switchSlot(1)
    vi.useRealTimers()
  })

  it('a file loads with every stock, timer, machine job and count as it was, and is saved again in the new shape', () => {
    expect(importSlot(1, JSON.stringify({ kind: '3d-home-farm-save', version: 1, slot: 1, save: justSaved(OLD_SAVE) }))).toEqual({ ok: true })
    const p = farm.producers
    expect([p.tree.stock, p.hens.stock, p.cows.stock, p.sheep.stock]).toEqual([[5], [4], [2, 0, 3], [1, 2, 0]])
    expect([p.hens.animals, p.cows.animals, p.sheep.animals]).toEqual([4, 3, 3])
    // the clocks ran on for the moment since it was saved (the hens' four times as fast)
    expect(p.tree.timer[0]).toBeCloseTo(12.5, 1)
    expect(p.hens.timer[0]).toBeCloseTo(17.25, 1)
    p.cows.timer.forEach((t, i) => expect(t).toBeCloseTo([10.5, 44, 0.75][i], 1))
    p.sheep.timer.forEach((t, i) => expect(t).toBeCloseTo([30.5, 0, 59][i], 1))
    expect(p.sheep.timer[1]).toBe(0) // a full fleece: its clock held at 0
    expect([machineStage('mill'), machineStage('loom'), machineStage('oven')]).toEqual(['working', 'done', 'done'])
    expect(farm.machines.mill).toMatchObject({ recipe: 'wheat', count: 5, ready: 0 })
    expect(farm.machines.mill.progress).toBeCloseTo(7.5, 1)
    expect(farm.machines.loom).toEqual({ recipe: 'wool', count: 0, progress: 0, ready: 3 })
    expect(farm.machines.oven).toEqual({ recipe: 'strawberry_cake', count: 0, progress: 0, ready: 1 })
    expect([farm.coins, farm.inv.wheat, farm.stats.baked, farm.beds[0].crop, waiting().map((v) => v.name)]).toEqual([321, 2, 2, 'lettuce', ['Omer']])
    // saved again: the new shape, none of the old fields
    saveFarm()
    const saved = JSON.parse(localStorage.getItem('3d-home:farm:v1')!)
    expect(saved.producers).toEqual(JSON.parse(JSON.stringify(farm.producers)))
    expect(saved.machines).toEqual(farm.machines)
    for (const old of ['lemons', 'lemonTimer', 'eggs', 'eggTimer', 'hens', 'cows', 'milk', 'milkTimer', 'sheep', 'wool', 'woolTimer', 'mill', 'oven', 'loom']) expect(saved).not.toHaveProperty(old)
  })

  it("the browser's own save loads the same way: the mill done, the oven baking, the loom at work, the full ones still full", () => {
    localStorage.setItem('3d-home:farm:v1:slot2', JSON.stringify(justSaved(OLD_SAVE_2)))
    expect(slotSummary(2).animals).toBe(6 + 1 + 4)
    switchSlot(2)
    const p = farm.producers
    expect([p.tree.stock, p.hens.stock, p.cows.stock, p.sheep.stock]).toEqual([[8], [6], [0], [2, 2, 1, 0]])
    expect([p.hens.animals, p.cows.animals, p.sheep.animals]).toEqual([6, 1, 4])
    expect([p.sheep.timer[0], p.sheep.timer[1]]).toEqual([0, 0])
    expect(p.sheep.timer[3]).toBeCloseTo(1.5, 1)
    expect(farm.machines.mill).toEqual({ recipe: 'sugarcane', count: 0, progress: 0, ready: 4 })
    expect(farm.machines.oven).toMatchObject({ recipe: 'carrot_cake', count: 1, ready: 0 })
    expect(farm.machines.oven.progress).toBeCloseTo(12.25, 1)
    expect(farm.machines.loom).toMatchObject({ recipe: 'wool', count: 2, ready: 0 })
    expect(farm.machines.loom.progress).toBeCloseTo(5.5, 1)
    expect([machineStage('mill'), machineStage('oven'), machineStage('loom')]).toEqual(['done', 'working', 'working'])
  })
})

describe('what fills up and is collected (PRODUCERS)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
  })

  it('the hens lay as many times as fast as there are of them; collecting the eggs leaves their clock running', () => {
    const nest = farm.producers.hens
    nest.stock[0] = 0
    expect(nest.animals).toBe(2)
    tick(20) // two hens: one egg in 20 s, not 40
    expect(nest.stock[0]).toBe(1)
    tick(15)
    expect(collect('hens')).toBe(1)
    expect(nest.timer[0]).toBe(30) // the clock runs on: the next egg is 5 s away
    tick(5)
    expect(nest.stock[0]).toBe(1)
    expect(farm.inv.egg).toBe(1)
  })

  it('picking the lemons, milking a cow and shearing a sheep start the wait for the next one again', () => {
    tick(20)
    expect([collect('tree'), collect('cows', 0), collect('sheep', 1)]).toEqual([3, 1, 1])
    expect([farm.producers.tree.timer[0], farm.producers.cows.timer[0], farm.producers.sheep.timer[1]]).toEqual([0, 0, 0])
    tick(25) // 25 s on: no lemon (30 s), no milk (45 s), no fleece (60 s) yet
    expect([farm.producers.tree.stock[0], farm.producers.cows.stock[0], farm.producers.sheep.stock[1]]).toEqual([0, 0, 0])
    expect([farm.inv.lemon, farm.inv.milk, farm.inv.wool, farm.stats.harvested]).toEqual([3, 1, 1, 5])
  })

  it('a tree fruits up to its most and no more; a full fleece stops growing, its clock held at 0 until it is shorn', () => {
    tick(150) // five lemons more than three: eight at most
    expect(farm.producers.tree.stock[0]).toBe(8)
    const sheep = farm.producers.sheep
    expect(sheep.stock).toEqual([2, 2])
    expect(sheep.timer).toEqual([0, 0])
    expect(woolliness(0)).toBe(1)
    collect('sheep', 0)
    expect(woolliness(0)).toBe(0)
    tick(30)
    expect(woolliness(0)).toBe(0.25) // half a fleece of two
    tick(90)
    expect(sheep.stock[0]).toBe(2)
    expect(sheep.timer[0]).toBe(0)
  })

  it('another cow comes with no milk yet, and her name; another hen lays into the same nest', () => {
    farm.coins = 1000
    expect(buy('cow')).toBe(true)
    expect(farm.producers.cows).toMatchObject({ animals: 2, stock: [1, 0], timer: [0, 0] })
    expect(useHome.getState().toast?.text).toBe('Mazal joins the herd')
    expect(buy('hen')).toBe(true)
    expect(farm.producers.hens).toMatchObject({ animals: 3, stock: [1], timer: [0] })
    expect(useHome.getState().toast?.text).toBe('Another hen: done')
  })
})

describe('the machines (MACHINES)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetFarm()
  })

  it('the mill takes as much wheat or cane as it has room for, works on it, and gives flour or sugar', () => {
    Object.assign(farm.inv, { wheat: 8, sugarcane: 3 })
    expect(loadMachine('mill', 'wheat')).toBe(6)
    expect(farm.inv.wheat).toBe(2)
    expect(machineSecondsLeft('mill')).toBe(24) // six sheaves, 4 s each
    expect(loadMachine('mill', 'sugarcane')).toBe(0) // busy: nothing more goes in
    tick(23.5)
    expect(machineStage('mill')).toBe('working')
    tick(0.5)
    expect(machineStage('mill')).toBe('done')
    expect(collectMachine('mill')).toBe(6)
    expect(machineStage('mill')).toBe('idle')
    expect(loadMachine('mill', 'sugarcane')).toBe(3)
    tick(12)
    expect(collectMachine('mill')).toBe(3)
    expect([farm.inv.flour, farm.inv.sugar, farm.inv.sugarcane]).toEqual([6, 3, 0])
  })

  it('the loom weaves up to four fleeces at a time into cloth', () => {
    farm.inv.wool = 5
    expect(loadMachine('loom', 'wool')).toBe(4)
    tick(24)
    expect(collectMachine('loom')).toBe(4)
    expect([farm.inv.cloth, farm.inv.wool]).toEqual([4, 1])
  })

  it('the oven bakes a cake only with everything for it, and the farm counts the cakes baked', () => {
    Object.assign(farm.inv, { flour: 1, sugar: 1, egg: 2, milk: 1, lemon: 1 })
    expect(loadMachine('oven', 'lemon_cake')).toBe(0) // a lemon short
    farm.inv.lemon = 2
    expect(loadMachine('oven', 'lemon_cake')).toBe(1)
    expect([farm.inv.flour, farm.inv.sugar, farm.inv.egg, farm.inv.milk, farm.inv.lemon]).toEqual([0, 0, 0, 0, 0])
    tick(30)
    expect(machineStage('oven')).toBe('done')
    expect(collectMachine('oven')).toBe(1)
    expect([farm.inv.lemon_cake, farm.stats.baked]).toEqual([1, 1])
    expect(collectMachine('oven')).toBe(0)
  })

  it('with no coins and nothing on its way a neighbour leaves some for seeds; a machine at work is on its way, the loom too', () => {
    tick(0.1) // with coins: the neighbour may give again
    farm.coins = 0
    farm.inv.wool = 1
    expect(loadMachine('loom', 'wool')).toBe(1)
    tick(0.1)
    expect(farm.coins).toBe(0) // cloth on its way
    tick(6)
    expect(collectMachine('loom')).toBe(1)
    farm.inv.cloth = 0
    tick(0.1)
    expect(farm.coins).toBe(6)
  })
})
