// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AGENT_SEAT } from '../data/estate'
import { useHome } from '../store'
import { DAY, ESTATE, LANE_ENDS, VISITOR, WALK_Z, XP_FOR } from './data'
import { agentBackIn, agentHere, buyApartment, driveTo, estateAgentNow, estateOpen, estateOpensIn, farm, freezeDay, resetFarm, setHour } from './state'
import { agentComes, agentLeaves, scriptSeconds } from './script'
import { levelPay, savedNow, startFrom } from './testSaves'

// The estate office by the market (src/farm/state.ts; the hours in src/farm/day.ts, HOURS.estate): the agent walks in
// from the lane as it opens at eight, sits at his desk until four, waves and walks out; the house is bought from him at
// his desk for its price, once, and the save keeps it; then the car drives you there.

beforeEach(() => {
  localStorage.clear()
  resetFarm()
  freezeDay(true)
})
afterEach(() => {
  freezeDay(false)
})

const HOUR = DAY.length / 24
const COMES = scriptSeconds(LANE_ENDS[0], WALK_Z, agentComes(), VISITOR.speed)
const GOES = scriptSeconds(AGENT_SEAT.x, AGENT_SEAT.z, agentLeaves(), VISITOR.speed)

describe('the estate agent keeps the office’s hours', () => {
  it('away before eight; walks in from the lane’s west end as it opens; at his desk, sitting, until four', () => {
    expect(COMES).toBeGreaterThan(20)
    expect(COMES).toBeLessThan(HOUR)
    // the small hours, and just before eight: away, the office shut
    for (const h of [24 + 3, 24 + 7.99]) {
      setHour(h)
      expect([estateOpen(), agentHere(), estateAgentNow()], `${h}`).toEqual([false, false, null])
    }
    expect(estateOpensIn()).toBeCloseTo(0.01 * HOUR, 5)
    expect(agentBackIn()).toBeCloseTo(0.01 * HOUR + COMES, 5)
    // eight: the door opens; he is on his way, from the lane's west end
    setHour(24 + 8)
    expect([estateOpen(), agentHere()]).toEqual([true, false])
    expect(estateAgentNow()).toMatchObject({ x: LANE_ENDS[0], z: WALK_Z })
    setHour(24 + 8 + 2 / HOUR)
    expect(estateAgentNow()?.walking).toBe(true)
    expect(estateAgentNow()!.x).toBeGreaterThan(LANE_ENDS[0])
    expect(agentBackIn()).toBeCloseTo(COMES - 2, 5)
    // at his desk once the walk is done: sitting in his chair, facing the door
    setHour(24 + 8 + (COMES + 0.01) / HOUR)
    expect(agentHere()).toBe(true)
    expect(estateAgentNow()).toMatchObject({ x: AGENT_SEAT.x, z: AGENT_SEAT.z, walking: false, pose: 'sit' })
    for (const h of [24 + 9, 24 + 12, 24 + 15.99]) {
      setHour(h)
      expect([agentHere(), agentBackIn(), estateAgentNow()?.pose], `${h}`).toEqual([true, 0, 'sit'])
    }
  })

  it('at four the office shuts: he waves, walks out to the lane and is gone; back the next morning after his walk', () => {
    setHour(16)
    expect([estateOpen(), agentHere()]).toEqual([false, false])
    expect(estateAgentNow()?.pose).toBe('wave')
    setHour(16 + 10 / HOUR)
    const out = estateAgentNow()
    expect(out?.walking).toBe(true)
    setHour(16 + (GOES + 0.01) / HOUR)
    expect(estateAgentNow()).toBeNull()
    expect(agentBackIn()).toBeCloseTo(16 * HOUR - GOES - 0.01 + COMES, 4)
    setHour(20)
    expect(estateOpensIn()).toBeCloseTo(12 * HOUR, 5)
  })
})

describe('buying the house', () => {
  it('refuses without the coins, out of hours and on his walk in; buys at his desk for its price, with XP, a word and the save', () => {
    setHour(12)
    farm.coins = ESTATE.price - 1
    expect(buyApartment()).toBe(false)
    expect([farm.coins, farm.apartment.owned]).toEqual([ESTATE.price - 1, false])
    farm.coins = ESTATE.price + 50
    // at night and on his way in: not at his desk
    setHour(21)
    expect(buyApartment()).toBe(false)
    setHour(24 + 8 + 1 / HOUR)
    expect(buyApartment()).toBe(false)
    expect([farm.coins, farm.apartment.owned]).toEqual([ESTATE.price + 50, false])
    // at his desk
    setHour(24 + 12)
    const xp = farm.xp.points
    const paid = farm.xp.paid
    expect(buyApartment()).toBe(true)
    // (its XP reaches a level: that level's coins came in by themselves)
    expect([farm.coins - levelPay(paid), farm.apartment.owned]).toEqual([50, true])
    expect(farm.xp.points).toBe(xp + XP_FOR.home)
    expect(useHome.getState().toast?.text).toBe('The house is yours')
    // once: a second press spends nothing
    farm.coins = 10_000
    expect(buyApartment()).toBe(false)
    expect(farm.coins).toBe(10_000)
    // the save keeps it, loaded the way the page starts
    const saved = savedNow()
    expect(saved.apartment).toEqual({ owned: true })
    resetFarm()
    expect(farm.apartment.owned).toBe(false)
    startFrom(saved)
    expect([farm.apartment.owned, farm.place]).toEqual([true, 'farm'])
  })

  it('then the car drives you to the house and back; before, it does not', () => {
    expect(driveTo('home')).toBe(false)
    setHour(12)
    farm.coins = ESTATE.price
    expect(buyApartment()).toBe(true)
    expect(driveTo('home')).toBe(true)
    expect(farm.place).toBe('home')
    expect(driveTo('farm')).toBe(true)
    expect(farm.place).toBe('farm')
  })
})
