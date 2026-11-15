// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHome } from '../store'
import { XP_FOR } from './data'
import { MACHINE_LEVELS, QUEUE, QUEUE_PRICES, queuePrice } from './machineView'
import { rollShopper } from './market'
import { orderPay } from './orders'
import { priceOf } from './prices'
import {
  addJob,
  awaySummary,
  buySlot,
  cameBack,
  capacity,
  collectMachine,
  fairPrice,
  farm,
  machineActions,
  machineCollectable,
  machineLevelOf,
  machineSecondsLeft,
  machineStage,
  machineView,
  managerPays,
  moveJob,
  removeJob,
  resetFarm,
  setRandom,
  spawnVisitor,
  tick,
} from './state'

// The machines' queues on the farm (src/farm/state.ts, rules in src/farm/machines.ts): a job takes its ingredients as
// it goes in and gives them back if it is taken out while it waits; jobs run one after another in play and while you
// are away; what is done waits in its place until it is collected, as far as the barn has room; places are bought, each
// dearer, up to twelve; and the level from the time a machine has worked gives its jobs more XP, makes them quicker and
// its goods dearer wherever they are sold.

const CAKES = { flour: 3, sugar: 3, egg: 6, milk: 2, lemon: 2, carrot: 3, strawberry: 4 }
/** The level whose minutes of work a machine has, given level n (1 …). */
const workedTo = (n: number) => MACHINE_LEVELS[n - 1].minutes * 60

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(() => 0.99)
})
afterEach(() => {
  setRandom(null)
  vi.restoreAllMocks()
})

describe('the queue in play', () => {
  it('three different cakes in a row: each starts as the one before is done, and one press collects all three', () => {
    Object.assign(farm.inv, CAKES)
    const act = machineActions('oven')
    expect([act.add('lemon_cake'), act.add('carrot_cake'), act.add('strawberry_cake')]).toEqual([true, true, true])
    const states = () => machineView('oven').slots.map((s) => `${s.makes}:${s.state}`)
    expect(states()).toEqual(['lemon_cake:working', 'carrot_cake:waiting', 'strawberry_cake:waiting'])
    expect(machineSecondsLeft('oven')).toBe(30 + 35 + 35)
    tick(31)
    expect(states()).toEqual(['lemon_cake:done', 'carrot_cake:working', 'strawberry_cake:waiting'])
    expect(machineView('oven').slots[1].left).toBeCloseTo(34, 6)
    tick(35)
    expect(states()).toEqual(['lemon_cake:done', 'carrot_cake:done', 'strawberry_cake:working'])
    tick(34)
    expect(machineStage('oven')).toBe('done')
    expect(act.collect()).toBe(3)
    expect(machineView('oven').slots).toEqual([])
    expect([farm.inv.lemon_cake, farm.inv.carrot_cake, farm.inv.strawberry_cake, farm.stats.baked]).toEqual([1, 1, 1, 3])
    expect([farm.got.lemon_cake, farm.got.carrot_cake, farm.got.strawberry_cake]).toEqual([1, 1, 1])
  })

  it('while you are away the queue goes on, job after job, as it would have in play; the card says what was made', () => {
    Object.assign(farm.inv, CAKES)
    for (const cake of ['lemon_cake', 'carrot_cake', 'strawberry_cake']) addJob('oven', cake)
    const start = JSON.stringify(farm.machines)
    const r = cameBack(600)!
    const away = JSON.stringify(farm.machines)
    expect(farm.machines.oven).toMatchObject({ done: 3, worked: 100 })
    expect(r.goods).toEqual(expect.arrayContaining([expect.objectContaining({ item: 'lemon_cake', count: 1 }), expect.objectContaining({ item: 'strawberry_cake', count: 1 })]))
    expect(awaySummary()).toBe(r)
    // the same as frames of five seconds
    farm.machines = JSON.parse(start)
    for (let t = 0; t < 600; t += 5) tick(5)
    expect(JSON.stringify(farm.machines)).toBe(away)
  })

  it('a waiting job comes out with its ingredients (even into a full barn) or moves up; the one under way and the done ones stay', () => {
    Object.assign(farm.inv, CAKES)
    for (const cake of ['lemon_cake', 'carrot_cake', 'strawberry_cake']) addJob('oven', cake)
    tick(31)
    // the barn full of eggs: the carrot cake's two eggs, flour and sugar come back all the same
    farm.inv.egg = capacity('barn')
    expect(removeJob('oven', 0)).toBe(false) // done
    expect(removeJob('oven', 1)).toBe(false) // under way
    expect(moveJob('oven', 2, 1)).toBe(false)
    expect(removeJob('oven', 2)).toBe(true)
    expect([farm.inv.strawberry, farm.inv.flour, farm.inv.sugar, farm.inv.egg, farm.inv.milk]).toEqual([4, 1, 1, capacity('barn') + 2, 1])
    expect(machineView('oven').slots.map((s) => s.recipe)).toEqual(['lemon_cake', 'carrot_cake'])
    // a place free again: a pie goes in at the end and moves up before the one added after it
    Object.assign(farm.inv, { flour: 2, sugar: 2, egg: 3, milk: 2, pumpkin: 1, lemon: 2 })
    farm.machines.oven.capacity = 4
    expect(addJob('oven', 'pumpkin_pie')).toBe(true)
    expect(addJob('oven', 'lemon_cake')).toBe(true)
    expect(moveJob('oven', 3, 2)).toBe(true)
    expect(farm.machines.oven.jobs).toEqual(['lemon_cake', 'carrot_cake', 'lemon_cake', 'pumpkin_pie'])
    expect(addJob('oven', 'lemon_cake')).toBe(false) // four places, four jobs
  })

  it('collecting takes what fits; the rest waits done in its places, and the button collects it once there is room', () => {
    Object.assign(farm.inv, CAKES)
    for (const cake of ['lemon_cake', 'carrot_cake', 'strawberry_cake']) addJob('oven', cake)
    tick(100)
    farm.inv.egg = capacity('barn') - 2
    expect(machineCollectable('oven')).toBe(2)
    expect(collectMachine('oven')).toBe(2)
    expect(useHome.getState().toast?.text).toBe('+ 1 lemon cake, 1 carrot cake · the barn is full')
    expect(farm.machines.oven).toMatchObject({ jobs: ['strawberry_cake'], done: 1 })
    expect(collectMachine('oven')).toBe(0)
    expect(useHome.getState().toast?.text).toBe('The barn is full')
    farm.inv.egg = 0
    expect(collectMachine('oven')).toBe(1)
    expect(farm.machines.oven.jobs).toEqual([])
  })
})

