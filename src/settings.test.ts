// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The player's settings (src/settings.ts: their own store, `3d-home:settings:v1`, merged with the defaults; never the
// farm's save) as a page loads them: the effects' and ambience's volumes under the main one (src/audio/mix.ts), and
// less motion (the one reader, src/ui/still.ts, driven by the setting).

const KEY = '3d-home:settings:v1'

/** The settings as a page that finds `stored` in its storage loads them, on a device that asks for less motion or not,
 *  with the one reader of less motion that page has. */
async function loaded(stored?: object, deviceAsks = false) {
  vi.resetModules()
  localStorage.clear()
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: deviceAsks && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))
  if (stored) localStorage.setItem(KEY, JSON.stringify(stored))
  const settings = await import('./settings')
  const still = await import('./ui/still')
  return { ...settings, ...still }
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

const marked = () => document.documentElement.dataset.motion === 'less'

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

describe('less motion', () => {
  it('starts left to the device: still where it asks, with walking sway off; moving where it does not', async () => {
    let s = await loaded()
    expect(s.DEFAULT_SETTINGS.motion).toBe('device')
    expect([s.lessMotion(), s.useSettings.getState().headBob, marked()]).toEqual([false, true, false])
    s = await loaded(undefined, true)
    expect([s.lessMotion(), s.useSettings.getState().headBob, s.DEFAULT_SETTINGS.headBob, marked()]).toEqual([true, false, false, true])
  })

  it('chosen in the game, stills or moves whatever the device says, walking sway with it, and is kept', async () => {
    let s = await loaded()
    s.useSettings.getState().update({ motion: 'less' })
    expect([s.lessMotion(), s.useSettings.getState().headBob, marked()]).toEqual([true, false, true])
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ motion: 'less', headBob: false })
    // sway turned on again by hand stays on, still
    s.useSettings.getState().update({ headBob: true })
    expect([s.lessMotion(), s.useSettings.getState().headBob]).toEqual([true, true])
    // a reload: still, from the first frame
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    s = await loaded(stored)
    expect([s.lessMotion(), marked()]).toEqual([true, true])
    // full motion on a device that asks for less: it moves (the player's choice wins), sway on again
    s = await loaded({ ...stored, headBob: false }, true)
    expect(s.lessMotion()).toBe(true)
    s.useSettings.getState().update({ motion: 'full' })
    expect([s.lessMotion(), s.useSettings.getState().headBob, marked()]).toEqual([false, true, false])
    // a change that sets sway too keeps the sway it set
    s.useSettings.getState().update({ motion: 'less', headBob: true })
    expect([s.lessMotion(), s.useSettings.getState().headBob]).toEqual([true, true])
  })

  it('goes back to the device with Reset to defaults, and an older or garbled stored object is left to it', async () => {
    let s = await loaded({ motion: 'less', headBob: false })
    expect(s.lessMotion()).toBe(true)
    s.useSettings.getState().reset()
    expect([s.useSettings.getState().motion, s.lessMotion(), marked()]).toEqual(['device', false, false])
    s = await loaded({ sound: true, volume: 0.4, headBob: false })
    expect([s.useSettings.getState().motion, s.useSettings.getState().headBob, s.lessMotion()]).toEqual(['device', false, false])
    s = await loaded({ motion: 'sometimes' }, true)
    expect([s.useSettings.getState().motion, s.lessMotion()]).toEqual(['device', true])
    s.useSettings.getState().update({ fov: 80 })
    expect(JSON.parse(localStorage.getItem(KEY)!).motion).toBe('device')
  })
})

describe('what the player has learnt of the controls', () => {
  it('an older stored object loads with nothing learnt (each is taught once), the rest as it was', async () => {
    const { useSettings, DEFAULT_SETTINGS } = await loaded({ sound: true, volume: 0.4 })
    expect(DEFAULT_SETTINGS.learnt).toEqual({ stick: false, look: false })
    expect(useSettings.getState().learnt).toEqual({ stick: false, look: false })
    expect(useSettings.getState().volume).toBe(0.4)
  })

  it('is kept once done, each on its own, survives a reload, and Reset to defaults keeps it', async () => {
    let s = await loaded()
    s.learn('stick')
    expect(JSON.parse(localStorage.getItem(KEY)!).learnt).toEqual({ stick: true, look: false })
    s = await loaded(JSON.parse(localStorage.getItem(KEY)!))
    expect(s.useSettings.getState().learnt).toEqual({ stick: true, look: false })
    s.learn('look')
    s.useSettings.getState().reset()
    expect(s.useSettings.getState().learnt).toEqual({ stick: true, look: true })
    expect(JSON.parse(localStorage.getItem(KEY)!).learnt).toEqual({ stick: true, look: true })
  })

  it('a garbled record is nothing learnt', async () => {
    const s = await loaded({ learnt: { stick: 'yes', look: 1 } })
    expect(s.useSettings.getState().learnt).toEqual({ stick: false, look: false })
  })
})
