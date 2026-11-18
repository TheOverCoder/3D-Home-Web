import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStill, lessMotion, onLessMotion, setMotionPref, type MotionPref } from './still'

// Less motion (update-v1/CONTRACTS.md §1.7).

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
    handlers,
  }
}

afterEach(() => {
  setMotionPref('device')
  vi.unstubAllGlobals()
})

describe('less motion', () => {
  it('follows the player’s choice, and the device’s when it is left to it', () => {
    const table: [MotionPref, boolean, boolean][] = [
      ['device', false, false],
      ['device', true, true],
      ['less', false, true],
      ['less', true, true],
      ['full', false, false],
      ['full', true, false],
    ]
    for (const [pref, asks, still] of table) expect(isStill(pref, asks), `${pref} ${asks}`).toBe(still)
  })

  it('reads the device now, and the setting over it', () => {
    device(true)
    expect(lessMotion()).toBe(true)
    setMotionPref('full')
    expect(lessMotion()).toBe(false)
    setMotionPref('device')
    expect(lessMotion()).toBe(true)
  })

  it('with no device to ask (Node), moves', () => {
    expect(lessMotion()).toBe(false)
  })

  it('tells its listeners once a change, from the setting or the device, and not after they stop', () => {
    const d = device(false)
    const heard: boolean[] = []
    const stop = onLessMotion((still) => heard.push(still))
    setMotionPref('less')
    setMotionPref('less')
    setMotionPref('device')
    d.set(true)
    d.set(true)
    expect(heard).toEqual([true, false, true])
    stop()
    expect(d.handlers.size).toBe(0)
    setMotionPref('full')
    expect(heard).toEqual([true, false, true])
  })
})
