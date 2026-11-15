/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Page } from '@playwright/test'
import { test, expect, type Game } from './helpers'
import { AGENT_SEAT, AGENT_STAND, ESTATE_DOOR, ESTATE_ROOM, PARKING, SALE_BOARD } from '../../src/data/estate'
import { CAR_SPOT } from '../../src/data/maps'
import { DAY, ESTATE, XP_FOR } from '../../src/farm/data'

// The house for sale (src/farm/Estate.tsx, EstatePanel.tsx, src/farm/car): past the garden's gate, the parking lot west
// of it with the car in its bay, and the estate office against the market's west wall, open from 8:00 to 16:00 with its
// agent at his desk. The car's sheet offers the house locked (sold at the estate office, its price, the way there) until
// it is bought: from the agent, at his desk, its price on the card that asks first; then the car offers it, and Drive
// takes you there (`farm.place`). Out of hours the office's door stays shut, and it says when it opens.

const P = Math.PI
const HOUR = DAY.length / 24
/** The yaw that looks from (x, z) towards (tx, tz) (yaw 0 looks north, along −z; π/2 west). */
const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z))
const DOOR = { x: (ESTATE_DOOR.x0 + ESTATE_DOOR.x1) / 2, z: ESTATE_DOOR.z0 }

const state = (page: Page) =>
  page.evaluate(() => {
    const h = (window as any).__home
    const s = h.useHome.getState()
    const p = h.playerState.position
    return {
      at: { x: p.x, z: p.z },
      nearby: s.nearby && { id: s.nearby.id, label: s.nearby.label, verb: s.nearby.icon?.verb },
      status: s.status && { id: s.status.id, label: s.status.label, verb: s.status.icon?.verb, seconds: s.status.icon?.seconds },
      tag: s.tag,
      panel: s.panel?.kind ?? null,
      coins: h.farm.state.coins,
      owned: h.farm.state.apartment.owned,
      place: h.farm.state.place,
      door: h.estate?.door?.(),
    }
  })

/** A new farm at an hour (the clock stopped), with `coins`. */
const reset = (game: Game, hour: number, coins: number) =>
  game.page.evaluate(
    ([hour, coins]) => {
      const f = (window as any).__home.farm
      f.reset()
      f.setHour(hour)
      f.freezeDay(true)
      f.state.coins = coins
      f.useFarm.setState((s: any) => ({ rev: s.rev + 1 }))
    },
    [hour, coins] as const,
  )
const setHour = (page: Page, h: number) =>
  page.evaluate((h) => {
    const f = (window as any).__home.farm
    f.setHour(h)
    f.freezeDay(true)
  }, h)
const panelIs = (game: Game, kind: string | null) =>
  game.page.waitForFunction((kind) => ((window as any).__home.useHome.getState().panel?.kind ?? null) === kind, kind, { timeout: 30_000, polling: 200 })
/** Holds W until the body is past `at` along `axis` (beyond: greater), within a minute (software rendering is slow). */
async function walkUntil(game: Game, axis: 'x' | 'z', beyond: boolean, at: number) {
  await game.page.keyboard.down('KeyW')
  try {
    await game.page.waitForFunction(
      ([axis, beyond, at]) => {
        const v = (window as any).__home.playerState.position[axis] as number
        return beyond ? v > at : v < at
      },
      [axis, beyond, at] as const,
      { timeout: 60_000, polling: 200 },
    )
  } finally {
    await game.page.keyboard.up('KeyW')
  }
}
const nearbyIs = (game: Game, id: string) => game.page.waitForFunction((want) => (window as any).__home.useHome.getState().nearby?.id === want, id, { timeout: 60_000, polling: 250 })

/** On the lane beside the car, looking at it. */
const AT_CAR = { x: CAR_SPOT.farm.x, z: 15.7 }
const atCar = (game: Game) => game.teleport(AT_CAR.x, 1.4, AT_CAR.z, yawTo(AT_CAR.x, AT_CAR.z, CAR_SPOT.farm.x, CAR_SPOT.farm.z), -0.3)
/** In the office before the agent's desk, looking at him. */
const atAgent = (game: Game) => game.teleport(AGENT_STAND.x, 1.4, AGENT_STAND.z, yawTo(AGENT_STAND.x, AGENT_STAND.z, AGENT_SEAT.x, AGENT_SEAT.z), -0.15)

