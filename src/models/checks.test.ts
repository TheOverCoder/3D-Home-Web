import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { describeIssue, ellipsoid, loadSolids, subtract } from '../lib/sculpt'
import { checkerSelfTest, MODEL_CHECKS } from './checks'
import { GALLERY } from './gallery'

/** The gallery's entries checked within another's check: the order office with the silo and the barn, the car on the
 *  road with the car, the scarecrows with the rest of the decoration. */
const CHECKED_WITH: Record<string, string> = { office: 'stores', 'car-road': 'car', scarecrows: 'decor' }

describe('the sculpted models', () => {
  const warn = vi.spyOn(console, 'warn')
  beforeAll(async () => {
    await loadSolids()
  })

  // 12-models asks the page the same: every entry draws something once its first frame has posed it — here in
  // seconds, where the page took a push's whole run to say so (the car park's ground alone drew 776)
  it('every model of the gallery draws more than 1000 triangles once posed', () => {
    for (const e of GALLERY) {
      const m = e.make()
      m.update(0.5)
      expect(m.triangles(), e.id).toBeGreaterThan(1000)
    }
  })

  // without the WASM path plugin in vitest.config.ts the engine fails to load here, quietly: the models are built
  // without their cuts and every check below still passes — this is the test that notices
  it('the solid engine (manifold-3d WASM) loads in Node and really cuts', () => {
    expect(warn).not.toHaveBeenCalled()
    const ball = ellipsoid(0.1, 0.1, 0.1, 16, 12)
    const cut = subtract(ball, ellipsoid(0.05, 0.05, 0.05, 12, 8).place([0.1, 0, 0]))
    expect(cut.count).not.toBe(ball.count)
  })

  it('the checks catch a loose piece, an open shape and a floating model', () => {
    expect(checkerSelfTest()).toEqual(['loose', 'open', 'floating'])
  })

  // the same checks the ?gallery page runs in the e2e suite (tests/e2e/12-models.spec.ts)
  it.each(MODEL_CHECKS.map((c) => [c.id, c] as const))('%s: no loose, open, floating or sunk pieces', (_, check) => {
    expect(check.run().map(describeIssue)).toEqual([])
  })

  // every model the gallery shows is checked here, and in the e2e suite; a model added to one and not the other fails
  // here, in seconds (12-models found it only in the gallery's own run)
  it('every model in the gallery has its check, and every check is of a model in the gallery', () => {
    const checked = new Set(GALLERY.map((e) => CHECKED_WITH[e.id] ?? e.id))
    expect([...checked].sort()).toEqual(MODEL_CHECKS.map((c) => c.id).sort())
    for (const [id, within] of Object.entries(CHECKED_WITH)) expect(GALLERY.some((e) => e.id === id) && MODEL_CHECKS.some((c) => c.id === within), `${id} in ${within}`).toBe(true)
  })

  // tests/e2e/12-models reads the gallery's ids from its source (it cannot load the models): the same ids, in order
  it("12-models reads the gallery's ids as GALLERY has them", () => {
    const source = readFileSync(new URL('./gallery.ts', import.meta.url), 'utf8')
    expect([...source.matchAll(/^ {4}id: '([\w-]+)',$/gm)].map((m) => m[1])).toEqual(GALLERY.map((e) => e.id))
  })
})