describe("a queue's places", () => {
  it('three to start; each place more costs its price, dearer the nearer to twelve, and none past twelve', () => {
    farm.coins = 100_000
    expect(machineView('loom').upgrade).toEqual({ capacity: 4, price: queuePrice(4) })
    let spent = 0
    for (let c = QUEUE.start + 1; c <= QUEUE.max; c++) {
      const before = farm.coins
      const xp = farm.xp.points
      expect(buySlot('loom')).toBe(true)
      expect([before - farm.coins, farm.machines.loom.capacity, farm.xp.points - xp]).toEqual([QUEUE_PRICES[c], c, XP_FOR.build])
      spent += before - farm.coins
    }
    expect(spent).toBe(Object.values(QUEUE_PRICES).reduce((a, b) => a + b, 0))
    expect(buySlot('loom')).toBe(false)
    expect(machineView('loom').upgrade).toBeNull()
    // each machine its own
    expect(farm.machines.mill.capacity).toBe(QUEUE.start)
  })

  it('not without its price', () => {
    farm.coins = queuePrice(4)! - 1
    expect(buySlot('mill')).toBe(false)
    expect([farm.coins, farm.machines.mill.capacity]).toEqual([queuePrice(4)! - 1, 3])
  })
})

describe("a machine's level", () => {
  it('counts only the time it works; level 2 after six hours of work, told once', () => {
    const texts: string[] = []
    const off = useHome.subscribe((s, prev) => {
      if (s.toast && s.toast !== prev.toast) texts.push(s.toast.text)
    })
    tick(600)
    expect(farm.machines.oven.worked).toBe(0)
    farm.machines.oven.worked = workedTo(2) - 10
    Object.assign(farm.inv, CAKES)
    addJob('oven', 'lemon_cake')
    addJob('oven', 'carrot_cake')
    tick(20)
    expect(machineLevelOf('oven')).toMatchObject({ n: 2, boost: MACHINE_LEVELS[1].boost })
    tick(60)
    off()
    expect(texts.filter((t) => t.startsWith('Oven: level'))).toEqual(['Oven: level 2 · +20% XP, +20% coins'])
    expect(farm.machines.oven.worked).toBe(workedTo(2) - 10 + 30 + 35)
  })

  it('its jobs give more XP as they are collected: a fifth more at level 2, never lost to rounding', () => {
    Object.assign(farm.inv, CAKES)
    const collectThree = () => {
      for (const cake of ['lemon_cake', 'carrot_cake', 'strawberry_cake']) addJob('oven', cake)
      tick(100)
      const xp = farm.xp.points
      collectMachine('oven')
      return farm.xp.points - xp
    }
    expect(collectThree()).toBe(3 * XP_FOR.make)
    Object.assign(farm.inv, CAKES)
    farm.machines.oven.worked = workedTo(2)
    expect(collectThree()).toBe(Math.ceil(3 * XP_FOR.make * 1.2))
    // one at a time: 2.4 is 3
    Object.assign(farm.inv, CAKES)
    addJob('oven', 'lemon_cake')
    tick(30)
    const xp = farm.xp.points
    collectMachine('oven')
    expect(farm.xp.points - xp).toBe(3)
  })

  it('at level 3 its jobs take 5 % less time', () => {
    farm.machines.mill.worked = workedTo(3)
    farm.inv.wheat = 1
    addJob('mill', 'wheat')
    expect(machineSecondsLeft('mill')).toBeCloseTo(4 * 0.95, 9)
    expect(machineView('mill').recipes.map((r) => r.seconds)).toEqual([4 * 0.95, 4 * 0.95])
  })

  it('what it makes sells for a fifth more at level 2 wherever it is sold — buyers, orders, the manager, the shelves — and nothing else does', () => {
    const before = { cake: priceOf('lemon_cake'), flour: priceOf('flour'), lettuce: priceOf('lettuce') }
    expect(before).toEqual({ cake: 42, flour: 4, lettuce: 3 })
    farm.machines.oven.worked = workedTo(2)
    expect(priceOf('lemon_cake')).toBeCloseTo(42 * 1.2, 9)
    expect([priceOf('flour'), priceOf('lettuce')]).toEqual([4, 3])
    // a buyer's fair offer, an order's pay, the manager's pay, a unit on the shelf
    expect(fairPrice('lemon_cake', 2)).toBe(Math.round(42 * 1.2 * 2))
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // a fair buyer: neither cheeky nor generous
    expect(spawnVisitor({ want: 'lemon_cake', qty: 1 }).offer).toBe(Math.round(42 * 1.2))
    expect(orderPay([{ good: 'lemon_cake', want: 2 }])).toBe(Math.round(42 * 1.2 * 2 * 1.25))
    farm.inv.lemon_cake = 1
    expect(managerPays('lemon_cake')).toBe(Math.floor(42 * 1.2 * 0.2))
    expect(rollShopper([{ good: 'lemon_cake', units: 1, pct: 100 }], 1, () => 0).coins).toBe(Math.round(42 * 1.2))
  })
})

describe("the machine's panel, as data", () => {
  it('a view of its level, queue, recipes and next place; the same actions every time', () => {
    farm.inv.wool = 1
    const view = machineView('loom')
    expect(view).toMatchObject({ id: 'loom', name: 'Loom', capacity: 3, slots: [], upgrade: { capacity: 4, price: queuePrice(4) } })
    expect(view.level).toMatchObject({ n: 1, minutes: 0, next: MACHINE_LEVELS[1].minutes, progress: 0 })
    expect(view.recipes).toEqual([{ id: 'wool', makes: 'cloth', needs: { wool: 1 }, have: { wool: 1 }, seconds: 6, can: true }])
    expect(machineActions('loom')).toBe(machineActions('loom'))
    expect(machineActions('loom').add('wool')).toBe(true)
    expect(machineView('loom').recipes[0]).toMatchObject({ have: { wool: 0 }, can: false })
    expect(machineView('loom').slots).toEqual([{ recipe: 'wool', makes: 'cloth', state: 'working', seconds: 6, left: 6 }])
  })
})
