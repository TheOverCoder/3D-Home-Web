// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lessMotion, onLessMotion, setMotionPref } from './still'

// Less motion on a page (update-v1/CONTRACTS.md §1.7): the CSS reads <html data-motion="less">, which ./still.ts keeps
// for the page's life, from the player's choice and from the device's own answer as it changes.

const marked = () => document.documentElement.dataset.motion === 'less'

/** The device's answer, as a test sets it, with its change event. */
function device(asks: boolean) {
  const handlers = new Set<() => void>()
  const mql = {
    matches: asks,
    addEventListener: (_: string, f: () => void) => handlers.add(f),
    removeEventListener: (_: string, f: () => void) => handlers.delete(f),
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    set(v: boolean) {
      mql.matches = v
      for (const f of handlers) f()
    },
  }
}

afterEach(() => {
  setMotionPref('device')
  vi.unstubAllGlobals()
})

describe('less motion on the page', () => {
  it('is marked on <html> as the player chooses', () => {
    expect(marked()).toBe(false)
    setMotionPref('less')
    expect(marked()).toBe(true)
    setMotionPref('full')
    expect(marked()).toBe(false)
  })

  it('follows the device while the choice is left to it, with no one else listening', () => {
    const d = device(false)
    // (the page's matchMedia is another now: asked again, and watched)
    expect(lessMotion()).toBe(false)
    d.set(true)
    expect(marked()).toBe(true)
    setMotionPref('full')
    expect(marked()).toBe(false)
    setMotionPref('device')
    expect(marked()).toBe(true)
    d.set(false)
    expect(marked()).toBe(false)
  })

  it('tells a reader that came later, and stops telling it when it stops', () => {
    const heard: boolean[] = []
    const stop = onLessMotion((still) => heard.push(still))
    setMotionPref('less')
    stop()
    setMotionPref('full')
    expect(heard).toEqual([true])
    expect(marked()).toBe(false)
  })
})
