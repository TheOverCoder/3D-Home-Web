/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, bootApp } from './helpers'

test.describe('settings', () => {
  test('Esc opens the drawer; a toggle persists across reload', async ({ game }) => {
    await game.ready()
    const { page } = game
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().settingsOpen === true, null, { timeout: 30_000 })
    const toggle = page.locator('#set-cinema')
    await expect(toggle).toBeVisible()
    const was = (await toggle.getAttribute('aria-checked')) === 'true'
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', String(!was))
    const stored = await page.evaluate(() => localStorage.getItem('3d-home:settings:v1'))
    expect(JSON.parse(stored!).cinema).toBe(!was)

    await bootApp(page) // loads the page afresh
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => (window as any).__home.useHome.getState().settingsOpen === true, null, { timeout: 30_000 })
    await expect(page.locator('#set-cinema')).toHaveAttribute('aria-checked', String(!was))

    // restore the default so later tests start clean
    await page.locator('#set-cinema').click()
    await expect(page.locator('#set-cinema')).toHaveAttribute('aria-checked', String(was))
  })

  test('three volumes: effects and ambience under the main one set their buses and persist; the drawer steps the room tone back', async ({ game }) => {
    await game.ready()
    const { page } = game
    const audio = () => page.evaluate(() => (window as any).__home.audio())
    const drawer = (open: boolean) => page.waitForFunction((open) => (window as any).__home.useHome.getState().settingsOpen === open, open, { timeout: 30_000 })
    // a key opens the drawer (and, a gesture, unlocks the sound: browsers start audio only on one)
    await page.keyboard.press('Escape')
    await drawer(true)
    await page.waitForFunction(() => (window as any).__home.audio?.() != null, null, { timeout: 10_000 })
    // the drawer has your attention: the room tone steps back, the effects and the music do not
    let a = await audio()
    expect(a.buses.amb.duck).toBe(-7)
    expect([a.buses.sfx.duck, a.buses.music.duck]).toEqual([0, 0])
    // effects to 40 % and ambience to 60 % with the keys, as a player can (each step 5 %)
    const slide = async (id: string, to: number) => {
      const el = page.locator(id)
      await el.focus()
      await page.keyboard.press('End')
      for (let v = 100; v > to; v -= 5) await page.keyboard.press('ArrowLeft')
      await expect(el).toHaveValue(String(to))
    }
    await slide('#set-effects', 40)
    await slide('#set-ambience', 60)
    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('3d-home:settings:v1')))!)
    expect([stored.effectsVolume, stored.ambienceVolume]).toEqual([0.4, 0.6])
    a = await audio()
    expect(a.buses.sfx.volume).toBe(0.4)
    expect(a.buses.sfx.gain).toBeCloseTo(0.16, 6)
    expect(a.buses.amb.volume).toBe(0.6)
    expect(a.buses.amb.gain).toBeCloseTo(0.36, 6)
    expect(a.buses.music.volume).toBe(stored.musicVolume)
    expect(a.volume).toBe(stored.volume)

    // a reload keeps them, in the sliders and in the buses
    await bootApp(page)
    await page.keyboard.press('Escape')
    await drawer(true)
    await expect(page.locator('#set-effects')).toHaveValue('40')
    await expect(page.locator('#set-ambience')).toHaveValue('60')
    await page.waitForFunction(() => (window as any).__home.audio?.()?.buses.sfx.volume === 0.4, null, { timeout: 10_000 })

    // back to full (later tests start clean), and the drawer closed (its button: Esc in a slider is the slider's) lets
    // the room tone come again
    await slide('#set-effects', 100)
    await slide('#set-ambience', 100)
    await page.getByRole('button', { name: 'Close (Esc)' }).click()
    await drawer(false)
    a = await audio()
    expect([a.buses.sfx.volume, a.buses.amb.volume, a.buses.amb.duck]).toEqual([1, 1, 0])
  })

  test('less motion: chosen in Settings, nothing flies or animates and walking sway is off; it persists, and off brings motion back', async ({ game }) => {
    // on the farm: its compass opens with a move, and its particles play
    await game.ready('farm')
    const { page } = game
    const drawer = async (open: boolean) => {
      if (open) await page.keyboard.press('Escape')
      else await page.getByRole('button', { name: 'Close (Esc)' }).click()
      await page.waitForFunction((open) => (window as any).__home.useHome.getState().settingsOpen === open, open, { timeout: 30_000 })
    }
    // what moves, read at once: <html data-motion>, the compass strip's opening, the stored choice, walking sway, and
    // whether the particles' engine is up (it goes under less motion)
    const look = () =>
      page.evaluate(() => {
        const strip = document.querySelector('.compass-strip')
        return {
          marked: document.documentElement.dataset.motion === 'less',
          compass: strip ? getComputedStyle(strip).animationName : null,
          motion: JSON.parse(localStorage.getItem('3d-home:settings:v1') ?? '{}').motion ?? 'device',
          sway: (window as any).__home.settings.getState().headBob as boolean,
        }
      })
    const fxUp = (up: boolean) => page.waitForFunction((up) => (window as any).__home.fx?.stats.loaded === up, up, { timeout: 60_000 })
    await fxUp(true)
    expect(await look()).toEqual({ marked: false, compass: 'compass-open', motion: 'device', sway: true })

    await drawer(true)
    const row = page.locator('#set-motion')
    await expect(row).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByText('Follows your device')).toBeVisible()
    await row.click()
    await expect(row).toHaveAttribute('aria-checked', 'true')
    await drawer(false)
    expect(await look()).toEqual({ marked: true, compass: 'none', motion: 'less', sway: false })
    // the particles' engine goes, and an effect asked for starts nothing
    await fxUp(false)
    const started = await page.evaluate(() => {
      const fx = (window as any).__home.fx
      fx.play('water', 0, 0.4, 0)
      return fx.stats.started as number
    })
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => (window as any).__home.fx.stats.started)).toBe(started)

    // a reload keeps it, still from the first frame
    await bootApp(page)
    expect(await look()).toMatchObject({ marked: true, compass: 'none', motion: 'less' })
    await drawer(true)
    await expect(page.locator('#set-motion')).toHaveAttribute('aria-checked', 'true')

    // off: full motion, walking sway back, the particles again
    await page.locator('#set-motion').click()
    await expect(page.locator('#set-motion')).toHaveAttribute('aria-checked', 'false')
    await drawer(false)
    expect(await look()).toEqual({ marked: false, compass: 'compass-open', motion: 'full', sway: true })
    await fxUp(true)
    const before = await page.evaluate(() => {
      const fx = (window as any).__home.fx
      fx.play('water', 0, 0.4, 0)
      return fx.stats.started as number
    })
    await page.waitForFunction((n) => (window as any).__home.fx.stats.started > n, before, { timeout: 30_000, polling: 100 })

    // left to the device again, as later tests expect
    await page.evaluate(() => (window as any).__home.settings.getState().update({ motion: 'device', headBob: true }))
    expect(await look()).toEqual({ marked: false, compass: 'compass-open', motion: 'device', sway: true })
  })
})
