import { beforeAll, describe, expect, it, vi } from 'vitest'
import { describeIssue, ellipsoid, loadSolids, subtract } from '../lib/sculpt'
import { checkerSelfTest, MODEL_CHECKS } from './checks'

describe('the sculpted models', () => {
  const warn = vi.spyOn(console, 'warn')
  beforeAll(async () => {
    await loadSolids()
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
})
