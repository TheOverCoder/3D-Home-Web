// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { filmAsked, takeFilm } from '../film/films'
import { LADDERS, LADDER_IDS, PRODUCERS, PRODUCER_IDS, REMOTE_PRICE, TOOL, TOOL_KINDS, XP_FOR, mostAnimals, toolLadder, type LadderId, type ToolKind } from './data'
import {
  animals,
  buy,
  buyLadder,
  cameBack,
  capacity,
  collect,
  eggsShown,
  farm,
  freezeDay,
  ladderNextPrice,
  ladderOpen,
  maxOf,
  owned,
  perTap,
  resetFarm,
  room,
  setRandom,
  tick,
  toolOwned,
  toolTake,
  toolView,
  used,
} from './state'
import { levelPay, savedNow, startFrom } from './testSaves'

// The animals' tools on the farm (plans/animal-tools.md; their rows in src/farm/data.ts, their pure rules in
// src/farm/tools.ts): bought in the farm shop once their herd is full, their two ladders once the tool is yours, the
// two premium remotes for their price (the animals' after a tool); each step a `build`'s XP, and no film from the farm's
// own buy (the card asks for it). A tool changes how you take and how much waits, never what you get: a tap takes one
// (more with its ladder) under the barn's rule, each good as collecting gives it; the coop gives each hen a nest of her
// own and her eggs come when they would have; the "holds" ladder lets more wait. All of it in `farm.ladders` and the
// producers' own counts: a save keeps it, and a save from before loads as today.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.99)
  takeFilm()
})
afterEach(() => {
  freezeDay(false)
  setRandom(null)
})

const HERD_UPGRADE: Record<ToolKind, 'hen' | 'cow' | 'sheep'> = { hens: 'hen', cows: 'cow', sheep: 'sheep' }
/** A herd bought to its most. */
function fillHerd(kind: ToolKind) {
  farm.coins += 100_000
  while (!owned(HERD_UPGRADE[kind])) expect(buy(HERD_UPGRADE[kind])).toBe(true)
  expect(animals(kind)).toBe(mostAnimals(kind))
}
/** A tool bought (its herd filled first). */
function ownTool(kind: ToolKind) {
  fillHerd(kind)
  expect(buyLadder(toolLadder(kind, 'tool'))).toBe(true)
}
const shopRows = LADDER_IDS.filter((id) => LADDERS[id].at === 'shop')

describe('buying a tool', () => {
  it('a new farm: no tool, no upgrade of one and no animals’ remote can be bought; the machines’ remote can, for its price', () => {
    farm.coins = 1_000_000
    expect(shopRows.filter((id) => ladderOpen(id))).toEqual(['machine-remote'])
    for (const id of shopRows) if (id !== 'machine-remote') expect(buyLadder(id), id).toBe(false)
    expect(farm.coins).toBe(1_000_000)
    expect(TOOL_KINDS.map((k) => farm.ladders[toolLadder(k, 'tool')])).toEqual([0, 0, 0])
  })

  it.each(TOOL_KINDS)('the %s’ tool opens only with the herd full, and its two ladders only with the tool', (kind) => {
    farm.coins = 1_000_000
    // one short of the herd
    while (animals(kind) < mostAnimals(kind) - 1) expect(buy(HERD_UPGRADE[kind])).toBe(true)
    expect(ladderOpen(toolLadder(kind, 'tool'))).toBe(false)
    expect(buyLadder(toolLadder(kind, 'tool'))).toBe(false)
    fillHerd(kind)
    expect([ladderOpen(toolLadder(kind, 'tool')), ladderOpen(toolLadder(kind, 'hold')), ladderOpen(toolLadder(kind, 'tap'))]).toEqual([true, false, false])
    expect(buyLadder(toolLadder(kind, 'hold'))).toBe(false)
    expect(buyLadder(toolLadder(kind, 'tool'))).toBe(true)
    // once: the tool is yours, its ladders open
    expect([ladderOpen(toolLadder(kind, 'tool')), buyLadder(toolLadder(kind, 'tool'))]).toEqual([false, false])
    expect([ladderOpen(toolLadder(kind, 'hold')), ladderOpen(toolLadder(kind, 'tap'))]).toEqual([true, true])
    // the other kinds' tools still wait for their herds
    for (const other of TOOL_KINDS) if (other !== kind) expect(ladderOpen(toolLadder(other, 'tool')), other).toBe(false)
  })

  it('a tool and every step of its ladders: the price each, the XP of a build each, no film', () => {
    fillHerd('cows')
    for (const part of ['tool', 'hold', 'tap'] as const) {
      const id = toolLadder('cows', part)
      for (let k = 0; k < LADDERS[id].levels; k++) {
        const price = ladderNextPrice(id)
        const [coins, xp, paid] = [farm.coins, farm.xp.points, farm.xp.paid]
        expect(buyLadder(id), `${id} step ${k}`).toBe(true)
        expect(farm.coins).toBe(coins - price + levelPay(paid))
        expect(farm.xp.points - xp).toBe(XP_FOR.build)
        expect(farm.ladders[id]).toBe(k + 1)
      }
      expect([ladderOpen(id), buyLadder(id)]).toEqual([false, false])
    }
    expect(farm.ladders['cows-hold']).toBe(TOOL.hold.to - TOOL.hold.from)
    expect(farm.ladders['cows-tap']).toBe(TOOL.tap.to - TOOL.tap.from)
    expect(filmAsked()).toBeNull()
  })

  it('too few coins: nothing bought, nothing spent', () => {
    fillHerd('sheep')
    farm.coins = TOOL.price - 1
    expect(buyLadder('sheep-tool')).toBe(false)
    expect([farm.coins, farm.ladders['sheep-tool']]).toEqual([TOOL.price - 1, 0])
  })
})

