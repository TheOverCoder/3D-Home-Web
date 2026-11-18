// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

// The game's touches (haptic in ./device.ts, the one place it buzzes): only on a touch screen that can buzz, and only
// while the player has Vibration on; each kind of thing done its own short pattern; what the player did is felt with
// its sound (farmSound in src/audio/sound.ts), the farm's own sounds are not.

/** The device module as a page on this kind of screen loads it, with the phone's buzz watched. */
async function onA(screen: 'phone' | 'computer', buzzes = true) {
  vi.resetModules()
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: screen === 'phone' && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} }))
  const vibrate = vi.fn<(pattern: number | number[]) => boolean>(() => true)
  Object.defineProperty(navigator, 'vibrate', { value: buzzes ? vibrate : undefined, configurable: true, writable: true })
  const device = await import('./device')
  const { useSettings } = await import('../settings')
  const { farmSound } = await import('../audio/sound')
  return { ...device, useSettings, farmSound, vibrate }
}

afterEach(() => vi.unstubAllGlobals())

describe('haptics', () => {
  it('a phone that can buzz, Vibration on: each kind its own pattern, short; nothing for no kind', async () => {
    const d = await onA('phone')
    d.useSettings.getState().update({ vibration: true })
    for (const kind of Object.keys(d.HAPTICS) as (keyof typeof d.HAPTICS)[]) {
      d.vibrate.mockClear()
      d.haptic(kind)
      expect(d.vibrate).toHaveBeenCalledWith(d.HAPTICS[kind])
    }
    // told apart: no two alike, none longer than a fifth of a second in all
    const patterns = Object.values(d.HAPTICS).map((p) => JSON.stringify(p))
    expect(new Set(patterns).size).toBe(patterns.length)
    for (const p of Object.values(d.HAPTICS)) expect([p].flat().reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(200)
    // a sale is a double, a level the strongest
    expect([d.HAPTICS.sale].flat().filter((_, i) => i % 2 === 0)).toHaveLength(2)
    // a big sum of coins: the same double, stronger (a size changes how strong, never which pattern)
    expect([d.HAPTICS['sale+']].flat().slice(0, 3)).toEqual(d.HAPTICS.sale)
    expect([d.HAPTICS['sale+']].flat().reduce((a, b) => a + b, 0)).toBeGreaterThan([d.HAPTICS.sale].flat().reduce((a, b) => a + b, 0))
    // (its longest pulse: the pauses between pulses are no strength)
    const pulses = (p: number | number[]) => [p].flat().filter((_, i) => i % 2 === 0)
    expect(Math.max(...pulses(d.HAPTICS.level))).toBeGreaterThan(Math.max(...Object.entries(d.HAPTICS).flatMap(([k, p]) => (k === 'level' ? [] : pulses(p)))))
    d.vibrate.mockClear()
    d.haptic(null)
    d.haptic(undefined)
    expect(d.vibrate).not.toHaveBeenCalled()
  })

  it('none with Vibration off, on a computer, or on a phone that cannot buzz', async () => {
    let d = await onA('phone')
    d.useSettings.getState().update({ vibration: false })
    d.haptic('level')
    expect(d.vibrate).not.toHaveBeenCalled()
    d = await onA('computer')
    d.useSettings.getState().update({ vibration: true })
    d.haptic('level')
    expect(d.vibrate).not.toHaveBeenCalled()
    d = await onA('phone', false)
    expect(d.canVibrate).toBe(false)
    expect(() => d.haptic('level')).not.toThrow()
  })

  it('felt with its sound: work done a tick, coins in a double, a thing bought firmer, a gift a roll, a level the strongest; the farm’s own sounds none', async () => {
    const d = await onA('phone')
    d.useSettings.getState().update({ vibration: true })
    const felt = (...args: Parameters<typeof d.farmSound>) => {
      d.vibrate.mockClear()
      d.farmSound(...args)
      return d.vibrate.mock.calls[0]?.[0] ?? null
    }
    for (const s of ['plant', 'water', 'harvest', 'milk', 'shear'] as const) expect(felt(s), s).toEqual(d.HAPTICS.tick)
    expect(felt('coins')).toEqual(d.HAPTICS.sale)
    expect(felt('till')).toEqual(d.HAPTICS.sale)
    expect(felt('build')).toEqual(d.HAPTICS.buy)
    expect(felt('surprise')).toEqual(d.HAPTICS.gift)
    // each action's own sound keeps the map's meaning: work a tick, coins out firmer, lifted and put down, a "no" none
    for (const s of ['pick', 'sack', 'bolt', 'tray', 'crate', 'shelf'] as const) expect(felt(s), s).toEqual(d.HAPTICS.tick)
    expect(felt('pay')).toEqual(d.HAPTICS.buy)
    expect(felt('lift')).toEqual(d.HAPTICS.lift)
    expect(felt('thud')).toEqual(d.HAPTICS.drop)
    expect(felt('nope')).toBeNull()
    expect(felt('level')).toEqual(d.HAPTICS.level)
    for (const s of ['cluck', 'moo', 'baa', 'crow', 'bell', 'ding', 'chug', 'xp', 'creak', 'loom', 'garment', 'chime'] as const) expect(felt(s), s).toBeNull()
    // a sound both the farm and the player make is felt where the call says so (the hens collected), or not at all
    expect(felt('cluck', 0, 1, 'tick')).toEqual(d.HAPTICS.tick)
    expect(felt('coins', 0, 1, null)).toBeNull()
  })
})
