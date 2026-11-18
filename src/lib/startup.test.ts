// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { retryPlan } from './startup'

// When the 3D scene fails, whether it starts again and how (src/lib/startup.ts, update-v1 mission 08 c9): the decision
// table, by the kind of failure, whether the scene was up, and the restarts already made this visit.

describe('retryPlan', () => {
  it('a graphics failure gets three tries: light graphics if the scene never got going, the same settings once, then light', () => {
    expect(retryPlan('graphics', false, 0)).toEqual({ light: true })
    expect(retryPlan('graphics', true, 0)).toEqual({ light: false })
    expect(retryPlan('graphics', true, 1)).toEqual({ light: true })
    expect(retryPlan('graphics', true, 2)).toEqual({ light: true })
    expect(retryPlan('graphics', true, 3)).toBeNull()
    expect(retryPlan('graphics', false, 3)).toBeNull()
  })

  it('any other failure gets one restart, while starting in light graphics, mid-game where you stood as you were', () => {
    expect(retryPlan('other', false, 0)).toEqual({ light: true })
    // mid-game: a fresh scene, the same settings (the farm lives outside it)
    expect(retryPlan('other', true, 0)).toEqual({ light: false })
    // one, with the restarts the visit already made counted
    expect(retryPlan('other', true, 1)).toBeNull()
    expect(retryPlan('other', false, 1)).toBeNull()
  })

  it('a download that did not come, or WebAssembly that is blocked, is never tried again: the next try finds the same', () => {
    for (const kind of ['network', 'wasm'] as const) {
      for (const warm of [false, true]) expect(retryPlan(kind, warm, 0), `${kind} ${warm}`).toBeNull()
    }
  })
})