describe('the remotes', () => {
  it('the machines’ remote: its price alone, once', () => {
    farm.coins = REMOTE_PRICE - 1
    expect(buyLadder('machine-remote')).toBe(false)
    farm.coins = REMOTE_PRICE
    const paid = farm.xp.paid
    expect(buyLadder('machine-remote')).toBe(true)
    expect(farm.coins).toBe(levelPay(paid))
    expect([ladderOpen('machine-remote'), buyLadder('machine-remote')]).toEqual([false, false])
  })

  it('the animals’ remote: only once a tool is yours (any one)', () => {
    farm.coins = 1_000_000
    for (const kind of TOOL_KINDS) fillHerd(kind)
    expect([ladderOpen('animal-remote'), buyLadder('animal-remote')]).toEqual([false, false])
    expect(buyLadder('sheep-tool')).toBe(true)
    expect(ladderOpen('animal-remote')).toBe(true)
    const coins = farm.coins
    const paid = farm.xp.paid
    expect(buyLadder('animal-remote')).toBe(true)
    expect(farm.coins).toBe(coins - REMOTE_PRICE + levelPay(paid))
  })
})

describe('the ladders from before', () => {
  it('open as they always did: the manager’s rate on a new farm, the shop’s own not before the shop is yours', () => {
    const before: LadderId[] = ['rate', 'places', 'group', 'pace']
    expect(before.map((id) => ladderOpen(id))).toEqual([true, false, false, false])
    ownTool('hens')
    expect(before.map((id) => ladderOpen(id))).toEqual([true, false, false, false])
    expect(TOOL_KINDS.map((k) => farm.ladders[toolLadder(k, 'tool')])).toEqual([1, 0, 0])
  })
})

/** The farm loaded again from a save, with no time away (the clock read nothing in between). */
function reload(save: Record<string, unknown>) {
  startFrom({ ...save, time: undefined })
}
/** The farm's barn left with `n` places of room (filled with planks, which nothing here takes). */
function barnRoom(n: number) {
  farm.inv.plank += Math.max(0, capacity('barn') - used('barn') - n)
  expect(room('barn')).toBe(n)
}
/** What taking changes: the XP, the goods in the barn and got, what was harvested, the surprises found. */
const counts = () => ({ xp: farm.xp.points, milk: farm.inv.milk, gotMilk: farm.got.milk, harvested: farm.stats.harvested, bricks: farm.inv.brick, gotBricks: farm.got.brick })
const minus = (a: ReturnType<typeof counts>, b: ReturnType<typeof counts>) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v - b[k as keyof typeof b]]))

