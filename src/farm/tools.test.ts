import { describe, expect, it } from 'vitest'
import { LADDERS, LADDER_IDS, PRODUCERS, REMOTE_PRICE, TOOL, TOOLS, TOOL_KINDS, isToolKind, mostAnimals, toolLadder, type LadderId, type ProducerId, type ToolKind } from './data'
import { clampLevels, ladderPrice } from './market'
import { needsMet, type ToolFarm } from './tools'

// The animals' tools as rows (plans/animal-tools.md): one TOOL every animal shares, TOOLS only for how each looks and
// where it stands, and the shop's ladders made from them — a tool, how much each place holds, how many a tap takes —
// with the two premium remotes beside them.

const PARTS = ['tool', 'hold', 'tap'] as const
const shopRows = LADDER_IDS.filter((id) => LADDERS[id].at === 'shop')
/** What the price of every step of a ladder comes to. */
const total = (id: LadderId) => Array.from({ length: LADDERS[id].levels }, (_, k) => ladderPrice(id, k)).reduce((a, b) => a + b, 0)

describe('the rows', () => {
  it('three ladders a kind and two remotes, all bought in the farm shop; the ladders from before keep their place', () => {
    expect(TOOL_KINDS).toEqual(['hens', 'cows', 'sheep'])
    for (const kind of TOOL_KINDS) {
      expect(PRODUCERS[kind].herd, kind).toBeTruthy()
      for (const part of PARTS) expect(LADDERS[toolLadder(kind, part)].tool, `${kind}-${part}`).toEqual({ kind, part })
    }
    expect(shopRows.sort()).toEqual([...TOOL_KINDS.flatMap((k) => PARTS.map((p) => `${k}-${p}`)), 'machine-remote', 'animal-remote'].sort())
    expect(LADDER_IDS.slice(0, 6)).toEqual(['rate', 'places', 'group', 'pace', 'stock', 'discount'])
    for (const id of LADDER_IDS.slice(0, 6)) expect([LADDERS[id].at, LADDERS[id].needs, LADDERS[id].tool, LADDERS[id].premium], id).toEqual([undefined, undefined, undefined, undefined])
    expect(isToolKind('hens') && isToolKind('sheep') && !isToolKind('tree') && !isToolKind('apple-tree')).toBe(true)
  })

  it("every kind's numbers are the same: one TOOL; only the look and the place differ", () => {
    const numbers = (kind: ToolKind) => PARTS.map((part) => ({ ...LADDERS[toolLadder(kind, part)], name: '', blurb: '', say: null, tool: null, needs: null }))
    for (const kind of TOOL_KINDS) expect(numbers(kind), kind).toEqual(numbers('hens'))
    for (const kind of TOOL_KINDS) {
      expect(LADDERS[toolLadder(kind, 'tool')].price, kind).toEqual([TOOL.price, 0])
      expect(LADDERS[toolLadder(kind, 'tool')].levels).toBe(1)
      expect(LADDERS[toolLadder(kind, 'hold')].price).toEqual(TOOL.hold.price)
      expect(LADDERS[toolLadder(kind, 'tap')].price).toEqual(TOOL.tap.price)
    }
    // the plan's sums, at the plan's numbers: each kind's tool and its two ladders to the top
    if (TOOL.price === 400 && TOOL.hold.price[0] === 150 && TOOL.tap.price[0] === 100) {
      expect(TOOL_KINDS.map((k) => PARTS.map((p) => total(toolLadder(k, p))))).toEqual(TOOL_KINDS.map(() => [400, 2625, 2700]))
    }
    // what differs: its name, picture, words, look and place
    expect(new Set(TOOL_KINDS.map((k) => TOOLS[k].name)).size).toBe(3)
    expect(new Set(TOOL_KINDS.map((k) => TOOLS[k].look))).toEqual(new Set(['nests', 'pail', 'shears']))
  })

  it('holds 3 → 10 a place, takes 1 → 10 a tap, each step dearer than the one before', () => {
    expect([TOOL.hold.from, TOOL.hold.to, TOOL.tap.from, TOOL.tap.to]).toEqual([3, 10, 1, 10])
    for (const kind of TOOL_KINDS) {
      const hold = LADDERS[toolLadder(kind, 'hold')]
      const tap = LADDERS[toolLadder(kind, 'tap')]
      expect([hold.levels, tap.levels]).toEqual([7, 9])
      expect([hold.say(0), hold.say(hold.levels)]).toEqual([`3 a ${TOOLS[kind].spot}`, `10 a ${TOOLS[kind].spot}`])
      expect([tap.say(0), tap.say(tap.levels)]).toEqual(['1 a tap', '10 a tap'])
      for (const id of [toolLadder(kind, 'hold'), toolLadder(kind, 'tap')]) {
        for (let k = 1; k < LADDERS[id].levels; k++) expect(ladderPrice(id, k), `${id} step ${k}`).toBeGreaterThan(ladderPrice(id, k - 1))
      }
    }
  })

  it('the two remotes: 10,000 each, premium, one step; the animals’ remote only after a tool', () => {
    expect(REMOTE_PRICE).toBe(10_000)
    for (const id of ['machine-remote', 'animal-remote'] as const) {
      expect([LADDERS[id].levels, LADDERS[id].price, LADDERS[id].premium, LADDERS[id].tool], id).toEqual([1, [10_000, 0], true, undefined])
    }
    expect(LADDERS['machine-remote'].needs).toBeUndefined()
    expect(LADDERS['animal-remote'].needs).toEqual({ anyOf: ['hens-tool', 'cows-tool', 'sheep-tool'] })
  })

  it('a tool waits for its herd full, its two ladders for the tool', () => {
    for (const kind of TOOL_KINDS) {
      expect(LADDERS[toolLadder(kind, 'tool')].needs).toEqual({ herd: kind })
      expect(LADDERS[toolLadder(kind, 'hold')].needs).toEqual({ ladder: `${kind}-tool` })
      expect(LADDERS[toolLadder(kind, 'tap')].needs).toEqual({ ladder: `${kind}-tool` })
    }
  })
})

