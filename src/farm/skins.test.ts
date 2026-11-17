import { describe, expect, it } from 'vitest'
import { TOOL_LOOKS } from '../models/tools'
import { TOOL_KINDS, TOOLS, toolLadder, type LadderId } from './data'
import { FREE_SKIN, SKINS, SKIN_STYLES, freshSkins, isSkinStyle, sanitizeSkins, skinBuyProblem, skinPrice, wearing, withSkin } from './skins'
import { skinsView } from './skinsView'

// The tools' skins as rows and their pure rules (src/farm/skins.ts; the farm's in state.skins.test.ts): each tool in
// every style of its models, the first free; a save read back safe; one bought is owned and worn at once; only one owned
// is put on; the shop's view.

/** Ladders with these tools yours. */
const owning = (...kinds: (typeof TOOL_KINDS)[number][]) => Object.fromEntries(kinds.map((k): [LadderId, number] => [toolLadder(k, 'tool'), 1]))

describe('the skins as rows', () => {
  it('each tool has a skin in every style of its model, the first free and the others for coins, each with a name', () => {
    expect(SKIN_STYLES).toEqual(['a', 'b', 'c'])
    expect(TOOL_LOOKS).toEqual(TOOL_KINDS.map((k) => TOOLS[k].look))
    for (const kind of TOOL_KINDS) {
      expect(Object.keys(SKINS[kind])).toEqual(SKIN_STYLES)
      expect(skinPrice(kind, FREE_SKIN)).toBe(0)
      for (const style of SKIN_STYLES) {
        expect(SKINS[kind][style].name.length, `${kind} ${style}`).toBeGreaterThan(2)
        if (style !== FREE_SKIN) expect(Number.isInteger(skinPrice(kind, style)) && skinPrice(kind, style) > 0, `${kind} ${style}`).toBe(true)
      }
      // three different names
      expect(new Set(SKIN_STYLES.map((s) => SKINS[kind][s].name)).size).toBe(3)
    }
  })

  it('a new farm owns each tool’s own skin and wears it', () => {
    expect(freshSkins()).toEqual({ hens: { owned: ['a'], worn: 'a' }, cows: { owned: ['a'], worn: 'a' }, sheep: { owned: ['a'], worn: 'a' } })
    expect([isSkinStyle('b'), isSkinStyle('d'), isSkinStyle(1), isSkinStyle(null)]).toEqual([true, false, false, false])
  })
})

describe('a save read back', () => {
  it('as saved, for the tools the farm has: each owned skin once, in order, the free one always; the one worn owned', () => {
    const raw = { hens: { owned: ['c', 'b', 'c'], worn: 'c' }, cows: { owned: ['b'], worn: 'b' }, sheep: { owned: ['a', 'c'], worn: 'b' } }
    expect(sanitizeSkins(raw, owning('hens', 'cows', 'sheep'))).toEqual({
      hens: { owned: ['a', 'b', 'c'], worn: 'c' },
      cows: { owned: ['a', 'b'], worn: 'b' },
      // (b is not the farm's: it wears its own)
      sheep: { owned: ['a', 'c'], worn: 'a' },
    })
  })

  it('a farm from before the skins (or anything else): every tool owns its own and wears it', () => {
    for (const raw of [undefined, null, 7, 'b', [], { hens: 'b' }, { hens: { owned: 'b', worn: 'z' } }, { cows: { owned: [1, {}, 'x'], worn: ['b'] } }])
      expect(sanitizeSkins(raw, owning('hens', 'cows', 'sheep')), JSON.stringify(raw)).toEqual(freshSkins())
  })

  it('a skin of a tool not the farm’s counts for nothing: it reads back as the tool’s own', () => {
    const raw = { hens: { owned: ['a', 'b', 'c'], worn: 'b' }, cows: { owned: ['a', 'c'], worn: 'c' }, sheep: { owned: ['a', 'b'], worn: 'b' } }
    expect(sanitizeSkins(raw, owning('cows'))).toEqual({ ...freshSkins(), cows: { owned: ['a', 'c'], worn: 'c' } })
    expect(sanitizeSkins(raw, {})).toEqual(freshSkins())
  })
})

describe('buying and wearing', () => {
  it('a skin can be bought only for a tool that is yours, once, with its price in coins', () => {
    const s = freshSkins()
    expect(skinBuyProblem(s, 'hens', 'b', false, 1e6)).toBe('no tool')
    expect(skinBuyProblem(s, 'hens', 'a', true, 1e6)).toBe('owned')
    expect(skinBuyProblem(s, 'hens', 'b', true, skinPrice('hens', 'b') - 1)).toBe('coins')
    expect(skinBuyProblem(s, 'hens', 'b', true, skinPrice('hens', 'b'))).toBeNull()
    expect(skinBuyProblem(withSkin(s, 'hens', 'b'), 'hens', 'b', true, 1e6)).toBe('owned')
  })

  it('bought, it is owned in its place in the order and worn at once; the other tools as they were', () => {
    const s = withSkin(withSkin(freshSkins(), 'cows', 'c'), 'cows', 'b')
    expect(s).toEqual({ ...freshSkins(), cows: { owned: ['a', 'b', 'c'], worn: 'b' } })
  })

  it('only a skin owned is put on; one worn already changes nothing', () => {
    const s = withSkin(freshSkins(), 'sheep', 'c')
    expect(wearing(s, 'sheep', 'b')).toBe(s)
    expect(wearing(s, 'sheep', 'c')).toBe(s)
    expect(wearing(s, 'sheep', 'a')).toEqual({ ...s, sheep: { owned: ['a', 'c'], worn: 'a' } })
  })
})

describe('the shop’s view', () => {
  it('each skin worn, owned or for sale, and whether the coins are there', () => {
    const s = withSkin(withSkin(freshSkins(), 'hens', 'c'), 'hens', 'a')
    const v = skinsView('hens', s, true, skinPrice('hens', 'b') - 1)
    expect([v.tool, v.art, v.has, v.owned, v.of]).toEqual([TOOLS.hens.name, TOOLS.hens.art, true, 2, 3])
    expect(v.skins.map((c) => [c.style, c.state, c.can])).toEqual([
      ['a', 'worn', false],
      ['b', 'sale', false],
      ['c', 'owned', false],
    ])
    expect(skinsView('hens', s, true, skinPrice('hens', 'b')).skins[1].can).toBe(true)
  })

  it('a tool not yours: nothing owned, nothing to buy', () => {
    const v = skinsView('sheep', freshSkins(), false, 1e6)
    expect([v.has, v.owned]).toEqual([false, 0])
    expect(v.skins.map((c) => [c.state, c.can])).toEqual([
      ['sale', false],
      ['sale', false],
      ['sale', false],
    ])
  })
})