describe('a farm without a tool', () => {
  it('plays as today: each place holds its own most, the hens one nest, and no tap takes anything', () => {
    for (const id of PRODUCER_IDS) expect([maxOf(id), toolOwned(id)], id).toEqual([PRODUCERS[id].max, null])
    fillHerd('hens')
    expect(farm.producers.hens.stock.length).toBe(1)
    farm.producers.cows.stock = [3]
    expect([toolTake('cows'), toolTake('cows', 0), farm.producers.cows.stock[0]]).toEqual([0, 0, 3])
    // and they fill up to their own most, no further
    fillHerd('sheep')
    tick(PRODUCERS.sheep.every * 5)
    expect(farm.producers.sheep.stock).toEqual([2, 2, 2, 2])
  })
})

describe('the coop: a nest a hen', () => {
  it('as it is bought, the nest is split: every egg kept, and the next eggs come when they would have', () => {
    fillHerd('hens')
    const { every } = PRODUCERS.hens
    farm.producers.hens.stock = [4]
    farm.producers.hens.timer = [13]
    expect(buyLadder('hens-tool')).toBe(true)
    const p = farm.producers.hens
    expect([p.stock.length, p.timer.length, p.stock.reduce((a, b) => a + b, 0)]).toEqual([6, 6, 4])
    expect(p.stock).toEqual([1, 1, 1, 1, 0, 0])
    // the shared nest's next eggs: at (every − 13 + k · every) / 6 s; just before and just after the fourth
    const fourth = (every - 13 + 3 * every) / 6
    tick(fourth - 0.01)
    expect(p.stock.reduce((a, b) => a + b, 0)).toBe(4 + 3)
    tick(0.02)
    expect(p.stock).toEqual([2, 2, 2, 2, 0, 0])
    expect(eggsShown()).toBe(6)
  })

  it('each nest holds 3, more with its ladder; the box shows up to its six, summed', () => {
    ownTool('hens')
    tick(PRODUCERS.hens.every * 20)
    expect(farm.producers.hens.stock).toEqual([3, 3, 3, 3, 3, 3])
    expect([maxOf('hens'), eggsShown()]).toEqual([3, 6])
    expect(buyLadder('hens-hold')).toBe(true)
    tick(PRODUCERS.hens.every)
    expect(farm.producers.hens.stock).toEqual([4, 4, 4, 4, 4, 4])
  })

  it('no animal is added past the herd: the coop needs it full', () => {
    ownTool('hens')
    expect(buy('hen')).toBe(false)
    expect(farm.producers.hens.stock.length).toBe(6)
  })
})

