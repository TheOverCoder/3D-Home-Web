import { describe, expect, it } from 'vitest'
import { makeProfile, PHONE_WEATHER_MOST, type DeviceClass } from './profile'

// What each device gets (src/lib/profile.ts): here the weather's share (src/fx/quarks.ts, `weatherFx`). The budget
// (tests/e2e/05) measures the heaviest weather with the most a phone draws.

const DEVICES: DeviceClass[] = ['phone', 'tablet', 'desktop']

describe('the weather a device draws', () => {
  it('a higher tier draws as many drops as a lower one or more, and light graphics the fewest', () => {
    for (const device of DEVICES)
      for (const low of [false, true]) {
        const w = makeProfile(device, low, false).weather
        expect(w.low, device).toBeGreaterThan(0)
        expect(w.low, device).toBeLessThanOrEqual(w.medium)
        expect(w.medium, device).toBeLessThanOrEqual(w.high)
        const light = makeProfile(device, low, true).weather
        for (const tier of ['low', 'medium', 'high'] as const) expect(light[tier], `${device} light ${tier}`).toBeLessThanOrEqual(w.low)
      }
  })

  it('a phone draws no more than the budget measures, on any tier', () => {
    for (const device of ['phone', 'tablet'] as const)
      for (const tier of ['low', 'medium', 'high'] as const) expect(makeProfile(device, false, false).weather[tier]).toBeLessThanOrEqual(PHONE_WEATHER_MOST)
    // the mission's counts: a phone on Medium 2,000 drops, on Low 1,000, in light graphics 600
    expect(makeProfile('phone', false, false).weather.medium).toBe(2000)
    expect(makeProfile('phone', true, false).weather.low).toBe(1000)
    expect(makeProfile('phone', false, true).weather.medium).toBe(600)
  })
})
