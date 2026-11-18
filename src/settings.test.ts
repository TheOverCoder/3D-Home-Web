// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The player's settings (src/settings.ts: their own store, `3d-home:settings:v1`, merged with the defaults; never the
// farm's save) as a page loads them: the effects' and ambience's volumes under the main one (src/audio/mix.ts).

const KEY = '3d-home:settings:v1'

/** The settings as a page that finds `stored` in its storage loads them. */
async function loaded(stored?: object) {
  vi.resetModules()
  localStorage.clear()
  if (stored) localStorage.setItem(KEY, JSON.stringify(stored))
  return import('./settings')
}

beforeEach(() => localStorage.clear())

describe('the volumes', () => {
  it('start full for effects and ambience, so nothing changes for anyone until they move them', async () => {
    const { DEFAULT_SETTINGS, useSettings } = await loaded()
    expect(DEFAULT_SETTINGS.effectsVolume).toBe(1)
    expect(DEFAULT_SETTINGS.ambienceVolume).toBe(1)
    expect(useSettings.getState().effectsVolume).toBe(1)
  })

  it('load an older stored object (from before them) with them full, and keep the rest as it was', async () => {
    const { useSettings } = await loaded({ sound: true, volume: 0.4, music: false, musicVolume: 0.3 })
    const s = useSettings.getState()
    expect([s.effectsVolume, s.ambienceVolume]).toEqual([1, 1])
    expect([s.volume, s.music, s.musicVolume]).toEqual([0.4, false, 0.3])
  })

  it('are kept between 0 and 1 (anything else full), and survive a reload', async () => {
    let { useSettings } = await loaded()
    useSettings.getState().update({ effectsVolume: 0.35, ambienceVolume: 0.6 })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ effectsVolume: 0.35, ambienceVolume: 0.6 })
    useSettings.getState().update({ effectsVolume: 2, ambienceVolume: -1 })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ effectsVolume: 1, ambienceVolume: 0 })
    useSettings.getState().update({ effectsVolume: Number.NaN, ambienceVolume: 0.25 })
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored).toMatchObject({ effectsVolume: 1, ambienceVolume: 0.25 })
    ;({ useSettings } = await loaded(stored))
    expect(useSettings.getState().ambienceVolume).toBe(0.25)
  })
})
