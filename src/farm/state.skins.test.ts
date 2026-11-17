// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TOOL_KINDS, XP_FOR, mostAnimals, toolLadder, type ToolKind } from './data'
import { SKINS, freshSkins, skinPrice } from './skins'
import { animals, buy, buyLadder, buySkin, farm, freezeDay, owned, resetFarm, setRandom, skinOwned, skinWorn, wearSkin } from './state'
import { levelPay, savedNow, startFrom } from './testSaves'

// The tools' skins on the farm (src/farm/skins.ts; bought and put on in the tool's skins shop, src/farm/SkinShop.tsx):
// a skin is bought only for a tool that is yours, once, for its price and a `build`'s XP, and worn at once; any skin the
// farm owns is put on for nothing; all of it in `farm.skins`, the one field the save gained, which a farm from before it
// reads as each tool's own skin, worn.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
  setRandom(() => 0.99)
})
afterEach(() => {
  freezeDay(false)
  setRandom(null)
})

const HERD_UPGRADE: Record<ToolKind, 'hen' | 'cow' | 'sheep'> = { hens: 'hen', cows: 'cow', sheep: 'sheep' }
/** A tool bought (its herd filled first), with coins to spare. */
function ownTool(kind: ToolKind) {
  farm.coins += 100_000
  while (!owned(HERD_UPGRADE[kind])) expect(buy(HERD_UPGRADE[kind])).toBe(true)
  expect(animals(kind)).toBe(mostAnimals(kind))
  expect(buyLadder(toolLadder(kind, 'tool'))).toBe(true)
}
/** The farm loaded again from a save, with no time away. */
const reload = (save: Record<string, unknown>) => startFrom({ ...save, time: undefined })

describe('buying a skin', () => {
  it.each(TOOL_KINDS)('the %s’ tool: each skin for its price and a build’s XP, once, worn at once', (kind) => {
    ownTool(kind)
    expect([skinWorn(kind), skinOwned(kind, 'a'), skinOwned(kind, 'b'), skinOwned(kind, 'c')]).toEqual(['a', true, false, false])
    for (const style of ['c', 'b'] as const) {
      const [coins, xp, paid] = [farm.coins, farm.xp.points, farm.xp.paid]
      expect(buySkin(kind, style), style).toBe(true)
      expect(farm.coins).toBe(coins - SKINS[kind][style].price + levelPay(paid))
      expect(farm.xp.points - xp).toBe(XP_FOR.build)
      expect([skinOwned(kind, style), skinWorn(kind)]).toEqual([true, style])
    }
    expect(farm.skins[kind]).toEqual({ owned: ['a', 'b', 'c'], worn: 'b' })
    // once: neither again, nor the free one
    const coins = farm.coins
    for (const style of ['a', 'b', 'c'] as const) expect(buySkin(kind, style), style).toBe(false)
    expect(farm.coins).toBe(coins)
    // the other tools as they were
    for (const other of TOOL_KINDS) if (other !== kind) expect(farm.skins[other]).toEqual(freshSkins()[other])
  })

  it('too few coins: nothing bought, nothing spent, nothing worn', () => {
    ownTool('cows')
    farm.coins = skinPrice('cows', 'c') - 1
    const xp = farm.xp.points
    expect(buySkin('cows', 'c')).toBe(false)
    expect([farm.coins, farm.xp.points, farm.skins.cows]).toEqual([skinPrice('cows', 'c') - 1, xp, { owned: ['a'], worn: 'a' }])
  })

  it('a skin of a tool not yours can be neither bought nor worn', () => {
    farm.coins = 1_000_000
    // (its herd full, and still no tool)
    while (!owned('sheep')) buy('sheep')
    const coins = farm.coins
    for (const style of ['a', 'b', 'c'] as const) {
      expect(buySkin('sheep', style), style).toBe(false)
      expect(wearSkin('sheep', style), style).toBe(false)
    }
    expect([farm.coins, farm.skins]).toEqual([coins, freshSkins()])
  })

  it('anything else is refused: a tool or a skin that is not one', () => {
    ownTool('hens')
    const coins = farm.coins
    expect(buySkin('tree' as ToolKind, 'b')).toBe(false)
    expect(buySkin('hens', 'd' as 'b')).toBe(false)
    expect(wearSkin('hens', 'z' as 'b')).toBe(false)
    expect([farm.coins, farm.skins]).toEqual([coins, freshSkins()])
  })
})

describe('wearing a skin', () => {
  it('any skin the farm owns is put on for nothing (no coins, no XP); one not owned is not', () => {
    ownTool('sheep')
    expect(buySkin('sheep', 'c')).toBe(true)
    const [coins, xp] = [farm.coins, farm.xp.points]
    expect(wearSkin('sheep', 'b')).toBe(false)
    expect(skinWorn('sheep')).toBe('c')
    expect(wearSkin('sheep', 'a')).toBe(true)
    expect(skinWorn('sheep')).toBe('a')
    // (worn already: nothing changes)
    expect(wearSkin('sheep', 'a')).toBe(false)
    expect(wearSkin('sheep', 'c')).toBe(true)
    expect([farm.coins, farm.xp.points, skinWorn('sheep')]).toEqual([coins, xp, 'c'])
  })
})

describe('the save', () => {
  it('keeps the skins owned and the one each tool wears', () => {
    ownTool('hens')
    ownTool('cows')
    buySkin('hens', 'b')
    buySkin('hens', 'c')
    wearSkin('hens', 'b')
    buySkin('cows', 'c')
    wearSkin('cows', 'a')
    const skins = structuredClone(farm.skins)
    reload(savedNow())
    expect(farm.skins).toEqual(skins)
    expect(farm.skins).toEqual({ hens: { owned: ['a', 'b', 'c'], worn: 'b' }, cows: { owned: ['a', 'c'], worn: 'a' }, sheep: { owned: ['a'], worn: 'a' } })
  })

  it('a farm from before the skins (its tools yours) owns each tool’s own skin and wears it', () => {
    ownTool('hens')
    ownTool('sheep')
    const save = savedNow()
    delete save.skins
    reload(save)
    expect(farm.skins).toEqual(freshSkins())
    expect([skinWorn('hens'), skinWorn('sheep')]).toEqual(['a', 'a'])
    expect(toolsOwned()).toEqual(['hens', 'sheep'])
  })

  it('a hand-made save with skins for a tool not yours: they count for nothing, and read back as its own', () => {
    ownTool('cows')
    const save = savedNow() as { skins: Record<string, unknown> }
    save.skins = { hens: { owned: ['a', 'b', 'c'], worn: 'c' }, cows: { owned: ['a', 'b'], worn: 'b' }, sheep: { owned: ['c'], worn: 'c' } }
    reload(save)
    expect(farm.skins).toEqual({ ...freshSkins(), cows: { owned: ['a', 'b'], worn: 'b' } })
  })
})

const toolsOwned = () => TOOL_KINDS.filter((k) => farm.ladders[toolLadder(k, 'tool')] > 0)