describe('what a ladder waits for', () => {
  /** A farm with these herds (each at its start otherwise) and ladder steps. */
  const farmWith = (animals: Partial<Record<ProducerId, number>>, ladders: Partial<Record<LadderId, number>> = {}): ToolFarm => ({
    producers: Object.fromEntries((Object.keys(PRODUCERS) as ProducerId[]).map((id) => [id, { animals: animals[id] ?? PRODUCERS[id].herd?.start ?? 0 }])) as ToolFarm['producers'],
    ladders: { ...clampLevels({}), ...ladders },
  })

  it('nothing to wait for: always', () => {
    expect(needsMet(undefined, farmWith({}))).toBe(true)
    expect(needsMet(LADDERS['machine-remote'].needs, farmWith({}))).toBe(true)
  })

  it('a herd: every animal the shop sells', () => {
    for (const kind of TOOL_KINDS) {
      const needs = LADDERS[toolLadder(kind, 'tool')].needs
      expect(needsMet(needs, farmWith({ [kind]: mostAnimals(kind) - 1 })), kind).toBe(false)
      expect(needsMet(needs, farmWith({ [kind]: mostAnimals(kind) })), kind).toBe(true)
    }
  })

  it('a ladder at its top; any one of a list at its top', () => {
    const full = farmWith({ hens: 6, cows: 3, sheep: 4 })
    expect(needsMet(LADDERS['hens-hold'].needs, full)).toBe(false)
    expect(needsMet(LADDERS['hens-tap'].needs, farmWith({}, { 'hens-tool': 1 }))).toBe(true)
    expect(needsMet(LADDERS['cows-tap'].needs, farmWith({}, { 'hens-tool': 1 }))).toBe(false)
    expect(needsMet(LADDERS['animal-remote'].needs, full)).toBe(false)
    for (const kind of TOOL_KINDS) expect(needsMet(LADDERS['animal-remote'].needs, farmWith({}, { [`${kind}-tool`]: 1 })), kind).toBe(true)
  })
})
