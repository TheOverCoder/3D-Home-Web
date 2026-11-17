import { describe, expect, it } from 'vitest'
import type { Panel } from '../../store'
import { ITEMS, PRODUCE, TOOL_KINDS, type ProduceId } from '../data'
import { CONTRACTOR_PLACE, nearestPlace, placesOf } from '../orderPlace'
import type { BedState } from '../state'
import { animalsOf, goFor, machineOf, type GoContext } from './go'
import { sourceOf } from './sources'

// "Where is it made" (plans/animal-tools.md): the one button under a good's words (./go.ts) — a premium remote opens
// the machine that makes it, or an owned tool of the animals that give it, on either map; else a walk to where it is
// made, on the farm only; else nothing — and the words themselves (./sources.ts).

const bed = (b: Partial<BedState>): BedState => ({ built: true, crop: null, growth: 0, water: 0, fixed: null, ...b })
const BEDS = [bed({ crop: 'wheat' }), bed({})]
/** The farm's places registered: two beds, the nest, the cows, the sheep, the machines, the contractor's window. */
const FARM_IDS = ['farm-bed-0', 'farm-bed-1', 'farm-nest', 'farm-cow-0', 'farm-cow-1', 'farm-sheep-0', 'farm-mill', 'farm-loom', 'farm-oven', CONTRACTOR_PLACE]

/** A context: on the farm, nothing owned, the contractor out (as `over` says otherwise). */
function ctx(over: Partial<GoContext> & { contractorIn?: boolean } = {}): GoContext {
  const { contractorIn = false, ...rest } = over
  const map = rest.map === undefined ? 'farm' : rest.map
  return {
    machineRemote: false,
    animalRemote: false,
    tools: [],
    map,
    placeFor: (good) => nearestPlace(placesOf(good, BEDS, map === 'farm' ? FARM_IDS : ['door-kitchen'], contractorIn).map((id, k) => ({ id, ready: false, d: k }))),
    ...rest,
  }
}
const BARN: Panel = { kind: 'store', store: 'barn' }

describe('the button under a good', () => {
  it("a machine's good opens that machine with the machines' remote, on either map, and goes back where it was tapped", () => {
    for (const map of ['farm', 'home'] as const) {
      expect(goFor('flour', ctx({ map, machineRemote: true, from: BARN }))).toEqual({ kind: 'open', panel: { kind: 'machine', id: 'mill', from: BARN } })
      expect(goFor('sugar', ctx({ map, machineRemote: true }))).toEqual({ kind: 'open', panel: { kind: 'machine', id: 'mill' } })
      expect(goFor('cloth', ctx({ map, machineRemote: true }))).toEqual({ kind: 'open', panel: { kind: 'machine', id: 'loom' } })
      expect(goFor('pumpkin_pie', ctx({ map, machineRemote: true }))).toEqual({ kind: 'open', panel: { kind: 'machine', id: 'oven' } })
    }
    // the animals' remote opens no machine; a crop has no machine
    expect(goFor('flour', ctx({ animalRemote: true, tools: [...TOOL_KINDS] }))).toEqual({ kind: 'walk', to: 'farm-mill' })
    expect(goFor('wheat', ctx({ machineRemote: true }))).toEqual({ kind: 'walk', to: 'farm-bed-0' })
  })

  it("an animal's good opens its tool with the animals' remote, only a tool owned", () => {
    const remote = { animalRemote: true, from: BARN }
    expect(goFor('egg', ctx({ ...remote, tools: ['hens'] }))).toEqual({ kind: 'open', panel: { kind: 'tool', tool: 'hens', from: BARN } })
    expect(goFor('milk', ctx({ ...remote, tools: ['cows'], map: 'home' }))).toEqual({ kind: 'open', panel: { kind: 'tool', tool: 'cows', from: BARN } })
    expect(goFor('wool', ctx({ ...remote, tools: ['hens', 'sheep'] }))).toEqual({ kind: 'open', panel: { kind: 'tool', tool: 'sheep', from: BARN } })
    // milk without the bucket: "Show me" on the farm, nothing in the house
    expect(goFor('milk', ctx({ ...remote, tools: ['hens'] }))).toEqual({ kind: 'walk', to: 'farm-cow-0' })
    expect(goFor('milk', ctx({ ...remote, tools: ['hens'], map: 'home' }))).toEqual({ kind: 'none' })
    // the tool without the remote: the walk
    expect(goFor('egg', ctx({ tools: ['hens'] }))).toEqual({ kind: 'walk', to: 'farm-nest' })
    // the machines' remote opens no tool
    expect(goFor('egg', ctx({ machineRemote: true, tools: ['hens'] }))).toEqual({ kind: 'walk', to: 'farm-nest' })
  })

  it('otherwise a walk on the farm to where it is made; in the house, or with nowhere to go, the words alone', () => {
    expect(goFor('wheat', ctx())).toEqual({ kind: 'walk', to: 'farm-bed-0' })
    expect(goFor('egg', ctx())).toEqual({ kind: 'walk', to: 'farm-nest' })
    expect(goFor('cloth', ctx())).toEqual({ kind: 'walk', to: 'farm-loom' })
    expect(goFor('apple', ctx())).toEqual({ kind: 'none' })
    for (const good of ['wheat', 'egg', 'cloth', 'flour'] as const) expect(goFor(good, ctx({ map: 'home' })), good).toEqual({ kind: 'none' })
    expect(goFor('egg', ctx({ map: null }))).toEqual({ kind: 'none' })
  })

  it('a building material walks to the contractor while he is in; else the words alone', () => {
    for (const good of ITEMS) {
      expect(goFor(good, ctx({ contractorIn: true })), good).toEqual({ kind: 'walk', to: CONTRACTOR_PLACE })
      expect(goFor(good, ctx({ contractorIn: false })), good).toEqual({ kind: 'none' })
      // no remote opens anything for it
      expect(goFor(good, ctx({ machineRemote: true, animalRemote: true, tools: [...TOOL_KINDS], map: 'home' })), good).toEqual({ kind: 'none' })
    }
  })

  it('which machine makes a good, which animals give it', () => {
    expect([machineOf('flour'), machineOf('cloth'), machineOf('lemon_cake'), machineOf('egg'), machineOf('brick')]).toEqual(['mill', 'loom', 'oven', null, null])
    expect([animalsOf('egg'), animalsOf('milk'), animalsOf('wool'), animalsOf('lemon'), animalsOf('apple')]).toEqual(['hens', 'cows', 'sheep', null, null])
  })
})

describe('where a good comes from, in words', () => {
  it('every good has its words: a bed, an animal, a tree or bush, a machine, a surprise the contractor sells', () => {
    const words = (good: ProduceId) => sourceOf(good).words
    expect([words('wheat'), words('egg'), words('milk'), words('wool'), words('lemon')]).toEqual([
      'Grows in a bed',
      'Laid by the hens',
      'Milked from the cows',
      'Shorn from the sheep',
      'Picked from the lemon tree',
    ])
    expect([words('flour'), words('cloth'), words('carrot_cake')]).toEqual(['Made at the mill', 'Woven at the loom', 'Baked in the oven'])
    expect(sourceOf('sugar').from).toEqual(['sugarcane'])
    for (const good of ITEMS) expect(words(good), good).toBe('A surprise · the contractor sells them')
    for (const p of PRODUCE) expect(sourceOf(p.id).words, p.id).not.toBe('A surprise')
  })
})
