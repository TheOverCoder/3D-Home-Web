import { describe, expect, it } from 'vitest'

// The e2e specs' numbers (update-v1/CONTRACTS.md §2, B12): each spec is known by its number (tests/README.md, CLAUDE.md,
// the missions), so no two may share one. Four missions of update v1 each planned a new spec 39; this fails in seconds
// when two land with the same number, instead of in a confusing review. (The specs are only listed, never loaded.)
// One spec may come in parts, each a file of its own (so each can run on a shard of its own): its number and its name,
// then the part (16-view-rooms, 16-view-openings, 16-view-farm, 16-view-buildings). Files that share a number must be
// one spec's parts.

/** A spec's file name as its number, its name and its part (no part: a spec in one file). */
const named = (f: string) => /^(\d+)-([a-z0-9]+)(?:-([a-z0-9-]+))?\.spec\.ts$/.exec(f)
/** Files that are one spec's parts: each with a part, all with the same name (16-view-rooms and 16-view-farm; not
 *  39-panels and 39-album, nor 39-panels and 39-panels-big). */
const oneSpec = (files: string[]) => files.every((f) => named(f)?.[3]) && new Set(files.map((f) => named(f)?.[2])).size === 1

describe('the e2e specs', () => {
  it('each has a number of its own (a spec in parts shares its number, and its name)', () => {
    const specs = Object.keys(import.meta.glob('../tests/e2e/*.spec.ts')).map((path) => path.split('/').pop()!)
    expect(specs.length).toBeGreaterThan(30)
    const byNumber = new Map<string, string[]>()
    for (const f of specs) {
      const n = /^(\d+)-/.exec(f)?.[1]
      expect(n, `${f} has no number`).toBeTruthy()
      byNumber.set(n!, [...(byNumber.get(n!) ?? []), f])
    }
    const twice = [...byNumber.values()].filter((files) => files.length > 1 && !oneSpec(files))
    expect(twice, 'two specs share a number').toEqual([])
  })

  it('tells a spec in parts from two specs with one number', () => {
    expect(oneSpec(['16-view-rooms.spec.ts', '16-view-openings.spec.ts', '16-view-farm.spec.ts', '16-view-buildings.spec.ts'])).toBe(true)
    expect(oneSpec(['39-panels.spec.ts', '39-album.spec.ts'])).toBe(false)
    expect(oneSpec(['39-panels.spec.ts', '39-panels-big.spec.ts'])).toBe(false)
    expect(oneSpec(['16-view-rooms.spec.ts', '16-walk-farm.spec.ts'])).toBe(false)
  })
})