test.describe('the house for sale', () => {
  test('the parking lot west of the gate is the lane: you walk onto it, the car stands in it, its west end holds you in', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, 12, 0)
    // from the lane before the gate, walking west along the fence into the lot (it used to end at x 4.3)
    await game.teleport(5.6, 1.4, 15.1, P / 2, 0)
    await walkUntil(game, 'x', false, 4.0)
    let s = await state(page)
    // in the lot west of the car, nothing puts you back; its west end holds you in
    await game.teleport(PARKING.x0 + 1.2, 1.4, 14.2, P / 2, 0)
    await page.waitForTimeout(2500)
    s = await state(page)
    expect(Math.hypot(s.at.x - (PARKING.x0 + 1.2), s.at.z - 14.2), 'still in the lot').toBeLessThan(0.6)
    await game.hold('KeyW', 2500)
    s = await state(page)
    expect(s.at.x, 'held in at its west end').toBeGreaterThan(PARKING.x0 - 0.1)
    // the car is something you bump into: walking at it from the lane, you stop at its side
    await game.teleport(CAR_SPOT.farm.x, 1.4, 16.0, 0, 0)
    await game.hold('KeyW', 2500)
    s = await state(page)
    expect(s.at.z, 'stopped at the car').toBeGreaterThan(CAR_SPOT.farm.z + 0.8)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("the car's sheet: the house locked — sold at the estate office, its price, the way there — and the farm, where you are", async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, 12, 0)
    await atCar(game)
    await nearbyIs(game, 'car-farm')
    let s = await state(page)
    expect(s.nearby).toMatchObject({ label: 'The car', verb: 'drive' })
    await page.keyboard.press('KeyE')
    await panelIs(game, 'car')
    const sheet = page.locator('.farm-panel')
    await expect(sheet).toContainText('The house is for sale by the market')
    const house = sheet.locator('.farm-shop-item').filter({ hasText: 'The house' })
    await expect(house).toContainText('Estate office')
    await expect(house).toContainText(String(ESTATE.price))
    await expect(house.getByRole('button', { name: /Drive/ })).toHaveCount(0)
    await expect(house.getByRole('button', { name: /estate office/ })).toBeEnabled()
    const farmRow = sheet.locator('.farm-shop-item').filter({ hasText: 'The farm' })
    await expect(farmRow).toContainText('You are here')
    // the way there: the sheet closes and you walk towards the estate agent
    await house.getByRole('button', { name: /estate office/ }).click()
    await panelIs(game, null)
    expect(await page.evaluate(() => (window as any).__home.walk.state().id)).toBe('farm-estate-agent')
    await page.evaluate(() => (window as any).__home.walk.stop('test'))
    s = await state(page)
    expect([s.owned, s.place]).toEqual([false, 'farm'])
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('the office is open at noon (its door opens, the agent at his desk) and shut at night (it says when it opens)', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, 12, 0)
    // noon: at the door it opens; in you go
    await game.teleport(DOOR.x, 1.4, DOOR.z - 1.2, P, 0)
    await page.waitForFunction(() => (window as any).__home.estate.door() === 1, null, { timeout: 30_000, polling: 200 })
    await walkUntil(game, 'z', true, ESTATE_ROOM.z0 + 0.2)
    let s = await state(page)
    await atAgent(game)
    await nearbyIs(game, 'farm-estate-agent')
    s = await state(page)
    expect(s.nearby).toMatchObject({ label: 'Talk to the estate agent', verb: 'talk' })
    expect(await page.evaluate(() => (window as any).__home.farm.estateAgentNow())).toMatchObject({ x: AGENT_SEAT.x, z: AGENT_SEAT.z, pose: 'sit' })
    // night: coming to it along the lane, the door stays shut and the office says when it opens; walking at it, you
    // stay out (just east of its door: the car, out of reach, offers nothing there). (Out of it first: on your way out
    // the door stays open for you until you are clear of it.)
    await game.teleport(9, 1.4, 15, P / 2, 0)
    await page.waitForTimeout(1000)
    await setHour(page, 22)
    const AT_DOOR = { x: DOOR.x + 0.55, z: DOOR.z - 0.5 }
    await game.teleport(AT_DOOR.x, 1.4, AT_DOOR.z, yawTo(AT_DOOR.x, AT_DOOR.z, DOOR.x, DOOR.z + 0.2), 0)
    await page.waitForFunction(() => (window as any).__home.useHome.getState().status?.id === 'farm-estate-door', null, { timeout: 30_000, polling: 200 })
    s = await state(page)
    expect(s.status).toMatchObject({ verb: 'wait', label: expect.stringMatching(/^The estate office opens at 8:00/) })
    expect(s.status!.seconds).toBeCloseTo(10 * HOUR, -1)
    expect(s.nearby).toBeNull()
    await game.hold('KeyW', 3000)
    s = await state(page)
    expect(s.door, 'its door stays shut').toBe(0)
    expect(s.at.z, 'kept out').toBeLessThan(ESTATE_DOOR.z0)
    expect(await page.evaluate(() => (window as any).__home.farm.estateAgentNow())).toBeNull()
    await setHour(page, 12)
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test('bought from the agent with coins, its price on the card that asks first; then the car offers the house, and Drive goes there', async ({ game }) => {
    await game.ready('farm')
    const { page } = game
    await reset(game, 12, ESTATE.price + 300)
    const xp = await page.evaluate(() => (window as any).__home.farm.xpNow().points)
    // the board on the wall carries the house's price tag; G opens the card, and nothing is spent
    await game.teleport(AGENT_STAND.x, 1.4, AGENT_STAND.z, yawTo(AGENT_STAND.x, AGENT_STAND.z, SALE_BOARD.x, SALE_BOARD.z), 0)
    await page.waitForFunction(() => (window as any).__home.useHome.getState().tag?.id === 'farm-estate-board', null, { timeout: 30_000, polling: 200 })
    let s = await state(page)
    expect(s.tag).toMatchObject({ kind: 'price', price: ESTATE.price })
    await page.keyboard.press('KeyG')
    await panelIs(game, 'house-buy')
    expect((await state(page)).coins).toBe(ESTATE.price + 300)
    await page.locator('.farm-panel').getByRole('button', { name: 'Not now' }).click()
    await panelIs(game, null)
    // the agent: E opens his panel, the house's price there opens the card; its Buy arms after a moment
    await atAgent(game)
    await nearbyIs(game, 'farm-estate-agent')
    await page.keyboard.press('KeyE')
    await panelIs(game, 'estate')
    await expect(page.locator('.farm-panel')).toContainText('The house')
    await page
      .locator('.farm-panel')
      .getByRole('button', { name: `Buy the house for ${ESTATE.price} coins` })
      .click()
    await panelIs(game, 'house-buy')
    await page.waitForTimeout(650) // the Buy button arms a moment after the card opens (ARM_MS)
    await page.locator('.farm-panel .farm-buy').click()
    await panelIs(game, null)
    s = await state(page)
    expect([s.owned, s.coins]).toEqual([true, 300])
    expect(await page.evaluate(() => (window as any).__home.farm.xpNow().points)).toBe(xp + XP_FOR.home)
    expect(await page.evaluate(() => (window as any).__home.useHome.getState().toast?.text)).toBe('The house is yours')
    // in the save (written a moment later)
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('3d-home:farm:v1') ?? '{}').apartment?.owned === true, null, { timeout: 30_000, polling: 250 })
    // the agent now says it is yours, and shows the way to the car
    await page.keyboard.press('KeyE')
    await panelIs(game, 'estate')
    await expect(page.locator('.farm-panel')).toContainText('The house is yours')
    await page.evaluate(() => (window as any).__home.useHome.getState().closePanel())
    // the car offers the house: Drive takes you there
    await atCar(game)
    await nearbyIs(game, 'car-farm')
    await page.keyboard.press('KeyE')
    await panelIs(game, 'car')
    const house = page.locator('.farm-panel .farm-shop-item').filter({ hasText: 'The house' })
    await expect(house).toContainText('Yours')
    await house.getByRole('button', { name: /Drive to the house/ }).click()
    await panelIs(game, null)
    await page.waitForFunction(() => (window as any).__home.farm.state.place === 'home', null, { timeout: 30_000, polling: 200 })
    // the house's map comes in, you out of the car on its driveway (src/scene/travel.ts)
    await page.waitForFunction(
      () => {
        const s = (window as any).__home.useHome.getState()
        return s.map === 'home' && s.mapReady && !s.curtain
      },
      null,
      { timeout: 180_000, polling: 250 },
    )
    // and back to the farm, for the specs that follow
    await game.ready('farm')
    expect(await page.evaluate(() => (window as any).__home.farm.state.place)).toBe('farm')
    expect(game.errors, game.errors.join('\n')).toEqual([])
  })

  test("afterwards: today's farm again", async ({ game }) => {
    await game.ready('farm')
    await game.page.evaluate(() => (window as any).__home.farm.reset())
    await game.ready('farm')
  })
})
