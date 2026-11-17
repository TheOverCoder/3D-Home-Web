import { describe, expect, it } from 'vitest'
import { LADDERS, LADDER_IDS, PRODUCERS, REMOTE_PRICE, TOOL, TOOLS, TOOL_KINDS, isToolKind, mostAnimals, toolLadder, type LadderId, type ProducerId, type ToolKind } from './data'
import { clampLevels, ladderPrice } from './market'
import { fullest, mostAt, needsMet, ownsEach, perTapOf, spreadNest, toolOf, type ToolFarm } from './tools'

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

describe('what a tool changes', () => {
  it('owned once its own ladder is bought; only the hens, the cows and the sheep have one', () => {
    expect(toolOf('hens', {})).toBeNull()
    expect(toolOf('hens', { 'hens-tool': 1 })).toBe('hens')
    expect(toolOf('cows', { 'hens-tool': 1 })).toBeNull()
    expect(toolOf('tree', { 'hens-tool': 1, 'cows-tool': 1, 'sheep-tool': 1 })).toBeNull()
  })

  it('the most a place holds: its own without the tool, 3 with it and one more a step', () => {
    for (const id of Object.keys(PRODUCERS) as ProducerId[]) expect(mostAt(id, {}), id).toBe(PRODUCERS[id].max)
    for (const kind of TOOL_KINDS) {
      expect(mostAt(kind, { [`${kind}-tool`]: 1 })).toBe(3)
      expect(mostAt(kind, { [`${kind}-tool`]: 1, [`${kind}-hold`]: 7 })).toBe(10)
      // (a step without the tool counts for nothing)
      expect(mostAt(kind, { [`${kind}-hold`]: 7 })).toBe(PRODUCERS[kind].max)
    }
    expect([perTapOf('cows', {}), perTapOf('cows', { 'cows-tap': 1 }), perTapOf('cows', { 'cows-tap': 9 })]).toEqual([1, 2, 10])
  })

  it('a nest a hen with the coop; the cows and the sheep give their own with or without their tools', () => {
    expect([ownsEach('hens', {}), ownsEach('hens', { 'hens-tool': 1 })]).toEqual([false, true])
    for (const kind of ['cows', 'sheep'] as const) expect([ownsEach(kind, {}), ownsEach(kind, { [`${kind}-tool`]: 1 })]).toEqual([true, true])
    expect(ownsEach('tree', { 'hens-tool': 1 })).toBe(false)
  })

  it('the tap with no place chosen takes from the fullest; ties: the first', () => {
    expect(fullest([0, 0, 0])).toBe(0)
    expect(fullest([1, 3, 3])).toBe(1)
    expect(fullest([5, 2, 5, 1])).toBe(0)
    expect(fullest([0, 0, 2])).toBe(2)
  })
})

describe('the nest split as the coop comes', () => {
  /** The moments (seconds from now) of the next `n` eggs of a shared nest: its clock `t`, `hens` times as fast. */
  const shared = (t: number, hens: number, every: number, n: number) => Array.from({ length: n }, (_, k) => (every - t + k * every) / hens)
  /** The same of a nest a hen, each with her own clock: each egg's moment and whose it is. */
  const own = (timer: number[], every: number, n: number) =>
    timer
      .flatMap((c, i) => Array.from({ length: n }, (_, j) => ({ at: every - c + j * every, i })))
      .sort((a, b) => a.at - b.at)
      .slice(0, n)

  it('keeps every egg, dealt round the nests', () => {
    const cases: [number, number][] = [
      [0, 6],
      [1, 6],
      [6, 6],
      [5, 4],
      [7, 3],
      [3, 1],
    ]
    for (const [eggs, hens] of cases) {
      const s = spreadNest(eggs, 0, hens, 40)
      expect(s.stock.length, `${eggs} in ${hens}`).toBe(hens)
      expect(s.stock.reduce((a, b) => a + b, 0)).toBe(eggs)
      expect(Math.max(...s.stock) - Math.min(...s.stock)).toBeLessThanOrEqual(1)
    }
  })

  it('the next eggs come when they would have: one hen after another, every clock from 0 to under its period', () => {
    const every = PRODUCERS.hens.every
    for (const hens of [1, 2, 5, 6]) {
      for (const t of [0, 0.3, 13, every / 2, every - 1e-6]) {
        const { timer } = spreadNest(2, t, hens, every)
        for (const c of timer) expect(c >= 0 && c < every, `clock ${c} (t ${t}, ${hens} hens)`).toBe(true)
        const want = shared(t, hens, every, 3 * hens)
        const got = own(timer, every, 3 * hens)
        got.forEach((e, k) => expect(e.at, `egg ${k} (t ${t}, ${hens} hens)`).toBeCloseTo(want[k], 9))
        // hen i lays the i-th of them, and every hens-th after
        got.forEach((e, k) => expect(e.i).toBe(k % hens))
      }
    }
  })
})