describe('a tap', () => {
  it('takes one from the fullest (ties: the first), or from the place tapped; more with its ladder', () => {
    ownTool('cows')
    farm.producers.cows.stock = [2, 3, 3]
    expect(toolTake('cows')).toBe(1)
    expect(farm.producers.cows.stock).toEqual([2, 2, 3])
    expect(toolTake('cows', 0)).toBe(1)
    expect(farm.producers.cows.stock).toEqual([1, 2, 3])
    expect(buyLadder('cows-tap')).toBe(true)
    expect(perTap('cows')).toBe(2)
    expect(toolTake('cows')).toBe(2)
    expect(toolTake('cows', 0)).toBe(1)
    expect(farm.producers.cows.stock).toEqual([0, 2, 1])
  })

  it('takes min(a tap, what waits, the room in the barn): what does not fit stays on the animal, nothing lost', () => {
    ownTool('sheep')
    for (let k = 0; k < 3; k++) expect(buyLadder('sheep-tap')).toBe(true)
    expect(perTap('sheep')).toBe(4)
    farm.producers.sheep.stock = [3, 0, 1, 2]
    barnRoom(2)
    const wool = farm.inv.wool
    expect(toolTake('sheep')).toBe(2)
    expect([farm.producers.sheep.stock, farm.inv.wool - wool]).toEqual([[1, 0, 1, 2], 2])
    // the barn full: nothing taken, nothing lost, no XP
    const xp = farm.xp.points
    expect([toolTake('sheep'), toolTake('sheep', 3)]).toEqual([0, 0])
    expect([farm.producers.sheep.stock, farm.inv.wool - wool, farm.xp.points]).toEqual([[1, 0, 1, 2], 2, xp])
  })

  it('an empty place, a place that is not there: 0, nothing given', () => {
    ownTool('cows')
    farm.producers.cows.stock = [0, 2, 0]
    const before = counts()
    expect([toolTake('cows', 0), toolTake('cows', 3), toolTake('cows', -1), toolTake('cows', 0.5)]).toEqual([0, 0, 0, 0])
    expect(minus(counts(), before)).toEqual({ xp: 0, milk: 0, gotMilk: 0, harvested: 0, bricks: 0, gotBricks: 0 })
  })

  it('each good as collecting one by one gives it: the XP, what the farm has got, the surprises (the same dice)', () => {
    // collected by hand, without a tool: three bottles from one cow, every roll a surprise
    setRandom(() => 0)
    farm.producers.cows.stock = [3]
    let before = counts()
    expect(collect('cows', 0)).toBe(3)
    const byHand = minus(counts(), before)
    // the same three a tap at a time with the bucket
    resetFarm()
    setRandom(() => 0.99)
    ownTool('cows')
    setRandom(() => 0)
    farm.producers.cows.stock = [3, 0, 0]
    before = counts()
    expect([toolTake('cows'), toolTake('cows'), toolTake('cows'), toolTake('cows')]).toEqual([1, 1, 1, 0])
    expect(minus(counts(), before)).toEqual(byHand)
    expect(byHand).toEqual({ xp: 3 * XP_FOR.collect, milk: 3, gotMilk: 3, harvested: 3, bricks: 3, gotBricks: 3 })
  })

  it('a cow emptied starts her wait again; the hens lay on', () => {
    ownTool('cows')
    farm.producers.cows.stock = [1, 0, 0]
    farm.producers.cows.timer = [20, 0, 0]
    expect(toolTake('cows', 0)).toBe(1)
    expect(farm.producers.cows.timer[0]).toBe(0)
    ownTool('hens')
    farm.producers.hens.stock = [1, 0, 0, 0, 0, 0]
    farm.producers.hens.timer = [20, 0, 0, 0, 0, 0]
    expect(toolTake('hens', 0)).toBe(1)
    expect(farm.producers.hens.timer[0]).toBe(20)
  })
})

describe('how much waits', () => {
  it('the "holds" ladder lets each place fill to its new most, in play and while away', () => {
    ownTool('cows')
    ownTool('sheep')
    tick(PRODUCERS.sheep.every * 10)
    expect([farm.producers.cows.stock, farm.producers.sheep.stock]).toEqual([
      [3, 3, 3],
      [3, 3, 3, 3],
    ])
    expect(buyLadder('cows-hold')).toBe(true)
    expect(buyLadder('sheep-hold')).toBe(true)
    tick(PRODUCERS.sheep.every)
    expect([farm.producers.cows.stock, farm.producers.sheep.stock]).toEqual([
      [4, 4, 4],
      [4, 4, 4, 4],
    ])
    for (let k = 1; k < LADDERS['sheep-hold'].levels; k++) expect(buyLadder('sheep-hold')).toBe(true)
    cameBack(PRODUCERS.sheep.every * 8)
    expect([maxOf('sheep'), farm.producers.sheep.stock]).toEqual([10, [10, 10, 10, 10]])
  })

  it('nothing comes faster: a herd lays, gives milk or grows wool at the same rate with or without its tool', () => {
    const laid = (seconds: number) => {
      const before = farm.producers.hens.stock.reduce((a, b) => a + b, 0)
      tick(seconds)
      return farm.producers.hens.stock.reduce((a, b) => a + b, 0) - before
    }
    fillHerd('hens')
    farm.producers.hens.stock = [0]
    farm.producers.hens.timer = [0]
    const without = laid(30)
    farm.producers.hens.stock = [0]
    farm.producers.hens.timer = [0]
    expect(buyLadder('hens-tool')).toBe(true)
    expect(laid(30)).toBe(without)
  })
})

