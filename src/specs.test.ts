import { describe, expect, it } from 'vitest'

// The e2e specs' numbers (update-v1/CONTRACTS.md §2, B12): each spec is known by its number (tests/README.md, CLAUDE.md,
// the missions), so no two may share one. Four missions of update v1 each planned a new spec 39; this fails in seconds
// when two land with the same number, instead of in a confusing review. (The specs are only listed, never loaded.)

describe('the e2e specs', () => {
  it('each has a number of its own', () => {
    const specs = Object.keys(import.meta.glob('../tests/e2e/*.spec.ts')).map((path) => path.split('/').pop()!)
    expect(specs.length).toBeGreaterThan(30)
    const byNumber = new Map<string, string[]>()
    for (const f of specs) {
      const n = /^(\d+)-/.exec(f)?.[1]
      expect(n, `${f} has no number`).toBeTruthy()
      byNumber.set(n!, [...(byNumber.get(n!) ?? []), f])
    }
    const twice = [...byNumber.values()].filter((files) => files.length > 1)
    expect(twice, 'two specs share a number').toEqual([])
  })
})
