// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { filmAsked, takeFilm } from '../film/films'
import { LADDERS, LADDER_IDS, REMOTE_PRICE, TOOL, TOOL_KINDS, XP_FOR, mostAnimals, toolLadder, type LadderId, type ToolKind } from './data'
import { animals, buy, buyLadder, farm, ladderNextPrice, ladderOpen, owned, resetFarm, setRandom } from './state'
import { levelPay } from './testSaves'

// The animals' tools on the farm (plans/animal-tools.md; their rows in src/farm/data.ts, their pure rules in
// src/farm/tools.ts): bought in the farm shop once their herd is full, their two ladders once the tool is yours, the
// two premium remotes for their price (the animals' after a tool); each step a `build`'s XP, and no film from the farm's
// own buy (the card asks for it).

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  setRandom(() => 0.99)
  takeFilm()
})
afterEach(() => setRandom(null))

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