describe('the save', () => {
  it('keeps the tools, their steps and a nest a hen, with their clocks', () => {
    ownTool('hens')
    ownTool('sheep')
    for (let k = 0; k < 4; k++) buyLadder('hens-hold')
    buyLadder('sheep-tap')
    farm.producers.hens.stock = [7, 0, 2, 5, 1, 0]
    farm.producers.hens.timer = [3, 0, 39, 12.5, 7, 21]
    const ladders = { ...farm.ladders }
    reload(savedNow())
    expect(farm.ladders).toEqual(ladders)
    expect(farm.producers.hens).toEqual({ animals: 6, stock: [7, 0, 2, 5, 1, 0], timer: [3, 0, 39, 12.5, 7, 21] })
    expect([maxOf('hens'), perTap('sheep'), toolOwned('cows')]).toEqual([7, 2, null])
  })

  it('a saved coop past the row’s most keeps it; past its own, it is cut to it', () => {
    ownTool('hens')
    for (let k = 0; k < 2; k++) buyLadder('hens-hold')
    const save = savedNow() as { producers: Record<string, { stock: number[] }> }
    save.producers.hens.stock = [5, 5, 9, 0, 0, 0]
    reload(save)
    expect([PRODUCERS.hens.max, maxOf('hens')]).toEqual([6, 5])
    expect(farm.producers.hens.stock).toEqual([5, 5, 5, 0, 0, 0])
    for (let k = 0; k < 3; k++) buyLadder('hens-hold')
    const more = savedNow() as { producers: Record<string, { stock: number[] }> }
    more.producers.hens.stock = [8, 7, 0, 0, 0, 1]
    reload(more)
    expect(farm.producers.hens.stock).toEqual([8, 7, 0, 0, 0, 1])
  })

  it('a save from before the tools loads as today: one nest, each place up to its own most', () => {
    fillHerd('hens')
    farm.producers.hens.stock = [5]
    farm.producers.hens.timer = [12]
    farm.producers.cows.stock = [3]
    const save = savedNow()
    delete save.ladders
    reload(save)
    expect(farm.producers.hens).toEqual({ animals: 6, stock: [5], timer: [12] })
    expect(farm.producers.cows.stock).toEqual([3])
    expect(TOOL_KINDS.map((k) => toolOwned(k))).toEqual([null, null, null])
  })

  it('a hand-made save with the upgrades and no tool: they count for nothing, and read back 0', () => {
    fillHerd('cows')
    const save = savedNow() as { ladders: Record<string, number>; producers: Record<string, { stock: number[] }> }
    save.ladders['cows-hold'] = 7
    save.ladders['cows-tap'] = 9
    save.producers.cows.stock = [9, 9, 9]
    reload(save)
    expect([farm.ladders['cows-hold'], farm.ladders['cows-tap'], maxOf('cows')]).toEqual([0, 0, 3])
    expect(farm.producers.cows.stock).toEqual([3, 3, 3])
  })
})

describe('the tool panel’s view', () => {
  it('each place with what waits, its most and the way to the next; a tap, the room, its two ladders', () => {
    ownTool('cows')
    farm.producers.cows.stock = [3, 1, 0]
    farm.producers.cows.timer = [10, 22.5, 0]
    barnRoom(7)
    const v = toolView('cows')
    expect(v).toEqual({
      kind: 'cows',
      name: 'Milk bucket',
      good: 'milk',
      look: 'pail',
      spots: [
        { name: 'Bella', has: 3, most: 3, next: 0 },
        { name: 'Mazal', has: 1, most: 3, next: 0.5 },
        { name: 'Daisy', has: 0, most: 3, next: 0 },
      ],
      perTap: 1,
      room: 7,
      store: 'barn',
      ladders: [
        { id: 'cows-hold', now: '3 a cow', next: '4 a cow', price: TOOL.hold.price[0] },
        { id: 'cows-tap', now: '1 a tap', next: '2 a tap', price: TOOL.tap.price[0] },
      ],
    })
    ownTool('hens')
    expect(toolView('hens').spots.map((s) => s.name)).toEqual(['Nest 1', 'Nest 2', 'Nest 3', 'Nest 4', 'Nest 5', 'Nest 6'])
    for (let k = 0; k < LADDERS['hens-tap'].levels; k++) buyLadder('hens-tap')
    expect(toolView('hens').ladders[1]).toEqual({ id: 'hens-tap', now: '10 a tap', next: null, price: ladderNextPrice('hens-tap') })
  })
})
